import { GameSettings, validateGameSettings } from "../settings/settings.js";
import { wrap } from "../utils/net.js";
import { GameRegistry } from "./gameRegistry.js";
import { parseDiscordInvite } from "../discord/invites.js";
import { MAP_CATALOG, buildMapSettings, isMapLoadable } from "../content/mapCatalog.js";
import { NetworkMessageType, type NetworkError, type NetworkInit, type NetworkItemUsed, type NetworkNewUser, type NetworkPauseRequest, type NetworkPauseState, type NetworkReportMatch, type NetworkReportSubmitted, type NetworkReplayShareCreated, type NetworkShoot, type NetworkTurn, type NetworkUseItem, type NetworkWaitingRoom, type UnTypedNetworkMessage, type WebSocketData } from "./types.js";

export interface ServerSocket {
	data: WebSocketData;
	send(message: string): unknown;
}

export class ServerRuntime {
	private sockets = new Map<string, ServerSocket>();
	private userByConnection = new Map<string, string>();
	private connectionByUser = new Map<string, string>();
	private waitingUsers: Array<{ userId: string; mapPreference?: string }> = [];

	constructor(private readonly games = new GameRegistry()) { }

	public open(socket: ServerSocket): void {
		this.sockets.set(socket.data.connectionId, socket)
	}

	public close(socket: ServerSocket): void {
		const connectionId = socket.data.connectionId
		const userId = this.userByConnection.get(connectionId)
		this.sockets.delete(connectionId)
		this.userByConnection.delete(connectionId)
		if (userId) {
			if (this.connectionByUser.get(userId) === connectionId) this.connectionByUser.delete(userId)
			this.waitingUsers = this.waitingUsers.filter(waiting => waiting.userId !== userId)
			this.games.disconnectUser(userId)
		}
	}

	public message(socket: ServerSocket, rawMessage: string): void {
		const message = parseMessage(rawMessage)
		if (!message) return this.sendError(socket, "Malformed network packet")

		switch (message.type) {
			case NetworkMessageType.LOGIN:
				this.login(socket, message.userid, message.mapPreference)
				return
			case NetworkMessageType.SHOOT:
				this.shoot(socket, message)
				return
			case NetworkMessageType.USE_ITEM:
				this.useItem(socket, message)
				return
			case NetworkMessageType.REMATCH:
				this.rematch(socket)
				return
			case NetworkMessageType.REPORT_MATCH:
				this.reportMatch(socket, message)
				return
			case NetworkMessageType.PAUSE_REQUEST:
				this.pauseRequest(socket, message)
				return
			case NetworkMessageType.CREATE_REPLAY_SHARE:
				this.createReplayShare(socket)
				return
			case NetworkMessageType.PONG:
				socket.send(wrap({ type: NetworkMessageType.PING }))
				return
			case "CREATE_GAME" as unknown as NetworkMessageType:
				this.createCustomGame(socket, (message as any).settings)
				return
			case "DISCORD_JOIN" as unknown as NetworkMessageType:
				this.handleDiscordJoin(socket, (message as any).payload)
				return
			default:
				this.sendError(socket, "Unsupported network packet")
		}
	}

	public matchmakeOnce(): void {
		this.games.evictInactive()
		while (this.waitingUsers.length >= 2) {
			const waiting = this.waitingUsers.splice(0, 2)
			const users = waiting.map(entry => entry.userId)
			const mapId = chooseMap(waiting[0].mapPreference, waiting[1].mapPreference)
			const record = this.games.create(buildMapSettings(mapId, GameSettings), users, mapId)
			for (const user of users) {
				this.games.connectUser(user)
				const socket = this.socketForUser(user)
				if (socket) socket.send(wrap<NetworkInit>({ type: NetworkMessageType.INIT, settings: this.games.settingsForUser(record, user), ruleState: record.ruleState, mapId }))
			}
		}
	}

	public getRegistry(): GameRegistry { return this.games }

	private createReplayShare(socket: ServerSocket): void {
		const userId = this.userByConnection.get(socket.data.connectionId);
		if (!userId) return this.sendError(socket, "Login is required before sharing a replay");
		const result = this.games.createReplayShare(userId);
		if (!result.ok) return this.sendError(socket, result.error);
		socket.send(wrap<NetworkReplayShareCreated>({ type: NetworkMessageType.REPLAY_SHARE_CREATED, token: result.token }));
	}

	private createCustomGame(socket: ServerSocket, rawSettings: unknown): void {
		const userId = this.userByConnection.get(socket.data.connectionId)
		if (!userId) return this.sendError(socket, "Login is required before creating a game")
		try {
			validateGameSettings(rawSettings)
			if (!this.waitingUsers.some(waiting => waiting.userId === userId)) this.waitingUsers.push({ userId })
			if (this.waitingUsers.length >= 2) {
				const users = this.waitingUsers.splice(0, 2).map(waiting => waiting.userId)
				const record = this.games.create(rawSettings, users)
				for (const user of users) {
					this.games.connectUser(user)
					const s = this.socketForUser(user)
					if (s) s.send(wrap<NetworkInit>({ type: NetworkMessageType.INIT, settings: this.games.settingsForUser(record, user), ruleState: record.ruleState }))
				}
			} else {
				socket.send(wrap<NetworkWaitingRoom>({ type: NetworkMessageType.WAITINGROOM }))
			}
		} catch (error) {
			this.sendError(socket, error instanceof Error ? error.message : "Invalid custom game settings")
		}
	}

	private handleDiscordJoin(socket: ServerSocket, payload: unknown): void {
		const userId = this.userByConnection.get(socket.data.connectionId)
		if (!userId) return this.sendError(socket, "Login is required before joining via invite")
		try {
			const invite = parseDiscordInvite(payload)
			const record = this.games.get(invite.gameId)
			if (!record) {
				return this.sendError(socket, "Game not found or expired")
			}
			this.games.connectUser(userId)
			socket.send(wrap<NetworkInit>({ type: NetworkMessageType.INIT, settings: this.games.settingsForUser(record, userId), ruleState: record.ruleState }))
		} catch (error) {
			this.sendError(socket, error instanceof Error ? error.message : "Invalid invite payload")
		}
	}

	private login(socket: ServerSocket, requestedUserId: unknown, mapPreference?: unknown): void {
		const userId = typeof requestedUserId === "string" && requestedUserId.length > 0
			? requestedUserId
			: crypto.randomUUID()
		const connectionId = socket.data.connectionId
		const oldConnection = this.connectionByUser.get(userId)
		if (oldConnection && oldConnection !== connectionId) this.sockets.delete(oldConnection)
		this.userByConnection.set(connectionId, userId)
		this.connectionByUser.set(userId, connectionId)
		if (requestedUserId === undefined) socket.send(wrap<NetworkNewUser>({ type: NetworkMessageType.NEWUSER, userid: userId as NetworkNewUser["userid"] }))
		const record = this.games.connectUser(userId)
		if (record) {
			socket.send(wrap<NetworkInit>({ type: NetworkMessageType.INIT, settings: this.games.settingsForUser(record, userId), ruleState: record.ruleState }))
			return
		}
		const preference = validateMapPreference(mapPreference)
		if (mapPreference !== undefined && !preference) return this.sendError(socket, "Invalid map preference")
		if (!this.waitingUsers.some(waiting => waiting.userId === userId)) this.waitingUsers.push({ userId, mapPreference: preference })
		socket.send(wrap<NetworkWaitingRoom>({ type: NetworkMessageType.WAITINGROOM }))
	}

	private shoot(socket: ServerSocket, message: NetworkShoot): void {
		const userId = this.userByConnection.get(socket.data.connectionId)
		if (!userId) return this.sendError(socket, "Login is required before shooting")
		const result = this.games.submitTurn(userId, message)
		if (!result.ok) return this.sendError(socket, result.error)
		const packet: NetworkTurn = {
			type: NetworkMessageType.TURN,
			sim: result.packet,
			turnNumber: result.record.turnNumber,
			activeTeam: result.record.currentTeam,
			ruleState: result.record.ruleState,
		}
		for (const user of result.record.users) {
			const recipient = this.socketForUser(user)
			if (recipient) recipient.send(wrap(packet))
		}
	}

	private useItem(socket: ServerSocket, message: NetworkUseItem): void {
		const userId = this.userByConnection.get(socket.data.connectionId)
		if (!userId) return this.sendError(socket, "Login is required before using items")
		const result = this.games.submitItemUse(userId, message.actorId, message.itemId, message.target)
		if (!result.ok) return this.sendError(socket, result.error)
		const packet: NetworkItemUsed = {
			type: NetworkMessageType.ITEM_USED,
			actorId: message.actorId,
			itemId: message.itemId,
			target: message.target,
			ruleState: result.record.ruleState,
			players: result.record.handler.toSettings().players,
		}
		for (const user of result.record.users) {
			const recipient = this.socketForUser(user)
			if (recipient) recipient.send(wrap(packet))
		}
	}

	private rematch(socket: ServerSocket): void {
		const userId = this.userByConnection.get(socket.data.connectionId)
		if (!userId) return this.sendError(socket, "Login is required before rematching")
		const result = this.games.rematch(userId)
		if (!result.ok) return this.sendError(socket, result.error)
		for (const user of result.record.users) {
			const recipient = this.socketForUser(user)
			if (recipient) recipient.send(wrap<NetworkInit>({ type: NetworkMessageType.INIT, settings: this.games.settingsForUser(result.record, user), ruleState: result.record.ruleState }))
		}
	}

	private reportMatch(socket: ServerSocket, message: NetworkReportMatch): void {
		const userId = this.userByConnection.get(socket.data.connectionId);
		if (!userId) return this.sendError(socket, "Login is required before reporting");
		const result = this.games.submitMatchReport(userId, message.category, message.text);
		if (!result.ok) return this.sendError(socket, result.error);
		socket.send(wrap<NetworkReportSubmitted>({ type: NetworkMessageType.REPORT_SUBMITTED, reportId: result.reportId }));
	}

	private pauseRequest(socket: ServerSocket, message: NetworkPauseRequest): void {
		const userId = this.userByConnection.get(socket.data.connectionId);
		if (!userId) return this.sendError(socket, "Login is required before pausing");
		const result = this.games.requestPause(userId, message.action);
		if (!result.ok) return this.sendError(socket, result.error);
		const state: NetworkPauseState = { type: NetworkMessageType.PAUSE_STATE, paused: result.paused, waitingForOtherPlayer: result.waitingForOtherPlayer };
		for (const user of result.record.users) this.socketForUser(user)?.send(wrap(state));
	}

	private socketForUser(userId: string): ServerSocket | undefined {
		const connectionId = this.connectionByUser.get(userId)
		return connectionId ? this.sockets.get(connectionId) : undefined
	}

	private sendError(socket: ServerSocket, message: string): void {
		socket.send(wrap<NetworkError>({ type: NetworkMessageType.ERROR, message }))
	}
}

function validateMapPreference(value: unknown): string | undefined {
	if (typeof value !== "string") return undefined;
	const entry = MAP_CATALOG.find(candidate => candidate.id === value);
	return entry?.browserAvailable && isMapLoadable(value) ? value : undefined;
}

function chooseMap(first: string | undefined, second: string | undefined): string {
	return first !== undefined && first === second ? first : "ice-map-v1";
}

function parseMessage(value: string): UnTypedNetworkMessage | undefined {
	try {
		const message: unknown = JSON.parse(value)
		return message && typeof message === "object" && "type" in message ? message as UnTypedNetworkMessage : undefined
	} catch {
		return undefined
	}
}

import { GameSettings } from "../settings/settings.js";
import { wrap } from "../utils/net.js";
import { GameRegistry } from "./gameRegistry.js";
import { parseDiscordInvite } from "../discord/invites.js";
import { FINAL_RELEASE_MAP_IDS, MAP_CATALOG, buildMapSettings, isMapLoadable } from "../content/mapCatalog.js";
import type { MapRepository } from "./mapRepository.js";
import { applyGameMode, getGameModeCatalogEntry } from "../rules/modeCatalog.js";
import { GameState } from "../kore/runtime/types.js";
import { fingerprintAuthoritativeTurn } from "../net/turnStateHash.js";
import { encodeKorePackedInit } from "../net/roastPackedInit.js";
import { RateLimiter } from "./rateLimiter.js";
import { verifyPlayerSession } from "./playerSession.js";
import type { RankedService } from "./rankedService.js";
import { NetworkMessageType, type NetworkError, type NetworkGameEnded, type NetworkInit, type NetworkItemUsed, type NetworkNewUser, type NetworkPauseRequest, type NetworkPauseState, type NetworkPhaseChanged, type NetworkReportMatch, type NetworkReportSubmitted, type NetworkReplayShareCreated, type NetworkShoot, type NetworkSurrendered, type NetworkTurn, type NetworkUseItem, type NetworkWaitingRoom, type UnTypedNetworkMessage, type WebSocketData } from "./types.js";

export interface ServerSocket {
	data: WebSocketData;
	send(message: string | Uint8Array): unknown;
}

export class ServerRuntime {
	private sockets = new Map<string, ServerSocket>();
	private userByConnection = new Map<string, string>();
	private connectionByUser = new Map<string, string>();
	private waitingUsers: Array<{ userId: string; mapPreference?: string; modePreference?: string; friendCode?: string }> = [];
	private readonly packetLimiter = new RateLimiter(120, 60);
	private rankedMatchOrdinal = 0;

	constructor(private readonly games = new GameRegistry(), private readonly maps?: MapRepository, private readonly packedInit = process.env.KORE_ROAST_PACKED_INIT === "1", private readonly playerSessionSecret = process.env.KORE_PLAYER_SESSION_SECRET, private readonly rankedService?: RankedService) { }

	private sendInit(socket: ServerSocket, record: import("./gameRegistry.js").GameRecord, userId: string, mapId?: string, modeId?: string): void { const settings = this.games.settingsForUser(record, userId); if (this.packedInit) socket.send(encodeKorePackedInit(settings, { gameId: record.id, mapId, modeId, ruleState: record.ruleState })); else socket.send(wrap<NetworkInit>({ type: NetworkMessageType.INIT, gameId: record.id, settings, ruleState: record.ruleState, mapId, modeId })); }

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
			this.rankedService?.queue.cancel(userId)
			this.games.disconnectUser(userId)
		}
	}

	public message(socket: ServerSocket, rawMessage: string): void {
		const message = parseMessage(rawMessage)
		if (!message) return this.sendError(socket, "Malformed network packet")
		const limit = this.packetLimiter.consume(this.userByConnection.get(socket.data.connectionId) ?? socket.data.connectionId, Date.now());
		if (!limit.allowed) return this.sendError(socket, `Rate limit exceeded; retry in ${limit.retryAfterMs}ms`);

		switch (message.type) {
			case NetworkMessageType.LOGIN:
				this.login(socket, message.userid, message.sessionToken, message.mapPreference, message.modePreference, message.friendRole, message.friendCode)
				return
			case NetworkMessageType.RANKED_QUEUE_JOIN:
				this.joinRankedQueue(socket, message.region)
				return
			case NetworkMessageType.RANKED_QUEUE_CANCEL:
				this.cancelRankedQueue(socket)
				return
			case NetworkMessageType.SHOOT:
				this.shoot(socket, message)
				return
			case NetworkMessageType.USE_ITEM:
				this.useItem(socket, message)
				return
			case NetworkMessageType.SKIP_PHASE:
				this.skipPhase(socket)
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
			case NetworkMessageType.LEAVE_GAME:
				this.leaveGame(socket)
				return
			case NetworkMessageType.SURRENDER_GAME:
				this.surrenderGame(socket)
				return
			case NetworkMessageType.PONG:
				socket.send(wrap({ type: NetworkMessageType.PING }))
				return
			case "CREATE_GAME" as unknown as NetworkMessageType:
				this.sendError(socket, "Client-supplied game settings are not accepted")
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
		if (this.rankedService) {
			const rankedMatch = this.rankedService.matchmake(Date.now(), this.rankedMatchOrdinal++);
			if (rankedMatch) {
				const users = [rankedMatch.first.playerId, rankedMatch.second.playerId];
				const record = this.maps
					? this.games.createRankedFromApprovedMap(this.maps, rankedMatch.mapId, withMode(GameSettings, "quick-slip-v1"), users, rankedMatch.first.seasonId, rankedMatch.rulesetVersion)
					: this.games.createRanked(withMode(buildMapSettings(rankedMatch.mapId, GameSettings), "quick-slip-v1"), users, rankedMatch.mapId, rankedMatch.first.seasonId, rankedMatch.rulesetVersion);
				for (const user of users) {
					this.games.connectUser(user);
					const socket = this.socketForUser(user);
					if (socket) this.sendInit(socket, record, user, rankedMatch.mapId, record.handler.getSettings()?.gameMode?.id);
				}
			}
		}
		while (this.waitingUsers.length >= 2) {
			const first = this.waitingUsers[0]!;
			const secondIndex = first.friendCode
				? this.waitingUsers.findIndex((candidate, index) => index > 0 && candidate.friendCode === first.friendCode)
				: this.waitingUsers.findIndex((candidate, index) => index > 0 && !candidate.friendCode);
			if (secondIndex < 0) return;
			const waiting = [first, this.waitingUsers[secondIndex]!];
			this.waitingUsers.splice(secondIndex, 1);
			this.waitingUsers.splice(0, 1);
			const users = waiting.map(entry => entry.userId)
			const mapId = this.chooseMap(waiting[0].mapPreference, waiting[1].mapPreference)
			const modeId = this.chooseMode(waiting[0].modePreference, waiting[1].modePreference)
			const record = this.maps
				? this.games.createFromApprovedMap(this.maps, mapId, withMode(GameSettings, modeId), users)
				: this.games.create(withMode(buildMapSettings(mapId, GameSettings), modeId), users, mapId)
			for (const user of users) {
				this.games.connectUser(user)
				const socket = this.socketForUser(user)
				if (socket) this.sendInit(socket, record, user, mapId, record.handler.getSettings()?.gameMode?.id)
			}
		}
	}

	public getRegistry(): GameRegistry { return this.games }

	private createReplayShare(socket: ServerSocket): void {
		const userId = this.userByConnection.get(socket.data.connectionId);
		if (!userId) return this.sendError(socket, "Login is required before sharing a replay");
		const result = this.games.createReplayShare(userId);
		if (!result.ok) return this.sendError(socket, result.error);
		const record = this.games.getForUser(userId);
		if (!record) return this.sendError(socket, "No active game for this user");
		const message = wrap<NetworkReplayShareCreated>({ type: NetworkMessageType.REPLAY_SHARE_CREATED, token: result.token });
		for (const user of record.users) this.socketForUser(user)?.send(message);
	}

	private leaveGame(socket: ServerSocket): void {
		const userId = this.userByConnection.get(socket.data.connectionId);
		if (!userId) return this.sendError(socket, "Login is required before leaving a game");
		const current = this.games.getForUser(userId);
		const players = current?.handler.getEntityManager().serialize();
		const record = this.games.endGameForUser(userId);
		if (!record) return this.sendError(socket, "No active game for this user");
		const ended: NetworkGameEnded = { type: NetworkMessageType.GAME_ENDED, reason: "A player left the game", players };
		for (const user of record.users) this.socketForUser(user)?.send(wrap(ended));
	}

	private surrenderGame(socket: ServerSocket): void {
		const userId = this.userByConnection.get(socket.data.connectionId);
		if (!userId) return this.sendError(socket, "Login is required before surrendering");
		const surrendered = this.games.surrenderGameForUser(userId);
		if (!surrendered) return this.sendError(socket, "No active game for this user");
		const ended: NetworkGameEnded = { type: NetworkMessageType.GAME_ENDED, reason: "A player surrendered", result: surrendered.result, players: surrendered.record.handler.getEntityManager().serialize() };
		for (const user of surrendered.record.users) this.socketForUser(user)?.send(wrap(ended));
		socket.send(wrap<NetworkSurrendered>({ type: NetworkMessageType.SURRENDERED, result: surrendered.result }));
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
			this.sendInit(socket, record, userId, undefined, record.handler.getSettings()?.gameMode?.id)
		} catch (error) {
			this.sendError(socket, error instanceof Error ? error.message : "Invalid invite payload")
		}
	}

	private joinRankedQueue(socket: ServerSocket, region: unknown): void {
		const userId = this.userByConnection.get(socket.data.connectionId);
		if (!userId) return this.sendError(socket, "Login is required before ranked matchmaking");
		if (!this.playerSessionSecret) return this.sendError(socket, "Ranked matchmaking requires configured player sessions");
		if (!this.rankedService || typeof region !== "string" || !/^[a-z]{2,12}$/i.test(region)) return this.sendError(socket, "Ranked matchmaking is unavailable or the region is invalid");
		try {
			this.rankedService.enqueue(userId, this.rankedService.getRating(userId), region.toLowerCase(), Date.now());
			this.sendRankedStatus(socket, true);
		} catch (error) { this.sendError(socket, error instanceof Error ? error.message : "Unable to join ranked queue"); }
	}

	private cancelRankedQueue(socket: ServerSocket): void {
		const userId = this.userByConnection.get(socket.data.connectionId);
		if (!userId || !this.rankedService) return this.sendRankedStatus(socket, false);
		this.rankedService.queue.cancel(userId);
		this.sendRankedStatus(socket, false);
	}

	private sendRankedStatus(socket: ServerSocket, queued: boolean): void {
		socket.send(wrap({ type: NetworkMessageType.RANKED_QUEUE_STATUS, queued, size: this.rankedService?.queue.size() ?? 0 }));
	}

	private login(socket: ServerSocket, requestedUserId: unknown, sessionToken?: unknown, mapPreference?: unknown, modePreference?: unknown, friendRole?: unknown, friendCode?: unknown): void {
		const session = this.playerSessionSecret && typeof sessionToken === "string" ? verifyPlayerSession(sessionToken, this.playerSessionSecret, Date.now()) : undefined;
		if (this.playerSessionSecret && !session) return this.sendError(socket, "A valid player session is required");
		if (session && requestedUserId !== undefined && requestedUserId !== session.userId) return this.sendError(socket, "Player session identity does not match login identity");
		const userId = session?.userId ?? (typeof requestedUserId === "string" && requestedUserId.length > 0
			? requestedUserId
			: crypto.randomUUID())
		const connectionId = socket.data.connectionId
		const oldConnection = this.connectionByUser.get(userId)
		if (oldConnection && oldConnection !== connectionId) this.sockets.delete(oldConnection)
		this.userByConnection.set(connectionId, userId)
		this.connectionByUser.set(userId, connectionId)
		if (requestedUserId === undefined) socket.send(wrap<NetworkNewUser>({ type: NetworkMessageType.NEWUSER, userid: userId as NetworkNewUser["userid"] }))
		const record = this.games.connectUser(userId)
		if (record) {
			this.sendInit(socket, record, userId, undefined, record.handler.getSettings()?.gameMode?.id)
			return
		}
		const preference = this.validateMapPreference(mapPreference)
		if (mapPreference !== undefined && !preference) return this.sendError(socket, "Invalid map preference")
		const selectedMode = this.validateModePreference(modePreference)
		if (modePreference !== undefined && !selectedMode) return this.sendError(socket, "Invalid mode preference")
		let roomCode: string | undefined
		if (friendRole === "create") {
			roomCode = this.createFriendCode()
			socket.send(wrap({ type: NetworkMessageType.FRIEND_ROOM_CREATED, code: roomCode }))
		} else if (friendRole === "join") {
			if (typeof friendCode !== "string" || !/^\d{6}$/.test(friendCode) || !this.waitingUsers.some(waiting => waiting.friendCode === friendCode)) return this.sendError(socket, "Unknown friend join code")
			roomCode = friendCode
		} else if (friendRole !== undefined) return this.sendError(socket, "Invalid friend room role")
		if (!this.waitingUsers.some(waiting => waiting.userId === userId)) this.waitingUsers.push({ userId, mapPreference: preference, modePreference: selectedMode, friendCode: roomCode })
		socket.send(wrap<NetworkWaitingRoom>({ type: NetworkMessageType.WAITINGROOM }))
	}

	private createFriendCode(): string {
		for (;;) {
			const code = String(Math.floor(100000 + Math.random() * 900000));
			if (!this.waitingUsers.some(waiting => waiting.friendCode === code)) return code;
		}
	}

	private validateMapPreference(value: unknown): string | undefined {
		if (typeof value !== "string") return undefined;
		if (this.maps) return this.maps.listApproved().some(map => map.id === value) ? value : undefined;
		return validateMapPreference(value);
	}

	private chooseMap(first?: string, second?: string): string {
		if (this.maps) {
			const approved = this.maps.listApproved();
			if (approved.length === 0) throw new Error("No approved database maps are available");
			return first && first === second && approved.some(map => map.id === first) ? first : approved[0]!.id;
		}
		return chooseMap(first, second);
	}

	private validateModePreference(value: unknown): string | undefined {
		if (typeof value !== "string") return undefined;
		try { return getGameModeCatalogEntry(value).id; } catch { return undefined; }
	}

	private chooseMode(first?: string, second?: string): string {
		return first && first === second ? first : "quick-slip-v1";
	}

	private shoot(socket: ServerSocket, message: NetworkShoot): void {
		const userId = this.userByConnection.get(socket.data.connectionId)
		if (!userId) return this.sendError(socket, "Login is required before shooting")
		const result = this.games.submitTurn(userId, message)
		if (!result.ok) return this.sendError(socket, result.error)
		const gameOver = result.record.handler.getState() === GameState.Game_over;
		const stateHash = fingerprintAuthoritativeTurn({
			players: result.record.handler.getEntityManager().serialize(),
			state: result.record.handler.getState(),
			turnNumber: result.record.turnNumber,
			activeTeam: result.record.currentTeam,
			ruleState: result.record.ruleState,
			matchResult: result.record.handler.getMatchResult(),
		});
		result.record.handler.log("turnPacket.authoritative", { gameId: result.record.id, sequence: result.record.turnNumber, stateHash });
		const packet: NetworkTurn = {
			type: NetworkMessageType.TURN,
			gameId: result.record.id,
			sequence: result.record.turnNumber,
			sim: result.packet,
			turnNumber: result.record.turnNumber,
			activeTeam: result.record.currentTeam,
			ruleState: result.record.ruleState,
			stateHash,
			matchResult: result.record.handler.getMatchResult(),
			gameOver,
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

	private skipPhase(socket: ServerSocket): void {
		const userId = this.userByConnection.get(socket.data.connectionId)
		if (!userId) return this.sendError(socket, "Login is required before skipping a phase")
		const result = this.games.skipPhase(userId)
		if (!result.ok) return this.sendError(socket, result.error)
		const packet: NetworkPhaseChanged = { type: NetworkMessageType.PHASE_CHANGED, ruleState: result.record.ruleState }
		for (const user of result.record.users) this.socketForUser(user)?.send(wrap(packet))
	}

	private rematch(socket: ServerSocket): void {
		const userId = this.userByConnection.get(socket.data.connectionId)
		if (!userId) return this.sendError(socket, "Login is required before rematching")
		const result = this.games.rematch(userId)
		if (!result.ok) return this.sendError(socket, result.error)
		for (const user of result.record.users) {
			const recipient = this.socketForUser(user)
			if (recipient) this.sendInit(recipient, result.record, user, undefined, result.record.handler.getSettings()?.gameMode?.id)
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

function withMode(template: GameSettings, modeId: string): GameSettings {
	const settings = structuredClone(template);
	applyGameMode(settings, modeId);
	return settings;
}

function validateMapPreference(value: unknown): string | undefined {
	if (typeof value !== "string") return undefined;
	const entry = MAP_CATALOG.find(candidate => candidate.id === value);
	return entry?.browserAvailable && FINAL_RELEASE_MAP_IDS.includes(entry.id as typeof FINAL_RELEASE_MAP_IDS[number]) && isMapLoadable(value) ? value : undefined;
}

function chooseMap(first: string | undefined, second: string | undefined): string {
	return first !== undefined && first === second && FINAL_RELEASE_MAP_IDS.includes(first as typeof FINAL_RELEASE_MAP_IDS[number]) ? first : FINAL_RELEASE_MAP_IDS[0];
}

function parseMessage(value: string): UnTypedNetworkMessage | undefined {
	try {
		const message: unknown = JSON.parse(value)
		return message && typeof message === "object" && "type" in message ? message as UnTypedNetworkMessage : undefined
	} catch {
		return undefined
	}
}

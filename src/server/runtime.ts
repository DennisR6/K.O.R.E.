import { GameSettings } from "../settings/settings.js";
import { wrap } from "../utils/net.js";
import { GameRegistry } from "./gameRegistry.js";
import { NetworkMessageType, type NetworkError, type NetworkInit, type NetworkNewUser, type NetworkShoot, type NetworkTurn, type NetworkWaitingRoom, type UnTypedNetworkMessage, type WebSocketData } from "./types.js";

export interface ServerSocket {
	data: WebSocketData;
	send(message: string): unknown;
}

export class ServerRuntime {
	private sockets = new Map<string, ServerSocket>();
	private userByConnection = new Map<string, string>();
	private connectionByUser = new Map<string, string>();
	private waitingUsers: string[] = [];

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
			this.waitingUsers = this.waitingUsers.filter(user => user !== userId)
			this.games.disconnectUser(userId)
		}
	}

	public message(socket: ServerSocket, rawMessage: string): void {
		const message = parseMessage(rawMessage)
		if (!message) return this.sendError(socket, "Malformed network packet")

		switch (message.type) {
			case NetworkMessageType.LOGIN:
				this.login(socket, message.userid)
				return
			case NetworkMessageType.SHOOT:
				this.shoot(socket, message)
				return
			case NetworkMessageType.PONG:
				socket.send(wrap({ type: NetworkMessageType.PING }))
				return
			default:
				this.sendError(socket, "Unsupported network packet")
		}
	}

	public matchmakeOnce(): void {
		this.games.evictInactive()
		while (this.waitingUsers.length >= 2) {
			const users = this.waitingUsers.splice(0, 2)
			const record = this.games.create(GameSettings, users)
			for (const user of users) {
				this.games.connectUser(user)
				const socket = this.socketForUser(user)
				if (socket) socket.send(wrap<NetworkInit>({ type: NetworkMessageType.INIT, settings: this.games.settingsForUser(record, user), ruleState: record.ruleState }))
			}
		}
	}

	public getRegistry(): GameRegistry { return this.games }

	private login(socket: ServerSocket, requestedUserId: unknown): void {
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
		if (!this.waitingUsers.includes(userId)) this.waitingUsers.push(userId)
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

	private socketForUser(userId: string): ServerSocket | undefined {
		const connectionId = this.connectionByUser.get(userId)
		return connectionId ? this.sockets.get(connectionId) : undefined
	}

	private sendError(socket: ServerSocket, message: string): void {
		socket.send(wrap<NetworkError>({ type: NetworkMessageType.ERROR, message }))
	}
}

function parseMessage(value: string): UnTypedNetworkMessage | undefined {
	try {
		const message: unknown = JSON.parse(value)
		return message && typeof message === "object" && "type" in message ? message as UnTypedNetworkMessage : undefined
	} catch {
		return undefined
	}
}

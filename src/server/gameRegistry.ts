import { GameHandler, GameHandlerBuilder } from "../engine/Handler.js";
import { GameState, type EngineSettings, type IInput, type TurnPacket } from "../engine/types.js";
import type { GameSettings } from "../settings/settings.js";
import { GameDatabase, type StoredGame } from "./db.js";

export type GameRecord = {
	id: string;
	handler: GameHandler;
	users: string[];
	teamByUser: Map<string, number>;
	currentTeam: number;
	turnNumber: number;
	resolving: boolean;
	lastAccess: number;
	connectedUsers: Set<string>;
};

export type SubmitTurnResult =
	| { ok: true; record: GameRecord; packet: TurnPacket }
	| { ok: false; error: string };

/**
 * Authoritative games are persisted after creation and every accepted turn.
 * The in-memory handler is a cache and can be rebuilt from its stored settings.
 */
export class GameRegistry {
	private games = new Map<string, GameRecord>();

	constructor(
		private readonly database: GameDatabase = new GameDatabase(),
		private readonly idleTimeoutMs: number = 60_000,
	) { }

	public create(settings: GameSettings, users: string[]): GameRecord {
		if (users.length < 2) throw new Error("A game requires at least two users")
		const id = crypto.randomUUID()
		const gameSettings: GameSettings = {
			...JSON.parse(JSON.stringify(settings)),
			id,
			allTeams: [...users],
			myTeam: [],
		}
		const record = this.createRecord(id, new GameHandlerBuilder().defaultSystems().fromSettings(gameSettings).build(), users, 0, 0)
		this.games.set(id, record)
		this.persist(record)
		return record
	}

	public get(gameId: string): GameRecord | undefined {
		const cached = this.games.get(gameId)
		if (cached) return this.touch(cached)
		return this.load(gameId)
	}

	public getForUser(userId: string): GameRecord | undefined {
		const gameId = this.database.findGameIdForUser(userId)
		return gameId ? this.get(gameId) : undefined
	}

	/** Marks a user's active socket and restores their game if it was evicted. */
	public connectUser(userId: string): GameRecord | undefined {
		const record = this.getForUser(userId)
		if (!record) return undefined
		record.connectedUsers.add(userId)
		return this.touch(record)
	}

	/** Evicts the cached handler immediately when the final connected user leaves. */
	public disconnectUser(userId: string): void {
		const gameId = this.database.findGameIdForUser(userId)
		if (!gameId) return
		const record = this.games.get(gameId)
		if (!record) return
		record.connectedUsers.delete(userId)
		if (record.connectedUsers.size === 0 && !record.resolving) this.games.delete(gameId)
	}

	/** Drops inactive handlers only. Durable SQLite state remains available. */
	public evictInactive(now: number = Date.now()): void {
		for (const [id, record] of this.games) {
			if (!record.resolving && now - record.lastAccess >= this.idleTimeoutMs) this.games.delete(id)
		}
	}

	public isCached(gameId: string): boolean { return this.games.has(gameId) }
	public getDatabase(): GameDatabase { return this.database }

	public settingsForUser(record: GameRecord, userId: string): EngineSettings {
		const team = record.teamByUser.get(userId)
		if (team === undefined) throw new Error("User does not belong to this game")
		const settings = record.handler.toSettings()
		return {
			...settings,
			myTeam: [team],
			allTeams: [...record.users],
			turnNumber: record.turnNumber,
			state: team === record.currentTeam ? GameState.Your_turn : GameState.Opponents_turn,
		}
	}

	public submitTurn(userId: string, input: IInput): SubmitTurnResult {
		const record = this.getForUser(userId)
		if (!record) return { ok: false, error: "No active game for this user" }
		if (record.resolving) return { ok: false, error: "A turn is already resolving" }
		const team = record.teamByUser.get(userId)
		if (team === undefined || team !== record.currentTeam) return { ok: false, error: "It is not your turn" }
		if (!isValidInput(input)) return { ok: false, error: "Invalid shot input" }

		const actor = record.handler.getEntityManager().getEntityById(input.actorId)
		if (!actor || actor.isDead()) return { ok: false, error: "Actor is not active" }
		if (!actor.getTeam().includes(team)) return { ok: false, error: "Actor is not controlled by this user" }

		record.resolving = true
		try {
			const packet = record.handler.resolveTurn(input)
			record.turnNumber++
			record.currentTeam = (record.currentTeam + 1) % record.users.length
			record.handler.setTurnNumber(record.turnNumber)
			this.persist(record)
			return { ok: true, record, packet }
		} finally {
			record.resolving = false
			this.touch(record)
		}
	}

	private load(id: string): GameRecord | undefined {
		const stored = this.database.loadGame(id)
		if (!stored) return undefined
		const handler = new GameHandlerBuilder().defaultSystems().fromSettings(stored.settings).build()
		const record = this.createRecord(stored.id, handler, stored.users, stored.currentTeam, stored.turnNumber)
		this.games.set(id, record)
		return record
	}

	private createRecord(
		id: string,
		handler: GameHandler,
		users: string[],
		currentTeam: number,
		turnNumber: number,
		lastAccess: number = Date.now(),
	): GameRecord {
		return {
			id,
			handler,
			users: [...users],
			teamByUser: new Map(users.map((user, team) => [user, team])),
			currentTeam,
			turnNumber,
			resolving: false,
			lastAccess,
			connectedUsers: new Set(),
		}
	}

	private persist(record: GameRecord): void {
		const game: StoredGame = {
			id: record.id,
			settings: record.handler.toSettings(),
			users: record.users,
			currentTeam: record.currentTeam,
			turnNumber: record.turnNumber,
			updatedAt: Date.now(),
		}
		if (this.database.hasGame(record.id)) this.database.saveGame(game)
		else this.database.createGame(game)
		record.lastAccess = game.updatedAt
	}

	private touch(record: GameRecord): GameRecord {
		record.lastAccess = Date.now()
		return record
	}
}

export function isValidInput(input: IInput): boolean {
	return typeof input.actorId === "string" && input.actorId.length > 0 &&
		Number.isFinite(input.angle) && input.angle >= 0 && input.angle < 360 &&
		Number.isFinite(input.power) && input.power > 0 && input.power <= 10
}

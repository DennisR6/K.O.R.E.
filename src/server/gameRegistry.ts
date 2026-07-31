import { GameHandler, GameHandlerBuilder } from "../engine/Handler.js";
import { type EngineSettings, type IInput, type TurnPacket } from "../engine/types.js";
import { currentTurnMode } from "../rules/defaultGameModes.js";
import { RuleInterpreter } from "../rules/RuleInterpreter.js";
import { RulePhase, type RuleState } from "../rules/types.js";
import { TurnSystem } from "../systems/TurnSystem.js";
import { validateGameSettings, type GameSettings } from "../settings/settings.js";
import { GameDatabase, type StoredGame } from "./db.js";
import { ReplayRecorder } from "../replay/recorder.js";
import type { ReplayDocument } from "../replay/types.js";
import { isValidInput } from "../input/validate.js";
export { isValidInput } from "../input/validate.js";

export type GameRecord = {
	id: string;
	handler: GameHandler;
	users: string[];
	teamByUser: Map<string, number>;
	currentTeam: number;
	turnNumber: number;
	rules: RuleInterpreter;
	ruleState: RuleState;
	resolving: boolean;
	lastAccess: number;
	connectedUsers: Set<string>;
	recorder: ReplayRecorder;
};

export type SubmitTurnResult =
	| { ok: true; record: GameRecord; packet: TurnPacket }
	| { ok: false; error: string };

export type RematchResult =
	| { ok: true; record: GameRecord }
	| { ok: false; error: string };

export type SubmitItemUseResult =
	| { ok: true; record: GameRecord }
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
		validateGameSettings(settings)
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

	public getReplay(gameId: string): ReplayDocument | undefined {
		const record = this.get(gameId)
		return record ? record.recorder.getReplay() : undefined
	}

	public settingsForUser(record: GameRecord, userId: string): EngineSettings {
		const team = record.teamByUser.get(userId)
		if (team === undefined) throw new Error("User does not belong to this game")
		const settings = record.handler.toSettings()
		return {
			...settings,
			myTeam: [team],
			allTeams: [...record.users],
			turnNumber: record.handler.getTurnNumber(),
			activeTeam: record.handler.getActiveTeam(),
			state: TurnSystem.stateForTeam(record.handler.getActiveTeam(), [team]),
		}
	}

	public submitTurn(userId: string, input: IInput): SubmitTurnResult {
		const record = this.getForUser(userId)
		if (!record) return { ok: false, error: "No active game for this user" }
		if (record.resolving) return { ok: false, error: "A turn is already resolving" }
		const team = record.teamByUser.get(userId)
		if (team === undefined || team !== record.handler.getActiveTeam()) return { ok: false, error: "It is not your turn" }
		if (record.ruleState.phase !== RulePhase.Physics) return { ok: false, error: "The game is not in the physics phase" }
		if (!isValidInput(input)) return { ok: false, error: "Invalid shot input" }

		const actor = record.handler.getEntityManager().getEntityById(input.actorId)
		if (!actor || actor.isDead()) return { ok: false, error: "Actor is not active" }
		if (!actor.getTeam().includes(team)) return { ok: false, error: "Actor is not controlled by this user" }

		record.resolving = true
		try {
			record.recorder.recordShoot(input.actorId, input.angle, input.power)
			const packet = record.handler.resolveTurn(input)
			const completedState = record.rules.advancePhase(record.ruleState)
			record.ruleState = record.rules.startNextTurn(completedState, record.users.length)
			record.handler.startTurn(record.ruleState)
			record.currentTeam = record.ruleState.activeTeam
			record.turnNumber = record.ruleState.turnNumber
			this.persist(record)
			return { ok: true, record, packet }
		} finally {
			record.resolving = false
			this.touch(record)
		}
	}

	public submitItemUse(userId: string, actorId: string, itemId: string, target: unknown): SubmitItemUseResult {
		const record = this.getForUser(userId)
		if (!record) return { ok: false, error: "No active game for this user" }
		if (record.resolving) return { ok: false, error: "A turn is already resolving" }
		const team = record.teamByUser.get(userId)
		if (team === undefined || team !== record.handler.getActiveTeam()) return { ok: false, error: "It is not your turn" }
		if (record.ruleState.phase !== RulePhase.Item) return { ok: false, error: "Items may only be used during the item phase" }

		if (typeof actorId !== "string" || !actorId || typeof itemId !== "string" || !itemId) {
			return { ok: false, error: "Invalid item use parameter" }
		}

		const actor = record.handler.getEntityManager().getEntityById(actorId)
		if (!actor || actor.isDead()) return { ok: false, error: "Actor is not active" }
		if (!actor.getTeam().includes(team)) return { ok: false, error: "Actor is not controlled by this user" }

		try {
			record.recorder.recordItemUse(actorId, itemId, target)
			const nextRuleState = record.rules.useItem(record.ruleState)
			record.handler.useItem(actorId, itemId, target)
			record.ruleState = nextRuleState
			record.handler.setRuleState(nextRuleState)
			record.currentTeam = nextRuleState.activeTeam
			record.turnNumber = nextRuleState.turnNumber
			this.persist(record)
			return { ok: true, record }
		} catch (error) {
			return { ok: false, error: error instanceof Error ? error.message : "Invalid item use" }
		}
	}

	public rematch(userId: string): RematchResult {
		const record = this.getForUser(userId)
		if (!record) return { ok: false, error: "No active game for this user" }
		if (!record.teamByUser.has(userId)) return { ok: false, error: "User does not belong to this game" }
		record.handler.rematch()
		record.ruleState = record.rules.initialState(0, 0)
		record.handler.setRuleState(record.ruleState)
		record.currentTeam = 0
		record.turnNumber = 0
		this.persist(record)
		return { ok: true, record }
	}

	private load(id: string): GameRecord | undefined {
		const stored = this.database.loadGame(id)
		if (!stored) return undefined
		const handler = new GameHandlerBuilder().defaultSystems().fromSettings(stored.settings).build()
		handler.setActiveTeam(stored.currentTeam)
		handler.setTurnNumber(stored.turnNumber)
		const record = this.createRecord(stored.id, handler, stored.users, stored.currentTeam, stored.turnNumber, undefined, stored.settings.ruleState, stored.actions)
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
		ruleState?: RuleState,
		actions?: ReplayDocument["actions"],
	): GameRecord {
		const mode = handler.getSettings()?.gameMode ?? currentTurnMode
		const rules = new RuleInterpreter(mode)
		const recorder = new ReplayRecorder(handler.toSettings(), 12345, actions ?? [])
		return {
			id,
			handler,
			users: [...users],
			teamByUser: new Map(users.map((user, team) => [user, team])),
			currentTeam,
			turnNumber,
			rules,
			ruleState: ruleState ?? rules.initialState(currentTeam, turnNumber),
			resolving: false,
			lastAccess,
			connectedUsers: new Set(),
			recorder,
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
			actions: record.recorder.getReplay().actions,
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

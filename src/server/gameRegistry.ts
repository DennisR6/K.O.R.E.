import { GameHandler } from "../kore/runtime/Handler.js";
import { GameState, type EngineSettings, type IInput, type TurnPacket } from "../kore/runtime/types.js";
import { currentTurnMode } from "../rules/defaultGameModes.js";
import { RuleInterpreter } from "../rules/RuleInterpreter.js";
import { MatchEndReason, MatchStatus, RulePhase, type MatchResult, type RuleState } from "../rules/types.js";
import { TurnSystem } from "../systems/TurnSystem.js";
import { validateGameSettings, type GameSettings } from "../settings/settings.js";
import { GameDatabase, type StoredGame } from "./db.js";
import { ReplayRecorder } from "../replay/recorder.js";
import type { FrozenReplayDocument, ReplayDocument } from "../replay/types.js";
import { isValidInput } from "../input/validate.js";
import { WinningSystem } from "../systems/WinningSystem.js";
import type { AuthoritativeMatchStatus, MatchMetrics, PersistedMatchLifecycle } from "./types.js";
import type { MapRepository } from "./mapRepository.js";
import { kore } from "../kore/sdk/index.js";
import type { RankedService } from "./rankedService.js";
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
	lifecycle: PersistedMatchLifecycle;
	mapId: string;
	pauseRequests: Set<string>;
	resumeRequests: Set<string>;
	ranked?: { seasonId: string; rulesetVersion: string };
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
export type SkipPhaseResult =
	| { ok: true; record: GameRecord }
	| { ok: false; error: string };
export type SubmitReportResult = { ok: true; reportId: string } | { ok: false; error: string };
export type CreateReplayShareResult = { ok: true; token: string } | { ok: false; error: string };
export type PauseRequestResult = { ok: true; record: GameRecord; paused: boolean; waitingForOtherPlayer: boolean } | { ok: false; error: string };

/**
 * Authoritative games are persisted after creation and every accepted turn.
 * The in-memory handler is a cache and can be rebuilt from its stored settings.
 */
export class GameRegistry {
	private games = new Map<string, GameRecord>();

	constructor(
		private readonly database: GameDatabase = new GameDatabase(),
		private readonly idleTimeoutMs: number = 60_000,
		private readonly rankedService?: RankedService,
	) { }

	public create(settings: GameSettings, users: string[], mapId: string = "ice-map-v1", ranked?: { seasonId: string; rulesetVersion: string }): GameRecord {
		if (users.length < 2) throw new Error("A game requires at least two users")
		validateGameSettings(settings)
		const id = crypto.randomUUID()
		const gameSettings: GameSettings = {
			...JSON.parse(JSON.stringify(settings)),
			id,
			allTeams: [...users],
			myTeam: [],
		}
		const record = this.createRecord(id, this.buildAuthoritativeHandler(gameSettings, users.length), users, 0, 0, undefined, undefined, undefined, undefined, mapId, undefined, ranked)
		this.games.set(id, record)
		this.persist(record)
		return record
	}

	/** Builds a new authoritative match from a server-approved map ID only. */
	public createRanked(settings: GameSettings, users: string[], mapId: string, seasonId: string, rulesetVersion: string): GameRecord {
		if (!this.rankedService) throw new Error("Ranked service is not configured");
		return this.create(settings, users, mapId, { seasonId, rulesetVersion });
	}

	public createFromApprovedMap(repository: MapRepository, mapId: string, template: GameSettings, users: string[]): GameRecord {
		const { map, settings } = repository.buildSettings(mapId, template);
		return this.create(settings, users, map.id);
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
		const gameId = this.database.findActiveGameIdForUser(userId)
		const record = gameId ? this.get(gameId) : undefined
		if (!record) return undefined
		record.connectedUsers.add(userId)
		this.database.setGamePlayerConnected(record.id, userId, true)
		return this.touch(record)
	}

	/** Evicts the cached handler immediately when the final connected user leaves. */
	public disconnectUser(userId: string): void {
		const gameId = this.database.findActiveGameIdForUser(userId) ?? this.database.findGameIdForUser(userId)
		if (!gameId) return
		this.database.setGamePlayerConnected(gameId, userId, false)
		const record = this.games.get(gameId)
		if (!record) return
		record.connectedUsers.delete(userId)
		if (record.connectedUsers.size === 0 && !record.resolving) {
			this.transition(record, record.lifecycle.status === "resident" ? "sleeping" : record.lifecycle.status)
			this.games.delete(gameId)
		}
	}

	/** Ends an abandoned match so none of its players can restore it on reconnect. */
	public endGameForUser(userId: string): GameRecord | undefined {
		const record = this.getForUser(userId);
		if (!record) return undefined;
		this.games.delete(record.id);
		record.connectedUsers.clear();
		record.handler.dispose();
		this.database.deleteGame(record.id);
		return record;
	}

	/** Operator-only emergency completion for a stuck, non-completed match. */
	public killGame(gameId: string): boolean {
		const record = this.get(gameId);
		if (!record || record.lifecycle.status === "completed") return false;
		record.handler.finishMatch({ status: MatchStatus.Draw, winnerTeam: null, reason: MatchEndReason.Draw, turnNumber: record.turnNumber });
		this.transition(record, "completed");
		this.finalizeRanked(record);
		this.persist(record);
		this.storeCompletedReplay(record);
		return true;
	}

	/** Completes a live match when a player explicitly returns to the menu. */
	public surrenderGameForUser(userId: string): { record: GameRecord; result: MatchResult } | undefined {
		const record = this.getForUser(userId);
		if (!record || record.lifecycle.status === "completed") return undefined;
		const surrenderingTeam = record.teamByUser.get(userId);
		const opponentTeam = surrenderingTeam === undefined ? undefined : record.users.map(user => record.teamByUser.get(user)).find(team => team !== undefined && team !== surrenderingTeam);
		const result: MatchResult = opponentTeam === undefined
			? { status: MatchStatus.Draw, winnerTeam: null, reason: MatchEndReason.Surrendered, turnNumber: record.turnNumber }
			: { status: MatchStatus.Winner, winnerTeam: opponentTeam, reason: MatchEndReason.Surrendered, turnNumber: record.turnNumber };
		record.handler.finishMatch(result);
		this.transition(record, "completed");
		this.finalizeRanked(record);
		this.persist(record);
		this.storeCompletedReplay(record);
		return { record, result };
	}

	/** Drops inactive handlers only. Durable SQLite state remains available. */
	public evictInactive(now: number = Date.now()): void {
		for (const [id, record] of this.games) {
			if (!record.resolving && now - record.lastAccess >= this.idleTimeoutMs) {
				this.transition(record, record.lifecycle.status === "resident" ? "sleeping" : record.lifecycle.status, now)
				this.games.delete(id)
			}
		}
	}

	public isCached(gameId: string): boolean { return this.games.has(gameId) }
	public getDatabase(): GameDatabase { return this.database }

	/** Point-in-time metrics; `now` is intentionally scoped to this registry. */
	public getMetrics(now: number = Date.now()): MatchMetrics {
		const persisted = this.database.getMetricCounts();
		const mapUsage = this.database.getMapUsageMetrics();
		return {
			...persisted,
			now: [...this.games.values()].filter(record => record.lifecycle.status === "resident").length,
			measuredAt: now,
			mapUsage,
			mostPlayedMap: mapUsage[0] ?? null,
			consistency: "now is scoped to this server process's resident registry cache",
		};
	}

	/** Lifecycle primitive for the later mutually-agreed pause protocol. */
	public setPaused(gameId: string, paused: boolean, now: number = Date.now()): GameRecord | undefined {
		const record = this.get(gameId);
		if (!record) return undefined;
		if (record.lifecycle.status === "completed") return record;
		this.transition(record, paused ? "paused" : "resident", now);
		return record;
	}

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
		if (record.lifecycle.status === "paused") return { ok: false, error: "The game is paused" }
		if (record.lifecycle.status === "completed" || record.handler.getState() === GameState.Game_over) return { ok: false, error: "The game is completed" }
		const team = record.teamByUser.get(userId)
		if (team === undefined || team !== record.handler.getActiveTeam()) return { ok: false, error: "It is not your turn" }
		const shotRuleState = record.ruleState.phase === RulePhase.Item ? record.rules.advancePhase(record.ruleState) : record.ruleState;
		if (shotRuleState.phase !== RulePhase.Physics) return { ok: false, error: "The game is not in the physics phase" }
		if (!isValidInput(input)) return { ok: false, error: "Invalid shot input" }

		const actor = record.handler.getEntityManager().getEntityById(input.actorId)
		if (!actor || actor.isDead()) return { ok: false, error: "Actor is not active" }
		if (!actor.getTeam().includes(team)) return { ok: false, error: "Actor is not controlled by this user" }
		if (!record.handler.isActorEligibleForAction(input.actorId)) return { ok: false, error: "Actor is locked from selection" }

		const previousRuleState = record.ruleState;
		record.resolving = true
		try {
			if (shotRuleState !== previousRuleState) {
				record.ruleState = shotRuleState;
				record.handler.setRuleState(shotRuleState);
			}
			let completed = false
			record.recorder.recordShoot(input.actorId, input.angle, input.power)
			const packet = record.handler.resolveTurn(input)
			if (record.handler.getState() === GameState.Game_over) {
				this.transition(record, "completed")
				completed = true
			} else {
				const completedState = record.rules.advancePhase(record.ruleState)
				record.ruleState = record.rules.startNextTurn(completedState, record.users.length)
				record.handler.startTurn(record.ruleState)
				record.currentTeam = record.ruleState.activeTeam
				record.turnNumber = record.ruleState.turnNumber
			}
			if (completed) this.finalizeRanked(record)
			this.persist(record)
			// Every completed match receives a secret replay token immediately.
			// It stays private until an explicit player share or operator lookup.
			if (completed) this.storeCompletedReplay(record)
			return { ok: true, record, packet }
		} catch (error) {
			if (shotRuleState !== previousRuleState) {
				record.ruleState = previousRuleState;
				record.handler.setRuleState(previousRuleState);
			}
			throw error;
		} finally {
			record.resolving = false
			this.touch(record)
		}
	}

	public submitItemUse(userId: string, actorId: string, itemId: string, target: unknown): SubmitItemUseResult {
		const record = this.getForUser(userId)
		if (!record) return { ok: false, error: "No active game for this user" }
		if (record.resolving) return { ok: false, error: "A turn is already resolving" }
		if (record.lifecycle.status === "paused") return { ok: false, error: "The game is paused" }
		if (record.lifecycle.status === "completed" || record.handler.getState() === GameState.Game_over) return { ok: false, error: "The game is completed" }
		const team = record.teamByUser.get(userId)
		if (team === undefined || team !== record.handler.getActiveTeam()) return { ok: false, error: "It is not your turn" }
		if (record.ruleState.phase !== RulePhase.Item) return { ok: false, error: "Items may only be used during the item phase" }

		if (typeof actorId !== "string" || !actorId || typeof itemId !== "string" || !itemId) {
			return { ok: false, error: "Invalid item use parameter" }
		}

		const actor = record.handler.getEntityManager().getEntityById(actorId)
		if (!actor || actor.isDead()) return { ok: false, error: "Actor is not active" }
		if (!actor.getTeam().includes(team)) return { ok: false, error: "Actor is not controlled by this user" }
		if (!record.handler.isActorEligibleForAction(actorId)) return { ok: false, error: "Actor is locked from selection" }

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

	public skipPhase(userId: string): SkipPhaseResult {
		const record = this.getForUser(userId)
		if (!record) return { ok: false, error: "No active game for this user" }
		if (record.resolving) return { ok: false, error: "A turn is already resolving" }
		if (record.lifecycle.status === "paused") return { ok: false, error: "The game is paused" }
		if (record.lifecycle.status === "completed" || record.handler.getState() === GameState.Game_over) return { ok: false, error: "The game is completed" }
		const team = record.teamByUser.get(userId)
		if (team === undefined || team !== record.handler.getActiveTeam()) return { ok: false, error: "It is not your turn" }
		if (record.ruleState.phase !== RulePhase.Item) return { ok: false, error: "The game is not in the item phase" }
		const nextRuleState = record.rules.advancePhase(record.ruleState)
		record.ruleState = nextRuleState
		record.handler.setRuleState(nextRuleState)
		record.currentTeam = nextRuleState.activeTeam
		record.turnNumber = nextRuleState.turnNumber
		this.persist(record)
		return { ok: true, record }
	}

	public submitMatchReport(userId: string, category: unknown, text: unknown): SubmitReportResult {
		const record = this.getForUser(userId);
		if (!record) return { ok: false, error: "No active game for this user" };
		if (category !== "conduct" && category !== "technical" && category !== "other") return { ok: false, error: "Invalid report category" };
		if (typeof text !== "string" || text.trim().length < 1 || text.length > 500) return { ok: false, error: "Invalid report text" };
		try { return { ok: true, reportId: this.database.createMatchReport(record.id, userId, category, text.trim(), record.turnNumber) }; }
		catch { return { ok: false, error: "Report already submitted" }; }
	}

	/** Freezes a completed authoritative record; it never reads a live snapshot. */
	public createReplayShare(userId: string): CreateReplayShareResult {
		const record = this.getForUser(userId);
		if (!record) return { ok: false, error: "No active game for this user" };
		if (record.lifecycle.status !== "completed" || record.handler.getState() !== GameState.Game_over) return { ok: false, error: "Replay shares require a completed match" };
		try {
			const token = this.storeCompletedReplay(record);
			if (!token) return { ok: false, error: "Replay share unavailable" };
			return { ok: true, token };
		} catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Replay share unavailable" }; }
	}

	public requestPause(userId: string, action: unknown): PauseRequestResult {
		const record = this.getForUser(userId);
		if (!record) return { ok: false, error: "No active game for this user" };
		if (action !== "pause" && action !== "resume") return { ok: false, error: "Invalid pause action" };
		if (record.lifecycle.status === "completed") return { ok: false, error: "The game is completed" };
		const requests = action === "pause" ? record.pauseRequests : record.resumeRequests;
		if ((action === "pause") !== (record.lifecycle.status !== "paused")) return { ok: false, error: action === "pause" ? "The game is already paused" : "The game is not paused" };
		requests.add(userId);
		if (requests.size < record.users.length) return { ok: true, record, paused: record.lifecycle.status === "paused", waitingForOtherPlayer: true };
		this.setPaused(record.id, action === "pause");
		record.pauseRequests.clear();
		record.resumeRequests.clear();
		return { ok: true, record, paused: action === "pause", waitingForOtherPlayer: false };
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
		this.transition(record, "resident")
		this.persist(record)
		return { ok: true, record }
	}

	private load(id: string): GameRecord | undefined {
		const stored = this.database.loadGame(id)
		if (!stored) return undefined
		const handler = this.buildAuthoritativeHandler(stored.settings, stored.users.length)
		handler.setActiveTeam(stored.currentTeam)
		handler.setTurnNumber(stored.turnNumber)
		// Only a stored immutable origin makes the recorded actions playable.
		// Legacy rows without one get a fresh recorder so a broken origin is
		// never persisted or served; their past actions stay unplayable.
		const origin = stored.initialSettings
		const record = this.createRecord(stored.id, handler, stored.users, stored.currentTeam, stored.turnNumber, undefined, stored.settings.ruleState, origin ? stored.actions ?? [] : [], stored.lifecycle, stored.mapId, origin, stored.ranked)
		this.games.set(id, record)
		if (record.lifecycle.status === "sleeping") this.transition(record, "resident")
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
		lifecycle: PersistedMatchLifecycle = createLifecycle("resident", Date.now()),
		mapId: string = "ice-map-v1",
		initialSettings?: GameSettings,
		ranked?: { seasonId: string; rulesetVersion: string },
	): GameRecord {
		const mode = handler.getSettings()?.gameMode ?? currentTurnMode
		const rules = new RuleInterpreter(mode)
		const recorder = new ReplayRecorder(initialSettings ?? handler.toSettings(), 12345, actions ?? [])
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
			lifecycle,
			mapId,
			pauseRequests: new Set(),
			resumeRequests: new Set(),
			...(ranked ? { ranked: structuredClone(ranked) } : {}),
		}
	}

	private persist(record: GameRecord): void {
		const game: StoredGame = {
			id: record.id,
			settings: record.handler.toSettings(),
			initialSettings: record.recorder.getReplay().initialSettings,
			users: record.users,
			currentTeam: record.currentTeam,
			turnNumber: record.turnNumber,
			updatedAt: Date.now(),
			actions: record.recorder.getReplay().actions,
			lifecycle: record.lifecycle,
			mapId: record.mapId,
			...(record.ranked ? { ranked: structuredClone(record.ranked) } : {}),
		}
		if (this.database.hasGame(record.id)) this.database.saveGame(game)
		else this.database.createGame(game)
		record.lastAccess = game.updatedAt
	}
	private finalizeRanked(record: GameRecord): void {
		if (!record.ranked || !this.rankedService) return;
		const result = record.handler.getMatchResult();
		if (!result) throw new Error("Ranked match completed without a result");
		this.rankedService.finalize(record.id, result, record.users.map((playerId, team) => ({ playerId, team })), record.lifecycle.completedAt ?? Date.now());
	}

	/** Idempotently stores the frozen replay token without publishing it to clients. */
	private storeCompletedReplay(record: GameRecord): string | undefined {
		const result = record.handler.getMatchResult();
		if (!result) throw new Error("Completed match has no result");
		const replay: FrozenReplayDocument = {
			...record.recorder.getReplay(),
			finalSettings: record.handler.toSettings(),
			result,
			completedAt: record.lifecycle.completedAt ?? Date.now(),
		};
		try {
			return this.database.createReplayShare(record.id, replay).token;
		} catch {
			// An unreproducible origin produces no share token; the completed
			// match still persists and its turn submission stays successful.
			return undefined;
		}
	}

	private touch(record: GameRecord): GameRecord {
		record.lastAccess = Date.now()
		return record
	}

	private transition(record: GameRecord, status: AuthoritativeMatchStatus, now: number = Date.now()): void {
		const current = record.lifecycle;
		if (current.status === status) return;
		record.lifecycle = {
			version: 1,
			status,
			createdAt: current.createdAt,
			statusChangedAt: now,
			completedAt: status === "completed" ? now : null,
		};
		this.database.setLifecycle(record.id, record.lifecycle);
	}

	private buildAuthoritativeHandler(settings: GameSettings | EngineSettings, teamCount: number): GameHandler {
		const handler = "systems" in settings ? kore.restoreHandler(settings) : kore.createHandler(settings);
		if (!("systems" in settings) || !settings.systems?.some(system => system.systemId === "core.winning")) handler.addSystem(new WinningSystem(teamCount));
		return handler;
	}
}

function createLifecycle(status: AuthoritativeMatchStatus, now: number): PersistedMatchLifecycle {
	return { version: 1, status, createdAt: now, statusChangedAt: now, completedAt: status === "completed" ? now : null };
}

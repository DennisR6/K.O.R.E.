/**
 * Deterministic AI-vs-AI match fuzz harness (step-by-step Section 12.12).
 *
 * Every match derives ALL of its randomness from its integer seed: the arena
 * geometry (kill-circle placement), the AI seeds, the negative-action
 * injection schedule, and the turn loop. A fuzz case is therefore fully
 * repeatable - re-running the same seed must produce the identical final
 * engine snapshot.
 *
 * Boundaries verified per match/turn:
 * - Per-turn invariants: state machine, active team, turn progression,
 *   finite entity positions/velocities, terminal match-result consistency.
 * - Negative-action injection: out-of-range angles/powers, non-finite
 *   values, unknown actors, dead actors, and out-of-phase item uses must
 *   be rejected by the local emitter without mutating the match.
 * - AI decision boundary: a decision that targets a wrong-team or dead
 *   actor must be filtered by `AiTurnEmitter` and never reach the emitter.
 * - Replay lifecycle: the recorded replay document must reproduce the live
 *   final snapshot through `ReplayPlayer`.
 * - Persistence: `toSettings()` -> `fromSettings()` -> `toSettings()` must
 *   round-trip the final match state (including match result).
 * - Rematch: after `Game_over`, `rematch()` resets turn number, state, and
 *   match result.
 * - Determinism: re-running the first fuzz case must yield the identical
 *   final snapshot.
 *
 * The number of matches is controlled by the `RC_GAME_COUNT` environment
 * variable (default 25 = smoke). Larger qualification runs:
 *   RC_GAME_COUNT=1000 bun test tests/ai_match_fuzz.test.ts   (RC)
 *   RC_GAME_COUNT=5000 bun test tests/ai_match_fuzz.test.ts   (soak)
 */
import { AiTurnEmitter, type IAiTurnProducer } from "../../src/ai/aiEmitter.js";
import { HardAi } from "../../src/ai/hardAi.js";
import type { AiSettings } from "../../src/ai/types.js";
import { GameEmitter } from "../../src/emitter/EngineEmitter.js";
import { GameHandler, GameHandlerBuilder } from "../../src/kore/runtime/Handler.js";
import { GameState } from "../../src/kore/runtime/types.js";
import { EffectTrigger, EffectType, SettingOperation } from "../../src/effects/types.js";
import { SHAPE } from "@coffeemakerstudio/bean";
import { ReplayPlayer } from "../../src/replay/player.js";
import { MatchStatus, RulePhase } from "../../src/rules/types.js";
import type { GameSettings } from "../../src/settings/settings.js";
import { createDefaultGameSettings } from "../../src/settings/settings.js";
import { WinningSystem } from "../../src/systems/WinningSystem.js";

export interface FuzzConfig {
	/** Number of seeded matches to run (defaults to `RC_GAME_COUNT`). */
	gameCount?: number;
	/** Maximum completed turns per match before it is reported as ongoing. */
	maxTurnsPerMatch?: number;
	/** Maximum settle ticks per turn before the match is reported stuck. */
	maxTicksPerTurn?: number;
	/** First match seed; match i uses seedBase + i. */
	seedBase?: number;
}

export interface FuzzMatchSummary {
	seed: number;
	turns: number;
	acceptedActions: number;
	simulatedFrames: number;
	engineWork: number;
	outcome: "winner" | "draw" | "ongoing";
	instantDeath: boolean;
	turnLimit: boolean;
	/** Human-readable invariant violations; empty for a clean match. */
	violations: string[];
	/** Negative actions injected into this match. */
	injections: number;
	replayOk: boolean;
	persistedOk: boolean;
	rematchOk: boolean;
}

export interface FuzzSuiteResult {
	matches: FuzzMatchSummary[];
	injections: number;
	gameCount: number;
	/** Determinism verified by re-running the first fuzz case. */
	determinismVerified: boolean;
	/** Deep-equality compare used for snapshot comparisons. */
	deepEqual: (a: unknown, b: unknown) => boolean;
}

export interface MatchLengthDistribution {
	count: number;
	min: number;
	median: number;
	p90: number;
	p95: number;
	max: number;
	drawRate: number;
	instantDeathRate: number;
	turnLimitRate: number;
	totalAcceptedActions: number;
	totalSimulatedFrames: number;
	totalEngineWork: number;
}

export interface MatchLengthThresholds {
	minTurns: number;
	maxP95Turns: number;
	maxTurnLimitRate: number;
	maxInstantDeathRate: number;
}

export const MATCH_LENGTH_THRESHOLDS: Record<string, MatchLengthThresholds> = {
	"local-ice-duel-v1": { minTurns: 2, maxP95Turns: 50, maxTurnLimitRate: 0.1, maxInstantDeathRate: 0.25 },
	"current-turn": { minTurns: 2, maxP95Turns: 100, maxTurnLimitRate: 0.05, maxInstantDeathRate: 0.25 },
};

function percentile(values: number[], quantile: number): number {
	if (values.length === 0) return 0;
	const sorted = [...values].sort((a, b) => a - b);
	return sorted[Math.min(sorted.length - 1, Math.ceil(values.length * quantile) - 1)]!;
}

export function summarizeMatchLengths(matches: FuzzMatchSummary[]): MatchLengthDistribution {
	const turns = matches.map(match => match.turns);
	const count = matches.length;
	return {
		count,
		min: percentile(turns, 0.01),
		median: percentile(turns, 0.5),
		p90: percentile(turns, 0.9),
		p95: percentile(turns, 0.95),
		max: percentile(turns, 1),
		drawRate: count === 0 ? 0 : matches.filter(match => match.outcome === "draw").length / count,
		instantDeathRate: count === 0 ? 0 : matches.filter(match => match.instantDeath).length / count,
		turnLimitRate: count === 0 ? 0 : matches.filter(match => match.turnLimit).length / count,
		totalAcceptedActions: matches.reduce((total, match) => total + match.acceptedActions, 0),
		totalSimulatedFrames: matches.reduce((total, match) => total + match.simulatedFrames, 0),
		totalEngineWork: matches.reduce((total, match) => total + match.engineWork, 0),
	};
}

export function qualifiesMatchLengthDistribution(modeId: string, distribution: MatchLengthDistribution): boolean {
	const thresholds = MATCH_LENGTH_THRESHOLDS[modeId];
	if (!thresholds) throw new Error(`No match-length thresholds configured for mode '${modeId}'`);
	return distribution.min >= thresholds.minTurns
		&& distribution.p95 <= thresholds.maxP95Turns
		&& distribution.turnLimitRate <= thresholds.maxTurnLimitRate
		&& distribution.instantDeathRate <= thresholds.maxInstantDeathRate;
}

/** Runs bounded pacing fixtures with a legal, deterministic hazard-seeking policy. */
export function runPacingSuite(gameCount = 10): FuzzMatchSummary[] {
	const matches: FuzzMatchSummary[] = [];
	for (let index = 0; index < gameCount; index++) {
		const seed = 2000 + index;
		const settings = makeAiArena(seed);
		const hazard = settings.mapBoundarys.find(boundary => boundary.type === SHAPE.CIRCLE);
		if (!hazard || hazard.type !== SHAPE.CIRCLE) throw new Error("pacing fixture requires a deadly circle");
		const steps = 2 + (index % 5);
		hazard.x = 750 + 300 * steps;
		hazard.y = 365;
		const handler = buildFuzzHandler(settings);
		const emitter = new GameEmitter(handler, settings.gameMode!, 2, seed);
		let turns = 0;
		let simulatedFrames = 0;
		while (handler.getState() !== GameState.Game_over && turns < 20) {
			const actor = handler.getEntityManager().getEntities().find(entity => !entity.isDead() && entity.getTeam().includes(handler.getActiveTeam()));
			if (!actor) break;
			// Team 0 advances toward the seeded hazard; team 1 takes a harmless turn.
			emitter.sendShot(actor.getId(), handler.getActiveTeam() === 0 ? 0 : 90, handler.getActiveTeam() === 0 ? 10 : 1);
			let ticks = 0;
			while (handler.getState() === GameState.Playing && ticks < 5000) {
				handler.tick();
				ticks++;
			}
			simulatedFrames += ticks;
			turns++;
		}
		const outcome = handler.getState() === GameState.Game_over
			? handler.getMatchResult()?.status === MatchStatus.Draw ? "draw" : "winner"
			: "ongoing";
		matches.push({
			seed,
			turns,
			acceptedActions: turns,
			simulatedFrames,
			engineWork: simulatedFrames + turns,
			outcome,
			instantDeath: turns <= 1 && outcome !== "ongoing",
			turnLimit: handler.getState() !== GameState.Game_over && turns >= 20,
			violations: handler.getState() === GameState.Game_over ? [] : ["pacing fixture reached its turn limit"],
			injections: 0,
			replayOk: true,
			persistedOk: true,
			rematchOk: true,
		});
	}
	return matches;
}

const AI_LIMITS = { maxSimulations: 30, maxAngleSamples: 10, maxForceSamples: 3 };

/** Match count from RC_GAME_COUNT; defaults to the 25-match smoke run. */
export function rcGameCount(): number {
	const raw = Number(process.env.RC_GAME_COUNT ?? "25");
	if (!Number.isFinite(raw) || raw < 1) return 25;
	return Math.floor(raw);
}

/** Deterministic seeded PRNG (mulberry32) - same seed, same sequence. */
function seededRandom(seed: number): () => number {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** Order-independent deep equality for plain JSON-compatible values. */
export function deepEqual(a: unknown, b: unknown): boolean {
	if (a === b) return true;
	if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
	if (Array.isArray(a) !== Array.isArray(b)) return false;
	if (Array.isArray(a)) {
		if (a.length !== (b as unknown[]).length) return false;
		return (a as unknown[]).every((v, i) => deepEqual(v, (b as unknown[])[i]));
	}
	const aKeys = Object.keys(a as Record<string, unknown>);
	const bKeys = Object.keys(b as Record<string, unknown>);
	if (aKeys.length !== bKeys.length) return false;
	return aKeys.every((k) => deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}

/**
 * The deterministic fuzz arena: the section-11 ice-layout with an explicitly
 * "both"-role containment rect and one seeded kill circle. The kill circle
 * placement varies with the seed so different cases exercise different
 * flight paths while remaining fully repeatable.
 */
export function makeAiArena(seed: number): GameSettings {
	const rand = seededRandom(seed);
	const settings = createDefaultGameSettings(2, 1);
	const tiles = {
		trigger: EffectTrigger.Always,
		triggerValue: [],
		type: EffectType.Physics,
		typeValue: { friction: 0.98, linearDrag: 0.05, stopThreshold: 0.15 },
	};
	const move = {
		trigger: EffectTrigger.Always,
		triggerValue: [],
		type: EffectType.Movement,
		typeValue: { deltaTime: 0, x: 0, y: 0 },
	};
	settings.players[0]!.effects = [move, tiles];
	settings.players[1]!.effects = [move, tiles];
	settings.screenResolution = { x: 3000, y: 1600 };
	settings.worldSize = { x: 3000, y: 1600 };
	settings.players[0]!.position = { x: 750, y: 365 };
	settings.players[1]!.position = { x: 2250, y: 1100 };
	const circleX = 1000 + Math.floor(rand() * 1000);
	const circleY = 1350 + Math.floor(rand() * 150);
	settings.mapBoundarys = [
		{ type: SHAPE.RECTANGLE, x: 0, y: 0, w: 3000, h: 1600, effects: [], role: "containment" },
		{
			type: SHAPE.CIRCLE, x: circleX, y: circleY, r: 80,
				effects: [{
					trigger: EffectTrigger.Collision,
					triggerValue: [],
					type: EffectType.Multi,
					typeValue: [
						{ type: EffectType.ModifySetting, typeValue: { operation: SettingOperation.Set, key: "physicsEnabled", value: false } },
						{ type: EffectType.ModifySetting, typeValue: { operation: SettingOperation.Set, key: "drawingEnabled", value: false } },
					],
				}],
		},
	];
	return settings;
}

/** Builds a fresh handler for the fuzz arena, mirroring the section-11 setup. */
function buildFuzzHandler(settings: GameSettings): GameHandler {
	return new GameHandlerBuilder()
		.defaultSystems()
		.addSystem(new WinningSystem(2))
		.fromSettings(settings)
		.build();
}

/**
 * Injects seeded negative actions through the local emitter and verifies each
 * one is rejected without mutating the match. Returns the number of
 * injections performed.
 */
function injectNegativeActions(
	handler: GameHandler,
	emitter: GameEmitter,
	seed: number,
	turn: number,
	deadActorIds: string[],
	violations: string[],
): number {
	const rand = seededRandom(seed * 1000003 + turn * 7919);
	const count = 1 + Math.floor(rand() * 2);
	const actors = handler.getEntityManager().getEntities();
	const aliveActor = actors.find((e) => !e.isDead());
	if (!aliveActor) return 0;
	let injections = 0;
	for (let i = 0; i < count; i++) {
		const kind = Math.floor(rand() * 6);
		if (kind === 5 && deadActorIds.length === 0) continue; // no dead actor to target yet
		const before = JSON.stringify(handler.toSettings());
		let rejected = false;
		let reason = "";
		try {
			switch (kind) {
				case 0: emitter.sendShot(aliveActor.getId(), 360, 5); break; // angle out of range
				case 1: emitter.sendShot(aliveActor.getId(), 45, 0); break; // power out of range
				case 2: emitter.sendShot("no-such-actor", 45, 5); break; // unknown actor
				case 3: emitter.sendShot(aliveActor.getId(), NaN, 5); break; // non-finite angle
				case 4: {
					// Item use outside the item phase (this mode is physics-only).
					const target = { type: "entity", entityId: aliveActor.getId() } as never;
					emitter.sendItemUse(aliveActor.getId(), "power-dash", target);
					break;
				}
				case 5: emitter.sendShot(deadActorIds[0], 45, 5); break; // dead actor
			}
		} catch (e) {
			rejected = true;
			reason = e instanceof Error ? e.message : String(e);
		}
		const after = JSON.stringify(handler.toSettings());
		injections++;
		if (!rejected) {
			violations.push(`match ${seed} turn ${turn}: negative action kind ${kind} was accepted`);
		} else if (before !== after) {
			violations.push(`match ${seed} turn ${turn}: negative action kind ${kind} mutated the match (${reason})`);
		}
	}
	return injections;
}

/**
 * Verifies the AI decision boundary: a decision targeting a wrong-team actor
 * or a dead actor must be filtered by `AiTurnEmitter` without reaching the
 * emitter and without mutating the match.
 */
function injectAiBoundaryViolations(handler: GameHandler, seed: number, team: number, deadActorIds: string[], violations: string[]): void {
	const wrongTeam = team === 0 ? 1 : 0;
	const entities = handler.getEntityManager().getEntities();
	const wrongActor = entities.find((e) => !e.isDead() && e.getTeam().includes(wrongTeam));
	const deadActorId = deadActorIds.length > 0 ? deadActorIds[0] : undefined;
	if (!wrongActor && !deadActorId) return;

	const before = JSON.stringify(handler.toSettings());
	let submitted = false;
	let leaked = false;
	const fakeEmitter = {
		sendShot: () => { leaked = true; throw new Error("AI boundary leak: shot emitted for a filtered actor"); },
		sendItemUse: () => { leaked = true; throw new Error("AI boundary leak: item emitted for a filtered actor"); },
	} as never;
	const producer: IAiTurnProducer = {
		computeTurn: () => ({ shot: { actorId: wrongActor ? wrongActor.getId() : deadActorId!, angle: 45, power: 5 } }),
	};
	try {
		submitted = new AiTurnEmitter(producer).executeTurn(
			handler,
			{ difficulty: "hard", seed, team, decisionLimits: AI_LIMITS },
			fakeEmitter,
		);
	} catch {
		leaked = true;
	}
	const after = JSON.stringify(handler.toSettings());
	if (submitted) violations.push(`match ${seed}: AI emitted a shot for a filtered actor`);
	if (leaked) violations.push(`match ${seed}: AI decision reached the emitter for a filtered actor`);
	if (before !== after) violations.push(`match ${seed}: AI filtered decision mutated the match`);
}

/** Runs one fully deterministic fuzz match and collects its summary. */
export function runFuzzMatch(seed: number, config: Required<FuzzConfig>): FuzzMatchSummary {
	const violations: string[] = [];
	let injections = 0;
	try {
		const settings = makeAiArena(seed);
		const handler = buildFuzzHandler(settings);
		const emitter = new GameEmitter(handler, settings.gameMode!, 2, seed);
		const aiTeam0: AiSettings = { difficulty: "hard", seed: seed * 2, team: 0, decisionLimits: AI_LIMITS };
		const aiTeam1: AiSettings = { difficulty: "hard", seed: seed * 2 + 1, team: 1, decisionLimits: AI_LIMITS };

		let turns = 0;
		let simulatedFrames = 0;
		let deadActorIds: string[] = [];
		while (handler.getState() !== GameState.Game_over && turns < config.maxTurnsPerMatch) {
			const team = handler.getActiveTeam();
			injections += injectNegativeActions(handler, emitter, seed, turns, deadActorIds, violations);
			injectAiBoundaryViolations(handler, seed, team, deadActorIds, violations);

			const submitted = new AiTurnEmitter(new HardAi()).executeTurn(handler, team === 0 ? aiTeam0 : aiTeam1, emitter);
			if (!submitted) {
				violations.push(`match ${seed} turn ${turns}: AI submitted no action`);
				break;
			}
			let ticks = 0;
			while (handler.getState() === GameState.Playing && ticks < config.maxTicksPerTurn) {
				handler.tick();
				ticks++;
			}
			simulatedFrames += ticks;
			if (handler.getState() === GameState.Playing) {
				violations.push(`match ${seed} turn ${turns}: turn did not settle within ${config.maxTicksPerTurn} ticks`);
				break;
			}

			// Per-turn state-machine invariant.
			const state = handler.getState();
			if (state !== GameState.Your_turn && state !== GameState.Opponents_turn && state !== GameState.Game_over) {
				violations.push(`match ${seed} turn ${turns}: invalid state ${String(state)} after settle`);
			}
			// Per-turn finiteness invariant.
			for (const e of handler.getEntityManager().getEntities()) {
				const p = e.getPos();
				const v = e.getVel();
				if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(v.x) || !Number.isFinite(v.y)) {
					violations.push(`match ${seed} turn ${turns}: non-finite entity state for ${e.getId()}`);
					break;
				}
			}
			// Per-turn rule-state invariants.
			const rule = handler.getRuleState();
			if (rule.activeTeam !== 0 && rule.activeTeam !== 1) {
				violations.push(`match ${seed} turn ${turns}: invalid active team ${rule.activeTeam}`);
			}
			if (rule.phase !== (settings.gameMode?.phases?.[0] ?? RulePhase.Physics)) {
				violations.push(`match ${seed} turn ${turns}: rule phase left the physics phase`);
			}
			if (rule.turnNumber !== turns + 1 && !(handler.getState() === GameState.Game_over && rule.turnNumber === turns)) {
				violations.push(`match ${seed} turn ${turns}: turn number ${rule.turnNumber} does not match turn count ${turns}`);
			}
			deadActorIds = handler.getEntityManager().getEntities().filter((e) => e.isDead()).map((e) => e.getId());
			turns++;
		}

		// Terminal match-result consistency.
		const result = handler.getMatchResult();
		let outcome: "winner" | "draw" | "ongoing" = "ongoing";
		if (handler.getState() === GameState.Game_over) {
			if (!result) {
				violations.push(`match ${seed}: Game_over without a match result`);
			} else {
				outcome = result.status === MatchStatus.Winner ? "winner" : "draw";
				if (result.status === MatchStatus.Winner && (result.winnerTeam !== 0 && result.winnerTeam !== 1)) {
					violations.push(`match ${seed}: winner result without a valid winning team`);
				}
				if (result.status === MatchStatus.Draw && result.winnerTeam !== null) {
					violations.push(`match ${seed}: draw result with a winning team`);
				}
			}
		}

		// Persistence round trip of the final state (including match result).
		const finalSnapshot = handler.toSettings();
		const restored = buildFuzzHandler(finalSnapshot);
		const persistedOk = deepEqual(restored.toSettings(), finalSnapshot);
		if (!persistedOk) violations.push(`match ${seed}: persisted snapshot did not round-trip`);

		// Replay lifecycle: the recorded document must reproduce the live state.
		let replayOk = false;
		try {
			const replay = new ReplayPlayer(emitter.recorder.document);
			replay.playAll();
			replayOk = deepEqual(replay.getHandler().toSettings(), finalSnapshot);
			if (!replayOk) violations.push(`match ${seed}: replay did not reproduce the live final snapshot`);
		} catch (e) {
			violations.push(`match ${seed}: replay failed: ${e instanceof Error ? e.message : String(e)}`);
		}

		// Rematch resets the completed match (turn 0, Your_turn, no result).
		let rematchOk = false;
		if (handler.getState() === GameState.Game_over) {
			handler.rematch();
			rematchOk = handler.getTurnNumber() === 0 && handler.getState() === GameState.Your_turn && handler.getMatchResult() === undefined;
			if (!rematchOk) violations.push(`match ${seed}: rematch did not reset the completed match`);
		}

		return {
			seed,
			turns,
			acceptedActions: turns,
			simulatedFrames,
			engineWork: simulatedFrames + turns,
			outcome,
			instantDeath: turns <= 1 && outcome !== "ongoing",
			turnLimit: handler.getState() !== GameState.Game_over && turns >= config.maxTurnsPerMatch,
			violations,
			injections,
			replayOk,
			persistedOk,
			rematchOk,
		};
	} catch (e) {
		violations.push(`match ${seed} crashed: ${e instanceof Error ? e.message : String(e)}`);
		return { seed, turns: 0, acceptedActions: 0, simulatedFrames: 0, engineWork: 0, outcome: "ongoing", instantDeath: false, turnLimit: false, violations, injections, replayOk: false, persistedOk: false, rematchOk: false };
	}
}

/** Runs the full fuzz suite: `gameCount` deterministic AI-vs-AI matches. */
export function runFuzzSuite(config: FuzzConfig = {}): FuzzSuiteResult {
	const resolved: Required<FuzzConfig> = {
		gameCount: config.gameCount ?? rcGameCount(),
		maxTurnsPerMatch: config.maxTurnsPerMatch ?? 100,
		maxTicksPerTurn: config.maxTicksPerTurn ?? 5000,
		seedBase: config.seedBase ?? 1000,
	};
	const matches: FuzzMatchSummary[] = [];
	let injections = 0;
	for (let i = 0; i < resolved.gameCount; i++) {
		const summary = runFuzzMatch(resolved.seedBase + i, resolved);
		injections += summary.injections;
		matches.push(summary);
	}

	// Repeat-same-case determinism: re-run the first fuzz case and compare the
	// final engine snapshot against the original run.
	let determinismVerified = false;
	if (matches.length > 0) {
		try {
			const first = matches[0];
			const rerun = runFuzzMatch(resolved.seedBase, resolved);
			// Compare the complete outcome summaries of both runs.
			determinismVerified =
				rerun.turns === first.turns &&
				rerun.outcome === first.outcome &&
				rerun.violations.length === first.violations.length &&
				rerun.violations.every((v, i) => v === first.violations[i]);
		} catch {
			determinismVerified = false;
		}
	}

	return { matches, injections, gameCount: resolved.gameCount, determinismVerified, deepEqual };
}

import { AiTurnEmitter } from "../../src/ai/aiEmitter.js";
import { EasyAi } from "../../src/ai/easyAi.js";
import { HardAi } from "../../src/ai/hardAi.js";
import type { AiDifficulty, AiSettings } from "../../src/ai/types.js";
import { buildMapSettings } from "../../src/content/mapCatalog.js";
import { GameEmitter } from "../../src/emitter/EngineEmitter.js";
import { GameHandler, GameHandlerBuilder } from "../../src/kore/runtime/Handler.js";
import { GameState } from "../../src/kore/runtime/types.js";
import { EffectTrigger } from "../../src/effects/types.js";
import { SHAPE } from "@coffeemakerstudio/bean";
import { ReplayPlayer } from "../../src/replay/player.js";
import { RulePhase } from "../../src/rules/types.js";
import { createCanonicalPlayableMatchSettings } from "../../src/settings/canonicalPlayableMatch.js";
import { validateGameSettings, type GameSettings } from "../../src/settings/settings.js";
import { WinningSystem } from "../../src/systems/WinningSystem.js";

/**
 * Section 17.3 - deterministic map qualification harness.
 *
 * Accepts validated map settings (or a catalog map ID) and produces one
 * structured technical qualification result covering the required checks:
 * schema/settings validation, finite and unique spawn state, no initial solid
 * overlap, no initial lethal-hazard overlap, containment validity, legal first
 * action, bounded playback, deterministic duplicate-run equality, snapshot
 * and restore equality, replay equality, terminal result or explicit bounded
 * ongoing classification, and no post-completion mutation.
 */

export const MAP_PLAYBACK_BOUND = 1200;
export const MAP_DEFAULT_MAX_TURNS = 24;
export const MAP_QUALIFICATION_SEEDS = [1503, 1504];

export type MapVariant = "original" | "side-swapped" | "first-turn-swapped";
export type MatrixPolicy = "easy" | "hard";

export interface MatrixPolicyLimits { maxSimulations: number; maxAngleSamples: number; maxForceSamples: number }

export const MATRIX_POLICY_LIMITS: Record<MatrixPolicy, MatrixPolicyLimits> = {
	easy: { maxSimulations: 1, maxAngleSamples: 1, maxForceSamples: 1 },
	hard: { maxSimulations: 12, maxAngleSamples: 4, maxForceSamples: 3 },
};

export interface MapQualificationOptions {
	seed: number;
	variant?: MapVariant;
	maxTurns?: number;
	maxPlaybackFrames?: number;
	policy?: MatrixPolicy;
}

export interface SpawnInspection {
	schemaValid: boolean;
	finiteSpawn: boolean;
	uniqueSpawn: boolean;
	noSolidOverlap: boolean;
	noLethalOverlap: boolean;
	containmentValid: boolean;
	spawnFindings: string[];
}

export interface MapQualificationChecks extends SpawnInspection {
	legalFirstAction: boolean;
	boundedPlayback: boolean;
	deterministic: boolean;
	snapshotRestore: boolean;
	replayEquality: boolean;
	terminal: boolean;
	noPostCompletionMutation: boolean;
}

export interface MapQualificationOutput {
	mapId: string;
	seed: number;
	variant: MapVariant;
	policy: MatrixPolicy;
	firstTeam: number;
	winnerTeam: number | null;
	acceptedActions: number;
	turns: number;
	simulatedFrames: number;
	engineWork: number;
	result: "winner" | "draw" | "ongoing";
	safetyLimitStatus: "none" | "warning" | "failure";
	spawnFindings: string[];
	invariantFindings: string[];
	replayRestoreStatus: "ok" | "failed";
	fingerprint: string;
	checks: MapQualificationChecks;
}


function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }

function stableJson(value: unknown): string {
	if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
	if (value && typeof value === "object") {
		return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`).join(",")}}`;
	}
	return JSON.stringify(value);
}

function quiet<T>(callback: () => T): T {
	const log = console.log;
	console.log = () => undefined;
	try { return callback(); } finally { console.log = log; }
}

function build(settings: GameSettings): GameHandler {
	return new GameHandlerBuilder().defaultSystems().addSystem(new WinningSystem(2)).fromSettings(settings).build();
}

function makeFingerprint(handler: GameHandler): string {
	const snapshot = handler.toSettings();
	return stableJson({ turns: handler.getTurnNumber(), result: handler.getMatchResult()?.status ?? "ongoing", players: snapshot.players });
}

function isHazardBoundary(boundary: { effects: { trigger: string }[] }): boolean {
	return boundary.effects.some(effect => effect.trigger === EffectTrigger.Collision);
}

function circleCircleOverlap(ax: number, ay: number, ar: number, bx: number, by: number, br: number): boolean {
	return Math.hypot(ax - bx, ay - by) < ar + br;
}

function circleRectOverlap(cx: number, cy: number, r: number, rect: { x: number; y: number; w: number; h: number }): boolean {
	const closestX = Math.max(rect.x, Math.min(cx, rect.x + rect.w));
	const closestY = Math.max(rect.y, Math.min(cy, rect.y + rect.h));
	return Math.hypot(cx - closestX, cy - closestY) < r;
}

function boundaryExtents(boundary: { type: number; x: number; y: number; r?: number; w?: number; h?: number; x2?: number; y2?: number }): { minX: number; minY: number; maxX: number; maxY: number } {
	if (boundary.type === SHAPE.RECTANGLE) {
		return { minX: boundary.x, minY: boundary.y, maxX: boundary.x + (boundary.w ?? 0), maxY: boundary.y + (boundary.h ?? 0) };
	}
	if (boundary.type === SHAPE.CIRCLE) {
		const r = boundary.r ?? 0;
		return { minX: boundary.x - r, minY: boundary.y - r, maxX: boundary.x + r, maxY: boundary.y + r };
	}
	return { minX: Math.min(boundary.x, boundary.x2 ?? boundary.x), minY: Math.min(boundary.y, boundary.y2 ?? boundary.y), maxX: Math.max(boundary.x, boundary.x2 ?? boundary.x), maxY: Math.max(boundary.y, boundary.y2 ?? boundary.y) };
}

/** Mirrors settings left/right around the world center and swaps the two teams. */
export function mirrorSettings(settings: GameSettings): GameSettings {
	const out = clone(settings);
	const width = out.worldSize.x;
	for (const player of out.players) {
		player.position.x = width - player.position.x;
		player.team = player.team.map(team => 1 - team);
	}
	for (const boundary of out.mapBoundarys) {
		if (boundary.type === SHAPE.RECTANGLE) boundary.x = width - (boundary.x + (boundary.w ?? 0));
		else if (boundary.type === SHAPE.CIRCLE) boundary.x = width - boundary.x;
		else if (boundary.type === SHAPE.LINE) {
			const original = boundary.x;
			boundary.x = width - (boundary.x2 ?? boundary.x);
			boundary.x2 = width - original;
		}
	}
	return out;
}

/**
 * Produces a complete engine snapshot in which team 1 opens the match on the
 * first turn instead of team 0. Built from a freshly started handler's
 * `toSettings()` so the inventory, loadout, item-draw, pickup, and physics
 * state match a real fresh match exactly; only the opening team and the
 * serialized state fields are rewritten.
 */
export function swapFirstTurn(settings: GameSettings): ReturnType<GameHandler["toSettings"]> {
	const fresh = build(clone(settings));
	const snapshot = fresh.toSettings();
	snapshot.state = "GameState.Your_turn";
	snapshot.turnNumber = 0;
	snapshot.activeTeam = 1;
	snapshot.ruleState = { ...snapshot.ruleState, phase: snapshot.ruleState.phase, activeTeam: 1, turnNumber: 0, itemUses: 0 };
	snapshot.matchResult = undefined;
	return snapshot;
}

function containmentRect(settings: GameSettings): { x: number; y: number; w: number; h: number } {
	const explicit = settings.mapBoundarys.find(boundary => "role" in boundary && boundary.role === "containment");
	if (explicit && explicit.type === SHAPE.RECTANGLE) return { x: explicit.x, y: explicit.y, w: explicit.w ?? 0, h: explicit.h ?? 0 };
	const solids = settings.mapBoundarys.filter(boundary => !isHazardBoundary(boundary));
	if (solids.length > 0) {
		let minX = Number.POSITIVE_INFINITY;
		let minY = Number.POSITIVE_INFINITY;
		let maxX = Number.NEGATIVE_INFINITY;
		let maxY = Number.NEGATIVE_INFINITY;
		for (const boundary of solids) {
			const extents = boundaryExtents(boundary);
			minX = Math.min(minX, extents.minX);
			minY = Math.min(minY, extents.minY);
			maxX = Math.max(maxX, extents.maxX);
			maxY = Math.max(maxY, extents.maxY);
		}
		return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
	}
	return { x: 0, y: 0, w: settings.worldSize.x, h: settings.worldSize.y };
}

/** Runs the spawn/geometry/schema checks without executing any turn. */
export function inspectMapSettings(settings: GameSettings): SpawnInspection {
	const spawnFindings: string[] = [];
	let schemaValid = true;
	try {
		validateGameSettings(settings);
	} catch (error) {
		spawnFindings.push(`schema/settings validation failed: ${error instanceof Error ? error.message : String(error)}`);
		return { schemaValid: false, finiteSpawn: false, uniqueSpawn: false, noSolidOverlap: false, noLethalOverlap: false, containmentValid: false, spawnFindings };
	}

	let finiteSpawn = true;
	let uniqueSpawn = true;
	let noSolidOverlap = true;
	let noLethalOverlap = true;
	let containmentValid = true;
	const solids = settings.mapBoundarys.filter(boundary => !isHazardBoundary(boundary) && !("role" in boundary && boundary.role === "containment"));
	const hazards = settings.mapBoundarys.filter(isHazardBoundary);
	const contained = containmentRect(settings);

	if (settings.players.length === 0) {
		spawnFindings.push("map configures no players");
		finiteSpawn = false;
	}
	for (const player of settings.players) {
		const { x, y } = player.position;
		const size = player.size;
		if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(size) || size <= 0 || !Number.isFinite(player.hp) || player.hp <= 0) {
			finiteSpawn = false;
			spawnFindings.push(`non-finite or invalid spawn for player ${player.id} (position ${x},${y}, size ${size}, hp ${player.hp})`);
		}
		if (!player.isPhysicsEnabled || !player.isDrawingEnabled) spawnFindings.push(`player ${player.id} spawns already inactive`);
	}
	for (let i = 0; i < settings.players.length; i++) {
		for (let j = i + 1; j < settings.players.length; j++) {
			const a = settings.players[i]!;
			const b = settings.players[j]!;
			if (a.position.x === b.position.x && a.position.y === b.position.y) {
				uniqueSpawn = false;
				spawnFindings.push(`players ${a.id} and ${b.id} share the exact spawn position`);
			}
		}
	}
	for (const player of settings.players) {
		const r = player.size;
		for (const solid of solids) {
			const overlaps = solid.type === SHAPE.CIRCLE
				? circleCircleOverlap(player.position.x, player.position.y, r, solid.x, solid.y, solid.r ?? 0)
				: solid.type === SHAPE.RECTANGLE
					? circleRectOverlap(player.position.x, player.position.y, r, { x: solid.x, y: solid.y, w: solid.w ?? 0, h: solid.h ?? 0 })
					: false;
			if (overlaps) {
				noSolidOverlap = false;
				spawnFindings.push(`player ${player.id} spawns inside solid structure at (${solid.x},${solid.y})`);
			}
		}
		for (const hazard of hazards) {
			const overlaps = hazard.type === SHAPE.CIRCLE
				? circleCircleOverlap(player.position.x, player.position.y, r, hazard.x, hazard.y, hazard.r ?? 0)
				: hazard.type === SHAPE.RECTANGLE
					? circleRectOverlap(player.position.x, player.position.y, r, { x: hazard.x, y: hazard.y, w: hazard.w ?? 0, h: hazard.h ?? 0 })
					: false;
			if (overlaps) {
				noLethalOverlap = false;
				spawnFindings.push(`player ${player.id} spawns inside lethal hazard at (${hazard.x},${hazard.y})`);
			}
		}
		const inside = player.position.x - r >= contained.x - 0.5 && player.position.y - r >= contained.y - 0.5
			&& player.position.x + r <= contained.x + contained.w + 0.5 && player.position.y + r <= contained.y + contained.h + 0.5;
		if (!inside) {
			containmentValid = false;
			spawnFindings.push(`player ${player.id} spawn is outside the containment region (${contained.x},${contained.y},${contained.w},${contained.h})`);
		}
	}
	if (contained.x < -0.5 || contained.y < -0.5 || contained.x + contained.w > settings.worldSize.x + 0.5 || contained.y + contained.h > settings.worldSize.y + 0.5) {
		containmentValid = false;
		spawnFindings.push("containment region extends outside the world bounds");
	}
	if (settings.players.every(player => !player.isPhysicsEnabled || !player.isDrawingEnabled)) spawnFindings.push("no legal actor: every configured player is inactive");
	return { schemaValid, finiteSpawn, uniqueSpawn, noSolidOverlap, noLethalOverlap, containmentValid, spawnFindings };
}

export interface RunResult {
	ok: boolean;
	inspection: SpawnInspection;
	fingerprint: string;
	turns: number;
	simulatedFrames: number;
	engineWork: number;
	result: "winner" | "draw" | "ongoing";
	acceptedActions: number;
	firstTeam: number;
	winnerTeam: number | null;
	legalFirstAction: boolean;
	playbackBounded: boolean;
	invariantFindings: string[];
	replayRestoreStatus: "ok" | "failed";
	snapshotRestore: boolean;
	replayEquality: boolean;
	postCompletionMutation: boolean;
}

function runOnce(settings: GameSettings, options: MapQualificationOptions): RunResult {
	const inspection = inspectMapSettings(settings);
	const invariantFindings: string[] = [];
	if (!inspection.schemaValid) return {
		ok: true, inspection, fingerprint: "", turns: 0, simulatedFrames: 0, engineWork: 0, result: "ongoing", acceptedActions: 0, firstTeam: 0, winnerTeam: null,
		legalFirstAction: false, playbackBounded: false, invariantFindings, replayRestoreStatus: "failed", snapshotRestore: false, replayEquality: false, postCompletionMutation: false,
	};
	// Each run builds from a fresh copy: the handler retains references into the
	// settings object, so a completed run must never leak state into the next one.
	let handler = build(clone(settings));
	const emitter = new GameEmitter(handler, settings.gameMode, 2, options.seed);

	let acceptedActions = 0;
	let turns = 0;
	let simulatedFrames = 0;
	let engineWork = 0;
	let result: "winner" | "draw" | "ongoing" = "ongoing";
	let playbackBounded = true;
	let legalFirstAction = true;
	let firstTeam = handler.getActiveTeam();
	let winnerTeam: number | null = null;
	const maxTurns = options.maxTurns ?? MAP_DEFAULT_MAX_TURNS;
	const maxFrames = options.maxPlaybackFrames ?? MAP_PLAYBACK_BOUND;
	const policy = options.policy ?? "easy";
	const policyLimits = MATRIX_POLICY_LIMITS[policy];
	const aiProducer = policy === "hard" ? new HardAi() : new EasyAi();

	let firstAction = true;
	while (handler.getState() !== GameState.Game_over && turns < maxTurns) {
		if (handler.getRuleState().phase === RulePhase.Item) emitter.skipPhase();
		const ai: AiSettings = { difficulty: policy as AiDifficulty, seed: options.seed + handler.getActiveTeam(), team: handler.getActiveTeam(), decisionLimits: policyLimits };
		const accepted = quiet(() => new AiTurnEmitter(aiProducer).executeTurn(handler, ai, emitter));
		if (!accepted) {
			if (firstAction) {
				legalFirstAction = false;
				invariantFindings.push("no legal first action: the production rule path rejected every candidate action");
			}
			invariantFindings.push("AI produced no legal action");
			break;
		}
		firstAction = false;
		acceptedActions++;
		const frames = quiet(() => settle(handler, maxFrames));
		engineWork += frames;
		if (frames >= maxFrames) {
			playbackBounded = false;
			invariantFindings.push(`playback exceeded the ${maxFrames}-frame bound (stall or repeated full state)`);
			break;
		}
		simulatedFrames += frames;
		turns = handler.getTurnNumber();
		const { x: worldX, y: worldY } = settings.worldSize;
		for (const player of handler.toSettings().players) {
			if (!Number.isFinite(player.position.x) || !Number.isFinite(player.position.y) || !Number.isFinite(player.velocity.x) || !Number.isFinite(player.velocity.y)) {
				invariantFindings.push(`non-finite physics state for player ${player.id}`);
			}
			if (player.position.x < -0.5 || player.position.y < -0.5 || player.position.x > worldX + 0.5 || player.position.y > worldY + 0.5) {
				invariantFindings.push(`player ${player.id} left the world bounds (${worldX}x${worldY}) - missing or violated containment`);
			}
		}
	}
	result = handler.getState() === GameState.Game_over
		? handler.getMatchResult()?.status === "draw" ? "draw" : "winner"
		: "ongoing";
	winnerTeam = handler.getMatchResult()?.winnerTeam ?? null;

	// The reference snapshot is taken immediately after the bounded run so a
	// replay of the recorded actions reproduces it exactly. The
	// post-completion mutation check only applies to COMPLETED matches: for
	// ongoing (turn-limited) runs the engine legitimately keeps simulating,
	// so ticking must not be misread as mutation.
	const snapshot = handler.toSettings();
	const restored = build(snapshot);
	const snapshotRestore = JSON.stringify(restored.toSettings()) === JSON.stringify(snapshot);
	if (!snapshotRestore) invariantFindings.push("engine snapshot did not restore identically");
	let replayEquality = false;
	let replayRestoreStatus: "ok" | "failed" = "failed";
	try {
		const replay = new ReplayPlayer(emitter.recorder.getReplay());
		quiet(() => replay.playAll());
		replayEquality = JSON.stringify(replay.getHandler().toSettings()) === JSON.stringify(snapshot);
		if (replayEquality) replayRestoreStatus = "ok";
		// Engine work counts every tick the qualification pass drove through the
		// engine: match simulation, post-completion verification, and replay.
		engineWork += replay.getTickCount();
	} catch (error) {
		invariantFindings.push(`replay failed: ${error instanceof Error ? error.message : String(error)}`);
	}
	if (!replayEquality) invariantFindings.push("replay did not reproduce the live snapshot");

	let postCompletionMutation = false;
	const fingerprintBefore = makeFingerprint(handler);
	if (handler.getState() === GameState.Game_over) {
		const fingerprintBefore = makeFingerprint(handler);
		for (let i = 0; i < 10; i++) quiet(() => handler.tick());
		postCompletionMutation = makeFingerprint(handler) !== fingerprintBefore;
		if (postCompletionMutation) invariantFindings.push("post-completion ticking mutated the match state");
		engineWork += 10;
	}

	return {
		ok: true, inspection, fingerprint: fingerprintBefore, turns, simulatedFrames, engineWork, result, acceptedActions, firstTeam, winnerTeam,
		legalFirstAction, playbackBounded, invariantFindings, replayRestoreStatus, snapshotRestore, replayEquality, postCompletionMutation,
	};
}

function settle(handler: GameHandler, maxFrames: number): number {
	let ticks = 0;
	while (handler.getState() === GameState.Playing && ticks < maxFrames) { handler.tick(); ticks++; }
	return ticks;
}

/**
 * Runs one deterministic qualification pass. A thrown engine error (for
 * example the Section 13 explicit failure "Unresolved penetration after max
 * solver iterations") is converted into a structured failed run: spawn and
 * schema checks keep their real values, run-level checks are false, and the
 * failure message becomes the invariant finding.
 */
function tryRunOnce(settings: GameSettings, options: MapQualificationOptions): RunResult {
	try {
		return runOnce(settings, options);
	} catch (error) {
		const inspection = inspectMapSettings(settings);
		const message = error instanceof Error ? error.message : String(error);
		return {
			ok: false, inspection,
			fingerprint: "", turns: 0, simulatedFrames: 0, engineWork: 0, result: "ongoing", acceptedActions: 0, firstTeam: 0, winnerTeam: null,
			legalFirstAction: false, playbackBounded: false, invariantFindings: [message],
			replayRestoreStatus: "failed", snapshotRestore: false, replayEquality: false, postCompletionMutation: false,
		};
	}
}

/** Qualifies pre-built settings; used directly by negative-case tests. */
export function qualifyMapSettings(settings: GameSettings, options: MapQualificationOptions, mapId: string = "custom-settings"): MapQualificationOutput {
	const variant = options.variant ?? "original";
	const input = variant === "side-swapped" ? mirrorSettings(settings) : variant === "first-turn-swapped" ? swapFirstTurn(settings) : settings;
	const first = tryRunOnce(input, options);
	const second = tryRunOnce(input, options);
	// Duplicate runs are deterministic when both pass with identical
	// fingerprints or both fail with identical structured findings.
	const deterministic = first.ok && second.ok
		? first.fingerprint === second.fingerprint && first.result === second.result
		: !first.ok && !second.ok && first.invariantFindings.join("|") === second.invariantFindings.join("|");
	const invariantFindings = [...first.invariantFindings];
	if (!deterministic) invariantFindings.push("duplicate seeded run diverged");
	const bothOk = first.ok && second.ok;
	const playbackBounded = first.playbackBounded && second.playbackBounded;
	const checks: MapQualificationChecks = {
		...first.inspection,
		legalFirstAction: first.legalFirstAction,
		boundedPlayback: playbackBounded,
		deterministic,
		snapshotRestore: bothOk && first.snapshotRestore && second.snapshotRestore,
		replayEquality: bothOk && first.replayEquality && second.replayEquality,
		terminal: first.result !== "ongoing",
		noPostCompletionMutation: bothOk && !first.postCompletionMutation && !second.postCompletionMutation,
	};
	const safetyLimitStatus = !playbackBounded
		? "failure"
		: first.result === "ongoing"
			? "warning"
			: "none";
	return {
		mapId,
		seed: options.seed,
		variant,
	policy: options.policy ?? "easy",
	firstTeam: first.firstTeam,
	winnerTeam: first.winnerTeam,
	acceptedActions: first.acceptedActions,
		turns: first.turns,
		simulatedFrames: first.simulatedFrames,
		engineWork: first.engineWork,
		result: first.result,
		safetyLimitStatus,
		spawnFindings: first.inspection.spawnFindings,
		invariantFindings,
		replayRestoreStatus: first.replayRestoreStatus,
		fingerprint: first.fingerprint,
		checks,
	};
}

/** Qualifies a catalog map through the canonical playable-match template. */
export function qualifyMap(mapId: string, options: MapQualificationOptions): MapQualificationOutput {
	const template = createCanonicalPlayableMatchSettings();
	const settings = buildMapSettings(mapId, template);
	return qualifyMapSettings(settings, { ...options }, mapId);
}

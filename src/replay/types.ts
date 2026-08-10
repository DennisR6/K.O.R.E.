import { DOCUMENT_SCHEMA_VERSION, migrateDocument } from "../contracts/documents.js";
import type { ReplayDocument, ReplayAction } from "../contracts/documents.js";
import type { EngineSettings } from "../engine/types.js";
import type { MatchResult } from "../rules/types.js";
import { validateCounterEffectSettings } from "../engine/sdk/counterCapability.js";

export type { ReplayDocument, ReplayAction };
/** Immutable authoritative artifact intentionally separate from a live match. */
export type FrozenReplayDocument = ReplayDocument & { finalSettings: EngineSettings; result: MatchResult; completedAt: number };
export { DOCUMENT_SCHEMA_VERSION, migrateDocument };

const SHOOT_ACTION_KEYS = ["type", "actorId", "input"] as const;
const ITEM_USE_ACTION_KEYS = ["type", "actorId", "itemId", "target"] as const;
const COUNTER_ACTION_KEYS = ["type", "effect"] as const;
const SHOOT_INPUT_KEYS = ["angle", "power"] as const;

export function validateReplayDocument(document: unknown): asserts document is ReplayDocument {
	if (!isRecord(document) || document.schemaVersion !== DOCUMENT_SCHEMA_VERSION) {
		throw new Error("Invalid replay schema version");
	}
	if (!isRecord(document.initialSettings) || typeof document.seed !== "number" || !Number.isFinite(document.seed) || !Array.isArray(document.actions)) {
		throw new Error("Invalid replay document structure");
	}
	for (const action of document.actions) validateReplayAction(action);
}

/**
 * Asserts that a replay document starts from a pristine, reproducible match
 * origin. Replays whose `initialSettings` fell back to a live snapshot (for
 * example legacy rows created before immutable origins were persisted) restore
 * actors that are already dead or resolve a completed match, which makes the
 * first recorded action unplayable. Every replay export boundary must reject
 * those documents instead of serving them.
 *
 * The opening team is deliberately NOT restricted: first-turn-swapped matches
 * (a legitimate variant that lets team 1 open at turn zero) produce pristine
 * origins with `activeTeam === 1`. The pristine-origin guarantees are turn
 * zero, a pre-result pre-phase-complete state, and alive healthy actors.
 */
export function validateReplayOrigin(document: ReplayDocument): asserts document is ReplayDocument {
	const initial = document.initialSettings;
	if (!isRecord(initial)) throw new Error("Replay origin must be serialized game settings");
	if (initial.state === "GameState.Game_over") throw new Error("Replay origin cannot be a completed match");
	if (initial.matchResult !== undefined && initial.matchResult !== null) throw new Error("Replay origin cannot carry a match result");
	if (initial.turnNumber !== undefined && initial.turnNumber !== 0) throw new Error("Replay origin must start at turn zero");
	if (isRecord(initial.ruleState)) {
		if (initial.ruleState.phase === "complete") throw new Error("Replay origin cannot resolve past the turn phases");
		if (initial.ruleState.turnNumber !== undefined && initial.ruleState.turnNumber !== 0) throw new Error("Replay origin rule state must start at turn zero");
	}
	if (Array.isArray(initial.players)) {
		for (const player of initial.players) {
			if (!isRecord(player)) throw new Error("Replay origin players must be serialized settings");
			if (player.isPhysicsEnabled === false || player.isDrawingEnabled === false) throw new Error("Replay origin actors must be alive");
			if (player.hp !== undefined && (typeof player.hp !== "number" || player.hp <= 0)) throw new Error("Replay origin actors must be healthy");
		}
	}
}

export function validateFrozenReplayDocument(document: unknown): asserts document is FrozenReplayDocument {
	validateReplayDocument(document);
	const frozen = document as unknown as Record<string, unknown>;
	if (!isRecord(frozen.finalSettings) || !isRecord(frozen.result) || !Number.isSafeInteger(frozen.completedAt) || (frozen.completedAt as number) < 0) throw new Error("Invalid frozen replay document");
	if (frozen.finalSettings.state !== "GameState.Game_over" || !isRecord(frozen.finalSettings.matchResult)) throw new Error("Frozen replay must contain a completed final snapshot");
	if (JSON.stringify(frozen.finalSettings.matchResult) !== JSON.stringify(frozen.result)) throw new Error("Frozen replay result does not match final snapshot");
}

function validateReplayAction(action: unknown): void {
	if (!isRecord(action)) throw new Error("Replay actions must be objects");
	if (action.type !== "shoot" && action.type !== "itemUse") {
		if (action.type !== "counter") throw new Error(`Unknown replay action type '${String(action.type)}'`);
		for (const key of Object.keys(action)) if (!(COUNTER_ACTION_KEYS as readonly string[]).includes(key)) throw new Error(`Unknown replay counter action field '${key}'`);
		validateCounterEffectSettings(action.effect);
		return;
	}
	if (typeof action.actorId !== "string" || action.actorId.length === 0) {
		throw new Error("Replay actions require a non-empty actorId");
	}
	if (action.type === "shoot") {
		for (const key of Object.keys(action)) {
			if (!(SHOOT_ACTION_KEYS as readonly string[]).includes(key)) {
				throw new Error(`Unknown replay shoot action field '${key}'`);
			}
		}
		if (!isRecord(action.input)) throw new Error("Replay shoot actions require an input object");
		for (const key of Object.keys(action.input)) {
			if (!(SHOOT_INPUT_KEYS as readonly string[]).includes(key)) {
				throw new Error(`Unknown replay shoot input field '${key}'`);
			}
		}
		const { angle, power } = action.input as { angle?: unknown; power?: unknown };
		if (typeof angle !== "number" || !Number.isFinite(angle)) throw new Error("Replay shoot angle must be a finite number");
		if (typeof power !== "number" || !Number.isFinite(power)) throw new Error("Replay shoot power must be a finite number");
		return;
	}
	for (const key of Object.keys(action)) {
		if (!(ITEM_USE_ACTION_KEYS as readonly string[]).includes(key)) {
			throw new Error(`Unknown replay item use action field '${key}'`);
		}
	}
	if (typeof action.itemId !== "string" || action.itemId.length === 0) {
		throw new Error("Replay item use actions require a non-empty itemId");
	}
	if (!isRecord(action.target)) throw new Error("Replay item use actions require a target object");
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

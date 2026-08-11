import { EffectSpawnTrigger } from "../effects/spawnTrigger.js";
import { createDeferredEffectTemplate, type DeferredEffectTemplate } from "@coffeemakerstudio/roast";
import { MOVEMENT_APPLY_FORCE_FIELD_EFFECT_ID, type MovementForceFieldPayload } from "@coffeemakerstudio/roast";
import { createStructureLifecycleTemplate, type StructureLifecycleTemplate } from "@coffeemakerstudio/roast";
import { EffectSelectionLock } from "../effects/selectionLock.js";
import type { ForceInput } from "../effects/types.js";
import type { ActionModifierTemplate } from "@coffeemakerstudio/roast";
import { SeededRandom } from "../utils/random.js";
import { createTemporalModifierTemplate, type TemporalModifierTemplate } from "@coffeemakerstudio/roast";
import { MOVEMENT_SCALE_SPEED_EFFECT_ID } from "@coffeemakerstudio/roast";
import { applyActionModifiers, createActionModifier } from "@coffeemakerstudio/roast";
import {
	ANKER_FORCE_FACTOR, DELAYED_MINE_DELAY_TICKS, DELAYED_MINE_FORCE, DELAYED_MINE_RADIUS,
	FALLTUER_RADIUS, FREEZE_SHOT_DURATION_TURNS, FREEZE_SHOT_SPEED_FACTOR, JAEGERMEISTER_ELIXIER_DURATION_TURNS,
	MINI_WALL_DURATION_TURNS, MINI_WALL_HEIGHT, MINI_WALL_WIDTH,
	POWER_DASH_FACTOR, VODKA_ZERO_MAX_VARIANCE_DEGREES,
} from "./officialItems.js";

export function applyAnkerForce(force: ForceInput): ForceInput { return applyActionModifiers(force, [createActionModifier({ id: "official:anker", action: "force", operation: "scale", factor: ANKER_FORCE_FACTOR, remainingUses: 1 })]); }
export function applyPowerDashForce(force: ForceInput): ForceInput { return applyActionModifiers(force, [createActionModifier({ id: "official:power-dash", action: "force", operation: "scale", factor: POWER_DASH_FACTOR, remainingUses: 1 })]); }

export interface VerzoegerteMine { center: { x: number; y: number }; radius: number; deferred: DeferredEffectTemplate; force: MovementForceFieldPayload; }
export function createVerzoegerteMine(center: { x: number; y: number }, delayTicks: number = DELAYED_MINE_DELAY_TICKS): VerzoegerteMine {
	if (!Number.isFinite(center.x) || !Number.isFinite(center.y)) throw new Error("Verzögerte Mine position must be finite");
	const deferred = createDeferredEffectTemplate({ durationUnit: "ticks", duration: delayTicks, effect: { schemaVersion: 1, type: MOVEMENT_APPLY_FORCE_FIELD_EFFECT_ID, typeValue: { mode: "repel", force: DELAYED_MINE_FORCE, range: DELAYED_MINE_RADIUS } } });
	return { center: { ...center }, radius: DELAYED_MINE_RADIUS, deferred, force: { mode: "repel", force: DELAYED_MINE_FORCE, range: DELAYED_MINE_RADIUS } };
}
export function createMiniWall(_position: { x: number; y: number }, _wallId: string = "mini-wall"): StructureLifecycleTemplate {
	return createStructureLifecycleTemplate({ durationUnit: "turns", duration: MINI_WALL_DURATION_TURNS, structure: { type: "rectangle", w: MINI_WALL_WIDTH, h: MINI_WALL_HEIGHT, role: "solid" } });
}
export function createFreezeShot(): TemporalModifierTemplate {
	return createTemporalModifierTemplate({ durationUnit: "turns", duration: FREEZE_SHOT_DURATION_TURNS, effect: { schemaVersion: 1, type: MOVEMENT_SCALE_SPEED_EFFECT_ID, typeValue: { factor: FREEZE_SHOT_SPEED_FACTOR } } });
}
export function createSelectionLock(): EffectSelectionLock { return new EffectSelectionLock({ typeValue: { durationTurns: JAEGERMEISTER_ELIXIER_DURATION_TURNS } }); }
export function createVodkaZero(seed: number = 42): ActionModifierTemplate {
	if (!Number.isSafeInteger(seed)) throw new Error("Vodka-Zero seed must be a safe integer");
	return { action: "aim", operation: "random-offset", maxVarianceDegrees: VODKA_ZERO_MAX_VARIANCE_DEGREES, randomState: new SeededRandom(seed).getState() };
}
export interface FalltuerKillZone { triggerId: string; center: { x: number; y: number }; radius: number; trigger: EffectSpawnTrigger; }
export function createFalltuerKillZone(center: { x: number; y: number }, radius: number = FALLTUER_RADIUS): FalltuerKillZone {
	if (!Number.isFinite(center.x) || !Number.isFinite(center.y)) throw new Error("Falltür position must be finite");
	if (!Number.isFinite(radius) || radius <= 0) throw new Error("Falltür radius must be positive");
	return { triggerId: "falltuer-kill-zone", center: { ...center }, radius, trigger: new EffectSpawnTrigger({ typeValue: { triggerId: "falltuer-kill-zone", delayTurns: 0 } }) };
}
export function isInsideFalltuerKillZone(position: { x: number; y: number }, zone: FalltuerKillZone): boolean { return Math.hypot(position.x - zone.center.x, position.y - zone.center.y) <= zone.radius; }

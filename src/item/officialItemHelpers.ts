import { EffectModifyForce } from "../effects/modifyForce.js";
import { EffectMagnet } from "../effects/magnet.js";
import { EffectSpawnTrigger } from "../effects/spawnTrigger.js";
import { EffectDelayed } from "../effects/delayedEffect.js";
import { EffectTemporaryWall } from "../effects/temporaryWall.js";
import { EffectSwapPosition, type PositionTargetState } from "../effects/swapPosition.js";
import { EffectSelectionLock } from "../effects/selectionLock.js";
import { EffectAimVariance } from "../effects/aimVariance.js";
import type { ForceInput } from "../effects/types.js";
import { createTemporalModifierTemplate, type TemporalModifierTemplate } from "../engine/contracts/temporalModifier.js";
import { MOVEMENT_SCALE_SPEED_EFFECT_ID } from "../engine/sdk/movementCapability.js";
import {
	ANKER_FORCE_FACTOR, DELAYED_MINE_DELAY_TICKS, DELAYED_MINE_FORCE, DELAYED_MINE_RADIUS,
	FALLTUER_RADIUS, FREEZE_SHOT_DURATION_TURNS, FREEZE_SHOT_SPEED_FACTOR, JAEGERMEISTER_ELIXIER_DURATION_TURNS,
	MAGNET_FORCE, MAGNET_RANGE, MINI_WALL_DURATION_TURNS, MINI_WALL_HEIGHT, MINI_WALL_WIDTH,
	POWER_DASH_FACTOR, VODKA_ZERO_MAX_VARIANCE_DEGREES,
} from "./officialItems.js";

export function applyAnkerForce(force: ForceInput): ForceInput { return new EffectModifyForce({ typeValue: { factor: ANKER_FORCE_FACTOR } }).applyToForce(force); }
export function applyPowerDashForce(force: ForceInput): ForceInput { return new EffectModifyForce({ typeValue: { factor: POWER_DASH_FACTOR } }).applyToForce(force); }

export interface VerzoegerteMine { center: { x: number; y: number }; radius: number; trigger: EffectDelayed; force: EffectMagnet; }
export function createVerzoegerteMine(center: { x: number; y: number }, delayTicks: number = DELAYED_MINE_DELAY_TICKS): VerzoegerteMine {
	if (!Number.isFinite(center.x) || !Number.isFinite(center.y)) throw new Error("Verzögerte Mine position must be finite");
	const trigger = new EffectDelayed({ typeValue: { effectType: "magnet", effectValue: { mode: "repel", force: DELAYED_MINE_FORCE, range: DELAYED_MINE_RADIUS }, delayTicks } });
	return { center: { ...center }, radius: DELAYED_MINE_RADIUS, trigger, force: new EffectMagnet({ typeValue: { mode: "repel", force: DELAYED_MINE_FORCE, range: DELAYED_MINE_RADIUS } }) };
}
export function applyVerzoegerteMineExplosion(mine: VerzoegerteMine, velocity: { x: number; y: number }, target: { x: number; y: number }): { x: number; y: number } { return mine.trigger.hasFired() ? mine.force.applyToVelocity(velocity, mine.center, target) : { ...velocity }; }
export function createMiniWall(position: { x: number; y: number }, wallId: string = "mini-wall"): EffectTemporaryWall { return new EffectTemporaryWall({ typeValue: { wallId, x: position.x, y: position.y, w: MINI_WALL_WIDTH, h: MINI_WALL_HEIGHT, durationTurns: MINI_WALL_DURATION_TURNS } }); }
export function createFreezeShot(): TemporalModifierTemplate {
	return createTemporalModifierTemplate({ durationUnit: "turns", duration: FREEZE_SHOT_DURATION_TURNS, effect: { schemaVersion: 1, type: MOVEMENT_SCALE_SPEED_EFFECT_ID, typeValue: { factor: FREEZE_SHOT_SPEED_FACTOR } } });
}
export function createSelectionLock(): EffectSelectionLock { return new EffectSelectionLock({ typeValue: { durationTurns: JAEGERMEISTER_ELIXIER_DURATION_TURNS } }); }
export function createVodkaZero(seed: number = 42): EffectAimVariance { return new EffectAimVariance({ typeValue: { maxVarianceDegrees: VODKA_ZERO_MAX_VARIANCE_DEGREES, seed } }); }
export function applySwitch(first: PositionTargetState, second: PositionTargetState): [{ x: number; y: number }, { x: number; y: number }] { return new EffectSwapPosition().swap(first, second); }
export function applyMagnetForce(velocity: { x: number; y: number }, source: { x: number; y: number }, target: { x: number; y: number }): { x: number; y: number } { return new EffectMagnet({ typeValue: { mode: "attract", force: MAGNET_FORCE, range: MAGNET_RANGE } }).applyToVelocity(velocity, source, target); }
export interface FalltuerKillZone { triggerId: string; center: { x: number; y: number }; radius: number; trigger: EffectSpawnTrigger; }
export function createFalltuerKillZone(center: { x: number; y: number }, radius: number = FALLTUER_RADIUS): FalltuerKillZone {
	if (!Number.isFinite(center.x) || !Number.isFinite(center.y)) throw new Error("Falltür position must be finite");
	if (!Number.isFinite(radius) || radius <= 0) throw new Error("Falltür radius must be positive");
	return { triggerId: "falltuer-kill-zone", center: { ...center }, radius, trigger: new EffectSpawnTrigger({ typeValue: { triggerId: "falltuer-kill-zone", delayTurns: 0 } }) };
}
export function isInsideFalltuerKillZone(position: { x: number; y: number }, zone: FalltuerKillZone): boolean { return Math.hypot(position.x - zone.center.x, position.y - zone.center.y) <= zone.radius; }

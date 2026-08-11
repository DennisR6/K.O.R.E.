import type { FullEffectSettings } from "../effects/types.js";
import { SHAPE, type Vector2D } from "@coffeemakerstudio/bean";
import type { MapBoundarySettings } from "../settings/settings.js";

export const ENVIRONMENT_SCHEMA_VERSION = 1;

export type EnvironmentalType = "timed-hazard" | "triggered-zone" | "force-field" | "moving-structure" | "environmental-cycle";
export interface EnvironmentalBase {
	schemaVersion: 1;
	id: string;
	type: EnvironmentalType;
	structure: MapBoundarySettings;
	effects?: FullEffectSettings[];
	/** Optional team ownership gate for activation. */
	ownerTeam?: number;
}
export interface TimedHazard extends EnvironmentalBase {
	type: "timed-hazard";
	startTick: number;
	intervalTicks: number;
	durationTicks: number;
}
export interface TriggeredZone extends EnvironmentalBase {
	type: "triggered-zone";
	triggerZone: { x: number; y: number; r: number };
	durationTicks: number;
	cooldownTicks?: number;
}
export interface ForceField extends EnvironmentalBase { type: "force-field" }
export interface MovingStructure extends EnvironmentalBase {
	type: "moving-structure";
	to: Vector2D;
	periodTicks: number;
	loop?: boolean;
}
export interface EnvironmentalCycle extends EnvironmentalBase {
	type: "environmental-cycle";
	phases: Array<{ durationTicks: number; enabled: boolean }>;
}
export type EnvironmentalMechanic = TimedHazard | TriggeredZone | ForceField | MovingStructure | EnvironmentalCycle;

export interface EnvironmentalState { tick: number; active: boolean[]; triggerUntil: number[]; cooldownUntil: number[]; cyclePhase: number[] }

export function validateEnvironmentalMechanics(value: unknown): asserts value is EnvironmentalMechanic[] {
	if (!Array.isArray(value)) throw new Error("Invalid environmental mechanics")
	const ids = new Set<string>();
	for (const mechanic of value) {
		if (!isRecord(mechanic) || mechanic.schemaVersion !== ENVIRONMENT_SCHEMA_VERSION || typeof mechanic.id !== "string" || !mechanic.id || ids.has(mechanic.id)) throw new Error("Invalid environmental mechanic identity")
		ids.add(mechanic.id)
		if (!isBoundary(mechanic.structure) || !Array.isArray(mechanic.effects ?? [])) throw new Error(`Invalid environmental structure '${mechanic.id}'`)
		if (mechanic.ownerTeam !== undefined && (!Number.isSafeInteger(mechanic.ownerTeam) || mechanic.ownerTeam < 0)) throw new Error("Invalid environmental ownership")
		switch (mechanic.type) {
			case "force-field": break
			case "timed-hazard": if (!positiveInteger(mechanic.startTick) || !positiveInteger(mechanic.intervalTicks) || !positiveInteger(mechanic.durationTicks)) throw new Error("Invalid timed hazard timing"); break
			case "triggered-zone": if (!isZone(mechanic.triggerZone) || !positiveInteger(mechanic.durationTicks) || (mechanic.cooldownTicks !== undefined && !positiveInteger(mechanic.cooldownTicks))) throw new Error("Invalid triggered zone timing"); break
			case "moving-structure": if (!isVector(mechanic.to) || !positiveInteger(mechanic.periodTicks) || (mechanic.loop !== undefined && typeof mechanic.loop !== "boolean")) throw new Error("Invalid moving structure path"); break
			case "environmental-cycle": if (!Array.isArray(mechanic.phases) || mechanic.phases.length === 0 || mechanic.phases.some(phase => !isRecord(phase) || !positiveInteger(phase.durationTicks) || typeof phase.enabled !== "boolean")) throw new Error("Invalid environmental cycle"); break
			default: throw new Error(`Unsupported environmental mechanic '${String((mechanic as { type?: unknown }).type)}'`)
		}
	}
}

function isRecord(value: unknown): value is Record<string, any> { return typeof value === "object" && value !== null && !Array.isArray(value) }
function finite(value: unknown): value is number { return typeof value === "number" && Number.isFinite(value) }
function positiveInteger(value: unknown): value is number { return typeof value === "number" && Number.isSafeInteger(value) && value > 0 }
function isVector(value: unknown): value is Vector2D { return isRecord(value) && finite(value.x) && finite(value.y) }
function isZone(value: unknown): value is { x: number; y: number; r: number } { return isRecord(value) && finite(value.x) && finite(value.y) && finite(value.r) && value.r > 0 }
function isBoundary(value: unknown): value is MapBoundarySettings {
	if (!isRecord(value) || !finite(value.x) || !finite(value.y) || !Array.isArray(value.effects)) return false
	if (value.type === SHAPE.CIRCLE) return finite(value.r) && value.r > 0
	if (value.type === SHAPE.RECTANGLE) return finite(value.w) && finite(value.h) && value.w > 0 && value.h > 0
	return value.type === SHAPE.LINE && finite(value.x2) && finite(value.y2)
}

export function environmentalBoundary(mechanic: EnvironmentalMechanic): MapBoundarySettings {
	return { ...structuredClone(mechanic.structure), effects: structuredClone(mechanic.effects ?? mechanic.structure.effects) };
}

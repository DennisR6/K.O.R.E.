import { SHAPE } from "../physics/physics.js";
import type { MapBoundarySettings } from "../settings/settings.js";
import { validateFullEffectSettings } from "../effects/validate.js";

export const STRUCTURE_SPAWN_COMMAND_SCHEMA_VERSION = 1 as const;

export interface StructureSpawnCommand {
	schemaVersion: 1;
	type: "structure.spawn";
	structureId: string;
	placement: "resolved-position";
	structure: MapBoundarySettings;
	durationTurns: number;
}

export function createStructureSpawnCommand(input: Omit<StructureSpawnCommand, "schemaVersion" | "type">): StructureSpawnCommand {
	const command: StructureSpawnCommand = { schemaVersion: 1, type: "structure.spawn", structureId: input.structureId, placement: input.placement, structure: structuredClone(input.structure), durationTurns: input.durationTurns };
	validateStructureSpawnCommand(command);
	return structuredClone(command);
}

export function resolveStructureSpawnPosition(command: StructureSpawnCommand, position: { x: number; y: number }): MapBoundarySettings {
	validateStructureSpawnCommand(command);
	if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) throw new Error("Structure spawn position must be finite");
	const structure = structuredClone(command.structure) as MapBoundarySettings & { x: number; y: number };
	structure.x = position.x;
	structure.y = position.y;
	return structure;
}

export function validateStructureSpawnCommand(value: unknown): asserts value is StructureSpawnCommand {
	const command = record(value, "Structure spawn command");
	exactKeys(command, ["schemaVersion", "type", "structureId", "placement", "structure", "durationTurns"], "Structure spawn command");
	if (command.schemaVersion !== 1 || command.type !== "structure.spawn") throw new Error("Unsupported structure spawn command version");
	if (typeof command.structureId !== "string" || !/^[a-z0-9.-]{1,80}$/.test(command.structureId)) throw new Error("Invalid structure spawn ID");
	if (command.placement !== "resolved-position") throw new Error("Unsupported structure spawn placement");
	if (typeof command.durationTurns !== "number" || !Number.isSafeInteger(command.durationTurns) || command.durationTurns < 1) throw new Error("Structure spawn durationTurns must be positive");
	validateStructure(command.structure);
}

function validateStructure(value: unknown): asserts value is MapBoundarySettings {
	const structure = record(value, "Spawned structure");
	if (!Number.isFinite(structure.x) || !Number.isFinite(structure.y) || !Array.isArray(structure.effects) || !structure.effects.every(effect => { try { validateFullEffectSettings(effect); return true; } catch { return false; } })) throw new Error("Spawned structure requires finite position and valid Effects");
	if (structure.color !== undefined && typeof structure.color !== "string") throw new Error("Spawned structure color must be a string");
	if (structure.role !== undefined && !["solid", "containment", "both"].includes(structure.role as string)) throw new Error("Spawned structure role is invalid");
	if (structure.type === SHAPE.CIRCLE) {
		knownKeys(structure, ["type", "x", "y", "r", "color", "effects", "role"], "Spawned circle");
		if (typeof structure.r !== "number" || !Number.isFinite(structure.r) || structure.r <= 0) throw new Error("Spawned circle radius must be positive");
		return;
	}
	if (structure.type === SHAPE.RECTANGLE) {
		knownKeys(structure, ["type", "x", "y", "w", "h", "color", "effects", "role"], "Spawned rectangle");
		if (typeof structure.w !== "number" || typeof structure.h !== "number" || !Number.isFinite(structure.w) || !Number.isFinite(structure.h) || structure.w <= 0 || structure.h <= 0) throw new Error("Spawned rectangle dimensions must be positive");
		return;
	}
	throw new Error("Spawned structures currently support circles and rectangles only");
}

function record(value: unknown, label: string): Record<string, unknown> {
	if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error(`${label} must be an object`);
	return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[], label: string): void {
	const allowed = new Set(keys);
	for (const key of Object.keys(value)) if (!allowed.has(key)) throw new Error(`${label} contains unknown field '${key}'`);
	for (const key of keys) if (!(key in value)) throw new Error(`${label} is missing '${key}'`);
}

function knownKeys(value: Record<string, unknown>, keys: readonly string[], label: string): void {
	const allowed = new Set(keys);
	for (const key of Object.keys(value)) if (!allowed.has(key)) throw new Error(`${label} contains unknown field '${key}'`);
}

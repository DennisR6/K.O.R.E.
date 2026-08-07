export const RESOLVED_EFFECT_TARGET_SCHEMA_VERSION = 1 as const;

export type ResolvedEffectTarget =
	| { schemaVersion: 1; type: "entity"; entityId: string }
	| { schemaVersion: 1; type: "position"; position: { x: number; y: number } };

export function createEntityResolvedTarget(entityId: string): ResolvedEffectTarget {
	const target: ResolvedEffectTarget = { schemaVersion: 1, type: "entity", entityId };
	validateResolvedEffectTarget(target);
	return structuredClone(target);
}

export function createPositionResolvedTarget(position: { x: number; y: number }): ResolvedEffectTarget {
	const target: ResolvedEffectTarget = { schemaVersion: 1, type: "position", position: { ...position } };
	validateResolvedEffectTarget(target);
	return structuredClone(target);
}

export function validateResolvedEffectTarget(value: unknown): asserts value is ResolvedEffectTarget {
	const target = record(value, "Resolved Effect target");
	if (target.schemaVersion !== 1) throw new Error("Unsupported resolved Effect target schema version");
	if (target.type === "entity") {
		exactKeys(target, ["schemaVersion", "type", "entityId"], "Resolved entity target");
		string(target.entityId, "Resolved entity target entityId");
		return;
	}
	if (target.type === "position") {
		exactKeys(target, ["schemaVersion", "type", "position"], "Resolved position target");
		const position = record(target.position, "Resolved position target position");
		exactKeys(position, ["x", "y"], "Resolved position");
		finite(position.x, "Resolved position x");
		finite(position.y, "Resolved position y");
		return;
	}
	throw new Error(`Unsupported resolved Effect target type '${String(target.type)}'`);
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

function string(value: unknown, label: string): asserts value is string {
	if (typeof value !== "string" || value.length === 0) throw new Error(`${label} must be a non-empty string`);
}

function finite(value: unknown, label: string): asserts value is number {
	if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${label} must be finite`);
}

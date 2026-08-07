import { validateEffectSettings } from "../effects/validate.js";
import type { EffectSettings } from "../effects/types.js";

export interface TriggerDefinition {
	schemaVersion: 1;
	id: string;
	effect: EffectSettings;
}

export interface TriggerDefinitionDescriptor {
	schemaVersion: 1;
	id: string;
	effectType: string;
}

/** Data-only named trigger catalog; runtime validators remain host-side. */
export class TriggerDefinitionCatalog {
	private readonly definitions = new Map<string, TriggerDefinition>();

	public register(definition: TriggerDefinition): this {
		validateTriggerDefinition(definition);
		if (this.definitions.has(definition.id)) throw new Error(`Duplicate trigger definition '${definition.id}'`);
		this.definitions.set(definition.id, structuredClone(definition));
		return this;
	}

	public get(id: string): TriggerDefinition | undefined {
		const definition = this.definitions.get(id);
		return definition === undefined ? undefined : structuredClone(definition);
	}

	public require(id: string): TriggerDefinition {
		const definition = this.get(id);
		if (!definition) throw new Error(`Unknown trigger definition '${id}'`);
		return definition;
	}

	public describe(): TriggerDefinitionDescriptor[] {
		return [...this.definitions.values()].sort((a, b) => a.id.localeCompare(b.id)).map(definition => ({ schemaVersion: 1, id: definition.id, effectType: definition.effect.type }));
	}

	public toSettings(): TriggerDefinition[] {
		return [...this.definitions.values()].sort((a, b) => a.id.localeCompare(b.id)).map(definition => structuredClone(definition));
	}
}

export function validateTriggerDefinition(value: unknown): asserts value is TriggerDefinition {
	const definition = record(value, "Trigger definition");
	exactKeys(definition, ["schemaVersion", "id", "effect"], "Trigger definition");
	if (definition.schemaVersion !== 1) throw new Error("Unsupported trigger definition schema version");
	if (typeof definition.id !== "string" || !/^[a-z0-9.-]{1,80}$/.test(definition.id)) throw new Error("Invalid trigger definition ID");
	validateEffectSettings(definition.effect);
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

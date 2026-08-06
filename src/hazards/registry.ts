import type { HazardDocument } from "../contracts/documents.js";

export interface HazardDefinition {
	type: string;
}

/** Registry of serialized hazard types; runtime behavior is added per hazard. */
export class HazardRegistry {
	private readonly definitions = new Map<string, HazardDefinition>();

	public register(definition: HazardDefinition): void {
		if (!definition.type) throw new Error("Hazard types must be non-empty")
		if (this.definitions.has(definition.type)) throw new Error(`Hazard type already registered: ${definition.type}`)
		this.definitions.set(definition.type, { ...definition });
	}
	public validate(hazard: HazardDocument): void {
		if (hazard.trigger.type !== "collision") throw new Error(`Unsupported hazard trigger: ${hazard.trigger.type}`)
		if (!this.definitions.has(hazard.type)) throw new Error(`Unknown hazard type: ${hazard.type}`)
	}
}

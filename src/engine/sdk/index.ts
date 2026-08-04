import { EngineSystemRegistry, type EngineFrameworkSettings, type EngineSystemDefinition } from "./systemRegistry.js";
import { EngineWorldBuilder, type EngineWorldSettings } from "./worldBuilder.js";
import { assertJsonValue, type JsonValue } from "../contracts/systemSettings.js";

/** Single generic Engine SDK entry point. It has no dependency on KORE game code. */
export const engine = {
	createWorld(options: { id: string; worldSize: { x: number; y: number } }): EngineWorldBuilder { return new EngineWorldBuilder(options.id, options.worldSize); },
	createSystemRegistry(): EngineSystemRegistry { return new EngineSystemRegistry(); },
	/** Creates a detached JSON-safe generic entity authoring record. */
	createEntity<T extends JsonValue>(settings: T): T { assertJsonValue(settings); return structuredClone(settings); },
	/** Creates a detached JSON-safe generic structure/geometry authoring record. */
	createStructure<T extends JsonValue>(settings: T): T { assertJsonValue(settings); return structuredClone(settings); },
	/** Creates a detached JSON-safe generic effect authoring record. */
	createEffect<T extends JsonValue>(settings: T): T { assertJsonValue(settings); return structuredClone(settings); },
	/** Validates an arbitrary generic SDK value is JSON-safe. */
	validate(value: unknown): asserts value is JsonValue { assertJsonValue(value); },
	buildJson(settings: EngineWorldSettings | EngineFrameworkSettings, space: number = 2): string { return JSON.stringify(settings, null, space); },
} as const;

export { EngineSystemRegistry, EngineWorldBuilder };
export type { EngineFrameworkSettings, EngineSystemDefinition, EngineWorldSettings };

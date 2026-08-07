/** Standalone public Engine SDK declaration. */
export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export type SystemSettings = { systemId: string; schemaVersion: 1; state: Record<string, unknown> };
export interface EngineSystemDefinition {
    id: string;
    schemaVersion?: 1;
    provides?: readonly string[];
    requires?: readonly string[];
    before?: readonly string[];
    after?: readonly string[];
    replaces?: readonly string[];
    optional?: boolean;
    state?: Record<string, JsonValue>;
}
export type EngineFrameworkSettings = { schemaVersion: 1; systems: SystemSettings[]; systemOrder: string[] };
export interface EngineWorldSettings {
    schemaVersion: 1;
    id: string;
    worldSize: { x: number; y: number };
    background?: JsonValue;
    entities: JsonValue[];
    structures: JsonValue[];
    effects: JsonValue[];
    framework?: EngineFrameworkSettings;
}
export declare class EngineSystemRegistry {
    register(definition: EngineSystemDefinition): this;
    select(ids: readonly string[]): EngineFrameworkSettings;
    validate(settings: unknown): asserts settings is EngineFrameworkSettings;
}
export declare class EngineWorldBuilder {
    constructor(id: string, worldSize: { x: number; y: number });
    setBackground(background: JsonValue): this;
    addEntity(entity: JsonValue): this;
    addStructure(structure: JsonValue): this;
    addEffect(effect: JsonValue): this;
    useFramework(framework: EngineFrameworkSettings): this;
    build(): EngineWorldSettings;
    buildJson(space?: number): string;
}
export declare const engine: {
    readonly createWorld: (options: { id: string; worldSize: { x: number; y: number } }) => EngineWorldBuilder;
    readonly createSystemRegistry: () => EngineSystemRegistry;
    readonly createEntity: <T extends JsonValue>(settings: T) => T;
    readonly createStructure: <T extends JsonValue>(settings: T) => T;
    readonly createEffect: <T extends JsonValue>(settings: T) => T;
    readonly validate: (value: unknown) => asserts value is JsonValue;
    readonly buildJson: (settings: EngineWorldSettings | EngineFrameworkSettings, space?: number) => string;
};

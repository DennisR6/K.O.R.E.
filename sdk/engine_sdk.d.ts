/** Standalone public Engine SDK declaration. */
export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export type SystemSettings = { systemId: string; schemaVersion: 1; state: Record<string, unknown> };
export interface EngineTransformState { schemaVersion: 1; position: { x: number; y: number }; rotation: number; }
export interface EngineMovementState { schemaVersion: 1; velocity: { x: number; y: number }; angularVelocity: number; enabled: boolean; }
export interface CounterState { schemaVersion: 1; id: string; value: number; }
export declare const COUNTER_SCHEMA_VERSION: 1;
export declare function createCounterState(input: { id: string; value?: number }): CounterState;
export declare function canonicalizeCounterStates(value: unknown): CounterState[];
export declare function validateCounterState(value: unknown): asserts value is CounterState;
export declare function createTransformState(input: { position: { x: number; y: number }; rotation?: number }): EngineTransformState;
export declare function createMovementState(input: { velocity: { x: number; y: number }; angularVelocity?: number; enabled?: boolean }): EngineMovementState;
export declare function validateTransformState(value: unknown): asserts value is EngineTransformState;
export declare function validateMovementState(value: unknown): asserts value is EngineMovementState;
export declare const MOVEMENT_SET_VELOCITY_EFFECT_ID: "movement.set-velocity";
export declare const MOVEMENT_ADD_VELOCITY_EFFECT_ID: "movement.add-velocity";
export declare const MOVEMENT_SCALE_SPEED_EFFECT_ID: "movement.scale-speed";
export interface MovementVelocityPayload { x: number; y: number; }
export interface MovementScaleSpeedPayload { factor: number; }
export declare const TRANSFORM_CAPABILITY: "transform.state";
export declare const TRANSFORM_SET_POSITION_EFFECT_ID: "transform.set-position";
export declare const TRANSFORM_SET_ROTATION_EFFECT_ID: "transform.set-rotation";
export interface TransformSetPositionPayload { x: number; y: number; }
export interface TransformSetRotationPayload { rotation: number; }
export type EngineEffectSettings = { type: string; schemaVersion?: 1; typeValue: JsonValue; target?: JsonValue };
export interface EngineEffectDefinition {
    id: string;
    schemaVersion?: 1;
    requiresCapability?: readonly string[];
    targetType?: string;
    lifecycleCategory?: string;
    validatePayload?: (payload: JsonValue) => void;
    validateTarget?: (target: JsonValue) => void;
}
export type EngineEffectDescriptor = Omit<EngineEffectDefinition, "validatePayload" | "validateTarget">;
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
    acceptsEffects?: readonly string[];
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
    counters: CounterState[];
    framework?: EngineFrameworkSettings;
}
export declare class EngineSystemRegistry {
    register(definition: EngineSystemDefinition): this;
    select(ids: readonly string[]): EngineFrameworkSettings;
    validate(settings: unknown): asserts settings is EngineFrameworkSettings;
    validateEffectSupport(settings: unknown, effects: readonly unknown[], catalog: EngineEffectRegistry): void;
}
export declare class EngineEffectRegistry {
    register(definition: EngineEffectDefinition): this;
    get(id: string): EngineEffectDefinition | undefined;
    validate(effect: unknown): asserts effect is EngineEffectSettings;
    describe(): EngineEffectDescriptor[];
}
export declare function registerMovementCommands(registry: EngineEffectRegistry): EngineEffectRegistry;
export declare function registerTransformEffects(registry: EngineEffectRegistry): EngineEffectRegistry;
export declare const COUNTER_CAPABILITY: "counter.state";
export declare const COUNTER_SET_EFFECT_ID: "counter.set";
export declare const COUNTER_ADD_EFFECT_ID: "counter.add";
export declare const COUNTER_RESET_EFFECT_ID: "counter.reset";
export interface CounterTarget { type: "counter"; counterId: string; }
export interface CounterSetPayload { value: number; }
export interface CounterAddPayload { amount: number; }
export type CounterResetPayload = Record<string, never>;
export type EngineTriggerType = "tick" | "collision.enter" | "round.start" | "environment.activation" | "schedule.due";
export type CounterEffectSettings = { schemaVersion: 1; type: "counter.set"; target: CounterTarget; typeValue: CounterSetPayload } | { schemaVersion: 1; type: "counter.add"; target: CounterTarget; typeValue: CounterAddPayload } | { schemaVersion: 1; type: "counter.reset"; target: CounterTarget; typeValue: CounterResetPayload };
export type CounterTriggerBinding = { trigger: EngineTriggerType; effect: CounterEffectSettings };
export declare function registerCounterCommands(registry: EngineEffectRegistry): EngineEffectRegistry;
export declare function validateCounterEffectSettings(value: unknown): asserts value is CounterEffectSettings;
export declare function validateCounterTarget(value: unknown): asserts value is CounterTarget;
export declare function validateCounterTriggerBinding(value: unknown): asserts value is CounterTriggerBinding;
export declare class EngineWorldBuilder {
    constructor(id: string, worldSize: { x: number; y: number });
    setBackground(background: JsonValue): this;
    addEntity(entity: JsonValue): this;
    addStructure(structure: JsonValue): this;
    addEffect(effect: JsonValue): this;
    addCounter(counter: CounterState): this;
    useFramework(framework: EngineFrameworkSettings): this;
    build(): EngineWorldSettings;
    buildJson(space?: number): string;
}
export declare const engine: {
    readonly createWorld: (options: { id: string; worldSize: { x: number; y: number } }) => EngineWorldBuilder;
    readonly createSystemRegistry: () => EngineSystemRegistry;
    readonly createEffectRegistry: () => EngineEffectRegistry;
    readonly createTransformState: typeof createTransformState;
    readonly createMovementState: typeof createMovementState;
    readonly createCounterState: typeof createCounterState;
    readonly canonicalizeCounterStates: typeof canonicalizeCounterStates;
    readonly validateCounterState: typeof validateCounterState;
    readonly createEntity: <T extends JsonValue>(settings: T) => T;
    readonly createStructure: <T extends JsonValue>(settings: T) => T;
    readonly createEffect: <T extends JsonValue>(settings: T) => T;
    readonly validate: (value: unknown) => asserts value is JsonValue;
    readonly buildJson: (settings: EngineWorldSettings | EngineFrameworkSettings, space?: number) => string;
};

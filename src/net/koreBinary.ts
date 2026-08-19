import { binary, createBinarySchemaRegistry, type BinarySchemaRegistry, type PackedSnapshotOptions } from "@coffeemakerstudio/roast";
import type { PlayerSettings } from "../entity/types.js";
import type { FullEffectSettings } from "../effects/types.js";
import type { NumericThresholdBinding } from "@coffeemakerstudio/roast";
import type { EngineWorldSettings } from "@coffeemakerstudio/roast";

export const KORE_BINARY_NAMESPACE = "kore";
export const KORE_BINARY_IDS = { player: 1, effect: 2, threshold: 3 } as const;

const effectTag: Record<string, number> = { "EffectType.Movement": 1, "EffectType.Physics": 2, "movement.set-velocity": 3, "participation.set-physics": 4, "participation.set-drawing": 5 };
const effectTrigger: Record<string, number> = { "EffectTrigger.Always": 1, "EffectTrigger.Collision": 2, "EffectTrigger.Round": 3 };
const effectSchema = binary.struct({ trigger: binary.u8(), effect: binary.taggedUnion({ tag: binary.u8(), variants: {
	1: binary.struct({ deltaTime: binary.f32(), x: binary.f32(), y: binary.f32() }),
	2: binary.struct({ friction: binary.f64(), linearDrag: binary.f64(), stopThreshold: binary.f64() }),
	3: binary.struct({ x: binary.f32(), y: binary.f32() }),
	4: binary.struct({ enabled: binary.bool() }),
	5: binary.struct({ enabled: binary.bool() }),
} }) });
const effectArraySchema = binary.array(effectSchema);
const comparatorSchema = binary.enumU8({ "below-or-equal": 1, below: 2, above: 3, "above-or-equal": 4, equal: 5 });
const thresholdEntrySchema = binary.struct({ comparator: comparatorSchema, value: binary.f32(), effects: effectArraySchema });
const thresholdSchema = binary.struct({ id: binary.string(), thresholds: binary.array(thresholdEntrySchema) });
const thresholdArraySchema = binary.array(thresholdSchema);
const playerWireSchema = binary.struct({ id: binary.string(), hp: binary.f32(), bouncyness: binary.f32(), mass: binary.f32(), size: binary.f32(), friction: binary.optional(binary.f32()), team: binary.array(binary.u8()), color: binary.string(), playericon: binary.u16(), shape: binary.u8(), hoop: binary.u16(), physics: binary.bool(), drawing: binary.bool(), remainder: binary.string() });

export type KorePlayerWire = { id: string; hp: number; bouncyness: number; mass: number; size: number; friction?: number; team: number[]; color: string; playericon: number; shape: number; hoop: number; physics: boolean; drawing: boolean; remainder: string };
export const korePlayerSchema = playerWireSchema;
export const koreEffectSchema = effectArraySchema;
export const koreThresholdSchema = thresholdArraySchema;

export const koreRegistry: BinarySchemaRegistry = createBinarySchemaRegistry()
	.register({ namespace: KORE_BINARY_NAMESPACE, typeId: KORE_BINARY_IDS.player, version: 1, name: "player", schema: korePlayerSchema })
	.register({ namespace: KORE_BINARY_NAMESPACE, typeId: KORE_BINARY_IDS.effect, version: 1, name: "effects", schema: koreEffectSchema })
	.register({ namespace: KORE_BINARY_NAMESPACE, typeId: KORE_BINARY_IDS.threshold, version: 1, name: "thresholds", schema: koreThresholdSchema });

function cloneJson(value: unknown): any { return JSON.parse(JSON.stringify(value)); }
function encodeEffect(effect: any): any { const tag = effectTag[effect.type]; if (!tag) throw new Error(`Unsupported KORE effect ${effect.type}`); const trigger = effectTrigger[effect.trigger ?? "EffectTrigger.Always"]; if (!trigger) throw new Error(`Unsupported KORE trigger ${effect.trigger}`); const v = effect.typeValue ?? {}; return { trigger, effect: { tag, value: tag === 1 ? { deltaTime: v.deltaTime, x: v.x, y: v.y } : tag === 2 ? { friction: v.friction, linearDrag: v.linearDrag, stopThreshold: v.stopThreshold } : tag === 3 ? { x: v.x, y: v.y } : { enabled: v.enabled } } }; }
function decodeEffect(wire: any): any { const type = Object.entries(effectTag).find(([, id]) => id === wire.effect.tag)?.[0]; const trigger = Object.entries(effectTrigger).find(([, id]) => id === wire.trigger)?.[0]; if (!type || !trigger) throw new Error("Unknown KORE packed effect tag"); return { schemaVersion: 1, trigger, triggerValue: [], type, typeValue: wire.effect.value }; }
export function effectsToWire(effects: FullEffectSettings[]): any[] { return effects.map(encodeEffect); }
export function effectsFromWire(effects: any[]): FullEffectSettings[] { return effects.map(decodeEffect) as FullEffectSettings[]; }
export function thresholdsToWire(thresholds: NumericThresholdBinding[]): any[] { return thresholds.map(binding => ({ id: binding.id, thresholds: binding.thresholds.map(threshold => ({ comparator: threshold.comparator, value: threshold.value, effects: effectsToWire(threshold.effects as any) })) })); }
export function thresholdsFromWire(thresholds: any[]): NumericThresholdBinding[] { return thresholds.map(binding => ({ schemaVersion: 1, id: binding.id, thresholds: binding.thresholds.map((threshold: any) => ({ schemaVersion: 1, comparator: threshold.comparator, value: threshold.value, effects: effectsFromWire(threshold.effects).map(effect => { const { trigger: _trigger, triggerValue: _triggerValue, ...settings } = effect as any; return settings; }) })) })) as NumericThresholdBinding[]; }
export function playerToWire(player: PlayerSettings, packed: { effects?: boolean; thresholds?: boolean } = { effects: true, thresholds: true }): KorePlayerWire { const source = cloneJson(player); const { id, hp, bouncyness, mass, size, friction, team, color, playericon, shape, hoop, isPhysicsEnabled, isDrawingEnabled, effects, numericThresholds, position: _position, velocity: _velocity, rotation: _rotation, angularVelocity: _angularVelocity, ...remainder } = source; if (!packed.effects) (remainder as any).effects = effects; if (!packed.thresholds) (remainder as any).numericThresholds = numericThresholds; return { id, hp, bouncyness, mass, size, friction, team, color, playericon, shape, hoop, physics: isPhysicsEnabled, drawing: isDrawingEnabled, remainder: JSON.stringify(remainder) } as KorePlayerWire; }
export function wireToPlayer(wire: KorePlayerWire, hot: { position: any; velocity: any; rotation: number; angularVelocity: number }, effects: FullEffectSettings[] = [], numericThresholds: NumericThresholdBinding[] = []): PlayerSettings { const remainder = wire.remainder ? JSON.parse(wire.remainder) : {}; return { ...remainder, id: wire.id, hp: wire.hp, bouncyness: wire.bouncyness, mass: wire.mass, size: wire.size, friction: wire.friction, team: wire.team, color: wire.color, playericon: wire.playericon, shape: wire.shape as unknown as PlayerSettings["shape"], hoop: wire.hoop, isPhysicsEnabled: wire.physics, isDrawingEnabled: wire.drawing, effects, numericThresholds, ...hot } as PlayerSettings; }
export type KorePackedStage = 1 | 2 | 3;
export function korePackedOptions(stage: KorePackedStage = 3): PackedSnapshotOptions { const components: Record<string, { namespace: string; typeId: number; version: number }> = { "kore.player.state": { namespace: KORE_BINARY_NAMESPACE, typeId: 1, version: 1 } }; if (stage >= 2) components["kore.effects.state"] = { namespace: KORE_BINARY_NAMESPACE, typeId: 2, version: 1 }; if (stage >= 3) components["kore.thresholds.state"] = { namespace: KORE_BINARY_NAMESPACE, typeId: 3, version: 1 }; return { registry: koreRegistry, components }; }
export function korePackedSettings(settings: EngineWorldSettings & { entities: any[] }, stage: KorePackedStage = 3): EngineWorldSettings { return { ...settings, entities: settings.entities.map(entity => { const source = entity as Record<string, any>; const output: Record<string, unknown> = { ...source, "kore.player.state": playerToWire(source["kore.player.state"], { effects: stage >= 2, thresholds: stage >= 3 }) }; if (stage >= 2) output["kore.effects.state"] = effectsToWire(source["kore.effects.state"] ?? []); if (stage >= 3) output["kore.thresholds.state"] = thresholdsToWire(source["kore.thresholds.state"] ?? []); return output; }) } as unknown as EngineWorldSettings; }

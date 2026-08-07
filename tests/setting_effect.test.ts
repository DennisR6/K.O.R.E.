import { expect, test } from "bun:test";
import { EffectModifySetting } from "../src/effects/modifySetting.ts";
import { MetaEffect } from "../src/effects/effects.ts";
import { EffectTrigger, EffectType, SettingOperation } from "../src/effects/types.ts";
import { GameHandlerBuilder } from "../src/engine/Handler.ts";
import { Player } from "../src/entity/Player.ts";
import { createPlayerSettings } from "../src/entity/types.ts";
import { StructureCircle } from "../src/structures/structureCircle.ts";
import IceMap from "../src/settings/iceMap.ts";
import { SHAPE } from "../src/physics/physics.ts";

test("setting effects mutate and serialize set, add, and remove operations", () => {
	const player = new Player(createPlayerSettings({ hp: 30, position: { x: 0, y: 0 } }))
	const damage = new EffectModifySetting({ typeValue: { operation: SettingOperation.Add, key: "hp", value: -10 } })
	damage.apply(player)
	expect(player.getHP()).toBe(20)

	new EffectModifySetting({ typeValue: { operation: SettingOperation.Remove, key: "hp", value: 5 } }).apply(player)
	expect(player.getHP()).toBe(15)

	const serialized = damage.toSettings()
	expect(serialized).toEqual({ schemaVersion: 1, type: damage.getType(), typeValue: { operation: SettingOperation.Add, key: "hp", value: -10 } })
	new MetaEffect(serialized).apply(player)
	expect(player.getHP()).toBe(5)
})

test("a death circle marks colliding players dead and removes them from selection", () => {
	const deathEffect = {
		schemaVersion: 1 as const,
		type: EffectType.Multi,
		typeValue: [
			new EffectModifySetting({ typeValue: { operation: SettingOperation.Set, key: "physicsEnabled", value: false } }).toSettings(),
			new EffectModifySetting({ typeValue: { operation: SettingOperation.Set, key: "drawingEnabled", value: false } }).toSettings(),
		],
	};
	const player = new Player(createPlayerSettings({ position: { x: 35, y: 20 }, size: 12 }))
	const handler = new GameHandlerBuilder()
		.defaultSystems()
		.addStructure(new StructureCircle(20, 20, 10, undefined, [{ trigger: EffectTrigger.Collision, triggerValue: [], ...deathEffect }]))
		.addPlayer(player)
		.build()

	handler.tick()
	expect(player.isDead()).toBe(true)
	expect(player.getVel()).toEqual({ x: 0, y: 0 })
	expect(handler.getEntityManager().getEntityAt(player.getPos().x, player.getPos().y)).toBeUndefined()
})

	test("ice-map death circles use serializable participation settings", () => {
	const deathCircle = IceMap.IceMap.mapBoundarys.find(boundary => boundary.type === SHAPE.CIRCLE)!
	expect(deathCircle.effects.some(effect =>
		 effect.type === EffectType.Multi && Array.isArray(effect.typeValue) &&
		 effect.typeValue.some(child => child.typeValue.key === "physicsEnabled" && child.typeValue.value === false) &&
		 effect.typeValue.some(child => child.typeValue.key === "drawingEnabled" && child.typeValue.value === false),
	)).toBe(true)
})

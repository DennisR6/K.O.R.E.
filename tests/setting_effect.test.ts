import { expect, test } from "bun:test";
import { EffectModifySetting } from "../src/effects/modifySetting.ts";
import { MetaEffect } from "../src/effects/effects.ts";
import { EffectType, SettingOperation } from "../src/effects/types.ts";
import { createCollisionCommandBinding } from "@coffeemakerstudio/roast";
import { createEngineEffectComposition } from "@coffeemakerstudio/roast";
import { PARTICIPATION_SET_DRAWING_EFFECT_ID, PARTICIPATION_SET_PHYSICS_EFFECT_ID } from "@coffeemakerstudio/roast";
import { GameHandlerBuilder } from "../src/kore/runtime/Handler.ts";
import { Player } from "../src/entity/Player.ts";
import { createPlayerSettings } from "../src/entity/types.ts";
import { StructureCircle } from "../src/structures/structureCircle.ts";
import IceMap from "../src/settings/iceMap.ts";
import { SHAPE } from "@coffeemakerstudio/bean";

test("setting effects mutate and serialize set, add, and remove operations", () => {
	const player = new Player(createPlayerSettings({ hp: 30, position: { x: 0, y: 0 } }))
	const handler = new GameHandlerBuilder().defaultSystems().addPlayer(player).build()
	const damage = new EffectModifySetting({ typeValue: { operation: SettingOperation.Add, key: "hp", value: -10 } })
	damage.apply(player)
	expect(player.getHP()).toBe(20)

	new EffectModifySetting({ typeValue: { operation: SettingOperation.Remove, key: "hp", value: 5 } }).apply(player)
	expect(player.getHP()).toBe(15)

	const serialized = damage.toSettings()
	expect(serialized).toEqual({ schemaVersion: 1, type: EffectType.ModifySetting, typeValue: { operation: SettingOperation.Add, key: "hp", value: -10 } })
	new MetaEffect(serialized).apply(player)
	expect(player.getHP()).toBe(5)
})

test("a death circle marks colliding players dead and removes them from selection", () => {
	const player = new Player(createPlayerSettings({ position: { x: 35, y: 20 }, size: 12 }))
	const deathCommands = [createCollisionCommandBinding(createEngineEffectComposition([
		{ schemaVersion: 1, type: PARTICIPATION_SET_PHYSICS_EFFECT_ID, typeValue: { enabled: false } },
		{ schemaVersion: 1, type: PARTICIPATION_SET_DRAWING_EFFECT_ID, typeValue: { enabled: false } },
	]))];
	const handler = new GameHandlerBuilder()
		.defaultSystems()
		.addStructure(new StructureCircle(20, 20, 10, undefined, [], undefined, "death-circle", true, true, deathCommands))
		.addPlayer(player)
		.build()

	handler.tick()
	expect(player.isDead()).toBe(true)
	expect(player.getVel()).toEqual({ x: 0, y: 0 })
	expect(handler.getEntityManager().getEntityAt(player.getPos().x, player.getPos().y)).toBeUndefined()
})

	test("ice-map death circles use serializable participation settings", () => {
	const deathCircle = IceMap.IceMap.mapBoundarys.find(boundary => boundary.type === SHAPE.CIRCLE)!
	expect(deathCircle.effects).toEqual(expect.any(Array));
	expect(deathCircle.collisionCommands?.[0]?.effect).toMatchObject({ type: "effect.composition", effects: [
		{ type: "participation.set-physics", typeValue: { enabled: false } },
		{ type: "participation.set-drawing", typeValue: { enabled: false } },
	] });
})

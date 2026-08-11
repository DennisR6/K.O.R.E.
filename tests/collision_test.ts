import { expect, test, describe, beforeEach } from "bun:test";
import { GameHandler, GameHandlerBuilder } from "../src/kore/runtime/Handler.ts"
import { ObjectEmitter } from "../src/emitter/ObjectEmitter.ts"
import { EmitterSystem } from "../src/systems/Emitter.ts"
import { UiSystem } from "../src/systems/UiSystem.ts";
import { FRICTION_TABLE } from "../src/settings/settings.ts";
import { StructureCircle } from "../src/structures/structureCircle.ts";
import { EffectTrigger, EffectType, SettingOperation } from "../src/effects/types.ts";
import { EffectPhysics } from "../src/effects/physics.ts";
import { Player } from "../src/entity/Player.ts";
import { createPlayerSettings } from "../src/entity/types.ts";
import { EffectMove } from "../src/effects/movement.ts";
import { IPhysics, SHAPE } from "@coffeemakerstudio/bean";
import { IStructure } from "../src/structures/types.ts";





describe("Testing Collisions with effects", () => {
	let handler: GameHandler
	const em = new ObjectEmitter()
	beforeEach(() => {
		const ui = new UiSystem()
		const physics = FRICTION_TABLE.ice
		handler = new GameHandlerBuilder()
			.defaultSystems()
			.addSystem(ui)
			.addUIMouse(ui)
			.addSystem(new EmitterSystem(em))
			.addStructure(new StructureCircle(200, 200, 20, undefined, [
				{
					trigger: EffectTrigger.Always, triggerValue: [],
					...new EffectPhysics({ typeValue: physics }).toSettings()
				},
				{
					trigger: EffectTrigger.Collision, triggerValue: [], schemaVersion: 1, type: EffectType.NumericAdd, typeValue: { stateId: "hp", amount: -30 }
				},
			]))
			.addPlayer(new Player(createPlayerSettings({
				position: { x: 150, y: 200 },
				size: 20,
				effects: [
					{
						trigger: EffectTrigger.Always, triggerValue: [],
						...new EffectPhysics({ typeValue: physics }).toSettings()
					},
					{
						trigger: EffectTrigger.Always, triggerValue: [],
						...new EffectMove({ typeValue: { deltaTime: 0, x: 0, y: 0 } }).toSettings()
					},
				]
			})))
			.build()
		handler.saveSettings(handler.toSettings())
	})

	test("starting engine", () => {
		const p1 = handler.getEntityManager().getEntities()[0]
		const sim = handler.simulateTurn(p1.getId(), 0, 1)
		handler.playTurn(sim)

		for (let i = 0; i <= sim.durationFrames; i++) handler.tick()

		expect(p1.getHP()).toBe(0)
		expect(p1.isDead()).toBe(true)
	})
})

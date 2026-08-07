import { test, expect } from "bun:test"
import { MetaEffect } from "../src/effects/effects.ts"
import { Player } from "../src/entity/Player.ts"
import { createPlayerSettings } from "../src/entity/types.ts"
import { EffectType, SettingOperation } from "../src/effects/types.ts"
import { EffectNumericAdd } from "../src/effects/numericAdd.ts"
import { GameHandlerBuilder } from "../src/engine/Handler.ts"


test("we are testing the Damage Effect", () => {
	const eff = new EffectNumericAdd({ typeValue: { stateId: "hp", amount: -10 } })
	const player = new Player(createPlayerSettings({ position: { x: 0, y: 0 } }))
	new GameHandlerBuilder().defaultSystems().addPlayer(player).build()
	eff.apply(player)
	const hp = player.getHP()

	expect(hp).toBe(20)
	expect(player.isDead()).toBe(false)
})

test("we are testing the Meta Damage Effect", () => {
	const eff = new MetaEffect({
		schemaVersion: 1,
		type: EffectType.NumericAdd,
		typeValue: { stateId: "hp", amount: -10 },
	})
	const player = new Player(createPlayerSettings({ position: { x: 0, y: 0 } }))
	new GameHandlerBuilder().defaultSystems().addPlayer(player).build()
	eff.apply(player)
	const hp = player.getHP()
	expect(hp).toBe(20)
})

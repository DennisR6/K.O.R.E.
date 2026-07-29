import { test, expect } from "bun:test"
import { MetaEffect } from "../src/effects/effects.ts"
import { Player } from "../src/entity/Player.ts"
import { createPlayerSettings } from "../src/entity/types.ts"
import { EffectType } from "../src/effects/types.ts"
import { EffectDamage } from "../src/effects/damage.ts"


test("we are testing the Damage Effect", () => {
	const eff = new EffectDamage({ typeValue: { damage: 10 } })
	const player = new Player(createPlayerSettings({ position: { x: 0, y: 0 } }))
	eff.apply(player)
	const hp = player.getHP()

	expect(hp).toBe(20)
	expect(player.isDead()).toBe(false)
})

test("we are testing the Meta Damage Effect", () => {
	const eff = new MetaEffect({
		type: EffectType.Damage,
		typeValue: { damage: 10 },
	})
	const player = new Player(createPlayerSettings({ position: { x: 0, y: 0 } }))
	eff.apply(player)
	const hp = player.getHP()
	expect(hp).toBe(20)
})

import { EffectMove, EffectMoveInput } from "../src/effects/movement.ts"
import { describe, expect, test } from "bun:test"
import { Player } from "../src/entity/Player.ts"
import { Vector2D } from "../src/physics/physics.ts"
import { EffectPhysics } from "../src/effects/physics.ts"
import { FRICTION_TABLE } from "../src/settings/settings.ts"
import { EffectTrigger } from "../src/effects/types.ts"
import { GameHandlerBuilder } from "../src/engine/Handler.ts"

describe(() => {
	const movementtest: EffectMoveInput[] = [
		{ x: 0, y: 0, deltaTime: 1 },
		{ x: 0, y: 10, deltaTime: 1 },
		{ x: 10, y: 0, deltaTime: 1 },
		{ x: 10, y: 10, deltaTime: 1 },
		{ x: 0, y: 0, deltaTime: 2 },
		{ x: 0, y: 10, deltaTime: 2 },
		{ x: 10, y: 0, deltaTime: 2 },
		{ x: 10, y: 10, deltaTime: 2 },
	]
	const overrideTest = [
		[{ x: 10, y: 0 }, { x: 0, y: 0, deltaTime: 1 }, { x: 20, y: 20, deltaTime: 1 }],
		[{ x: 0, y: 10 }, { x: 0, y: 10, deltaTime: 1 }, { x: 20, y: 0, deltaTime: 1 }],
		[{ x: 10, y: 10 }, { x: 0, y: 0, deltaTime: 1 }, { x: 20, y: 20, deltaTime: 1 }],
	] as Array<[Vector2D, EffectMoveInput, EffectMoveInput]>

	test.each(movementtest)("we are testing the movement effect", EffectMovementTest)
	test.each(overrideTest)("we are testing the override movement effect", EffectMovementOverrideTest)


})

function EffectMovementTest(input: EffectMoveInput) {
	const moveEffect = new EffectMove({ typeValue: input })
	const p1 = new Player().new({ position: { x: 0, y: 0 } })
	moveEffect.apply(p1)
	const { x, y } = p1.getPos()

	expect(x).toBe(input.x * input.deltaTime)
	expect(y).toBe(input.y * input.deltaTime)

	const settings = moveEffect.toSettings()
	expect(settings.typeValue.deltaTime).toBe(input.deltaTime)
	expect(settings.typeValue.x).toBe(input.x)
	expect(settings.typeValue.y).toBe(input.y)
}

function EffectMovementOverrideTest(startVel: Vector2D, input: EffectMoveInput, override: EffectMoveInput) {
	const moveEffect = new EffectMove({ typeValue: input })
	const p1 = new Player().new({ position: { x: 0, y: 0 } })
	p1.setVel(startVel)
	moveEffect.apply(p1, { x: startVel.x + override.x, y: startVel.y + override.y, deltaTime: override.deltaTime })

	const { x, y } = p1.getPos()
	expect(x).toBe((startVel.x + override.x) * override.deltaTime)
	expect(y).toBe((startVel.y + override.y) * override.deltaTime)
}

test("effectPhysics", () => {
	const effectPhysics = new EffectPhysics({ typeValue: FRICTION_TABLE.ice })
	const p1 = new Player().new({ position: { x: 0, y: 0 } })
	p1.addEffect(EffectTrigger.Always, effectPhysics)
	p1.setVel({ x: -10, y: 10 })
	const snapshot = JSON.stringify(p1.toSettings())
	effectPhysics.apply(p1, { dt: 1, friction: 0.995 })
	expect(p1.getVel().x).toBeCloseTo(-9.95, 1)
	expect(p1.getVel().y).toBeCloseTo(9.95, 1)

	const p2 = new Player().fromSettings(JSON.parse(snapshot))
	effectPhysics.apply(p2, { dt: 1, friction: 0.995 })
	expect(p2.getVel().x).toBeCloseTo(-9.95, 1)
	expect(p2.getVel().y).toBeCloseTo(9.95, 1)

	const p3 = new Player().fromSettings(JSON.parse(snapshot))
	const handler = new GameHandlerBuilder().defaultSystems()
		.addPlayer(p3)
		.build()

	handler.tick()

	const { x, y } = p3.getVel()
	expect(x).toBeCloseTo(-9.95, 1)
	expect(y).toBeCloseTo(9.95, 1)
})

import { describe, test } from "node:test";
import { createTestHandler } from "../src/engine/Handler.ts"
import { Simulator } from "../src/engine/Simulator.ts"
import { defaultPhysics } from "../src/physics/defaultPhysics.ts";
import { PhysicsSystem } from "../src/systems/PhysicsSystem.ts";
import { PlaybackSystem } from "../src/systems/PlayBackSystem.ts";
import { EntityManager } from "../src/entity/EntityManager.ts";
import { Player } from "../src/entity/player.ts";
import { StructureRectangle } from "../src/structures/structureRectangle.ts";

describe("teste, ob ein tick von 1 identisch ist, wie 100 ticks mit 0.1", { timeout: Infinity }, () => {
	test("teste, ob ein tick von 1 identisch ist, wie 100 ticks mit 0.1", () => {
		const physics = new defaultPhysics({ friction: 1, linearDrag: 1, stopThreshold: 0.1 })
		const e = new EntityManager([new Player().new({ x: 100, y: 100, id: "p1" })])
		const h = createTestHandler({ physicsStrategy: physics, entityManager: e })

		h.addSystem(new PhysicsSystem(physics))
		h.addSystem(new PlaybackSystem())
		h.setSimulator(new Simulator())
		h.addStructure(new StructureRectangle(0, 0, 10, 100, ""))
		let res;
		for (let i = 0; i < 10_000; i++) {
			res = h.simulateTurn("p1", 180, 100)
		}
	})
})

import { describe, test } from "node:test";
import { createTestHandler } from "../src/engine/Handler.js"
import { defaultPhysics } from "../src/physics/defaultPhysics.js";
import { PhysicsSystem } from "../src/systems/PhysicsSystem.js";
import { PlaybackSystem } from "../src/systems/PlayBackSystem.js";
import { EntityManager } from "../src/entity/EntityManager.js";
import { Player } from "../src/entity/Player.js";
import { StructureRectangle } from "../src/structures/structureRectangle.js";
import { Simulator } from "../src/systems/Simulator.js";

describe("teste, ob ein tick von 1 identisch ist, wie 100 ticks mit 0.1", { timeout: Infinity }, () => {
	test("teste, ob ein tick von 1 identisch ist, wie 100 ticks mit 0.1", () => {
		const physics = new defaultPhysics({ friction: 1, linearDrag: 1, stopThreshold: 0.1 })
		const e = new EntityManager([new Player().new({ x: 100, y: 100, id: "p1" })])
		const h = createTestHandler({ physicsStrategy: physics, entityManager: e })
		const physicsSystem = new PhysicsSystem(physics)
		h.addSystem(physicsSystem)
		h.addSystem(new PlaybackSystem())
		h.addSystem(new Simulator(physicsSystem))
		h.addStructure(new StructureRectangle(0, 0, 10, 100, ""))
		let res;
		for (let i = 0; i < 10_000; i++) {
			res = h.simulateTurn("p1", 180, 100)
		}
		res
	})
})

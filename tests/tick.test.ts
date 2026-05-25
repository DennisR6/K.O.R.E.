import { describe, test } from "node:test";
import { Player } from "../src/entity/Player.js";
import { GameHandlerBuilder } from "../src/engine/Handler.ts"

describe("teste, ob ein tick von 1 identisch ist, wie 100 ticks mit 0.1", { timeout: Infinity }, () => {
	test("teste, ob ein tick von 1 identisch ist, wie 100 ticks mit 0.1", () => {
		const handler = new GameHandlerBuilder()
			.defaultSystems()
			.addPlayer(new Player().new({ x: 100, y: 100, id: "p1" }))
			.build()
			.start()
		let res;
		for (let i = 0; i < 10_000; i++) {
			res = handler.simulateTurn("p1", 180, 100)
		}
		res
	})
})

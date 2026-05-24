import test, { describe } from "node:test"
import { gamelogs } from "./logs.js"
import { GameSettings } from "../src/settings/settings.js"
import { CombiEmitter, GameEmitter, LogEmitter } from "../src/emitter/Emitter.ts"
import { GameHandlerBuilder } from "../src/engine/Handler.ts"

describe("check logs of real games for Errors", () => {
	test(`1. Game`, () => {
		const TickRate = 1

		let handler = new GameHandlerBuilder(TickRate)
			.fromSettings(GameSettings)
			.build()
		const em = new CombiEmitter([new LogEmitter(), new GameEmitter(handler)])
		handler.setEmitter(em)
		handler.start()
		// const playerpos = []
		gamelogs.logs.forEach(log => {
			if (log.data[0] === "TURN") {
				// console.log(log.data[1])
			}
		})
	})
})

import { describe, test } from "bun:test"
import { GameHandlerBuilder } from "../src/engine/Handler.ts"
import { Player } from "../src/entity/Player.ts"
import { createPlayerSettings } from "../src/entity/types.ts"


describe(() => {
	let i = 0
	const players = [
		new Player(createPlayerSettings({ position: { x: ++i * 100, y: 0 }, id: "4a1282ef-6d77-4489-a09c-03eb4c681cee" })),
		new Player(createPlayerSettings({ position: { x: ++i * 100, y: 0 }, id: "9ab33594-3674-4668-8064-8af27337b022" })),
		new Player(createPlayerSettings({ position: { x: ++i * 100, y: 0 }, id: "b0cf5285-f780-4c60-982b-b729a8962a10" })),
		new Player(createPlayerSettings({ position: { x: ++i * 100, y: 0 }, id: "571848bd-8e62-4a71-b019-03bef13ac5f1" })),
	]
	const builder = new GameHandlerBuilder()
		.defaultSystems()
	for (const player of players) builder.addPlayer(player)
	const handler = builder.build()



	test("serializing", () => {
		const settings = handler.toSettings()
		console.log(settings)
	})



})

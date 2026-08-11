#!/home/eugen/.bun/bin/bun
import { GameHandlerBuilder } from "../src/kore/runtime/Handler.js";
import { Player } from "../src/entity/Player.js";
import { createPlayerSettings } from "../src/entity/types.js";
import { StructureRectangle } from "../src/structures/structureRectangle.js";

const handler = new GameHandlerBuilder()
	.defaultSystems()
	.addPlayer(new Player(createPlayerSettings({ position: { x: 100, y: 120 }, id: "10000000-0000-4000-8000-000000000001", size: 20, color: "red", team: [0] })))
	.addPlayer(new Player(createPlayerSettings({ position: { x: 200, y: 200 }, id: "20000000-0000-4000-8000-000000000002", size: 20, color: "cyan", team: [1] })))
	.addStructure(new StructureRectangle(0, 0, 400, 20, "white"))
	.addStructure(new StructureRectangle(0, 20, 20, 380, "white"))
	.addStructure(new StructureRectangle(0, 380, 400, 20, "white"))
	.addStructure(new StructureRectangle(380, 20, 20, 380, "white"))
	.build()
	.start()


const GAMES = {
	games: 10,
	rounds: 1_000,
	maxAngle: 360,
	maxPower: 10,
}
const file = Bun.file("output.log")
const writer = file.writer()
for (let index = 0; index < GAMES.games; index++) {
	const angle = Math.random() * GAMES.maxAngle
	const power = Math.random() * GAMES.maxPower
	for (let index = 0; index < GAMES.rounds; index++) {
		const sim = handler.simulateTurn("10000000-0000-4000-8000-000000000001", angle, power)
		handler.playTurn(sim)
		for (let index = 0; index < sim.durationFrames; index++) handler.tick(1)
	}
	writer.write(JSON.stringify(handler.exportGame()) + "\n")
}
writer.end()

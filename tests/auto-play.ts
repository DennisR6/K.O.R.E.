#!/home/eugen/.bun/bin/bun
import { GameHandlerBuilder } from "../src/engine/Handler";
import { Player } from "../src/entity/Player";
import { StructureRectangle } from "../src/structures/structureRectangle";

const handler = new GameHandlerBuilder()
	.defaultSystems()
	.addPlayer(new Player().new({ x: 100, y: 120, id: 1, size: 20, color: "red", team: ["1"] }))
	.addPlayer(new Player().new({ x: 200, y: 200, id: 2, size: 20, color: "cyan", team: ["2"] }))
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
		const sim = handler.simulateTurn(1, angle, power)
		handler.tickTurn(sim)
		for (let index = 0; index < sim.durationFrames; index++) handler.tick(1)
	}
	writer.write(JSON.stringify(handler.exportGame()) + "\n")
}
writer.end()

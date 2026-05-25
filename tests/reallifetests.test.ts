import test, { describe } from "node:test"
import { createReadStream } from "node:fs"
import { createInterface } from "node:readline"
import { GameHandlerBuilder } from "../src/engine/Handler"
import { Player } from "../src/entity/Player.ts"
import { StructureRectangle } from "../src/structures/structureRectangle.ts"
import { IInput, TurnPacket } from "../src/engine/types.ts"
import { EntityManager } from "../src/entity/EntityManager.ts"
import assert from "node:assert"
import { Vector2D } from "../src/physics/physics.ts"

describe("check logs of real games for Errors", async () => {

	const fileStream = createReadStream("./output.log")
	const rl = createInterface({ input: fileStream })

	test(`Game`, async () => {
		let lineNr = 0
		for await (const line of rl) {
			lineNr++;
			if (lineNr < 7) continue
			const structures = [
				new StructureRectangle(0, 0, 400, 20, "white"),
				new StructureRectangle(0, 20, 20, 380, "white"),
				new StructureRectangle(0, 380, 400, 20, "white"),
				new StructureRectangle(380, 20, 20, 380, "white"),
			]
			const players = [
				new Player().new({ x: 100, y: 120, id: 1, size: 20, color: "red", team: ["1"] }),
				new Player().new({ x: 200, y: 200, id: 2, size: 20, color: "cyan", team: ["2"] }),
			]
			const builder = new GameHandlerBuilder()
				.defaultSystems()
			structures.forEach(str => builder.addStructure(str))
			players.forEach(player => builder.addPlayer(player))
			const handler = builder.build().start()

			const turns = JSON.parse(line) as { logs: Array<IInput> }
			turns.logs.forEach((turn, id) => {
				const sim = handler.simulateTurn(turn.actorId, turn.angle, turn.power)
				handler.tickTurn(sim)
				const pos: Vector2D[] = []
				for (let i = 0; i < sim.durationFrames; i++) {
					handler.tick()
					handler.getEntityManager().getEntities().forEach(p => pos.push(p.getPos()))
				}
				if (checkIfPlayerFliesOutOfBounds(structures, sim, handler.getEntityManager(), id)) {
					assert(false, pos.slice(-100).map(({ x, y }) => `${x} ${y}`).join("\n")
						+ `\nlineNr: ${lineNr} turn: ${id}`)
				}
				// checkPlayersWithSimulation(sim, handler.getEntityManager(), lineNr)
				// checkPlayersWithSimulation2(sim, handler.getEntityManager(), lineNr)
				if (id == 6217) {
					console.log(pos.slice(-20).map(line => `${line.x} ${line.y}`).join("\n"))
					process.exit(1)
				}
			})
		}
	})
})
function checkIfPlayerFliesOutOfBounds(_bounds: StructureRectangle[], _sim: TurnPacket, entityManager: EntityManager, lineNr: number = 0): boolean {
	for (const player of entityManager.getEntities()) {
		const { x, y } = player.getPos()

		if (x < -50) return true
		if (y < -50) return true
		if (x > 450) return true
		if (y > 450) return true

		assert.equal(x > -50, true, `lineNr: ${lineNr} x: ${x}`)
		assert.equal(y > -50, true, `lineNr: ${lineNr} y: ${y}`)
		assert.equal(x < 450, true, `lineNr: ${lineNr} x: ${x}`)
		assert.equal(y < 450, true, `lineNr: ${lineNr} y: ${y}`)
	}
	return false
}
function checkPlayersWithSimulation(sim: TurnPacket, entityManager: EntityManager, lineNr: number = 0) {
	const MAX_DRIFT = 10
	const players = sim.finalState.map(player => { return { id: player.id, x: player.x, y: player.y } })
	for (let id = 0; id < players.length; id++) {
		const player = players[id]
		const actor = entityManager.getEntityById(player.id)!
		assert(actor, "Spieler existiert nicht?!")

		const { x, y } = actor.getPos()
		if (Math.abs(y - sim.finalState[id].y) > 0.001)
			console.log(`TURN-FEHLER: ID ${id} driftet ab. Y-Diff: ${Math.abs(y - sim.finalState[id].y)}`);
		assert.equal(
			Math.abs(x - sim.finalState[id].x) < MAX_DRIFT, true,
			`lineNr: ${lineNr} diff id: ${id} x: ${Math.abs(x - sim.finalState[id].x)}`
		)
		assert.equal(
			Math.abs(y - sim.finalState[id].y) < MAX_DRIFT, true,
			`lineNr: ${lineNr} diff id: ${id} y: ${Math.abs(y - sim.finalState[id].y)} ${JSON.stringify(entityManager.getEntities())}`
		)
	}
}
function checkPlayersWithSimulation2(_sim: TurnPacket, entityManager: EntityManager, lineNr: number) {
	const players = entityManager.getEntities(); // Passe das an dein Interface an

	players.forEach((player: any) => {
		const pos = player.getPos();
		const vel = player.getVel();

		// 1. BOUNDS CHECK: Das Spiel ist "kaputt", wenn Spieler außerhalb der Map sind
		if (pos.x < -1000 || pos.x > 5000 || pos.y < -1000 || pos.y > 5000) {
			throw new Error(`AssertionError: lineNr: ${lineNr} - ID ${player.id} ist aus dem Spielfeld geflogen! Pos: ${JSON.stringify(pos)}`);
		}

		// 2. VELOCITY CHECK: Wenn die Velocity "explodiert"
		if (Math.abs(vel.x) > 1000 || Math.abs(vel.y) > 1000) {
			throw new Error(`AssertionError: lineNr: ${lineNr} - ID ${player.id} hat eine physikalisch unmögliche Velocity: ${JSON.stringify(vel)}`);
		}

		// 3. NAN CHECK: Der häufigste Grund für "Geisterbewegungen"
		if (isNaN(pos.x) || isNaN(pos.y)) {
			throw new Error(`AssertionError: lineNr: ${lineNr} - ID ${player.id} hat NaN Position!`);
		}
	});
}

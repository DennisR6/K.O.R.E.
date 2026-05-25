// import { test, afterEach, beforeEach, describe } from "bun:test"
// import { createReadStream } from "node:fs"
// import { createInterface } from "node:readline"
// import { GameHandler, GameHandlerBuilder } from "../src/engine/Handler"
// import { Player } from "../src/entity/Player.ts"
// import { StructureRectangle } from "../src/structures/structureRectangle.ts"
// import { IInput, TurnPacket } from "../src/engine/types.ts"
// import { EntityManager } from "../src/entity/EntityManager.ts"
// import assert from "node:assert"
// import { Vector2D } from "../src/physics/physics.ts"

// describe("check logs of real games for Errors", async () => {
//
// 	const fileStream = createReadStream("./output.log")
// 	const rl = createInterface({ input: fileStream })
//
// 	let lineNr = 0
// 	const WORLD_SIZE = {
// 		X: 400,
// 		Y: 400,
// 		PADDING: 20
// 	}
// 	const structures = [
// 		new StructureRectangle(0, 0, WORLD_SIZE.X, WORLD_SIZE.PADDING, "white"),
// 		new StructureRectangle(0, WORLD_SIZE.PADDING, WORLD_SIZE.PADDING, WORLD_SIZE.Y - WORLD_SIZE.PADDING, "white"),
// 		new StructureRectangle(0, WORLD_SIZE.Y - WORLD_SIZE.PADDING, WORLD_SIZE.X, WORLD_SIZE.PADDING, "white"),
// 		new StructureRectangle(WORLD_SIZE.X - WORLD_SIZE.PADDING, WORLD_SIZE.PADDING, WORLD_SIZE.PADDING, WORLD_SIZE.Y - WORLD_SIZE.PADDING, "white"),
// 	]
// 	const players = [
// 		new Player().new({ x: 100, y: 120, id: 1, size: 20, color: "red", team: ["1"] }),
// 		new Player().new({ x: 200, y: 200, id: 2, size: 20, color: "cyan", team: ["2"] }),
// 	]
// 	let handler: GameHandler | undefined
// 	beforeEach(() => {
// 		const builder = new GameHandlerBuilder()
// 			.defaultSystems()
// 		structures.forEach(str => builder.addStructure(str))
// 		players.forEach(player => builder.addPlayer(player))
// 		handler = builder.build().start()
// 	})
// 	afterEach(() => {
// 		handler = undefined
// 	})
// 	for await (const line of rl) {
// 		lineNr++;
// 		test(`${lineNr}. Game`, async () => {
// 			if (global.gc) global.gc();
// 			const turns = JSON.parse(line) as { logs: Array<IInput> }
// 			turns.logs.forEach((turn, id) => {
// 				const sim = handler!.simulateTurn(turn.actorId, turn.angle, turn.power)
// 				handler!.tickTurn(sim)
// 				const pos: Vector2D[] = []
// 				for (let i = 0; i < sim.durationFrames; i++) {
// 					handler!.tick()
// 					handler!.getEntityManager().getEntities().forEach(p => pos.push(p.getPos()))
// 					if (checkIfPlayerFliesOutOfBounds(structures, sim, handler!.getEntityManager(), id)) {
// 						assert(false, pos.slice(-100).map(({ x, y }) => `${x} ${y}`).join("\n")
// 							+ `\nlineNr: ${lineNr} turn: ${id}`)
// 					}
// 				}
// 				// checkPlayersWithSimulation(sim, handler.getEntityManager(), id)
// 				// checkPlayersWithSimulation2(sim, handler.getEntityManager(), id)
// 			})
// 		})
// 	}
// })
// function checkIfPlayerFliesOutOfBounds(_bounds: StructureRectangle[], _sim: TurnPacket, entityManager: EntityManager, lineNr: number = 0): boolean {
// 	for (const player of entityManager.getEntities()) {
// 		const { x, y } = player.getPos()
//
// 		if (x < 0) return true
// 		if (y < 0) return true
// 		if (x > 400) return true
// 		if (y > 400) return true
//
// 		assert.equal(x > 0, true, `lineNr: ${lineNr} x: ${x}`)
// 		assert.equal(y > 0, true, `lineNr: ${lineNr} y: ${y}`)
// 		assert.equal(x < 400, true, `lineNr: ${lineNr} x: ${x}`)
// 		assert.equal(y < 400, true, `lineNr: ${lineNr} y: ${y}`)
// 	}
// 	return false
// }
// function checkPlayersWithSimulation(sim: TurnPacket, entityManager: EntityManager, lineNr: number = 0) {
// 	const MAX_DRIFT = 10
// 	const players = sim.finalState.map(player => { return { id: player.id, x: player.x, y: player.y } })
// 	for (let id = 0; id < players.length; id++) {
// 		const player = players[id]
// 		const actor = entityManager.getEntityById(player.id)!
// 		assert(actor, "Spieler existiert nicht?!")
//
// 		const { x, y } = actor.getPos()
// 		if (Math.abs(y - sim.finalState[id].y) > 0.001)
// 			console.log(`TURN-FEHLER: ID ${id} driftet ab. Y-Diff: ${Math.abs(y - sim.finalState[id].y)}`);
// 		assert.equal(
// 			Math.abs(x - sim.finalState[id].x) < MAX_DRIFT, true,
// 			`lineNr: ${lineNr} diff id: ${id} x: ${Math.abs(x - sim.finalState[id].x)}`
// 		)
// 		assert.equal(
// 			Math.abs(y - sim.finalState[id].y) < MAX_DRIFT, true,
// 			`lineNr: ${lineNr} diff id: ${id} y: ${Math.abs(y - sim.finalState[id].y)} ${JSON.stringify(entityManager.getEntities())}`
// 		)
// 	}
// }
// function checkPlayersWithSimulation2(_sim: TurnPacket, entityManager: EntityManager, lineNr: number) {
// 	const players = entityManager.getEntities(); // Passe das an dein Interface an
//
// 	players.forEach((player: any) => {
// 		const pos = player.getPos();
// 		const vel = player.getVel();
//
// 		// 1. BOUNDS CHECK: Das Spiel ist "kaputt", wenn Spieler außerhalb der Map sind
// 		if (pos.x < -1000 || pos.x > 5000 || pos.y < -1000 || pos.y > 5000) {
// 			throw new Error(`AssertionError: lineNr: ${lineNr} - ID ${player.id} ist aus dem Spielfeld geflogen! Pos: ${JSON.stringify(pos)}`);
// 		}
//
// 		// 2. VELOCITY CHECK: Wenn die Velocity "explodiert"
// 		if (Math.abs(vel.x) > 1000 || Math.abs(vel.y) > 1000) {
// 			throw new Error(`AssertionError: lineNr: ${lineNr} - ID ${player.id} hat eine physikalisch unmögliche Velocity: ${JSON.stringify(vel)}`);
// 		}
//
// 		// 3. NAN CHECK: Der häufigste Grund für "Geisterbewegungen"
// 		if (isNaN(pos.x) || isNaN(pos.y)) {
// 			throw new Error(`AssertionError: lineNr: ${lineNr} - ID ${player.id} hat NaN Position!`);
// 		}
// 	});
// }
//
// describe("2. check logs of real games for Errors", async () => {
// 	// 1. Lade alle Daten VOR dem Test (oder im Test selbst)
// 	// Nutze kein for-await im describe-Scope!
//
// 	const WORLD_SIZE = {
// 		X: 400,
// 		Y: 400,
// 		PADDING: 20
// 	}
// 	const structures = [
// 		new StructureRectangle(0, 0, WORLD_SIZE.X, WORLD_SIZE.PADDING, "white"),
// 		new StructureRectangle(0, WORLD_SIZE.PADDING, WORLD_SIZE.PADDING, WORLD_SIZE.Y - WORLD_SIZE.PADDING, "white"),
// 		new StructureRectangle(0, WORLD_SIZE.Y - WORLD_SIZE.PADDING, WORLD_SIZE.X, WORLD_SIZE.PADDING, "white"),
// 		new StructureRectangle(WORLD_SIZE.X - WORLD_SIZE.PADDING, WORLD_SIZE.PADDING, WORLD_SIZE.PADDING, WORLD_SIZE.Y - WORLD_SIZE.PADDING, "white"),
// 	]
// 	const players = [
// 		new Player().new({ x: 100, y: 120, id: 1, size: 20, color: "red", team: ["1"] }),
// 		new Player().new({ x: 200, y: 200, id: 2, size: 20, color: "cyan", team: ["2"] }),
// 	]
// 	const data = await Bun.file("./output.log").text();
// 	const lines = data.split("\n").filter(l => l.length > 0);
//
// 	lines.forEach((line, index) => {
// 		const lineNr = index + 1;
//
// 		test(`${lineNr}. Game`, async () => {
// 			if (global.gc) global.gc();
// 			// JEDER TEST baut seine eigene Welt!
// 			const builder = new GameHandlerBuilder().defaultSystems();
// 			structures.forEach(str => builder.addStructure(str));
// 			players.forEach(player => builder.addPlayer(player));
//
// 			const handler = builder.build().start();
//
// 			const turns = JSON.parse(line) as { logs: Array<IInput> };
// 			const pos: Vector2D[] = []
// 			turns.logs.forEach((turn, id) => {
// 				const sim = handler.simulateTurn(turn.actorId, turn.angle, turn.power);
// 				handler.tickTurn(sim);
//
// 				for (let i = 0; i < sim.durationFrames; i++) {
// 					handler.tick();
//
// 					handler!.getEntityManager().getEntities().forEach(p => pos.push(p.getPos()))
// 					if (checkIfPlayerFliesOutOfBounds(structures, sim, handler!.getEntityManager(), id)) {
// 						assert(false, pos.slice(-100).map(({ x, y }) => `${x} ${y}`).join("\n")
// 							+ `\nlineNr: ${lineNr} turn: ${id}`)
// 					}
// 				}
// 			});
// 		});
// 	});
// });

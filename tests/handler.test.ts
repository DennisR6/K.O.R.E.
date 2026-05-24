import test, { describe } from "node:test";
import { Player } from "../src/entity/Player.js";
import { defaultPhysics } from "../src/physics/defaultPhysics.js";
import { GameState, type IInputEmitter } from "../src/engine/types.js";
import assert from "node:assert";
import { PhysicsSystem } from "../src/systems/PhysicsSystem.js";
import { EntityManager } from "../src/entity/EntityManager.js";
import { Simulator } from "../src/systems/Simulator.js";
import { GameHandlerBuilder } from "../src/engine/Handler.js";


/**
 * @test Handler & Physics System Integration
 * 
 * Diese Suite prüft die tiefere Integration: Wie reagieren Systeme auf Kollisionen
 * und bleibt die Engine über eine lange Kette von Ereignissen (Multi-Turn) stabil?
 */
describe("Handler & Physics System Integration", () => {

	/**
		 * Test: Elastische Kollisionsauflösung.
		 * 
		 * Prüft, ob das PhysicsSystem Kollisionen erkennt und Impulse korrekt umkehrt.
		 * 
		 * Szenario:
		 * P1 rast nach rechts (Vel: 10), P2 rast nach links (Vel: -10).
		 * Nach dem Aufprall müssen sie voneinander abprallen.
		 */
	test("PhysicsSystem - Elastic Collision Resolution", () => {
		const p1 = new Player().new({ id: "1", x: 200, y: 0, size: 60 });
		const p2 = new Player().new({ id: "2", x: 100, y: 0, size: 60 });

		const handler = new GameHandlerBuilder().defaultSystems()
			.addPlayer(p1)
			.addPlayer(p2)
			.build()
			.start()

		const move1 =
			handler.simulateTurn("1", 0, 10)
		handler.tickTurn(move1)
		handler.finalizeTurnManual()
		const move2 = handler.simulateTurn("2", 180, 10)
		handler.tickTurn(move2)
		handler.finalizeTurnManual()



		for (let i = 0; i < 1; i++) {
			handler.tick()
		}

		assert.ok(p1.getVel().x > 0, "Entity 1 should be moving left after collision");
		assert.ok(p2.getVel().x < 0, "Entity 2 should be moving right after collision");
	});

	/**
		 * Test: Determinismus über mehrere Spielzüge hinweg.
		 * 
		 * Dies ist der "Härtetest". Er führt eine komplexe Sequenz von 5 Schüssen zweimal 
		 * komplett unabhängig aus und vergleicht das Endergebnis.
		 * 
		 * Warum das wichtig ist:
		 * In einer Engine können sich winzige Rundungsfehler oder ein falsch zurückgesetzter 
		 * State über die Zeit aufsummieren ("Drift"). Wenn das Ergebnis nach 5 Zügen 
		 * noch Bit-für-Bit identisch ist, ist die Engine absolut deterministisch.
		 */
	test("Handler - Determinism across Multi-Turn Sequences", () => {
		const runFullSequence = () => {
			const handler =
				new GameHandlerBuilder()
					.defaultSystems()
					.addPlayer(new Player().new({ id: "p1", x: 100, y: 100, size: 60 }))
					.addPlayer(new Player().new({ id: "p2", x: 400, y: 400, size: 60 }))
					.build()
					.start()

			const shots = [
				{ angle: 0, power: 50 },
				{ angle: 180, power: 30 },
				{ angle: 90, power: 80 },
				{ angle: 315, power: 40 },
				{ angle: 0.5, power: 100 }
			];

			shots.forEach((shot, index) => {
				const actorId = index % 2 === 0 ? "p1" : "p2";
				const ticket = handler.simulateTurn(actorId, shot.angle, shot.power);

				assert.ok(ticket.durationFrames > 0, `Turn ${index}: Simulation resulted in immediate standstill`);
				assert.strictEqual(ticket.finalState.length, 2, `Turn ${index}: Snapshot does not contain all entities`);

				handler.tickTurn(ticket);
				handler.finalizeTurnManual();

				handler.getEntityManager().getEntities().forEach(e => {
					const pos = e.getPos();
					assert.ok(!isNaN(pos.x) && !isNaN(pos.y), `NaN detected in Entity ${e.getId()} after Turn ${index}`);
				});
			});

			return handler.getEntityManager().getEntities().map(e => ({
				id: e.getId(),
				pos: { x: e.getPos().x, y: e.getPos().y }
			}));
		};

		const result1 = runFullSequence();
		const result2 = runFullSequence();

		for (let i = 0; i < result1.length; i++) {
			assert.strictEqual(
				result1[i].pos.x,
				result2[i].pos.x,
				`Determinism failure: X-coordinate mismatch for Entity ${result1[i].id}`
			);
			assert.strictEqual(
				result1[i].pos.y,
				result2[i].pos.y,
				`Determinism failure: Y-coordinate mismatch for Entity ${result1[i].id}`
			);
		}
	});

	/**
		 * Test: State Lifecycle Initialisierung.
		 * 
		 * Ein simpler, aber kritischer Check: Startet die Engine wirklich im 
		 * richtigen Modus, damit der Spieler sofort interagieren kann?
		 */
	test("Handler - Initial State Lifecycle", () => {
		const p1 = new Player().new({ id: "p1", x: 100, y: 100, size: 60 });

		const handler = new GameHandlerBuilder()
			.defaultSystems()
			.addPlayer(p1)
			.build()
		handler.start()


		assert.strictEqual(
			handler.getContext().state,
			GameState.YOUR_TURN,
			"Handler failed to initialize in YOUR_TURN state"
		);
	});
});

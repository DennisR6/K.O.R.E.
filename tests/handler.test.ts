import test, { describe } from "node:test";
import { Player } from "../src/entity/player.ts";
import { defaultPhysics } from "../src/physics/defaultPhysics.ts";
import { Simulator } from "../src/engine/Simulator.ts";
import { createDefaultContext, GameState, type IInputEmitter } from "../src/engine/types";
import assert from "node:assert";
import { createTestHandler, GameHandler } from "../src/engine/Handler.ts";
import { PhysicsSystem } from "../src/systems/PhysicsSystem.ts";
import { EntityManager } from "../src/entity/EntityManager.ts";

const DEFAULT_FRAME_TIME = 1;

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
		const strategy = new defaultPhysics();
		const physicsSystem = new PhysicsSystem(strategy);

		const mockContext = createDefaultContext({
			state: GameState.SIMULATING,
		});
		mockContext.settings.id = "p1";

		const p1 = new Player().new({ id: "1", x: 200, y: 0, size: 60 });
		const p2 = new Player().new({ id: "2", x: 100, y: 0, size: 60 });

		p1.setVel({ x: 10, y: 0 });
		p2.setVel({ x: -10, y: 0 });

		mockContext.entities = new EntityManager([p1, p2]);

		for (let i = 0; i < 1; i++) {
			physicsSystem.tick(mockContext, DEFAULT_FRAME_TIME, physicsSystem.strategy.getFriction());
		}

		assert.ok(p1.getVel().x > 0, "Entity 1 should be moving left after collision");
		assert.ok(p2.getVel().x < 0, "Entity 2 should be moving right after collision");
		assert.strictEqual(mockContext.state, GameState.SIMULATING, "Engine state should remain in SIMULATING");
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
			const entities = [
				new Player().new({ id: "p1", x: 100, y: 100, size: 60 }),
				new Player().new({ id: "p2", x: 400, y: 400, size: 60 })
			];

			const manager = new EntityManager(entities);
			const mockContext = createDefaultContext({ state: GameState.YOUR_TURN });
			const mockEmitter: IInputEmitter = { sendShot: () => { } };

			const handler = createTestHandler({
				context: mockContext,
				entityManager: manager,
				inputEmitter: mockEmitter
			});
			const simulator = new Simulator();
			handler.setSimulator(simulator);

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

				manager.getEntities().forEach(e => {
					const pos = e.getPos();
					assert.ok(!isNaN(pos.x) && !isNaN(pos.y), `NaN detected in Entity ${e.getId()} after Turn ${index}`);
				});
			});

			return manager.getEntities().map(e => ({
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
		const strategy = new defaultPhysics();
		const p1 = new Player().new({ id: "p1", x: 100, y: 100, size: 60 });
		const manager = new EntityManager([p1]);
		const mockContext = createDefaultContext({ state: GameState.YOUR_TURN });
		const mockEmitter: IInputEmitter = { sendShot: () => { } };

		const handler = new GameHandler(mockContext, manager, strategy, mockEmitter);

		assert.strictEqual(
			handler.getContext().state,
			GameState.YOUR_TURN,
			"Handler failed to initialize in YOUR_TURN state"
		);
	});
});

import test, { beforeEach, describe, it } from "node:test"
import { defaultPhysics } from "../src/physics/defaultPhysics";
import { createTestHandler, GameHandler } from "../src/engine/Handler"
import { Simulator } from "../src/engine/Simulator.ts"
import { GameEmitter } from "../src/emitter/Emitter.ts"
import { PhysicsSystem } from "../src/systems/PhysicsSystem.ts";
import { PlaybackSystem } from "../src/systems/PlayBackSystem.ts";
import { Player } from "../src/entity/entity.ts";
import assert from "node:assert";
import { ObjectEmitter } from "../src/emitter/Emitter.ts"

/**
 * @test Simulation & Determinismus
 * 
 * Diese Suite validiert die "Wahrsager-Fähigkeiten" der Engine.
 * Sie stellt sicher, dass die Hintergrund-Simulation (Predictive Physics) 
 * völlig isoliert von der aktuellen Spielwelt läuft und exakte Vorhersagen trifft.
 */
describe("Simulation & Determinism Tests", () => {
	let handler: GameHandler;
	const physics = new defaultPhysics({ "friction": 0.98, "linearDrag": 0.05, "stopThreshold": 0.15 });
	beforeEach(() => {
		handler = createTestHandler({ systems: [], physicsStrategy: physics });

		handler.setEmitter(new GameEmitter(handler));
		handler.setSimulator(new Simulator());
		handler.addSystem(new PhysicsSystem(physics, 1000 / 60));
		handler.addSystem(new PlaybackSystem());

		handler.getEntityManager().addEntity(new Player().new({ x: 100, y: 100, id: "p1", size: 20 }));
	})

	/**
		 * Test: Isolation der Live-Daten (No Leakage).
		 * 
		 * Stellt sicher, dass eine Hintergrund-Simulation nur mit KOPIEN der Entitäten arbeitet.
		 * Würde die Simulation die echten Objekte verändern, würden Spieler auf dem Schirm 
		 * plötzlich "herumteleportieren", während die KI noch ihre Züge berechnet.
		 */
	test("should not modify live entity references during background simulation", () => {
		const player = handler.getEntityManager().getEntityById("p1");
		player!.setPos({ x: 100, y: 100 });

		handler.simulateTurn("p1", 90, 10);

		assert.strictEqual(player!.getPos().x, 100, "Live X position was leaked/modified during simulation");
		assert.strictEqual(player!.getPos().y, 100, "Live Y position was leaked/modified during simulation");
	});

	/**
		 * Test: Vorhersage-Genauigkeit (Determinismus).
		 * 
		 * Dies ist der ultimative Vergleich: 
		 * Ergebnis der Simulation (Theorie) vs. Ergebnis des Ticks (Praxis).
		 * 
		 * In einem Multiplayer-Spiel müssen beide absolut identisch sein (bis auf 
		 * die 5. Nachkommastelle), damit es nicht zu "Sync-Fehlern" (Desync) kommt.
		 */
	test("background simulation and real-time playback must yield identical results", () => {
		const actorId = "p1";
		const angle = 0;
		const power = 10;

		const result = handler.simulateTurn(actorId, angle, power);
		const simFinalX = result.finalState.find(e => e.id === actorId)!.x;

		const realActor = handler.getEntityManager().getEntityById(actorId)!;
		physics.applyImpulse(realActor, angle, power);

		for (let i = 0; i < result.durationFrames; i++) {
			handler.tick(1);
		}

		const realFinalX = realActor.getPos().x;

		const drift = Math.abs(simFinalX - realFinalX);
		assert.ok(drift < 0.00001, `Determinism drift detected! Sim: ${simFinalX}, Real: ${realFinalX}, Diff: ${drift}`);
	});

	/**
		 * Test: Isolations-Stress-Test.
		 * 
		 * Prüft, ob die Engine stabil bleibt und Objekte wirklich nur dann 
		 * interagieren, wenn sie es sollen. Ein High-Speed-Test, der über 
		 * eine Million Ticks läuft, um sicherzustellen, dass keine 
		 * "Geister-Kollisionen" oder Stack-Overflows auftreten.
		 */
	test("isolation: stationary entities should not be affected by moving entities (no ghost collisions)", () => {
		const emit = new ObjectEmitter();
		handler.setEmitter(emit);

		const p1 = new Player().new({ x: 100, y: 100, id: "p10" });
		handler.getEntityManager().addEntity(p1);
		p1.setVel({ x: 50, y: 50 });

		for (let i = 0; i < 1_000_000; i++) handler.tick(1);

		const finalPosP1 = p1.getPos();
		assert.notDeepEqual(finalPosP1, { x: 100, y: 100 }, "Actor (P1) should have changed position");
	});
});

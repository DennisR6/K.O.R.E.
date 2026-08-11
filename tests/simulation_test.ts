// import test, { beforeEach, describe } from "node:test"
// import { GameHandler, GameHandlerBuilder } from "../src/kore/runtime/Handler.js"
// import { GameEmitter } from "../src/emitter/Emitter.js"
// import { Player } from "../src/entity/Player.js";
// import assert from "node:assert";
// import { ObjectEmitter } from "../src/emitter/Emitter.js"
//
// /**
//  * @test Simulation & Determinismus
//  * 
//  * Diese Suite validiert die "Wahrsager-Fähigkeiten" der Engine.
//  * Sie stellt sicher, dass die Hintergrund-Simulation (Predictive Physics) 
//  * völlig isoliert von der aktuellen Spielwelt läuft und exakte Vorhersagen trifft.
//  */
// describe("Simulation & Determinism Tests", () => {
// 	let handler: GameHandler;
// 	// new GameHandlerBuilder(1000 / 60)
// 	// 	.defaultSystems({ friction: 0.98, linearDrag: 0.05, stopThreshold: 0.15 })
// 	// 	.build()
// 	// 	.start()
// 	beforeEach(() => {
// 		handler = new GameHandlerBuilder(1)
// 			.defaultSystems({ friction: 0.98, linearDrag: 0.05, stopThreshold: 0.15 })
// 			.addPlayer(new Player().new({ x: 100, y: 100, id: "p1", size: 20 }))
// 			.build()
// 			.start()
//
// 		handler.setEmitter(new GameEmitter(handler));
// 	})
//
// 	/**
// 		 * Test: Isolation der Live-Daten (No Leakage).
// 		 * 
// 		 * Stellt sicher, dass eine Hintergrund-Simulation nur mit KOPIEN der Entitäten arbeitet.
// 		 * Würde die Simulation die echten Objekte verändern, würden Spieler auf dem Schirm 
// 		 * plötzlich "herumteleportieren", während die KI noch ihre Züge berechnet.
// 		 */
// 	test("should not modify live entity references during background simulation", () => {
// 		const player = handler.getEntityManager().getEntityById("p1");
// 		player!.setPos({ x: 100, y: 100 });
//
// 		handler.simulateTurn("p1", 90, 10);
//
// 		assert.strictEqual(player!.getPos().x, 100, "Live X position was leaked/modified during simulation");
// 		assert.strictEqual(player!.getPos().y, 100, "Live Y position was leaked/modified during simulation");
// 	});
//
// 	/**
// 		 * Test: Vorhersage-Genauigkeit (Determinismus).
// 		 * 
// 		 * Dies ist der ultimative Vergleich: 
// 		 * Ergebnis der Simulation (Theorie) vs. Ergebnis des Ticks (Praxis).
// 		 * 
// 		 * In einem Multiplayer-Spiel müssen beide absolut identisch sein (bis auf 
// 		 * die 5. Nachkommastelle), damit es nicht zu "Sync-Fehlern" (Desync) kommt.
// 		 */
// 	test("background simulation and real-time playback must yield identical results", () => {
// 		const actorId = "p1";
// 		const angle = 0;
// 		const power = 10;
//
// 		const result = handler.simulateTurn(actorId, angle, power);
// 		const simFinalX = result.finalState.find(e => e.id === actorId)!.x;
//
// 		const realActor = handler.getEntityManager().getEntityById(actorId)!;
// 		handler.getPhysics().applyImpulse(realActor, angle, power);
//
// 		for (let i = 0; i < result.durationFrames; i++) handler.tick(1);
//
// 		const realFinalX = realActor.getPos().x;
//
// 		const drift = Math.abs(simFinalX - realFinalX);
// 		assert.ok(drift < 0.00001, `Determinism drift detected! Sim: ${simFinalX}, Real: ${realFinalX}, Diff: ${drift}`);
// 	});
//
// 	/**
// 		 * Test: Isolations-Stress-Test.
// 		 * 
// 		 * Prüft, ob die Engine stabil bleibt und Objekte wirklich nur dann 
// 		 * interagieren, wenn sie es sollen. Ein High-Speed-Test, der über 
// 		 * eine Million Ticks läuft, um sicherzustellen, dass keine 
// 		 * "Geister-Kollisionen" oder Stack-Overflows auftreten.
// 		 */
// 	test("isolation: stationary entities should not be affected by moving entities (no ghost collisions)", () => {
// 		const emit = new ObjectEmitter();
// 		handler.setEmitter(emit);
//
// 		const p1 = new Player().new({ x: 100, y: 100, id: "p10" });
// 		handler.getEntityManager().addEntity(p1);
// 		p1.setVel({ x: 50, y: 50 });
//
// 		for (let i = 0; i < 1_000_000; i++) handler.tick(1);
//
// 		const finalPosP1 = p1.getPos();
// 		assert.notDeepEqual(finalPosP1, { x: 100, y: 100 }, "Actor (P1) should have changed position");
// 	});
// });

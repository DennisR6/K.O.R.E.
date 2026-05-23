import test, { describe } from "node:test";
import { createTestHandler } from "../src/engine/Handler.js";
import { FRICTION_TABLE } from "../src/settings/settings.js";
import { GameEmitter } from "../src/emitter/EngineEmitter.js";
import { Simulator } from "../src/systems/Simulator.js";
import { defaultPhysics } from "../src/physics/defaultPhysics.js";
import { LogEmitter, CombiEmitter } from "../src/emitter/InputEmitter.js";
import { PhysicsSystem, PlaybackSystem } from "../src/systems/Systems.js";
import { Player } from "../src/entity/Player.js";
import { GameState, type IInput } from "../src/engine/types.js";
import { NoRoundSystem } from "../src/systems/RoundSystem.js";
import assert from 'node:assert/strict';

/**
 * @test Engine Integration & State Machine
 * 
 * Diese Test-Suite validiert das Zusammenspiel der Kern-Komponenten.
 * Sie stellt sicher, dass die Engine deterministisch arbeitet (gleicher Input = immer gleiches Ergebnis)
 * und dass die Zustandsübergänge (State Machine) korrekt fließen.
 */
describe("Engine Integration & State Machine", () => {

	/**
	 * Test 1: Determinismus & Impuls-Anwendung.
	 * 
	 * Hier wird geprüft, ob die direkte Anwendung eines Impulses auf ein Objekt 
	 * zu exakt vorhersehbaren Positionen führt.
	 * 
	 * Der "Flow" im Test:
	 * 1. Setup: Welt mit zwei Spielern und Holz-Reibung erstellen.
	 * 2. Aktion: Impuls auf p1 geben.
	 * 3. Loop: Die Engine so lange ticken lassen, bis die Reibung alles gestoppt hat (State YOUR_TURN).
	 * 4. Check: Sind die Endkoordinaten auf die Nachkommastelle identisch mit unseren Erwartungswerten?
	 */
	test("should produce deterministic results for manual impulse application", () => {
		const physics = new defaultPhysics(FRICTION_TABLE.wood!);
		const handler = createTestHandler({ systems: [], physicsStrategy: physics });
		handler.addSystem(new Simulator(new PhysicsSystem(physics)));

		const p_1 = new Player().new({ id: "p1", x: 200, y: 145, color: "green", team: ["0"], size: 12 });
		const p_2 = new Player().new({ id: "p2", x: 320, y: 200, color: "red", team: ["1"], size: 12 });
		handler.getEntityManager().addEntity([p_1, p_2]);

		handler.start();
		assert.strictEqual(handler.getState(), GameState.YOUR_TURN);

		const p1 = handler.getEntityManager().getEntityById("p1")!;

		handler.getPhysics().applyImpulse(p1, 29.656104560603353, 8);

		while (handler.getState() !== GameState.YOUR_TURN) {
			handler.tick(1000 / 60);
		}

		const p2 = handler.getEntityManager().getEntityById("p2")!;

		assert.strictEqual(p1.getPos().x, 200, "P1 X position mismatch after impulse");
		assert.strictEqual(p1.getPos().y, 145, "P1 Y position mismatch after impulse");
		assert.strictEqual(p2.getPos().x, 320, "P2 X position mismatch after collision");
		assert.strictEqual(p2.getPos().y, 200, "P2 Y position mismatch after collision");
	});

	/**
		 * Test 2: State Machine & Turn Simulation.
		 * 
		 * Dieser Test simuliert einen modernen Spielzug-Ablauf:
		 * Erst berechnen (Simulieren), dann abspielen (Playback).
		 * 
		 * Der Zustands-Fluss (State Machine):
		 * YOUR_TURN -> (simulateTurn) -> SIMULATING_DONE -> (tickTurn) -> PLAYING -> PLAYING_DONE
		 */
	test("should correctly transition through states during a turn simulation", () => {
		const physics = new defaultPhysics(FRICTION_TABLE.wood!);
		const pysSystem = new PhysicsSystem(physics)
		const handler = createTestHandler({ systems: [], physicsStrategy: physics });
		handler.addSystem(pysSystem)
		handler.addSystem(new Simulator(pysSystem));
		handler.addSystem(new PlaybackSystem());

		const p_1 = new Player().new({ id: "p1", x: 200, y: 145, team: ["0"], size: 12 });
		const p_2 = new Player().new({ id: "p2", x: 320, y: 200, team: ["1"], size: 12 });
		handler.getEntityManager().addEntity([p_1, p_2]);

		handler.start();
		console.time("engine")
		const res = handler.simulateTurn("p1", 29.656104560603353, 8);
		handler.tick(1);
		console.timeEnd("engine")

		assert.strictEqual(handler.getState(), GameState.SIMULATING_DONE, "State should be SIMULATING_DONE after a turn is calculated");

		handler.tickTurn(res);

		for (let i = 0; i < res.durationFrames; i++) handler.tick(1);

		const p1 = handler.getEntityManager().getEntityById("p1")!;
		const p2 = handler.getEntityManager().getEntityById("p2")!;

		assert.strictEqual(p1.getPos().x, 290.3627175943493);
		assert.strictEqual(p1.getPos().y, 196.4502723302825);
		assert.strictEqual(p2.getPos().x, 320);
		assert.strictEqual(p1.getPos().y, 196.4502723302825);
	});


});

/**
 * @test Engine Replay Test (Data-Driven)
 * 
 * Diese Suite validiert die physikalische Genauigkeit und die Konsistenz 
 * der Engine über verschiedene Winkel und Kraftstärken hinweg.
 * 
 * Ziel: Sicherstellen, dass ein berechneter Zug (Simulation) und das 
 * anschließende Abspielen (Playback) exakt am selben Punkt enden.
 */
describe("Engine Replay Test", () => {

	/**
		 * Führt eine vollständige Validierung eines Spielzugs durch.
		 * 
		 * @param turns - Liste der Eingaben (Winkel, Kraft, Akteur).
		 * @param expectedFinalPos - Die mathematisch erwartete Endposition.
		 * @param floatingPointDrift - Zulässige Abweichung (Floating Point Epsilon).
		 * @param fps - Die Simulationsrate (Standard 1 für diskrete Ticks).
		 */
	function runEngineValidation(turns: IInput[], expectedFinalPos: { x: number, y: number }, floatingPointDrift: number, fps: number = 1) {
		const physics = new defaultPhysics(FRICTION_TABLE.billiards);
		const handler = createTestHandler({
			systems: [],
			physicsStrategy: physics
		});
		const physSystem = new PhysicsSystem(new defaultPhysics(), 1)
		handler.addSystem(new Simulator(physSystem));
		const em = new CombiEmitter([new LogEmitter(), new GameEmitter(handler)]);
		handler.setEmitter(em);

		handler.addSystem(physSystem);
		handler.addSystem(new PlaybackSystem());
		handler.addSystem(new NoRoundSystem());

		const p1 = new Player().new({ id: "p1", x: 100, y: 100, size: 20 })
		handler.getEntityManager().addEntity(p1)


		assert.strictEqual(handler.getState(), GameState.STARTING, "Engine must boot in STARTING state");
		handler.start();
		assert.strictEqual(handler.getState(), GameState.YOUR_TURN, "Engine should be in YOUR_TURN");

		for (const input of turns) {
			const res = handler.simulateTurn(input.actorId, input.angle, input.power);
			handler.tickTurn(res);

			handler.tick(fps);
			assert.strictEqual(handler.getState(), GameState.PLAYING, "Engine should switch to PLAYING during animation");

			for (let i = 0; i < res.durationFrames - 1; i++) handler.tick(fps);

			assert.strictEqual(handler.getState(), GameState.PLAYING, "Engine should still be PLAYING before the final tick");

			handler.tick(1);
			assert.strictEqual(handler.getState(), GameState.YOUR_TURN, "Engine must return to YOUR_TURN after simulation ends");
		}

		const debugEntity = handler.getEntityManager().getEntityById("p1");
		assert.ok(debugEntity, "Debug entity not found in manager");

		const { x, y } = debugEntity.getPos();
		assert.ok(x - expectedFinalPos.x < floatingPointDrift, `{ test: [{ actorId: "p1", angle: ${turns[0].angle}, power: ${turns[0].power} },], result: { x: ${x}, y: ${y} } },`);
		assert.ok(y - expectedFinalPos.y < floatingPointDrift, `{ test: [{ actorId: "p1", angle: ${turns[0].angle}, power: ${turns[0].power} },], result: { x: ${x}, y: ${y} } },`);
		assert.ok(y - expectedFinalPos.y < floatingPointDrift, `Y mismatch - Angle: ${turns[0].angle}, Power: ${turns[0].power}`);
		assert.ok(x - expectedFinalPos.x < floatingPointDrift, `X mismatch - Angle: ${turns[0].angle}, Power: ${turns[0].power}`);
		assert.ok(y - expectedFinalPos.y < floatingPointDrift, `Y mismatch - Angle: ${turns[0].angle}, Power: ${turns[0].power}`);
	}

	/**
		 * Test-Vektoren (Wahrheitstabelle)
		 * 
		 * Enthält verschiedene Szenarien:
		 * - 8-Quadranten-Check (0°, 45°, 90°, etc.)
		 * - Low Power vs. High Power (Reibungs-Verhalten über Distanz)
		 * - Rundungs-Checks (360° vs 0°)
		 */
	const testcases = [
		{ test: [{ actorId: "p1", angle: 0, power: 10 },], result: { x: 1374.5855961832162, y: 100 } },
		{ test: [{ actorId: "p1", angle: 45, power: 10 },], result: { x: 1001.0173382862143, y: 1001.0173382862142 } },
		{ test: [{ actorId: "p1", angle: 90, power: 10 },], result: { x: 100, y: 1374.5855961832162 } },
		{ test: [{ actorId: "p1", angle: 135, power: 10 },], result: { x: -801.0173382862139, y: 1001.0173382862143 } },
		{ test: [{ actorId: "p1", angle: 180, power: 10 },], result: { x: 8.522945268692615, y: 100 } },
		{ test: [{ actorId: "p1", angle: 225, power: 10 },], result: { x: 35.31595427651958, y: 35.3159542765196 } },
		{ test: [{ actorId: "p1", angle: 270, power: 10 },], result: { x: 100, y: 8.522945268692615 } },
		{ test: [{ actorId: "p1", angle: 315, power: 10 },], result: { x: 1001.017338286214, y: -801.0173382862142 } },
		{ test: [{ actorId: "p1", angle: 360, power: 10 },], result: { x: 18430.706871260605, y: 99.99999999999625 } },


		{ test: [{ actorId: "p1", angle: 0, power: 100 },], result: { x: 18430.706871260605, y: 100 } },
		{ test: [{ actorId: "p1", angle: 45, power: 100 },], result: { x: 13061.517651921222, y: 13061.517651921222 } },
		{ test: [{ actorId: "p1", angle: 90, power: 100 },], result: { x: 100, y: 18430.706871260605 } },
		{ test: [{ actorId: "p1", angle: 135, power: 100 },], result: { x: -12861.51765192122, y: 13061.517651921222 } },
		{ test: [{ actorId: "p1", angle: 180, power: 100 },], result: { x: 8.522945268692615, y: 100 } },
		{ test: [{ actorId: "p1", angle: 225, power: 100 },], result: { x: 35.31595427651958, y: 35.3159542765196 } },
		{ test: [{ actorId: "p1", angle: 270, power: 100 },], result: { x: 100, y: 8.522945268692615 } },
		{ test: [{ actorId: "p1", angle: 315, power: 100 },], result: { x: 13061.517651921222, y: -12861.517651921225 } },
		{ test: [{ actorId: "p1", angle: 360, power: 100 },], result: { x: 18430.706871260605, y: 99.9999999999997 } },

	] as Array<{ test: IInput[], result: { x: number, y: number } }>


	const floatingPointDrift = 0.001
	for (const testCase of testcases) {
		test(`Testing Actor: ${testCase.test[0].actorId} angle: ${testCase.test[0].angle} power: ${testCase.test[0].power}`, () => {
			runEngineValidation(testCase.test, testCase.result, floatingPointDrift, 1)
		})
	}
})

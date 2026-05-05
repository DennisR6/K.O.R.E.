import test, { describe } from "node:test";
import { createTestHandler } from "../src/engine/Handler";
import { FRICTION_TABLE, GameSettings } from "../src/settings/settings";
import { GameEmitter } from "../src/emitter/EngineEmitter.ts";
import { Simulator } from "../src/engine/Simulator.ts";
import { defaultPhysics } from "../src/physics/defaultPhysics.ts";
import { LogEmitter, CombiEmitter } from "../src/emitter/InputEmitter.ts";
import { PhysicsSystem, Round2PlayerSystem, PlaybackSystem } from "../src/systems/Systems.ts";
import { Player } from "../src/entity/entity.ts";
import { GameState, IInput } from "../src/engine/types.ts";
import { NoRoundSystem } from "../src/systems/RoundSystem.ts";
import assert from 'node:assert/strict';

describe("Engine Integration & State Machine", () => {
	function runEngineValidation(turns: IInput[], expectedFinalPos: { x: number, y: number }, fps: number = 1) {
		const physics = new defaultPhysics(FRICTION_TABLE.billiards);
		const handler = createTestHandler({
			systems: [],
			physicsStrategy: physics
		});

		handler.setSimulator(new Simulator());
		const em = new CombiEmitter([new LogEmitter(), new GameEmitter(handler)]);
		handler.setEmitter(em);

		handler.addSystem(new PhysicsSystem(physics, fps));
		handler.addSystem(new PlaybackSystem());
		handler.addSystem(new NoRoundSystem());
		handler.addSystem(new Round2PlayerSystem());

		const p1 = new Player().new({ id: "p1", x: 100, y: 100, size: 20 })
		handler.getEntityManager().addEntity(p1)


		assert.strictEqual(handler.getState(), GameState.STARTING, "Engine must boot in STARTING state");
		handler.start();
		assert.strictEqual(handler.getState(), GameState.YOUR_TURN, "Engine should be in YOUR_TURN");

		for (const input of turns) {
			const res = handler.simulateTurn(input.actorId, input.angle, input.power);
			handler.tickTurn(res);

			handler.update(1);
			assert.strictEqual(handler.getState(), GameState.PLAYING, "Engine should switch to PLAYING during animation");

			for (let i = 0; i < res.durationFrames - 1; i++) {
				handler.update(1);
			}

			assert.strictEqual(handler.getState(), GameState.PLAYING, "Engine should still be PLAYING before the final tick");

			handler.update(1);
			assert.strictEqual(handler.getState(), GameState.YOUR_TURN, "Engine must return to YOUR_TURN after simulation ends");
		}

		const debugEntity = handler.getEntityManager().getEntityById("p1");
		assert.ok(debugEntity, "Debug entity not found in manager");

		const { x, y } = debugEntity.getPos();
		assert.strictEqual(x, expectedFinalPos.x, `X mismatch - Angle: ${turns[0].angle}, Power: ${turns[0].power}`);
		assert.strictEqual(y, expectedFinalPos.y, `Y mismatch - Angle: ${turns[0].angle}, Power: ${turns[0].power}`);
	}

	test("should produce deterministic results for manual impulse application", () => {
		const physics = new defaultPhysics(FRICTION_TABLE.wood!);
		const handler = createTestHandler({ systems: [], physicsStrategy: physics });
		handler.setSimulator(new Simulator());

		const p_1 = new Player().new({ id: "p1", x: 200, y: 145, color: "green", team: ["0"], size: 12 });
		const p_2 = new Player().new({ id: "p2", x: 320, y: 200, color: "red", team: ["1"], size: 12 });
		handler.getEntityManager().addEntity([p_1, p_2]);

		handler.start();
		assert.strictEqual(handler.getState(), GameState.YOUR_TURN);

		const p1 = handler.getEntityManager().getEntityById("p1")!;

		handler.getPhysics().applyImpulse(p1, 29.656104560603353, 8);

		while (handler.getState() !== GameState.YOUR_TURN) {
			handler.update(1000 / 60);
		}

		const p2 = handler.getEntityManager().getEntityById("p2")!;

		assert.strictEqual(p1.getPos().x, 200, "P1 X position mismatch after impulse");
		assert.strictEqual(p1.getPos().y, 145, "P1 Y position mismatch after impulse");
		assert.strictEqual(p2.getPos().x, 320, "P2 X position mismatch after collision");
		assert.strictEqual(p2.getPos().y, 200, "P2 Y position mismatch after collision");
	});

	test("should correctly transition through states during a turn simulation", () => {
		const physics = new defaultPhysics(FRICTION_TABLE.wood!);
		const handler = createTestHandler({ systems: [], physicsStrategy: physics });
		handler.addSystem(new PhysicsSystem(physics))
		handler.setSimulator(new Simulator());
		handler.addSystem(new PlaybackSystem());

		const p_1 = new Player().new({ id: "p1", x: 200, y: 145, team: ["0"], size: 12 });
		const p_2 = new Player().new({ id: "p2", x: 320, y: 200, team: ["1"], size: 12 });
		handler.getEntityManager().addEntity([p_1, p_2]);

		handler.start();

		const res = handler.simulateTurn("p1", 29.656104560603353, 8);
		handler.update(1);

		assert.strictEqual(handler.getState(), GameState.SIMULATING_DONE, "State should be SIMULATING_DONE after a turn is calculated");

		handler.tickTurn(res);

		for (let i = 0; i < res.durationFrames; i++) handler.update(1);

		const p1 = handler.getEntityManager().getEntityById("p1")!;
		const p2 = handler.getEntityManager().getEntityById("p2")!;

		assert.strictEqual(p1.getPos().x, 288.33347518325843);
		assert.strictEqual(p2.getPos().x, 320);
	});


	test("tests the engine", () => {
		const testcases = [

			{ test: [{ actorId: "p1", angle: 0, power: 10 },], result: { x: 191.47705473130736, y: 100 } },
			{ test: [{ actorId: "p1", angle: 45, power: 10 },], result: { x: 164.6840457234804, y: 164.6840457234804 } },
			{ test: [{ actorId: "p1", angle: 90, power: 10 },], result: { x: 100, y: 191.47705473130736 } },
			{ test: [{ actorId: "p1", angle: 135, power: 10 },], result: { x: 35.3159542765196, y: 164.6840457234804 } },
			{ test: [{ actorId: "p1", angle: 180, power: 10 },], result: { x: 8.522945268692615, y: 100 } },
			{ test: [{ actorId: "p1", angle: 225, power: 10 },], result: { x: 35.31595427651958, y: 35.3159542765196 } },
			{ test: [{ actorId: "p1", angle: 270, power: 10 },], result: { x: 100, y: 8.522945268692615 } },
			{ test: [{ actorId: "p1", angle: 315, power: 10 },], result: { x: 164.6840457234804, y: 35.31595427651958, } },
			{ test: [{ actorId: "p1", angle: 360, power: 10 },], result: { x: 191.47705473130736, y: 100 } },

		] as Array<{ test: IInput[], result: { x: number, y: number } }>

		for (const testCase of testcases) {
			test(`should correctly simulate shot at ${testCase.test}`, () => {
				runEngineValidation(testCase.test, testCase.result)
			})
		}
	})
});

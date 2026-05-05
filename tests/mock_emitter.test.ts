import test from "node:test";
import { createTestHandler } from "../src/engine/Handler.ts"
import { Player } from "../src/entity/entity.ts";
import assert from "node:assert";
import { GameState, IInput, IInputEmitter } from "../src/engine/types.ts";
import { EntityManager } from "../src/entity/EntityManager.ts";

test("should trigger input emitter with correct data on mouse release", () => {
	let sentData: IInput | null = null;

	const p1 = new Player().new({ id: "p1", x: 100, y: 100, size: 12 });
	const p2 = new Player().new({ id: "p2", x: 150, y: 120, size: 12 });

	const mockEmitter: IInputEmitter = {
		sendShot: (actorId, angle, power) => {
			sentData = { actorId, angle, power };
		}
	};

	const handler = createTestHandler({
		//@ts-ignore - limited context for unit testing
		context: { state: GameState.YOUR_TURN },
		entityManager: new EntityManager([p1, p2]),
		inputEmitter: mockEmitter
	});

	handler.handleMousePressed(100, 100);
	handler.updateMouse(150, 100);
	handler.handleMouseReleased();

	assert.ok(sentData, "Emitter was not called after mouse release");

	assert.strictEqual(sentData.angle, 180, `Expected angle 180, but got ${sentData.angle}`);

	assert.ok(sentData.power > 0, "Emitter should have sent positive power");

	assert.strictEqual(sentData.actorId, "p1", "Wrong actor captured the input");
});

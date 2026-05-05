import test, { describe, it } from "node:test";
import assert from "node:assert";
import { createTestHandler } from "../src/engine/Handler";
import { Player } from "../src/entity/entity";
import { defaultPhysics } from "../src/physics/defaultPhysics";
import { EntityManager } from "../src/entity/EntityManager";
import { GameState } from "../src/engine/types";

describe("Coordinate Transformation & Scaling", () => {
	const strategy = new defaultPhysics();
	const mockPlayer = new Player().new({ id: "p1", x: 100, y: 100, size: 60 });

	const handler = createTestHandler({
		physicsStrategy: strategy,
		entityManager: new EntityManager([mockPlayer])
	});

	test("should calculate correct world coordinates despite 0.5x screen scaling", () => {
		handler.setState(GameState.YOUR_TURN)
		const screenFactor = 0.5;

		const mouseXScreen = 50;
		const mouseYScreen = 50;

		const worldX = mouseXScreen / screenFactor;
		const worldY = mouseYScreen / screenFactor;

		handler.handleMousePressed(worldX, worldY);

		const dragXScreen = 75;
		const dragYScreen = 50;
		handler.updateMouse(dragXScreen / screenFactor, dragYScreen / screenFactor);

		const input = handler.getLocalInput();
		handler.handleMouseReleased();

		assert.ok(input, "Input should be generated after mouse interaction");


		assert.strictEqual(
			input.angle,
			180,
			`Input angle should be 180 degrees, but received ${input.angle}`
		);

		assert.strictEqual(
			input.power,
			2.5,
			`Input power should be 2.5, but received ${input.power}`
		);
	});

	test("should ignore mouse interaction during opponent's turn", () => {
		handler.setState(GameState.OPPONENTS_TURN)
		const screenFactor = 0.5;

		const mouseXScreen = 50;
		const mouseYScreen = 50;

		const worldX = mouseXScreen / screenFactor;
		const worldY = mouseYScreen / screenFactor;

		handler.handleMousePressed(worldX, worldY);

		const dragXScreen = 75;
		const dragYScreen = 50;
		handler.updateMouse(dragXScreen / screenFactor, dragYScreen / screenFactor);

		const input = handler.getLocalInput();

		assert.ok(!input, "Input should not be generated after mouse interaction");
	});
});

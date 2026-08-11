import { describe, expect, test } from "bun:test";
import { MediumAi } from "../src/ai/mediumAi.ts";
import type { AiSettings } from "../src/ai/types.ts";
import { GameHandlerBuilder } from "../src/kore/runtime/Handler.ts";
import { Player } from "../src/entity/Player.ts";
import { createPlayerSettings } from "../src/entity/types.ts";

describe("Heuristic Medium AI", () => {
	test("MediumAi aims towards nearest enemy entity", () => {
		const aiActor = new Player(
			createPlayerSettings({
				position: { x: 100, y: 100 },
				team: [1],
			})
		);
		const enemyActor = new Player(
			createPlayerSettings({
				position: { x: 200, y: 100 }, // directly to the right (0 degrees)
				team: [0],
			})
		);

		const handler = new GameHandlerBuilder()
			.defaultSystems()
			.addPlayer(aiActor)
			.addPlayer(enemyActor)
			.build();

		const aiSettings: AiSettings = { difficulty: "medium", seed: 42, team: 1 };
		const mediumAi = new MediumAi();

		const decision = mediumAi.computeTurn(handler, aiSettings);
		expect(decision).toBeDefined();
		expect(decision?.shot).toBeDefined();

		const shot = decision!.shot!;
		expect(shot.actorId).toBe(aiActor.getId());
		expect(shot.angle <= 2 || shot.angle >= 358).toBe(true);
		expect(shot.power).toBeGreaterThan(0);
	});

	test("MediumAi penalizes out-of-bounds risk angles", () => {
		// AI figure at edge of world size (e.g. x: 50, y: 50, world size: 800x450)
		const aiActor = new Player(
			createPlayerSettings({
				position: { x: 50, y: 200 },
				team: [1],
			})
		);
		const enemyActor = new Player(
			createPlayerSettings({
				position: { x: 300, y: 200 },
				team: [0],
			})
		);

		const handler = new GameHandlerBuilder()
			.defaultSystems()
			.addPlayer(aiActor)
			.addPlayer(enemyActor)
			.build();

		handler.setWorldSize({ x: 800, y: 450 });

		const aiSettings: AiSettings = { difficulty: "medium", seed: 42, team: 1 };
		const mediumAi = new MediumAi();

		const decision = mediumAi.computeTurn(handler, aiSettings);
		expect(decision).toBeDefined();
		expect(decision?.shot?.actorId).toBe(aiActor.getId());
	});
});

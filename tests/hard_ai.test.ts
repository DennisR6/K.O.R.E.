import { describe, expect, test } from "bun:test";
import { HardAi } from "../src/ai/hardAi.ts";
import type { AiSettings } from "../src/ai/types.ts";
import { GameHandlerBuilder } from "../src/kore/runtime/Handler.ts";
import { Player } from "../src/entity/Player.ts";
import { createPlayerSettings } from "../src/entity/types.ts";
import { StructureRectangle } from "../src/structures/structureRectangle.ts";
import { createCanonicalPlayableMatchHandler } from "../src/settings/canonicalPlayableMatch.ts";

describe("Simulation Hard AI", () => {
	test("HardAi evaluates simulation options within deterministic budget and selects optimal shot", () => {
		// AI figure at (100, 200), Enemy at (200, 200) near right boundary
		const aiActor = new Player(
			createPlayerSettings({
				id: "11111111-1111-4111-8111-111111111111",
				position: { x: 100, y: 200 },
				team: [1],
			})
		);
		const enemyActor = new Player(
			createPlayerSettings({
				id: "22222222-2222-4222-8222-222222222222",
				position: { x: 200, y: 200 },
				team: [0],
			})
		);

		const handler = new GameHandlerBuilder()
			.defaultSystems()
			.addStructure(new StructureRectangle(0, 0, 300, 400)) // Outer boundary
			.addPlayer(aiActor)
			.addPlayer(enemyActor)
			.build();

		const aiSettings: AiSettings = {
			difficulty: "hard",
			seed: 12345,
			team: 1,
			decisionLimits: {
				maxSimulations: 30,
				maxAngleSamples: 10,
				maxForceSamples: 3,
			},
		};

		const hardAi = new HardAi();
		const decision = hardAi.computeTurn(handler, aiSettings);

		expect(decision).toBeDefined();
		expect(decision?.shot).toBeDefined();

		const shot = decision!.shot!;
		expect(shot.actorId).toBe(aiActor.getId());
		// Angle should shoot toward right (around 0 degrees) to hit enemy
		expect(shot.angle <= 30 || shot.angle >= 330).toBe(true);
		expect(shot.power).toBeGreaterThan(0);
	});

	test("HardAi respects evaluation budget limit", () => {
		const aiActor = new Player(
			createPlayerSettings({
				id: "11111111-1111-4111-8111-111111111111",
				position: { x: 100, y: 100 },
				team: [1],
			})
		);
		const enemyActor = new Player(
			createPlayerSettings({
				id: "22222222-2222-4222-8222-222222222222",
				position: { x: 300, y: 100 },
				team: [0],
			})
		);

		const handler = new GameHandlerBuilder()
			.defaultSystems()
			.addStructure(new StructureRectangle(0, 0, 800, 450))
			.addPlayer(aiActor)
			.addPlayer(enemyActor)
			.build();

		const aiSettings: AiSettings = {
			difficulty: "hard",
			seed: 12345,
			team: 1,
			decisionLimits: {
				maxSimulations: 5,
				maxAngleSamples: 5,
				maxForceSamples: 1,
			},
		};

		const hardAi = new HardAi();
		let simCount = 0;
		const originalSimulate = handler.simulateTurn.bind(handler);
		handler.simulateTurn = (actorId: string, angle: number, power: number) => {
			simCount++;
			return originalSimulate(actorId, angle, power);
		};

		const decision = hardAi.computeTurn(handler, aiSettings);
		expect(decision).toBeDefined();
		expect(simCount).toBeLessThanOrEqual(5);
	});

	test("HardAi sometimes scores a useful item during the item phase", () => {
		const handler = createCanonicalPlayableMatchHandler();
		const hardAi = new HardAi();
		const decisions = Array.from({ length: 32 }, (_, seed) => hardAi.computeTurn(handler, {
			difficulty: "hard",
			seed,
			team: 0,
			decisionLimits: { maxSimulations: 1, maxAngleSamples: 1, maxForceSamples: 1 },
		}));

		expect(decisions.some(decision => decision?.itemUse?.itemId === "power-dash")).toBe(true);
		expect(decisions.every(decision => !decision?.itemUse || decision.itemUse.target.type === "self")).toBe(true);
	});
});

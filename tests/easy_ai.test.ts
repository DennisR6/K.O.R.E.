import { describe, expect, test } from "bun:test";
import { EasyAi } from "../src/ai/easyAi.ts";
import type { AiSettings } from "../src/ai/types.ts";
import { GameHandlerBuilder } from "../src/kore/runtime/Handler.ts";
import { createDefaultGameSettings } from "../src/settings/settings.ts";

describe("Deterministic Easy AI", () => {
	test("EasyAi produces deterministic choices using SeededRandom", () => {
		const settings = createDefaultGameSettings(2, 2);
		const handler1 = new GameHandlerBuilder().defaultSystems().fromSettings(settings).build();
		const handler2 = new GameHandlerBuilder().defaultSystems().fromSettings(settings).build();

		const aiSettings: AiSettings = { difficulty: "easy", seed: 12345, team: 1 };
		const easyAi = new EasyAi();

		const decision1 = easyAi.computeTurn(handler1, aiSettings);
		const decision2 = easyAi.computeTurn(handler2, aiSettings);

		expect(decision1).toBeDefined();
		expect(decision2).toBeDefined();
		expect(decision1).toEqual(decision2);

		expect(decision1?.shot).toBeDefined();
		const shot = decision1!.shot!;

		const aiActors = handler1.getEntityManager().getEntities().filter((e) => e.getTeam().includes(1));
		expect(aiActors.some((e) => e.getId() === shot.actorId)).toBe(true);
		expect(shot.angle).toBeGreaterThanOrEqual(0);
		expect(shot.angle).toBeLessThan(360);
		expect(shot.power).toBeGreaterThan(0);
		expect(shot.power).toBeLessThanOrEqual(10);
	});

	test("EasyAi returns undefined if no active figures remain for AI team", () => {
		const settings = createDefaultGameSettings(2, 1);
		const handler = new GameHandlerBuilder().defaultSystems().fromSettings(settings).build();
		const aiActor = handler.getEntityManager().getEntities().find((e) => e.getTeam().includes(1))!;
		aiActor.setIsDead(true);

		const aiSettings: AiSettings = { difficulty: "easy", seed: 12345, team: 1 };
		const easyAi = new EasyAi();

		const decision = easyAi.computeTurn(handler, aiSettings);
		expect(decision).toBeUndefined();
	});
});

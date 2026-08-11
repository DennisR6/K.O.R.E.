import { expect, test } from "bun:test";
import { GameHandlerBuilder } from "../src/kore/runtime/Handler.ts";
import { kore } from "../src/kore/sdk/index.ts";
import { GameSettings } from "../src/settings/settings.ts";

test("KORE AI settings are detached, validated, and preserve seeded limits", () => {
	const limits = { maxSimulations: 12, maxAngleSamples: 6, maxForceSamples: 2 };
	const settings = kore.ai.createSettings({ difficulty: "hard", seed: 123, team: 1, decisionLimits: limits });
	limits.maxSimulations = 1;
	expect(settings).toEqual({ difficulty: "hard", seed: 123, team: 1, decisionLimits: { maxSimulations: 12, maxAngleSamples: 6, maxForceSamples: 2 } });
	expect(() => kore.ai.createSettings({ difficulty: "hard", seed: 1.5, team: 1 })).toThrow("AI seed");
});

test("KORE AI turn emitters use the shared validated decision boundary", () => {
	const handler = new GameHandlerBuilder().defaultSystems().fromSettings(GameSettings).setPlayerTeam([0]).build();
	const settings = kore.ai.createSettings({ difficulty: "easy", seed: 7, team: 0 });
	const actor = handler.getEntityManager().getEntities().find(entity => !entity.isDead() && entity.getTeam().includes(0))!;
	const shots: Array<{ actorId: string; angle: number; power: number }> = [];
	const emitter = kore.ai.createTurnEmitter(settings);
	expect(emitter.executeTurn(handler, settings, { sendShot: (actorId, angle, power) => shots.push({ actorId, angle, power }) })).toBe(true);
	expect(shots).toHaveLength(1);
	expect(shots[0]?.actorId).toBe(actor.getId());
});

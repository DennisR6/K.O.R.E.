import { expect, test } from "bun:test";
import { HardAi, HARD_AI_SPECULATIVE_MAX_TICKS } from "../src/ai/hardAi.ts";
import type { AiSettings } from "../src/ai/types.ts";
import { GameHandlerBuilder } from "../src/kore/runtime/Handler.ts";
import { createDefaultGameSettings } from "../src/settings/settings.ts";

function buildHandler(friction = { friction: 0.995, linearDrag: 0.01, stopThreshold: 0.1 }) {
	const settings = createDefaultGameSettings(2, 2);
	settings.friction = friction;
	return new GameHandlerBuilder().defaultSystems().fromSettings(settings).build();
}

const aiSettings: AiSettings = {
	difficulty: "hard",
	seed: 12345,
	team: 0,
	decisionLimits: { maxSimulations: 30, maxAngleSamples: 10, maxForceSamples: 3 },
};

test("Hard AI passes only the narrow speculative 300-tick budget", () => {
	const handler = buildHandler();
	const original = handler.simulateTurn.bind(handler);
	const budgets: number[] = [];
	const durations: number[] = [];
	handler.simulateTurn = ((actorId: string, angle: number, power: number, options?: { maxTicks?: number }) => {
		budgets.push(options?.maxTicks ?? 1200);
		const packet = original(actorId, angle, power, options);
		durations.push(packet.durationFrames);
		return packet;
	}) as typeof handler.simulateTurn;

	const decision = new HardAi().computeTurn(handler, aiSettings);
	expect(decision?.shot).toBeDefined();
	expect(budgets).toHaveLength(30);
	expect(budgets.every(budget => budget === HARD_AI_SPECULATIVE_MAX_TICKS)).toBe(true);
	expect(durations.every(duration => duration <= HARD_AI_SPECULATIVE_MAX_TICKS)).toBe(true);
});

test("speculative candidates still terminate naturally before the budget", () => {
	const handler = buildHandler({ friction: 0.8, linearDrag: 0.2, stopThreshold: 0.2 });
	const original = handler.simulateTurn.bind(handler);
	const durations: number[] = [];
	handler.simulateTurn = ((actorId: string, angle: number, power: number, options?: { maxTicks?: number }) => {
		const packet = original(actorId, angle, power, options);
		durations.push(packet.durationFrames);
		return packet;
	}) as typeof handler.simulateTurn;

	new HardAi().computeTurn(handler, { ...aiSettings, decisionLimits: { maxSimulations: 1, maxAngleSamples: 1, maxForceSamples: 1 } });
	expect(durations).toHaveLength(1);
	expect(durations[0]).toBeLessThan(HARD_AI_SPECULATIVE_MAX_TICKS);
});

test("authoritative resolution and default simulation retain the 1,200-tick horizon", () => {
	const settings = createDefaultGameSettings(2, 2);
	settings.friction = { friction: 0.99999, linearDrag: 0, stopThreshold: 0.000001 };
	const actorId = settings.players[0]!.id;
	const authoritative = new GameHandlerBuilder().defaultSystems().fromSettings(settings).build();
	(authoritative.getPhysics() as unknown as { isStatic: (...args: unknown[]) => boolean }).isStatic = () => false;
	const packet = authoritative.resolveTurn({ actorId, angle: 0, power: 10 });
	expect(packet.durationFrames).toBe(1200);

	const speculativeDefault = new GameHandlerBuilder().defaultSystems().fromSettings(settings).build();
	expect(speculativeDefault.simulateTurn(actorId, 0, 10).durationFrames).toBeGreaterThan(300);
	expect(speculativeDefault.simulateTurn(actorId, 0, 10).durationFrames).toBeLessThanOrEqual(1200);
});

test("the bounded Hard AI decision remains deterministic", () => {
	const settings = createDefaultGameSettings(2, 2);
	settings.players.forEach((player, index) => { player.id = `00000000-0000-4000-8000-00000000000${index}`; });
	const first = new GameHandlerBuilder().defaultSystems().fromSettings(settings).build();
	const second = new GameHandlerBuilder().defaultSystems().fromSettings(JSON.parse(JSON.stringify(settings))).build();
	expect(new HardAi().computeTurn(first, aiSettings)).toEqual(new HardAi().computeTurn(second, aiSettings));
});

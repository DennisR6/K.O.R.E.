import { describe, expect, test } from "bun:test";
import { GameHandlerBuilder } from "../src/kore/runtime/Handler.ts";
import { createDefaultGameSettings } from "../src/settings/settings.ts";

describe("Simulate Turn Isolation", () => {
	test("resolves on a cloned world deterministically and leaves the live handler untouched", () => {
		const settings = createDefaultGameSettings(2, 2);
		settings.friction = { friction: 0.98, linearDrag: 0.05, stopThreshold: 0.2 };
		settings.drift = 0.3;

		const handler = new GameHandlerBuilder().defaultSystems().fromSettings(settings).build();
		const entities = handler.getEntityManager().getEntities();
		const before = handler.toSettings();

		const packet = handler.simulateTurn(entities[0]!.getId(), 60, 4);

		// Packet contract
		expect(packet.actorId).toBe(entities[0]!.getId());
		expect(packet.input).toEqual({ angle: 60, power: 4 });
		expect(packet.durationFrames).toBeGreaterThan(0);
		expect(packet.durationFrames).toBeLessThan(1200);
		expect(packet.finalState).toHaveLength(entities.length);

		// The simulation actually moved the world
		expect(packet.finalState[0]!.position).not.toEqual(entities[0]!.getPos());

		// The live handler is completely untouched: full engine contract equal
		expect(handler.toSettings()).toEqual(before);
		// ... including entities, rule state, turn number, active team, and RNG state
		expect(handler.getEntityManager().serialize()).toEqual(before.players);
		expect(handler.getRuleState()).toEqual(before.ruleState);
		expect(handler.getTurnNumber()).toBe(before.turnNumber);
		expect(handler.getActiveTeam()).toBe(before.activeTeam);
		expect(handler.toSettings().itemDrawState).toEqual(before.itemDrawState);

		// Deterministic: identical input produces an identical packet
		const again = handler.simulateTurn(entities[0]!.getId(), 60, 4);
		expect(again).toEqual(packet);

		// Different input produces a different outcome
		const other = handler.simulateTurn(entities[0]!.getId(), 200, 7);
		expect(other).not.toEqual(packet);

		// The live handler is still untouched after repeated simulations
		expect(handler.toSettings()).toEqual(before);
	});

	test("rejects unknown or dead actors without mutating the live match", () => {
		const settings = createDefaultGameSettings(2, 2);
		const handler = new GameHandlerBuilder().defaultSystems().fromSettings(settings).build();
		const entities = handler.getEntityManager().getEntities();

		const before = handler.toSettings();
		expect(() => handler.simulateTurn("missing-actor", 0, 1)).toThrow();
		expect(handler.toSettings()).toEqual(before);

		// Kill a player through the live engine and reject a shot for it
		entities[3]!.setIsDead(true);
		const beforeDead = handler.toSettings();
		expect(() => handler.simulateTurn(entities[3]!.getId(), 0, 1)).toThrow(/not active/i);
		expect(handler.toSettings()).toEqual(beforeDead);
		// Sanity: the dead state itself is preserved in the live match
		expect(handler.toSettings()).not.toEqual(before);
	});
});

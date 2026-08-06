import { describe, expect, test } from "bun:test";
import { GameRegistry, isValidInput } from "../src/server/gameRegistry.js";
import { createDefaultGameSettings } from "../src/settings/settings.js";
import { RulePhase } from "../src/rules/types.js";

describe("Harden Untrusted Game Inputs (Fuzz & Malformed Input Tests)", () => {
	test("isValidInput safely rejects non-objects, null, and primitive values without throwing", () => {
		const invalidInputs: unknown[] = [
			null,
			undefined,
			123,
			"actorId",
			true,
			[],
			Symbol("input"),
			() => {},
		];

		for (const input of invalidInputs) {
			expect(() => isValidInput(input as any)).not.toThrow();
			expect(isValidInput(input as any)).toBe(false);
		}
	});

	test("isValidInput validates actorId, angle, and power strictly", () => {
		const badInputs: unknown[] = [
			{},
			{ actorId: "", angle: 90, power: 5 },
			{ actorId: 123, angle: 90, power: 5 },
			{ actorId: "p1", angle: "90", power: 5 },
			{ actorId: "p1", angle: NaN, power: 5 },
			{ actorId: "p1", angle: Infinity, power: 5 },
			{ actorId: "p1", angle: -10, power: 5 },
			{ actorId: "p1", angle: 360, power: 5 },
			{ actorId: "p1", angle: 400, power: 5 },
			{ actorId: "p1", angle: 90, power: "5" },
			{ actorId: "p1", angle: 90, power: NaN },
			{ actorId: "p1", angle: 90, power: Infinity },
			{ actorId: "p1", angle: 90, power: 0 },
			{ actorId: "p1", angle: 90, power: -1 },
			{ actorId: "p1", angle: 90, power: 10.1 },
		];

		for (const input of badInputs) {
			expect(isValidInput(input as any)).toBe(false);
		}

		// Valid cases
		expect(isValidInput({ actorId: "p1", angle: 0, power: 0.1 })).toBe(true);
		expect(isValidInput({ actorId: "p1", angle: 359.99, power: 10 })).toBe(true);
	});

	test("GameRegistry.submitTurn rejects malformed or unauthorized inputs cleanly", () => {
		const registry = new GameRegistry();
		const settings = createDefaultGameSettings();
		const record = registry.create(settings, ["user1", "user2"]);

		// Unauthorized user
		const resUnknownUser = registry.submitTurn("hacker", { actorId: "p1", angle: 90, power: 5 });
		expect(resUnknownUser.ok).toBe(false);

		// Wrong turn user
		const resWrongTurn = registry.submitTurn("user2", { actorId: "p1", angle: 90, power: 5 });
		expect(resWrongTurn.ok).toBe(false);

		// Malformed input payload (null / non-object / bad values)
		const resNullInput = registry.submitTurn("user1", null as any);
		expect(resNullInput.ok).toBe(false);

		const resBadAngle = registry.submitTurn("user1", { actorId: "p1", angle: 999, power: 5 });
		expect(resBadAngle.ok).toBe(false);

		// Actor owned by opponent or non-existent actor
		const resNonExistentActor = registry.submitTurn("user1", { actorId: "nonexistent", angle: 90, power: 5 });
		expect(resNonExistentActor.ok).toBe(false);

		const p2Id = record.handler.getEntityManager().getEntities().find(e => e.getTeam().includes(1))?.getId();
		if (p2Id) {
			const resOpponentActor = registry.submitTurn("user1", { actorId: p2Id, angle: 90, power: 5 });
			expect(resOpponentActor.ok).toBe(false);
		}
	});

	test("GameRegistry.submitItemUse rejects malformed or unauthorized item requests", () => {
		const registry = new GameRegistry();
		const settings = createDefaultGameSettings();
		const record = registry.create(settings, ["user1", "user2"]);

		// Try item use in Physics phase
		record.ruleState.phase = RulePhase.Physics;
		const p1Id = record.handler.getEntityManager().getEntities().find(e => e.getTeam().includes(0))!.getId();
		
		const resWrongPhase = registry.submitItemUse("user1", p1Id, "anker", null);
		expect(resWrongPhase.ok).toBe(false);

		// Change phase to Item phase
		record.ruleState.phase = RulePhase.Item;

		// Malformed actorId or itemId
		expect(registry.submitItemUse("user1", null as any, "anker", null).ok).toBe(false);
		expect(registry.submitItemUse("user1", p1Id, null as any, null).ok).toBe(false);
		expect(registry.submitItemUse("user1", p1Id, 123 as any, null).ok).toBe(false);

		// Opponent actor
		const p2Id = record.handler.getEntityManager().getEntities().find(e => e.getTeam().includes(1))!.getId();
		expect(registry.submitItemUse("user1", p2Id, "anker", null).ok).toBe(false);

		// Unknown user
		expect(registry.submitItemUse("attacker", p1Id, "anker", null).ok).toBe(false);
	});

	test("GameRegistry.create and settingsForUser handle bounds and unauthorized queries", () => {
		const registry = new GameRegistry();
		expect(() => registry.create(createDefaultGameSettings(), ["user1"])).toThrow();

		const settings = createDefaultGameSettings();
		const record = registry.create(settings, ["user1", "user2"]);

		expect(() => registry.settingsForUser(record, "unknownUser")).toThrow();
	});
});

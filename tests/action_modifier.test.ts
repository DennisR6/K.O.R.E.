import { expect, test } from "bun:test";
import { applyActionModifiers, consumeActionModifiers, createActionModifier } from "@coffeemakerstudio/roast";

test("accepted action modifiers apply deterministic force scaling in explicit order", () => {
	const modifiers = [
		createActionModifier({ id: "late", action: "force", operation: "scale", factor: 1.5, remainingUses: 1, sourceOrder: 20 }),
		createActionModifier({ id: "early", action: "force", operation: "scale", factor: 0.5, remainingUses: 1, sourceOrder: 10 }),
	];

	expect(applyActionModifiers({ angle: -45, power: 10 }, modifiers)).toEqual({ angle: 315, power: 7.5 });
	expect(consumeActionModifiers(modifiers)).toEqual([]);
});

test("accepted action modifier state is JSON-safe and restoreable", () => {
	const modifier = createActionModifier({ id: "power-dash-use", action: "force", operation: "scale", factor: 1.5, remainingUses: 1, sourceId: "power-dash", sourceOrder: 0 });
	const restored = JSON.parse(JSON.stringify(modifier));

	expect(applyActionModifiers({ angle: 0, power: 4 }, [restored])).toEqual({ angle: 0, power: 6 });
	expect(consumeActionModifiers([restored])).toEqual([]);
});

test("accepted action modifier validation rejects invalid factors and inputs", () => {
	expect(() => createActionModifier({ id: "bad", action: "force", operation: "scale", factor: Number.NaN, remainingUses: 1 })).toThrow("finite");
	expect(() => createActionModifier({ id: "tick", action: "force", operation: "scale", factor: 1, durationUnit: "ticks" as never, duration: 1, remaining: 1 })).toThrow("turns");
	expect(() => applyActionModifiers({ angle: 0, power: -1 }, [])).toThrow("non-negative");
});

test("action modifier lifetime and action-use consumption remain independent", () => {
	const timed = createActionModifier({ id: "anker", action: "force", operation: "scale", factor: 0.5, durationUnit: "turns", duration: 2, remaining: 2 });

	expect(consumeActionModifiers([timed])).toEqual([timed]);
	expect(applyActionModifiers({ angle: 0, power: 8 }, [timed])).toEqual({ angle: 0, power: 4 });
});

test("aim random-offset and force scale compose in stable canonical order", () => {
	const aim = createActionModifier({ id: "aim", action: "aim", operation: "random-offset", maxVarianceDegrees: 10, randomState: 12345, remainingUses: 1, sourceOrder: 1 });
	const force = createActionModifier({ id: "force", action: "force", operation: "scale", factor: 1.5, remainingUses: 1, sourceOrder: 2 });
	const reversed = [force, aim];

	expect(applyActionModifiers({ angle: 90, power: 4 }, reversed)).toEqual(applyActionModifiers({ angle: 90, power: 4 }, [aim, force]));
	expect(applyActionModifiers({ angle: 90, power: 4 }, reversed).power).toBe(6);
	expect(consumeActionModifiers([aim])).toEqual([]);
	const advanced = consumeActionModifiers([createActionModifier({ id: "aim", action: "aim", operation: "random-offset", maxVarianceDegrees: 10, randomState: 12345, remainingUses: 2 })])[0]!;
	expect(advanced.remainingUses).toBe(1);
	if (advanced.action !== "aim") throw new Error("Expected aim modifier");
	expect(advanced.randomState).not.toBe(12345);
});

test("aim random-offset validates canonical random state and variance", () => {
	expect(() => createActionModifier({ id: "bad", action: "aim", operation: "random-offset", maxVarianceDegrees: -1, randomState: 1, remainingUses: 1 })).toThrow("variance");
	expect(() => createActionModifier({ id: "bad", action: "aim", operation: "random-offset", maxVarianceDegrees: 1, randomState: -1, remainingUses: 1 })).toThrow("unsigned");
});

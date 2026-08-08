import { expect, test } from "bun:test";
import { applyActionModifiers, consumeActionModifiers, createActionModifier } from "../src/engine/contracts/actionModifier.ts";

test("accepted action modifiers apply deterministic force scaling in explicit order", () => {
	const modifiers = [
		createActionModifier({ id: "late", action: "force", operation: "scale", factor: 1.5, sourceOrder: 20 }),
		createActionModifier({ id: "early", action: "force", operation: "scale", factor: 0.5, sourceOrder: 10 }),
	];

	expect(applyActionModifiers({ angle: -45, power: 10 }, modifiers)).toEqual({ angle: 315, power: 7.5 });
	expect(consumeActionModifiers(modifiers)).toEqual([]);
});

test("accepted action modifier state is JSON-safe and restoreable", () => {
	const modifier = createActionModifier({ id: "power-dash-use", action: "force", operation: "scale", factor: 1.5, sourceId: "power-dash", sourceOrder: 0 });
	const restored = JSON.parse(JSON.stringify(modifier));

	expect(applyActionModifiers({ angle: 0, power: 4 }, [restored])).toEqual({ angle: 0, power: 6 });
	expect(consumeActionModifiers([restored])).toEqual([]);
});

test("accepted action modifier validation rejects invalid factors and inputs", () => {
	expect(() => createActionModifier({ id: "bad", action: "force", operation: "scale", factor: Number.NaN })).toThrow("finite");
	expect(() => applyActionModifiers({ angle: 0, power: -1 }, [])).toThrow("non-negative");
});

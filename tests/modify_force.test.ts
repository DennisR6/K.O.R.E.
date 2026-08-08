import { expect, test } from "bun:test";
import { applyActionModifiers, createActionModifier } from "../src/engine/contracts/actionModifier.ts";

test("modifyForce authoring applies one deterministic generic force multiplier", () => {
	const effect = createActionModifier({ id: "modify-force", action: "force", operation: "scale", factor: 0.5, remainingUses: 1 });
	expect(applyActionModifiers({ angle: -90, power: 8 }, [effect])).toEqual({ angle: 270, power: 4 });
	expect(JSON.parse(JSON.stringify(effect))).toEqual(effect);
});

test("modifyForce effects stack in declaration order by multiplication", () => {
	const result = applyActionModifiers({ angle: 450, power: 10 }, [
		createActionModifier({ id: "first", action: "force", operation: "scale", factor: 0.8, remainingUses: 1, sourceOrder: 0 }),
		createActionModifier({ id: "second", action: "force", operation: "scale", factor: 0.5, remainingUses: 1, sourceOrder: 1 }),
	]);
	expect(result).toEqual({ angle: 90, power: 4 });
});

test("modifyForce rejects invalid factors and force inputs", () => {
	expect(() => createActionModifier({ id: "negative", action: "force", operation: "scale", factor: -1, remainingUses: 1 })).toThrow("non-negative");
	expect(() => createActionModifier({ id: "nan", action: "force", operation: "scale", factor: Number.NaN, remainingUses: 1 })).toThrow("finite");
	const effect = createActionModifier({ id: "valid", action: "force", operation: "scale", factor: 1, remainingUses: 1 });
	expect(() => applyActionModifiers({ angle: 0, power: -1 }, [effect])).toThrow("non-negative power");
});

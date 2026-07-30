import { expect, test } from "bun:test";
import { ItemValidator, validateDeclarativeItem } from "../src/item/validate.ts";
import { createItemDocument } from "../src/item/types.ts";

function createValidator(): ItemValidator {
	const validator = new ItemValidator();
	validator.registerEffectType("modifyForce");
	return validator;
}

function validItem(value: Record<string, unknown> = { factor: 0.5 }) {
	return createItemDocument({
		effects: [{ type: "modifyForce", value }],
		targetValidation: { allowSelf: true, allowAlly: false, allowEnemy: false },
	});
}

test("accepts an item with a registered declarative effect", () => {
	const item = validItem({ factor: 0.5, labels: ["slow", "safe"] });
	expect(createValidator().validate(item)).toBe(item);
});

test("rejects an item with an effect outside the whitelist", () => {
	const item = validItem();
	item.effects[0].type = "executeScript";
	expect(() => createValidator().validate(item)).toThrow("not in the whitelist");
});

test("rejects empty and duplicate effect registrations", () => {
	const validator = new ItemValidator();
	expect(() => validator.registerEffectType(" ")).toThrow("non-empty string");
	validator.registerEffectType("modifyForce");
	expect(() => validator.registerEffectType("modifyForce")).toThrow("already registered");
	expect(validator.isRegisteredEffectType("modifyForce")).toBe(true);
});

test("rejects non-JSON effect values and cycles", () => {
	class EffectValue {}
	const cyclic: Record<string, unknown> = {};
	cyclic.self = cyclic;
	const invalidValues: unknown[] = [
		undefined,
		() => undefined,
		Symbol("value"),
		1n,
		new EffectValue(),
		new Date(),
		new Map(),
		new Set(),
		cyclic,
	];

	for (const value of invalidValues) {
		const item = validItem({ value });
		expect(() => createValidator().validate(item)).toThrow();
	}
});

test("rejects executable keys in effect values at every depth", () => {
	for (const key of ["script", "code", "handler", "onClick"]) {
		expect(() => createValidator().validate({ ...validItem(), [key]: "run()" })).toThrow("not allowed");
	}

	for (const value of [
		{ script: "run()" },
		{ nested: { code: "run()" } },
		{ nested: { handler: "run" } },
		{ nested: { onClick: "run" } },
	]) {
		expect(() => createValidator().validate(validItem(value))).toThrow("executable field");
	}
});

test("rejects fields outside the known item schemas", () => {
	const validator = createValidator();
	const cases: Record<string, unknown>[] = [
		{ extra: true },
		{ effects: [{ type: "modifyForce", extra: true }] },
		{ duration: { type: "instant", value: 0, extra: true } },
		{ useLimit: { perTurn: 1, perGame: 1, extra: true } },
		{ targetValidation: { allowSelf: true, allowAlly: false, allowEnemy: false, extra: true } },
	];

	for (const changes of cases) {
		const item = { ...validItem(), ...changes };
		expect(() => validator.validate(item)).toThrow("not allowed");
	}
});

test("keeps descriptive strings as data and returns documents through the wrapper", () => {
	const item = validItem({ description: "const force = 10; this is only a label" });
	item.description = "Code-themed item";
	expect(validateDeclarativeItem(item, createValidator())).toBe(item);
});

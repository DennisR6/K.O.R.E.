import { expect, test } from "bun:test";
import { EffectSwapPosition } from "../src/effects/swapPosition.ts";
import { ItemEffectType } from "../src/effects/types.ts";

test("swapPosition exchanges active entity positions atomically", () => {
	const effect = new EffectSwapPosition();
	expect(effect.swap(
		{ id: "a", position: { x: 10, y: 20 }, active: true },
		{ id: "b", position: { x: 80, y: 90 }, active: true },
	)).toEqual([{ x: 80, y: 90 }, { x: 10, y: 20 }]);
	expect(effect.teleport({ id: "a", position: { x: 10, y: 20 }, active: true }, { x: 40, y: 50 })).toEqual({ x: 40, y: 50 });
});

test("swapPosition serializes as a declarative effect", () => {
	expect(new EffectSwapPosition().toSettings()).toEqual({ type: ItemEffectType.SwapPosition, typeValue: {} });
});

test("swapPosition rejects invalid or inactive targets", () => {
	const effect = new EffectSwapPosition();
	const active = { id: "a", position: { x: 0, y: 0 }, active: true };
	expect(() => effect.swap(active, active)).toThrow("itself");
	expect(() => effect.swap({ ...active, active: false }, { id: "b", position: { x: 1, y: 1 }, active: true })).toThrow("active");
	expect(() => effect.teleport(active, { x: Number.NaN, y: 1 })).toThrow("finite");
});

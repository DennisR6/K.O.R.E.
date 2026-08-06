import { expect, test } from "bun:test";
import { applyAnkerForce, ankerItem, createOfficialItemLoader } from "../src/item/officialItems.ts";

test("Anker is a validated built-in declarative item", () => {
	const loader = createOfficialItemLoader();
	expect(loader.getSource("anker")).toBe("built-in");
	expect(loader.get("anker")).toEqual(ankerItem);
	expect(ankerItem.effects).toEqual([{ type: "modifyForce", value: { factor: 0.5 } }]);
});

test("Anker halves force while preserving normalized direction", () => {
	expect(applyAnkerForce({ angle: -90, power: 8 })).toEqual({ angle: 270, power: 4 });
});

test("Anker keeps its declared target, duration, and use limits", () => {
	expect(ankerItem.targetType).toBe("self");
	expect(ankerItem.duration).toEqual({ type: "turns", value: 2 });
	expect(ankerItem.useLimit).toEqual({ perTurn: 1, perGame: 2 });
});

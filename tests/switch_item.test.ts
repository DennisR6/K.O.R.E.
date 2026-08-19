import { expect, test } from "bun:test";
import { createOfficialItemLoader, switchItem } from "../src/item/officialItems.ts";

test("Switch is a validated ally-targeted built-in item", () => {
	const loader = createOfficialItemLoader();
	expect(loader.getSource("switch")).toBe("built-in");
	expect(loader.get("switch")).toEqual(switchItem);
	expect(switchItem.effects).toEqual([{ type: "transform.swap-position", value: {} }]);
	expect(switchItem.targetValidation).toEqual({ allowSelf: false, allowAlly: true, allowEnemy: true, maxRange: 300 });
});

test("Switch remains instant, ally-targeted, and game-limited", () => {
	expect(switchItem.duration).toEqual({ type: "instant", value: 0 });
	expect(switchItem.useLimit).toEqual({ perTurn: 1, perGame: 1 });
});

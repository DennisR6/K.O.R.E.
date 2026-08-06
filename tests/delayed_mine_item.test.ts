import { expect, test } from "bun:test";
import { applyVerzoegerteMineExplosion, createOfficialItemLoader, createVerzoegerteMine, verzoegerteMineItem } from "../src/item/officialItems.ts";

test("Verzögerte Mine is a validated built-in position-targeted item", () => {
	const loader = createOfficialItemLoader();
	expect(loader.getSource("verzoegerte-mine")).toBe("built-in");
	expect(loader.get("verzoegerte-mine")).toEqual(verzoegerteMineItem);
});

test("Verzögerte Mine applies no force before delay and repels after explosion", () => {
	const mine = createVerzoegerteMine({ x: 0, y: 0 }, 2);
	expect(applyVerzoegerteMineExplosion(mine, { x: 0, y: 0 }, { x: 10, y: 0 })).toEqual({ x: 0, y: 0 });
	mine.trigger.advanceTick();
	expect(applyVerzoegerteMineExplosion(mine, { x: 0, y: 0 }, { x: 10, y: 0 })).toEqual({ x: 0, y: 0 });
	mine.trigger.advanceTick();
	expect(applyVerzoegerteMineExplosion(mine, { x: 0, y: 0 }, { x: 10, y: 0 })).toEqual({ x: -4, y: 0 });
});

test("Verzögerte Mine rejects invalid placement", () => {
	expect(() => createVerzoegerteMine({ x: Number.NaN, y: 0 })).toThrow("finite");
});

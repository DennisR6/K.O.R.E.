import { expect, test } from "bun:test";
import { createOfficialItemLoader, createVerzoegerteMine, verzoegerteMineItem } from "../src/item/officialItems.ts";

test("Verzögerte Mine is a validated built-in position-targeted item", () => {
	const loader = createOfficialItemLoader();
	expect(loader.getSource("verzoegerte-mine")).toBe("built-in");
	expect(loader.get("verzoegerte-mine")).toEqual(verzoegerteMineItem);
});

test("Verzögerte Mine lowers to a generic deferred force-field effect", () => {
	const mine = createVerzoegerteMine({ x: 0, y: 0 }, 2);
	expect(mine.deferred).toEqual({ durationUnit: "ticks", duration: 2, effect: { schemaVersion: 1, type: "movement.apply-force-field", typeValue: { mode: "repel", force: 4, range: 60 } } });
});

test("Verzögerte Mine rejects invalid placement", () => {
	expect(() => createVerzoegerteMine({ x: Number.NaN, y: 0 })).toThrow("finite");
});

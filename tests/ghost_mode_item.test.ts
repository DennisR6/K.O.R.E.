import { expect, test } from "bun:test";
import { EffectGhostMode } from "../src/effects/ghostMode.ts";
import { durchlaessigkeitItem, createOfficialItemLoader } from "../src/item/officialItems.ts";

test("Durchlässigkeit is loaded as a validated built-in ghost-mode item", () => {
	const loader = createOfficialItemLoader();
	expect(loader.getSource("durchlaessigkeit")).toBe("built-in");
	expect(loader.get("durchlaessigkeit")).toEqual(durchlaessigkeitItem);
	expect(durchlaessigkeitItem.effects).toEqual([{ type: "ghostMode", value: { durationTurns: 2 } }]);
});

test("ghost mode filters collisions while active and expires deterministically", () => {
	const ghost = new EffectGhostMode({ typeValue: { durationTurns: 2 } });
	expect(ghost.shouldIgnoreCollision()).toBe(true);
	ghost.advanceTurn();
	expect(ghost.shouldIgnoreCollision()).toBe(true);
	ghost.advanceTurn();
	expect(ghost.shouldIgnoreCollision()).toBe(false);
});

test("ghost mode preserves remaining duration through serialization", () => {
	const ghost = new EffectGhostMode({ typeValue: { durationTurns: 3 } });
	ghost.advanceTurn();
	const settings = ghost.toSettings();
	expect(new EffectGhostMode(settings).toSettings()).toEqual(settings);
});

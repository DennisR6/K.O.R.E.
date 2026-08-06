import { expect, test } from "bun:test";
import { EffectSelectionLock } from "../src/effects/selectionLock.ts";
import { ItemEffectType } from "../src/effects/types.ts";
import { createOfficialItemLoader, createSelectionLock, jaegermeisterElixierItem } from "../src/item/officialItems.ts";

test("Jägermeister-Elixier is loaded as a validated built-in enemy-targeted item", () => {
	const loader = createOfficialItemLoader();
	expect(loader.getSource("jaegermeister-elixier")).toBe("built-in");
	expect(loader.get("jaegermeister-elixier")).toEqual(jaegermeisterElixierItem);
	expect(jaegermeisterElixierItem.effects).toEqual([{ type: "selectionLock", value: { durationTurns: 2 } }]);
	expect(jaegermeisterElixierItem.targetValidation).toEqual({ allowSelf: false, allowAlly: false, allowEnemy: true, maxRange: 300 });
});

test("selection lock prevents figure selection for its duration and expires deterministically", () => {
	const lock = createSelectionLock();
	expect(lock.isLocked()).toBe(true);
	expect(lock.getRemainingTurns()).toBe(2);
	lock.advanceTurn();
	expect(lock.isLocked()).toBe(true);
	expect(lock.getRemainingTurns()).toBe(1);
	lock.advanceTurn();
	expect(lock.isLocked()).toBe(false);
	expect(lock.getRemainingTurns()).toBe(0);
});

test("selection lock serializes and restores remaining lifetime", () => {
	const effect = new EffectSelectionLock({ typeValue: { durationTurns: 3 } });
	effect.advanceTurn();
	const settings = effect.toSettings();
	expect(settings).toEqual({ type: ItemEffectType.SelectionLock, typeValue: { durationTurns: 3, remainingTurns: 2 } });
	expect(new EffectSelectionLock(settings).toSettings()).toEqual(settings);
});

test("selection lock rejects invalid duration and countdown settings", () => {
	expect(() => new EffectSelectionLock({ typeValue: { durationTurns: 0 } })).toThrow("positive integer");
	expect(() => new EffectSelectionLock({ typeValue: { durationTurns: 2, remainingTurns: 3 } })).toThrow("between zero");
});

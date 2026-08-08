import { expect, test } from "bun:test";
import { GameHandlerBuilder } from "../src/engine/Handler.ts";
import { createDefaultGameSettings } from "../src/settings/settings.ts";
import { createItemDocument } from "../src/item/types.ts";

function handlerWithItems(items: ReturnType<typeof createItemDocument>[]) {
	const settings = createDefaultGameSettings(2, 1);
	settings.items = items;
	settings.players[0] = { ...settings.players[0]!, inventory: items.map(item => ({ itemId: item.id, remainingUses: 2, usesThisTurn: 0 })) };
	return new GameHandlerBuilder().defaultSystems().fromSettings(settings).build();
}

test("declarative conflict rejection is atomic at the public item boundary", () => {
	const first = createItemDocument({ id: "first", effects: [{ type: "temporalModifier", value: { durationUnit: "turns", duration: 2, effect: { schemaVersion: 1, type: "movement.scale-speed", typeValue: { factor: 0.5 } } } }] });
	const conflicting = createItemDocument({
		id: "conflicting",
		effects: [{ type: "ghostMode", value: { durationTurns: 2 } }],
		interaction: { mode: "stack", with: { first: "reject" } },
	});
	const handler = handlerWithItems([first, conflicting]);
	const actor = handler.getEntityManager().getEntities()[0]!;
	handler.useItem(actor.getId(), first.id);
	const before = handler.toSettings();

	expect(() => handler.useItem(actor.getId(), conflicting.id)).toThrow("conflicts");
	expect(handler.toSettings()).toEqual(before);
});

test("replacement and ordering are deterministic and survive a snapshot", () => {
	const oldItem = createItemDocument({ id: "old", effects: [{ type: "temporalModifier", value: { durationUnit: "turns", duration: 2, effect: { schemaVersion: 1, type: "movement.scale-speed", typeValue: { factor: 0.5 } } } }], interaction: { mode: "stack", order: 20 } });
	const replacement = createItemDocument({ id: "replacement", effects: [{ type: "ghostMode", value: { durationTurns: 2 } }], interaction: { mode: "replace", with: { old: "replace" }, order: 10 } });
	const handler = handlerWithItems([oldItem, replacement]);
	const actor = handler.getEntityManager().getEntities()[0]!;
	handler.useItem(actor.getId(), oldItem.id);
	handler.useItem(actor.getId(), replacement.id);
	const effects = actor.getItemEffects();
	const temporal = actor.getTemporalModifiers();
	expect(effects).toHaveLength(1);
	expect(temporal).toHaveLength(0);

	const snapshot = handler.toSettings();
	const restored = new GameHandlerBuilder().defaultSystems().fromSettings(structuredClone(snapshot)).build();
	expect(restored.toSettings()).toEqual(snapshot);
});

test("turn-scoped combinations expire on the declared boundary", () => {
	const temporary = createItemDocument({ id: "temporary", effects: [{ type: "temporalModifier", value: { durationUnit: "turns", duration: 2, effect: { schemaVersion: 1, type: "movement.scale-speed", typeValue: { factor: 0.5 } } } }] });
	const handler = handlerWithItems([temporary]);
	const actor = handler.getEntityManager().getEntities()[0]!;
	handler.useItem(actor.getId(), temporary.id);
	handler.setTurnNumber(1);
	expect(actor.getTemporalModifiers()).toHaveLength(1);
	handler.setTurnNumber(2);
	expect(actor.getTemporalModifiers()).toHaveLength(0);
});

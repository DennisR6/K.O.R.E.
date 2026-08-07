import { expect, test } from "bun:test";
import { orderInstalledEffects, preserveEffectDeclarationOrder } from "../src/effects/ordering.ts";
import { EffectType, type EffectSettings } from "../src/effects/types.ts";
import { MultiEffect } from "../src/effects/effects.ts";

test("installed item Effects order by explicit order and retain declaration order for ties", () => {
	const ordered = orderInstalledEffects([
		{ id: "late", order: 2 },
		{ id: "first", order: 0 },
		{ id: "tie-a", order: 1 },
		{ id: "tie-b", order: 1 },
	]);

	expect(ordered.map(effect => effect.id)).toEqual(["first", "tie-a", "tie-b", "late"]);
});

test("Multi Effect children preserve serialized declaration order", () => {
	const children: EffectSettings[] = [
		{ schemaVersion: 1, type: EffectType.Velocity, typeValue: { x: 1, y: 0 } },
		{ schemaVersion: 1, type: EffectType.Position, typeValue: { x: 4, y: 5 } },
	];
	const effect = new MultiEffect({ schemaVersion: 1, type: EffectType.Multi, typeValue: children });

	expect(preserveEffectDeclarationOrder(children)).toEqual(children);
	expect(effect.toSettings()).toEqual({ schemaVersion: 1, type: EffectType.Multi, typeValue: children });
});

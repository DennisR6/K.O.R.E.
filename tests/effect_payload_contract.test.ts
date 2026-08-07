import { expect, test } from "bun:test";
import { EffectType, ItemEffectType, SettingOperation, type EffectSettings, type TypedItemEffectSettings } from "../src/effects/types.ts";

test("core EffectSettings maps each implemented type to a typed payload", () => {
	const effects: EffectSettings[] = [
		{ type: EffectType.Physics, typeValue: { friction: 0.9, linearDrag: 0.1, stopThreshold: 0.2 } },
		{ type: EffectType.Damage, typeValue: { damage: 3 } },
		{ type: EffectType.Movement, typeValue: { deltaTime: 1, x: 2, y: 0 } },
		{ type: EffectType.Multi, typeValue: [{ type: EffectType.Velocity, typeValue: { x: 1, y: 2 } }] },
		{ type: EffectType.ModifyMass, typeValue: { mass: 1 } },
		{ type: EffectType.ModifySize, typeValue: { size: 20 } },
		{ type: EffectType.Position, typeValue: { x: 1, y: 2 } },
		{ type: EffectType.Velocity, typeValue: { x: 1, y: 2 } },
		{ type: EffectType.Team, typeValue: { team: [0, 1] } },
		{ type: EffectType.ModifySetting, typeValue: { operation: SettingOperation.Set, key: "dead", value: false } },
	];

	expect(JSON.parse(JSON.stringify(effects))).toEqual(effects);
});

test("typed item runtime settings retain lifecycle payload fields", () => {
	const effect: TypedItemEffectSettings = {
		type: ItemEffectType.Freeze,
		typeValue: { speedFactor: 0.25, durationTurns: 2, remainingTurns: 1 },
	};

	expect(JSON.parse(JSON.stringify(effect))).toEqual(effect);
});

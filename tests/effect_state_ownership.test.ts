import { expect, test } from "bun:test";
import { createPlayerSettings } from "../src/entity/types.ts";
import { Player } from "../src/entity/Player.ts";
import { EffectModifySetting } from "../src/effects/modifySetting.ts";
import { EffectMove } from "../src/effects/movement.ts";
import { SettingOperation, EffectTrigger, EffectType } from "../src/effects/types.ts";
import { GameHandlerBuilder } from "../src/engine/Handler.ts";

test("current entity state is canonical and is serialized separately from a setting request", () => {
	const player = new Player(createPlayerSettings({ hp: 10 }));
	const request = new EffectModifySetting({ typeValue: { operation: SettingOperation.Add, key: "hp", value: -3 } });

	request.apply(player);
	const settings = player.toSettings();

	expect(settings.hp).toBe(7);
	expect(request.toSettings()).toEqual({ schemaVersion: 1, type: EffectType.ModifySetting, typeValue: { operation: SettingOperation.Add, key: "hp", value: -3 } });
	expect(settings.effects).toEqual([]);
});

test("persistent behavior retains its Effect definition while current position remains entity state", () => {
	const movement = new EffectMove({ typeValue: { deltaTime: 1, x: 2, y: 0 } });
	const player = new Player(createPlayerSettings({ effects: [{ ...movement.toSettings(), trigger: EffectTrigger.Always, triggerValue: [] }] }));

	new GameHandlerBuilder().defaultSystems().addPlayer(player).build().tick(1);
	const settings = player.toSettings();

	expect(settings.position).toEqual({ x: 2, y: 0 });
	expect(settings.effects[0]).toEqual({ ...movement.toSettings(), trigger: EffectTrigger.Always, triggerValue: [] });
});

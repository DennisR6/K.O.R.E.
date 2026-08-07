import { expect, test } from "bun:test";
import { GameHandlerBuilder } from "../src/engine/Handler.ts";
import { Player } from "../src/entity/Player.ts";
import { createPlayerSettings } from "../src/entity/types.ts";
import { EffectModifySetting } from "../src/effects/modifySetting.ts";
import { EffectTrigger, SettingOperation, type FullEffectSettings } from "../src/effects/types.ts";
import { RulePhase } from "../src/rules/types.ts";

function damageRoundEffect(amount: number): FullEffectSettings {
	return {
		trigger: EffectTrigger.Round,
		triggerValue: [],
		...new EffectModifySetting({ typeValue: { operation: SettingOperation.Add, key: "hp", value: -amount } }).toSettings(),
	} as FullEffectSettings;
}

test("Round Effects activate once at startTurn in handler and Player declaration order", () => {
	const player = new Player(createPlayerSettings({ hp: 10, effects: [damageRoundEffect(2)] }));
	const handler = new GameHandlerBuilder().defaultSystems().addPlayer(player).build();
	handler.addEffectEveryRound(new EffectModifySetting({ typeValue: { operation: SettingOperation.Add, key: "hp", value: -1 } }));

	handler.startTurn({ phase: RulePhase.Physics, activeTeam: 0, turnNumber: 0, itemUses: 0 });
	expect(player.getHP()).toBe(7);

	handler.startTurn({ phase: RulePhase.Physics, activeTeam: 0, turnNumber: 1, itemUses: 0 });
	expect(player.getHP()).toBe(4);
});

test("Round activation is not repeated by snapshot restoration", () => {
	const player = new Player(createPlayerSettings({ hp: 10, effects: [damageRoundEffect(2)] }));
	const handler = new GameHandlerBuilder().defaultSystems().addPlayer(player).build();
	handler.startTurn({ phase: RulePhase.Physics, activeTeam: 0, turnNumber: 0, itemUses: 0 });
	const snapshot = handler.toSettings();
	const restored = new GameHandlerBuilder().defaultSystems().fromSettings(snapshot).build();

	expect(restored.getEntityManager().getEntities()[0]!.getHP()).toBe(8);
	expect(restored.getEntityManager().getEntities()[0]!.toSettings().effects).toEqual(snapshot.players[0]!.effects);
});

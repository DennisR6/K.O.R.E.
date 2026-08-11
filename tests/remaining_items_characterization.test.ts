import { expect, test } from "bun:test";
import { GameEmitter } from "../src/emitter/EngineEmitter.ts";
import { GameHandlerBuilder } from "../src/kore/runtime/Handler.ts";
import { durchlaessigkeitItem, jaegermeisterElixierItem, vodkaZeroItem } from "../src/item/officialItems.ts";
import { RulePhase, WinCondition, type GameModeSettings } from "../src/rules/types.ts";
import { createDefaultGameSettings } from "../src/settings/settings.ts";

function buildSettings(item: typeof durchlaessigkeitItem | typeof jaegermeisterElixierItem | typeof vodkaZeroItem): GameModeSettings & ReturnType<typeof createDefaultGameSettings> {
	const settings = createDefaultGameSettings(2, 1);
	settings.items = [item];
	settings.gameMode = {
		id: `remaining-item-${item.id}`,
		phases: [RulePhase.Item, RulePhase.Physics],
		maxItemsPerTurn: 1,
		winCondition: WinCondition.LastTeamStanding,
		itemEconomy: {
			fixedLoadouts: [{ team: 0, items: [{ itemId: item.id, uses: 1 }] }],
			mapPickups: [],
		},
	};
	return settings as GameModeSettings & ReturnType<typeof createDefaultGameSettings>;
}

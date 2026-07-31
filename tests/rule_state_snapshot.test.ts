import { expect, test } from "bun:test";
import { GameHandlerBuilder } from "../src/engine/Handler.ts";
import { RulePhase } from "../src/rules/types.ts";
import { MatchEndReason, MatchStatus } from "../src/rules/types.ts";
import { GameSettings } from "../src/settings/settings.ts";

test("engine snapshots restore rule phase and pending item usage", () => {
	const handler = new GameHandlerBuilder().defaultSystems().fromSettings(GameSettings).build();
	handler.setRuleState({ phase: RulePhase.Item, activeTeam: 1, turnNumber: 4, itemUses: 1 });
	handler.setMatchResult({ status: MatchStatus.Winner, winnerTeam: 1, reason: MatchEndReason.LastTeamStanding, turnNumber: 4 });
	const restored = new GameHandlerBuilder().defaultSystems().fromSettings(handler.toSettings()).build();

	expect(restored.getRuleState()).toEqual({ phase: RulePhase.Item, activeTeam: 1, turnNumber: 4, itemUses: 1 });
	expect(restored.getActiveTeam()).toBe(1);
	expect(restored.getTurnNumber()).toBe(4);
	expect(restored.getMatchResult()).toEqual({ status: MatchStatus.Winner, winnerTeam: 1, reason: MatchEndReason.LastTeamStanding, turnNumber: 4 });
});

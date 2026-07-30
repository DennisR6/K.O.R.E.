import { expect, test } from "bun:test";
import { DEFAULT_ITEM_ECONOMY, MatchEndReason, RulePhase, WinCondition, type GameModeSettings, type MatchResult, type RuleState } from "../src/rules/types.ts";

test("game-mode, rule-state, and match-result contracts round-trip as JSON", () => {
	const mode: GameModeSettings = {
		id: "standard",
		phases: [RulePhase.Item, RulePhase.Aim, RulePhase.Charge, RulePhase.Push, RulePhase.Physics],
		maxItemsPerTurn: 1,
		winCondition: WinCondition.LastTeamStanding,
		itemEconomy: DEFAULT_ITEM_ECONOMY,
	}
	const state: RuleState = { phase: RulePhase.Push, activeTeam: 1, turnNumber: 4, itemUses: 1 }
	const result: MatchResult = { winnerTeam: null, reason: MatchEndReason.Draw, turnNumber: 12 }

	const restored = JSON.parse(JSON.stringify({ mode, state, result })) as {
		mode: GameModeSettings;
		state: RuleState;
		result: MatchResult;
	}

	expect(restored).toEqual({ mode, state, result })
})

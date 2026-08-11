import { expect, test } from "bun:test";
import { GameHandlerBuilder } from "../src/kore/runtime/Handler.ts";
import { GameState } from "../src/kore/runtime/types.ts";
import { currentTurnMode } from "../src/rules/defaultGameModes.ts";
import { RuleInterpreter } from "../src/rules/RuleInterpreter.ts";
import { RulePhase } from "../src/rules/types.ts";
import { GameSettings } from "../src/settings/settings.ts";
import { TurnSystem } from "../src/systems/TurnSystem.ts";

test("RuleInterpreter advances teams deterministically and TurnSystem maps ownership to UI state", () => {
	const rules = new RuleInterpreter(currentTurnMode)
	expect(rules.nextActiveTeam(0, 2)).toBe(1)
	expect(rules.nextActiveTeam(1, 2)).toBe(0)
	expect(TurnSystem.stateForTeam(1, [0])).toBe(GameState.Opponents_turn)
	expect(TurnSystem.stateForTeam(1, [1])).toBe(GameState.Your_turn)
})

test("GameHandler persists rule-derived active team and turn number through settings", () => {
	const handler = new GameHandlerBuilder().defaultSystems().fromSettings(GameSettings).build()
	expect(handler.getActiveTeam()).toBe(0)
	expect(handler.getTurnNumber()).toBe(0)
	const rules = new RuleInterpreter(currentTurnMode)
	const nextTurn = rules.startNextTurn({ phase: RulePhase.Complete, activeTeam: 0, turnNumber: 0, itemUses: 0 }, 2)
	handler.setActiveTeam(nextTurn.activeTeam)
	handler.setTurnNumber(nextTurn.turnNumber)
	expect(handler.getActiveTeam()).toBe(1)
	expect(handler.getTurnNumber()).toBe(1)

	const restored = new GameHandlerBuilder().defaultSystems().fromSettings(handler.toSettings()).build()
	expect(restored.getActiveTeam()).toBe(1)
	expect(restored.getTurnNumber()).toBe(1)
})

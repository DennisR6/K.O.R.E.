import { expect, test } from "bun:test";
import { GameHandlerBuilder } from "../src/engine/Handler.ts";
import { GameState } from "../src/engine/types.ts";
import { GameSettings } from "../src/settings/settings.ts";
import { TurnSystem } from "../src/systems/TurnSystem.ts";

test("TurnSystem advances teams deterministically and maps ownership to UI state", () => {
	expect(TurnSystem.nextActiveTeam(0, 2)).toBe(1)
	expect(TurnSystem.nextActiveTeam(1, 2)).toBe(0)
	expect(TurnSystem.stateForTeam(1, [0])).toBe(GameState.Opponents_turn)
	expect(TurnSystem.stateForTeam(1, [1])).toBe(GameState.Your_turn)
})

test("GameHandler persists active team and turn number through settings", () => {
	const handler = new GameHandlerBuilder().defaultSystems().fromSettings(GameSettings).build()
	expect(handler.getActiveTeam()).toBe(0)
	expect(handler.getTurnNumber()).toBe(0)
	expect(handler.advanceTurn()).toBe(1)
	expect(handler.getTurnNumber()).toBe(1)

	const restored = new GameHandlerBuilder().defaultSystems().fromSettings(handler.toSettings()).build()
	expect(restored.getActiveTeam()).toBe(1)
	expect(restored.getTurnNumber()).toBe(1)
})

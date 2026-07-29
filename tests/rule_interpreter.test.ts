import { expect, test } from "bun:test";
import { RuleInterpreter } from "../src/rules/RuleInterpreter.ts";
import { RulePhase, WinCondition, type GameModeSettings } from "../src/rules/types.ts";

const standardMode: GameModeSettings = {
	id: "standard",
	phases: [RulePhase.Item, RulePhase.Aim, RulePhase.Charge, RulePhase.Push, RulePhase.Physics],
	maxItemsPerTurn: 1,
	winCondition: WinCondition.LastTeamStanding,
}

test("RuleInterpreter advances configured phases without changing turn state", () => {
	const rules = new RuleInterpreter(standardMode)
	let state = rules.initialState(1, 4)
	expect(state).toEqual({ phase: RulePhase.Item, activeTeam: 1, turnNumber: 4, itemUses: 0 })

	for (const phase of [RulePhase.Aim, RulePhase.Charge, RulePhase.Push, RulePhase.Physics, RulePhase.Complete]) {
		state = rules.advancePhase(state)
		expect(state.phase).toBe(phase)
		expect(state.activeTeam).toBe(1)
		expect(state.turnNumber).toBe(4)
	}

	expect(rules.advancePhase(state)).toBe(state)
})

test("RuleInterpreter supports modes that omit the optional item phase", () => {
	const rules = new RuleInterpreter({ ...standardMode, phases: [RulePhase.Aim, RulePhase.Push, RulePhase.Physics] })
	expect(rules.initialState().phase).toBe(RulePhase.Aim)
	expect(() => new RuleInterpreter({ ...standardMode, phases: [] })).toThrow("at least one rule phase")
	expect(() => new RuleInterpreter({ ...standardMode, phases: [RulePhase.Complete] })).toThrow("Complete cannot")
})

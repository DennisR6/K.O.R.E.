import { expect, test } from "bun:test";
import { RuleInterpreter } from "../src/rules/RuleInterpreter.ts";
import { DEFAULT_ITEM_ECONOMY, RulePhase, WinCondition, type GameModeSettings } from "../src/rules/types.ts";

const standardMode: GameModeSettings = {
	id: "standard",
	phases: [RulePhase.Item, RulePhase.Aim, RulePhase.Charge, RulePhase.Push, RulePhase.Physics],
	maxItemsPerTurn: 1,
	winCondition: WinCondition.LastTeamStanding,
	itemEconomy: DEFAULT_ITEM_ECONOMY,
}

test("RuleInterpreter advances configured phases without changing turn state", () => {
	const rules = new RuleInterpreter(standardMode)
	let state = rules.initialState(1, 4)
	expect(state).toEqual({ phase: RulePhase.Item, activeTeam: 1, turnNumber: 4, itemUses: 0 })
	state = rules.useItem(state)
	expect(state.itemUses).toBe(1)
	expect(() => rules.useItem(state)).toThrow("Item allowance has been exhausted")

	for (const phase of [RulePhase.Aim, RulePhase.Charge, RulePhase.Push, RulePhase.Physics, RulePhase.Complete]) {
		state = rules.advancePhase(state)
		expect(state.phase).toBe(phase)
		expect(state.activeTeam).toBe(1)
		expect(state.turnNumber).toBe(4)
	}

	expect(rules.advancePhase(state)).toBe(state)
	expect(rules.startNextTurn(state, 2)).toEqual({ phase: RulePhase.Item, activeTeam: 0, turnNumber: 5, itemUses: 0 })
	expect(() => rules.startNextTurn(rules.initialState(), 1)).toThrow("must complete")
	expect(() => rules.nextActiveTeam(0, 0)).toThrow("at least one team")
})

test("RuleInterpreter supports modes that omit the optional item phase", () => {
	const rules = new RuleInterpreter({ ...standardMode, phases: [RulePhase.Aim, RulePhase.Charge, RulePhase.Push, RulePhase.Physics], maxItemsPerTurn: 0 })
	expect(rules.initialState().phase).toBe(RulePhase.Aim)
	expect(() => new RuleInterpreter({ ...standardMode, phases: [] })).toThrow("at least one rule phase")
	expect(() => new RuleInterpreter({ ...standardMode, phases: [RulePhase.Complete] })).toThrow("Complete cannot")
	expect(() => new RuleInterpreter({ ...standardMode, maxItemsPerTurn: 0 })).toThrow("positive item allowance")
	expect(() => new RuleInterpreter({ ...standardMode, phases: [RulePhase.Physics], maxItemsPerTurn: 1 })).toThrow("requires an item phase")
	expect(() => new RuleInterpreter({ ...standardMode, phases: [RulePhase.Aim, RulePhase.Item] })).toThrow("must start a turn")
	expect(() => new RuleInterpreter({ ...standardMode, phases: [RulePhase.Item, RulePhase.Item, RulePhase.Aim, RulePhase.Charge, RulePhase.Push, RulePhase.Physics] })).toThrow("may occur only once")
})

test("RuleInterpreter rejects skipped or reordered staged shot phases", () => {
	expect(() => new RuleInterpreter({ ...standardMode, phases: [RulePhase.Aim, RulePhase.Push, RulePhase.Physics], maxItemsPerTurn: 0 }))
		.toThrow("Staged shots must use aim, charge, push, then physics phases")
	expect(() => new RuleInterpreter({ ...standardMode, phases: [RulePhase.Charge, RulePhase.Aim, RulePhase.Push, RulePhase.Physics], maxItemsPerTurn: 0 }))
		.toThrow("Staged shots must use aim, charge, push, then physics phases")
})

import { RulePhase, validateItemEconomySettings, type GameModeSettings, type RuleState } from "./types.js";

/** Advances a game mode's declarative turn phases without touching simulation. */
export class RuleInterpreter {
	private readonly phases: RulePhase[];
	private readonly maxItemsPerTurn: number;

	public constructor(mode: GameModeSettings) {
		if (mode.phases.length === 0) throw new Error("A game mode requires at least one rule phase")
		if (mode.phases.includes(RulePhase.Complete)) throw new Error("Complete cannot be a configured rule phase")
		if (!Number.isSafeInteger(mode.maxItemsPerTurn) || mode.maxItemsPerTurn < 0) throw new Error("Item allowance must be a non-negative integer")
		const hasItemPhase = mode.phases.includes(RulePhase.Item)
		if (mode.phases.filter(phase => phase === RulePhase.Item).length > 1) throw new Error("Item phase may occur only once")
		if (hasItemPhase && mode.phases[0] !== RulePhase.Item) throw new Error("Item phase must start a turn")
		if (hasItemPhase && mode.maxItemsPerTurn === 0) throw new Error("Item phase requires a positive item allowance")
		if (!hasItemPhase && mode.maxItemsPerTurn !== 0) throw new Error("Item allowance requires an item phase")
		validateItemEconomySettings(mode.itemEconomy)
		const shotPhases = mode.phases.filter(phase => phase !== RulePhase.Item)
		const requiredShotPhases = [RulePhase.Aim, RulePhase.Charge, RulePhase.Push, RulePhase.Physics]
		const isLegacyPhysicsOnly = shotPhases.length === 1 && shotPhases[0] === RulePhase.Physics
		if (!isLegacyPhysicsOnly && (shotPhases.length !== requiredShotPhases.length || !requiredShotPhases.every((phase, index) => shotPhases[index] === phase))) {
			throw new Error("Staged shots must use aim, charge, push, then physics phases")
		}
		this.phases = [...mode.phases]
		this.maxItemsPerTurn = mode.maxItemsPerTurn
	}

	public initialState(activeTeam: number = 0, turnNumber: number = 0): RuleState {
		return { phase: this.phases[0], activeTeam, turnNumber, itemUses: 0 }
	}

	public advancePhase(state: RuleState): RuleState {
		if (state.phase === RulePhase.Complete) return state
		const phaseIndex = this.phases.indexOf(state.phase)
		if (phaseIndex < 0) throw new Error(`Phase ${state.phase} is not configured for this game mode`)
		return { ...state, phase: this.phases[phaseIndex + 1] ?? RulePhase.Complete }
	}

	/** Records one item use during the optional item phase. */
	public useItem(state: RuleState): RuleState {
		if (state.phase !== RulePhase.Item) throw new Error("Items may only be used during the item phase")
		if (state.itemUses >= this.maxItemsPerTurn) throw new Error("Item allowance has been exhausted")
		return { ...state, itemUses: state.itemUses + 1 }
	}

	public nextActiveTeam(activeTeam: number, teamCount: number): number {
		if (!Number.isInteger(activeTeam) || !Number.isInteger(teamCount) || teamCount < 1) {
			throw new Error("RuleInterpreter requires at least one team")
		}
		return (activeTeam + 1) % teamCount
	}

	public startNextTurn(state: RuleState, teamCount: number): RuleState {
		if (state.phase !== RulePhase.Complete) throw new Error("A turn must complete before the next turn starts")
		return {
			phase: this.phases[0],
			activeTeam: this.nextActiveTeam(state.activeTeam, teamCount),
			turnNumber: state.turnNumber + 1,
			itemUses: 0,
		}
	}
}

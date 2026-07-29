import { RulePhase, type GameModeSettings, type RuleState } from "./types.js";

/** Advances a game mode's declarative turn phases without touching simulation. */
export class RuleInterpreter {
	private readonly phases: RulePhase[];

	public constructor(mode: GameModeSettings) {
		if (mode.phases.length === 0) throw new Error("A game mode requires at least one rule phase")
		if (mode.phases.includes(RulePhase.Complete)) throw new Error("Complete cannot be a configured rule phase")
		this.phases = [...mode.phases]
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

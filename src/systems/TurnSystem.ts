import { GameState } from "../engine/types.js";

/** Deterministic turn-order rules shared by local and authoritative game flows. */
export class TurnSystem {
	public static nextActiveTeam(activeTeam: number, teamCount: number): number {
		if (!Number.isInteger(activeTeam) || !Number.isInteger(teamCount) || teamCount < 1) {
			throw new Error("TurnSystem requires at least one team")
		}
		return (activeTeam + 1) % teamCount
	}

	public static stateForTeam(activeTeam: number, controlledTeams: number[]): GameState {
		return controlledTeams.includes(activeTeam) ? GameState.Your_turn : GameState.Opponents_turn
	}
}

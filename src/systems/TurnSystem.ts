import { GameState } from "../engine/types.js";

/** Deterministic turn-order rules shared by local and authoritative game flows. */
export class TurnSystem {
	public static stateForTeam(activeTeam: number, controlledTeams: number[]): GameState {
		return controlledTeams.includes(activeTeam) ? GameState.Your_turn : GameState.Opponents_turn
	}
}

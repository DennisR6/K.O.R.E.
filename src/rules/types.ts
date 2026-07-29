/** Serializable phases that a game mode may include in its turn loop. */
export const enum RulePhase {
	Item = "item",
	Aim = "aim",
	Charge = "charge",
	Push = "push",
	Physics = "physics",
	Complete = "complete",
}

export const enum WinCondition {
	LastTeamStanding = "last-team-standing",
}

/** Data-defined gameplay rules, independent from the simulation handler. */
export interface GameModeSettings {
	id: string;
	phases: RulePhase[];
	maxItemsPerTurn: number;
	winCondition: WinCondition;
}

/** Serializable progress through a game mode's current turn. */
export interface RuleState {
	phase: RulePhase;
	activeTeam: number;
	turnNumber: number;
	itemUses: number;
}

export const enum MatchEndReason {
	LastTeamStanding = "last-team-standing",
	Draw = "draw",
}

/** Serializable terminal outcome evaluated by game rules. */
export interface MatchResult {
	winnerTeam: number | null;
	reason: MatchEndReason;
	turnNumber: number;
}

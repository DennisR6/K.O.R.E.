import { DEFAULT_ITEM_ECONOMY, RulePhase, WinCondition, type GameModeSettings } from "./types.js";

/** Current input combines aim, charge, and push before the physics turn starts. */
export const currentTurnMode: GameModeSettings = {
	id: "current-turn",
	phases: [RulePhase.Physics],
	maxItemsPerTurn: 0,
	winCondition: WinCondition.LastTeamStanding,
	itemEconomy: DEFAULT_ITEM_ECONOMY,
}

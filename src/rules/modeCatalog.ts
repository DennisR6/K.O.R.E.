import { createGameMode } from "../kore/sdk/match.js";
import { RulePhase, WinCondition, type GameModeSettings } from "./types.js";

export const GAME_MODE_CATALOG_SCHEMA_VERSION = 1 as const;

export interface GameModeCatalogEntry {
	schemaVersion: 1;
	id: string;
	name: string;
	description: string;
	selectable: boolean;
	mode: GameModeSettings;
}

/** Public, SDK-authored mode catalog shared by browser, local, server, and tests. */
export const GAME_MODE_CATALOG: readonly GameModeCatalogEntry[] = [
	{
		schemaVersion: 1,
		id: "quick-slip-v1",
		name: "Quick Slip",
		description: "A clean physics turn with no item phase.",
		selectable: true,
		mode: createGameMode({ id: "quick-slip-v1", phases: [RulePhase.Physics], winCondition: WinCondition.LastTeamStanding }),
	},
	{
		schemaVersion: 1,
		id: "power-rush-v1",
		name: "Power Rush",
		description: "Two deterministic item uses before every physics shot.",
		selectable: true,
		mode: createGameMode({ id: "power-rush-v1", phases: [RulePhase.Item, RulePhase.Physics], maxItemsPerTurn: 2, winCondition: WinCondition.LastTeamStanding }),
	},
];

export function getGameModeCatalogEntry(modeId: string): GameModeCatalogEntry {
	const entry = GAME_MODE_CATALOG.find(candidate => candidate.id === modeId);
	if (!entry || !entry.selectable) throw new Error(`Unknown or unavailable game mode: ${modeId}`);
	return entry;
}

export function getSelectableGameModes(): readonly GameModeCatalogEntry[] {
	return GAME_MODE_CATALOG.map(entry => structuredClone(entry));
}

export function applyGameMode(settings: { gameMode?: GameModeSettings }, modeId: string): void {
	settings.gameMode = structuredClone(getGameModeCatalogEntry(modeId).mode);
}

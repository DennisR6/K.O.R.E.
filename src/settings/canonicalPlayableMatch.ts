import { GameHandler, GameHandlerBuilder } from "../engine/Handler.js";
import { RulePhase, WinCondition } from "../rules/types.js";
import { WinningSystem } from "../systems/WinningSystem.js";
import { createDefaultGameSettings, validateGameSettings, type GameSettings } from "./settings.js";

/** The supported two-human local reference match for the playable vertical slice. */
export const CANONICAL_PLAYABLE_MATCH = {
	id: "local-ice-duel-v1",
	mapId: "ice-map-v1",
	teamCount: 2,
	figuresPerTeam: 1,
	humanTeams: [0, 1],
	camera: { mode: "fit-world", worldSize: { x: 800, y: 450 } },
	items: "disabled",
	result: "last-team-standing",
} as const;

/** Returns a detached, validated and deterministic reference-match snapshot. */
export function createCanonicalPlayableMatchSettings(): GameSettings {
	const settings = createDefaultGameSettings(2, 1);
	settings.id = "00000000-0000-4000-8000-000000000014";
	settings.myTeam = [0, 1];
	settings.allTeams = ["Local team 0", "Local team 1"];
	settings.players[0]!.id = "00000000-0000-4000-8000-000000000140";
	settings.players[1]!.id = "00000000-0000-4000-8000-000000000141";
	settings.items = [];
	settings.gameMode = {
		id: CANONICAL_PLAYABLE_MATCH.id,
		phases: [RulePhase.Physics],
		maxItemsPerTurn: 0,
		winCondition: WinCondition.LastTeamStanding,
		itemEconomy: { fixedLoadouts: [], mapPickups: [] },
	};
	validateGameSettings(settings);
	return JSON.parse(JSON.stringify(settings)) as GameSettings;
}

/** Builds the canonical local handler with its authoritative winning evaluator. */
export function createCanonicalPlayableMatchHandler(): GameHandler {
	return new GameHandlerBuilder()
		.defaultSystems()
		.addSystem(new WinningSystem(CANONICAL_PLAYABLE_MATCH.teamCount))
		.fromSettings(createCanonicalPlayableMatchSettings())
		.build();
}

import { assertJsonValue, type SystemSettings } from "../../engine/contracts/systemSettings.js";
import { EngineSystemRegistry, type EngineFrameworkSettings } from "../../engine/sdk/index.js";
import { createRuntimeHandler } from "../../engine/runtimeFactory.js";
import { RuleInterpreter } from "../../rules/RuleInterpreter.js";
import { RulePhase, validateItemEconomySettings, WinCondition, type GameModeSettings, type ItemEconomySettings } from "../../rules/types.js";
import { validateGameSettings, type GameSettings } from "../../settings/settings.js";
import { validateAiSettings, type AiSettings } from "../../ai/types.js";
import type { ItemDocument } from "../../item/types.js";
import type { PlayerSettings } from "../../entity/types.js";
import type { GameHandler } from "../../engine/Handler.js";

/** Versioned, JSON-safe match definition authored by the KORE SDK. */
export const KORE_MATCH_DEFINITION_VERSION = 1 as const;

/** Rules input for `kore.createGameMode()`; validated and detached on output. */
export interface KoreGameModeInput {
	id: string;
	phases: RulePhase[];
	maxItemsPerTurn?: number;
	winCondition?: WinCondition;
	itemEconomy?: ItemEconomySettings;
	schemaVersion?: 1;
}

/** Mode-specific header applied to a match definition. */
export interface KoreMatchHeader {
	myTeam?: number[];
	allTeams?: string[];
	ai?: AiSettings;
}

/** Input for `kore.createMatchDefinition()`. */
export interface KoreMatchOptions {
	/** Stable catalog map identity; optional but recommended for replay origin tracking. */
	mapId?: string;
	/** Canonical map settings; the game mode and header are applied on top. */
	settings: GameSettings;
	/** Rule phases, item economy, and win condition for the match. */
	gameMode: GameModeSettings;
	/** Deterministic recorder/battle seed (safe integer). */
	seed: number;
	/** Mode-specific team names, controlled teams, and AI metadata. */
	header?: KoreMatchHeader;
}

/** The frozen, JSON-safe authoring result of a canonical KORE match. */
export interface KoreMatchDefinition {
	schemaVersion: 1;
	/** Match id; identical to `settings.id`. */
	id: string;
	mapId?: string;
	seed: number;
	settings: GameSettings;
	/** Data-only engine system snapshots, sorted by stable ID. */
	systems: SystemSettings[];
	/** Explicit tick registration order. */
	systemOrder: string[];
}

/**
 * Authors a validated, detached `GameModeSettings`. The rule semantics are
 * enforced by the same boundary the runtime uses (`RuleInterpreter`), so a
 * mode that passes authoring is guaranteed to be interpretable.
 */
export function createGameMode(input: KoreGameModeInput): GameModeSettings {
	if (!input || typeof input.id !== "string" || input.id.trim() === "") throw new Error("A game mode requires a non-empty id");
	const mode: GameModeSettings = {
		schemaVersion: input.schemaVersion ?? 1,
		id: input.id,
		phases: [...input.phases],
		maxItemsPerTurn: input.maxItemsPerTurn ?? 0,
		winCondition: input.winCondition ?? WinCondition.LastTeamStanding,
		itemEconomy: input.itemEconomy !== undefined
			? structuredClone(input.itemEconomy)
			: { fixedLoadouts: [], mapPickups: [] },
	};
	validateGameMode(mode);
	return structuredClone(mode);
}

function validateGameMode(mode: GameModeSettings): void {
	if (mode.schemaVersion !== undefined && mode.schemaVersion !== 1) throw new Error("Unsupported game mode schema version");
	// The interpreter constructor is the data-only rule boundary: it rejects
	// empty phases, misplaced item phases, inconsistent allowances, and
	// malformed item economies without touching any simulation state.
	new RuleInterpreter(mode);
	validateItemEconomySettings(mode.itemEconomy);
}

/**
 * Canonical KORE engine system profile for one match: playback, physics,
 * boundary, game-state manager, and the last-team-standing winning evaluator.
 * The states are the exact initial serialized states of the runtime systems
 * (pinned by tests), and the topological order matches the legacy pipeline
 * tick order.
 */
export function createMatchSystemProfile(teamCount: number): EngineFrameworkSettings {
	if (!Number.isSafeInteger(teamCount) || teamCount < 1) throw new Error("A match system profile requires at least one team");
	const registry = new EngineSystemRegistry()
		.register({ id: "core.playback", provides: ["playback"], state: { remainingFrames: 0, syncPending: false, completionPending: false, finalState: null } })
		.register({ id: "core.physics", provides: ["physics"], after: ["core.playback"], state: { fps: 1, contacts: [] } })
		.register({ id: "core.boundary", requires: ["physics"], after: ["core.physics"] })
		.register({ id: "core.game-state-manager", after: ["core.boundary"] })
		.register({ id: "core.winning", after: ["core.game-state-manager"], state: { teamCount, pending: null } });
	const framework = registry.select(["core.playback", "core.physics", "core.boundary", "core.game-state-manager", "core.winning"]);
	assertJsonValue(framework.systems);
	return framework;
}

/** Applies the canonical match header (id, teams, ids, items, mode) to base settings. */
export function authorMatchSettings(settings: GameSettings, options: {
	matchId: string;
	myTeam: number[];
	allTeams?: string[];
	playerIds?: string[];
	items?: ItemDocument[];
	gameMode: GameModeSettings;
}): GameSettings {
	if (typeof options.matchId !== "string" || options.matchId.trim() === "") throw new Error("A match requires a non-empty id");
	if (!Array.isArray(options.myTeam) || options.myTeam.some(team => !Number.isSafeInteger(team) || team < 0)) throw new Error("A match requires non-negative integer teams");
	validateGameSettings(settings);
	validateGameMode(options.gameMode);
	const result = structuredClone(settings);
	result.id = options.matchId as GameSettings["id"];
	result.myTeam = [...options.myTeam];
	if (options.allTeams !== undefined) result.allTeams = [...options.allTeams];
	if (options.playerIds !== undefined) {
		if (options.playerIds.length !== result.players.length) throw new Error("Player IDs must match the player count");
		result.players = result.players.map((player, index) => ({ ...player, id: options.playerIds![index] as PlayerSettings["id"] }));
	}
	if (options.items !== undefined) result.items = options.items.map(item => structuredClone(item));
	result.gameMode = structuredClone(options.gameMode);
	validateGameSettings(result);
	return structuredClone(result);
}

/** Builds a detached, validated, JSON-safe canonical match definition. */
export function createMatchDefinition(options: KoreMatchOptions): KoreMatchDefinition {
	validateGameSettings(options.settings);
	const gameMode = createGameMode(options.gameMode);
	if (typeof options.seed !== "number" || !Number.isSafeInteger(options.seed)) throw new Error("A match definition requires a safe integer seed");
	const settings = structuredClone(options.settings);
	settings.gameMode = structuredClone(gameMode);
	if (options.header?.myTeam !== undefined) {
		if (!Array.isArray(options.header.myTeam) || options.header.myTeam.some(team => !Number.isSafeInteger(team) || team < 0)) throw new Error("Match teams must be non-negative integers");
		settings.myTeam = [...options.header.myTeam];
	}
	if (options.header?.allTeams !== undefined) {
		if (!Array.isArray(options.header.allTeams) || options.header.allTeams.some(name => typeof name !== "string")) throw new Error("Match team names must be strings");
		settings.allTeams = [...options.header.allTeams];
	}
	if (options.header?.ai !== undefined) {
		validateAiSettings(options.header.ai);
		settings.ai = structuredClone(options.header.ai);
	}
	validateGameSettings(settings);
	const teamCount = settings.allTeamSize > 0 ? settings.allTeamSize : (settings.playerCount > 0 ? settings.playerCount : 2);
	const framework = createMatchSystemProfile(teamCount);
	const definition: KoreMatchDefinition = {
		schemaVersion: KORE_MATCH_DEFINITION_VERSION,
		id: settings.id,
		...(options.mapId !== undefined ? { mapId: options.mapId } : {}),
		seed: options.seed,
		settings: structuredClone(settings),
		systems: structuredClone(framework.systems),
		systemOrder: [...framework.systemOrder],
	};
	validateKoreMatchDefinition(definition);
	return structuredClone(definition);
}

/** Rejects malformed, non-JSON, or semantically inconsistent match definitions. */
export function validateKoreMatchDefinition(value: unknown): asserts value is KoreMatchDefinition {
	if (!isRecord(value)) throw new Error("Malformed match definition");
	if (value.schemaVersion !== KORE_MATCH_DEFINITION_VERSION) throw new Error("Unsupported match definition version");
	if (typeof value.id !== "string" || value.id.trim() === "") throw new Error("A match definition requires a non-empty id");
	if (typeof value.seed !== "number" || !Number.isSafeInteger(value.seed)) throw new Error("A match definition requires a safe integer seed");
	validateGameSettings(value.settings);
	if (value.settings.gameMode === undefined) throw new Error("A match definition requires a game mode");
	validateGameMode(value.settings.gameMode);
	if (!Array.isArray(value.systems) || !Array.isArray(value.systemOrder)) throw new Error("A match definition requires systems and systemOrder arrays");
	const ids = new Set<string>();
	for (const system of value.systems) {
		if (!isRecord(system) || typeof system.systemId !== "string" || !/^[a-z0-9.-]{1,80}$/.test(system.systemId) || system.schemaVersion !== 1 || !isRecord(system.state)) {
			throw new Error("Malformed system settings in match definition");
		}
		if (ids.has(system.systemId)) throw new Error("Duplicate system in match definition");
		ids.add(system.systemId);
		assertJsonValue(system.state);
	}
	if (value.systemOrder.length !== ids.size || new Set(value.systemOrder).size !== ids.size || value.systemOrder.some(id => !ids.has(id))) {
		throw new Error("Invalid match definition system order");
	}
}

/** Constructs the runtime handler for a validated match definition. */
export function createRuntimeMatch(definition: KoreMatchDefinition): GameHandler {
	validateKoreMatchDefinition(definition);
	return createRuntimeHandler(definition.settings, definition.systems, definition.systemOrder);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

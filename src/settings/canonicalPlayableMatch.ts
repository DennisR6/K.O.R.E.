import { GameHandler, GameHandlerBuilder } from "../engine/Handler.js";
import { RulePhase, WinCondition } from "../rules/types.js";
import { WinningSystem } from "../systems/WinningSystem.js";
import { createDefaultGameSettings, validateGameSettings, type GameSettings } from "./settings.js";
import { SHAPE } from "../physics/physics.js";
import { FitWorldCamera } from "../ui/FitWorldCamera.js";

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
	settings.mapBoundarys = settings.mapBoundarys.map(boundary => ({ ...boundary, role: "solid", color: boundary.color ?? "#315b7d" }));
	settings.mapBoundarys.unshift({ type: SHAPE.RECTANGLE, x: 0, y: 0, w: 800, h: 450, effects: [], role: "containment" });
	settings.gameMode = {
		id: CANONICAL_PLAYABLE_MATCH.id,
		phases: [RulePhase.Physics],
		maxItemsPerTurn: 0,
		winCondition: WinCondition.LastTeamStanding,
		itemEconomy: { fixedLoadouts: [], mapPickups: [] },
	};
	validateGameSettings(settings);
	validateReferenceMapSettings(settings);
	validateReferenceSpawnAndCamera(settings);
	return JSON.parse(JSON.stringify(settings)) as GameSettings;
}

/** Validates the semantic safety contract for the shipped Ice Duel arena. */
export function validateReferenceMapSettings(settings: GameSettings): void {
	const { x: width, y: height } = settings.screenResolution;
	const containment = settings.mapBoundarys.filter(structure => structure.role === "containment");
	if (containment.length !== 1 || settings.mapBoundarys.some(structure => structure.role === "both")) throw new Error("reference map requires exactly one containment boundary");
	for (const structure of settings.mapBoundarys) {
		if (structure.type === SHAPE.RECTANGLE && (!(structure.w > 0) || !(structure.h > 0) || structure.x < 0 || structure.y < 0 || structure.x + structure.w > width || structure.y + structure.h > height)) throw new Error("reference map has invalid rectangle");
		if (structure.type === SHAPE.CIRCLE && (!(structure.r > 0) || structure.x - structure.r < 0 || structure.y - structure.r < 0 || structure.x + structure.r > width || structure.y + structure.r > height)) throw new Error("reference map has invalid circle");
		if (structure.role === "solid" && !structure.color) throw new Error("reference map solid is not visible");
	}
	for (const player of settings.players) {
		if (player.position.x - player.size < 0 || player.position.y - player.size < 0 || player.position.x + player.size > width || player.position.y + player.size > height) throw new Error("reference map spawn is outside containment");
		for (const other of settings.players) if (other !== player && Math.hypot(player.position.x - other.position.x, player.position.y - other.position.y) < player.size + other.size) throw new Error("reference map spawns overlap");
	}
}

/** Validates that the shipped match opens with every live figure in the fixed arena view. */
export function validateReferenceSpawnAndCamera(settings: GameSettings): void {
	validateReferenceMapSettings(settings);
	const camera = new FitWorldCamera(CANONICAL_PLAYABLE_MATCH.camera.worldSize);
	const world = camera.getWorldBounds();
	if (settings.worldSize.x !== world.w || settings.worldSize.y !== world.h) throw new Error("reference camera world does not match the arena");
	const containment = settings.mapBoundarys.find(structure => structure.role === "containment");
	if (!containment || containment.type !== SHAPE.RECTANGLE) throw new Error("reference camera requires rectangular containment");
	for (const player of settings.players) {
		if (player.isDead || player.hp <= 0 || player.team.length !== 1 || (player.team[0] !== 0 && player.team[0] !== 1)) throw new Error("reference player is not selectable");
		if (!camera.containsCircle(player.position, player.size)) throw new Error("reference player is outside the initial camera");
		if (player.position.x - player.size < containment.x || player.position.y - player.size < containment.y || player.position.x + player.size > containment.x + containment.w || player.position.y + player.size > containment.y + containment.h) throw new Error("reference player is outside containment");
	}
}

/** Builds the canonical local handler with its authoritative winning evaluator. */
export function createCanonicalPlayableMatchHandler(): GameHandler {
	return new GameHandlerBuilder()
		.defaultSystems()
		.addSystem(new WinningSystem(CANONICAL_PLAYABLE_MATCH.teamCount))
		.fromSettings(createCanonicalPlayableMatchSettings())
		.build();
}

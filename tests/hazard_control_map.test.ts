import { describe, expect, test } from "bun:test";
import { buildMapSettings, getMapCatalogEntry } from "../src/content/mapCatalog.js";
import { GameEmitter } from "../src/emitter/EngineEmitter.js";
import { GameHandler, GameHandlerBuilder } from "../src/engine/Handler.js";
import { GameState } from "../src/engine/types.js";
import { EffectTrigger } from "../src/effects/types.js";
import { RulePhase } from "../src/rules/types.js";
import { createCanonicalPlayableMatchSettings } from "../src/settings/canonicalPlayableMatch.js";
import { validateGameSettings } from "../src/settings/settings.js";
import { WinningSystem } from "../src/systems/WinningSystem.js";
import { FitWorldCamera } from "../src/ui/FitWorldCamera.js";
import { MAP_QUALIFICATION_SEEDS, inspectMapSettings, mirrorSettings, qualifyMap } from "./support/mapQualification.js";

/**
 * Section 17.6 - hazard control map.
 *
 * Hazard Control is a mirrored arena whose primary terminal pressure comes
 * from declarative hazards: two mirrored kill zones guard the center corridor
 * between the spawns. Every straight crossing is self-eliminating (the
 * shooter's own puck dies in the near zone), the opponent is protected behind
 * its own zone, and elimination requires either driving an opponent into a
 * hazard or its own misplay. The arena walls remain the containment kill
 * boundary.
 *
 * Required characteristics: hazards visible and spatially understandable
 * (red collision circles, no solids on the direct line), no player begins
 * within an active lethal region, ordinary actions can move opponents toward
 * and away from danger, hazard placement does not make one physical side
 * automatically terminal (mirrored zones), and a non-lethal recovery route
 * remains available (the north and south flank lanes).
 * Required verification: deterministic hazard activation, hazard-seeking
 * fixture, hazard-avoidance fixture, no instant-death baseline, explicit
 * winner path, side-swapped run, snapshot continuity, and replay equality.
 * No delayed hazards are configured, so the delayed-hazard snapshot
 * requirement is not exercised; snapshot continuity and replay equality are
 * verified through the qualification harness.
 */

const MAP_ID = "hazard-control";
const ZONE_RADIUS = 28;
const PLAYER_RADIUS = 12;

function build(): ReturnType<typeof createCanonicalPlayableMatchSettings> {
	return buildMapSettings(MAP_ID, createCanonicalPlayableMatchSettings());
}

function quiet<T>(callback: () => T): T {
	const log = console.log;
	console.log = () => undefined;
	try { return callback(); } finally { console.log = log; }
}

function settle(handler: GameHandler, maxFrames = 900): number {
	let frames = 0;
	quiet(() => { while (handler.getState() === GameState.Playing && frames < maxFrames) { handler.tick(); frames++; } });
	return frames;
}

function toPhysics(handler: GameHandler, settings: ReturnType<typeof createCanonicalPlayableMatchSettings>): GameHandler {
	const emitter = new GameEmitter(handler, settings.gameMode, 2, 1503);
	while (handler.getRuleState().phase !== RulePhase.Physics && handler.getRuleState().phase !== RulePhase.Complete) emitter.skipPhase();
	return handler;
}

interface ShotOutcome {
	frames: number;
	players: { team: number[]; position: { x: number; y: number }; isDead: boolean }[];
}

/** Runs one scripted first-turn action for the given team and settles the outcome. */
function runShot(settings: ReturnType<typeof createCanonicalPlayableMatchSettings>, team: number, angle: number, power: number, maxFrames = 900): ShotOutcome {
	const handler = toPhysics(new GameHandlerBuilder().defaultSystems().addSystem(new WinningSystem(2)).fromSettings(JSON.parse(JSON.stringify(settings))).build(), settings);
	const emitter = new GameEmitter(handler, settings.gameMode, 2, 1503);
	const actor = handler.toSettings().players.find(player => player.team[0] === team)!;
	emitter.sendShot(actor.id, angle, power);
	const frames = settle(handler, maxFrames);
	return { frames, players: handler.toSettings().players.map(player => ({ team: player.team, position: { ...player.position }, isDead: player.isDead })) };
}

interface ScriptedAction { team: number; angle: number; power: number }

/** Plays a fully scripted match: each turn the active team executes its scripted action. */
function playScripted(settings: ReturnType<typeof createCanonicalPlayableMatchSettings>, actions: ScriptedAction[]): { winnerTeam: number | null; players: { team: number[]; position: { x: number; y: number }; isDead: boolean }[]; turns: number } {
	const handler = toPhysics(new GameHandlerBuilder().defaultSystems().addSystem(new WinningSystem(2)).fromSettings(JSON.parse(JSON.stringify(settings))).build(), settings);
	const emitter = new GameEmitter(handler, settings.gameMode, 2, 1503);
	for (const action of actions) {
		if (handler.getState() === GameState.Game_over) break;
		if (handler.getRuleState().phase === RulePhase.Item) emitter.skipPhase();
		const actor = handler.toSettings().players.find(player => player.team[0] === action.team && !player.isDead);
		if (!actor) throw new Error(`No live actor for team ${action.team} on the scripted turn`);
		emitter.sendShot(actor.id, action.angle, action.power);
		settle(handler, 900);
	}
	const snapshot = handler.toSettings();
	return {
		winnerTeam: handler.getMatchResult()?.status === "draw" ? null : (handler.getMatchResult()?.winnerTeam ?? null),
		players: snapshot.players.map(player => ({ team: player.team, position: { ...player.position }, isDead: player.isDead })),
		turns: handler.getTurnNumber(),
	};
}

function hazardZones(settings: ReturnType<typeof createCanonicalPlayableMatchSettings>): { x: number; y: number; r: number }[] {
	return settings.mapBoundarys
		.filter(boundary => boundary.effects.some(effect => effect.trigger === EffectTrigger.Collision))
		.map(boundary => ({ x: boundary.x, y: boundary.y, r: boundary.r ?? 0 }));
}

describe("Section 17.6 hazard control map", () => {
	test("schema validation passes through the shared loader", () => {
		const settings = build();
		expect(() => validateGameSettings(settings)).not.toThrow();
		const entry = getMapCatalogEntry(MAP_ID);
		expect(entry.schemaVersion).toBe(1);
		expect(entry.plannedSource).toBeUndefined();
		expect(settings.worldSize).toEqual({ x: 800, y: 450 });
		expect(settings.drift).toBe(0);
		expect(settings.players.length).toBe(2);
	});

	test("settings round trip is identical", () => {
		const settings = build();
		const handler = new GameHandlerBuilder().defaultSystems().addSystem(new WinningSystem(2)).fromSettings(JSON.parse(JSON.stringify(settings))).build();
		const snapshot = handler.toSettings();
		const restored = new GameHandlerBuilder().defaultSystems().addSystem(new WinningSystem(2)).fromSettings(snapshot).build();
		expect(JSON.stringify(restored.toSettings())).toBe(JSON.stringify(snapshot));
	});

	test("hazards are visible, mirrored, and spatially understandable", () => {
		const settings = build();
		const zones = hazardZones(settings);
		expect(zones.length).toBe(2);
		// The two mirrored kill zones sit directly on the line between the spawns.
		const west = zones.find(zone => zone.x < 400);
		const east = zones.find(zone => zone.x > 400);
		expect(west).toMatchObject({ x: 300, y: 225, r: ZONE_RADIUS });
		expect(east).toMatchObject({ x: 500, y: 225, r: ZONE_RADIUS });
		// Every hazard renders as a red collision-effect circle (the loader
		// assigns the kill-zone color) and no solid stands on the direct line.
		const solids = settings.mapBoundarys.filter(boundary => boundary.effects.length === 0 && !("role" in boundary && boundary.role === "containment"));
		expect(solids.length).toBe(0);
	});

	test("no player begins within an active lethal region", () => {
		const settings = build();
		const zones = hazardZones(settings);
		for (const player of settings.players) {
			for (const zone of zones) {
				const distance = Math.hypot(player.position.x - zone.x, player.position.y - zone.y);
				expect(distance - zone.r).toBeGreaterThanOrEqual(60);
			}
		}
	});

	test("initial-overlap scan is clean", () => {
		const inspection = inspectMapSettings(build());
		expect(inspection.schemaValid).toBe(true);
		expect(inspection.finiteSpawn).toBe(true);
		expect(inspection.uniqueSpawn).toBe(true);
		expect(inspection.noSolidOverlap).toBe(true);
		expect(inspection.noLethalOverlap).toBe(true);
		expect(inspection.containmentValid).toBe(true);
		expect(inspection.spawnFindings).toEqual([]);
	});

	test("no instant-death baseline: the opponent is protected on turn one", () => {
		const settings = build();
		let safeOpenings = 0;
		for (let angle = 0; angle < 360; angle += 10) {
			for (let power = 1; power <= 10; power++) {
				const outcome = quiet(() => runShot(settings, 0, angle, power));
				expect(outcome.players[1]!.isDead).toBe(false);
				if (!outcome.players[0]!.isDead) safeOpenings++;
			}
		}
		expect(safeOpenings).toBeGreaterThanOrEqual(2);
	});

	test("deterministic hazard activation: a straight shot dies in the near zone at a fixed position", () => {
		const settings = build();
		const first = quiet(() => runShot(settings, 0, 0, 6));
		const second = quiet(() => runShot(settings, 0, 0, 6));
		expect(JSON.stringify(first.players)).toBe(JSON.stringify(second.players));
		expect(first.players[0]!.isDead).toBe(true);
		// The shooter died inside the west kill zone (distance < r + radius).
		const west = hazardZones(settings).find(zone => zone.x < 400)!;
		const deathDistance = Math.hypot(first.players[0]!.position.x - west.x, first.players[0]!.position.y - west.y);
		expect(deathDistance).toBeLessThan(ZONE_RADIUS + PLAYER_RADIUS);
		expect(first.players[1]!.isDead).toBe(false);
	});

	test("hazard-avoidance fixture: the flank lanes carry a puck past both hazards alive", () => {
		const settings = build();
		const zones = hazardZones(settings);
		const north = quiet(() => runShot(settings, 0, 335, 4));
		expect(north.players[0]!.isDead).toBe(false);
		// Crossed above the west zone and came to rest beyond the east zone.
		expect(north.players[0]!.position.x).toBeGreaterThan(400);
		expect(north.players[0]!.position.y).toBeLessThan(160);
		const south = quiet(() => runShot(settings, 0, 20, 4));
		expect(south.players[0]!.isDead).toBe(false);
		expect(south.players[0]!.position.x).toBeGreaterThan(400);
		expect(south.players[0]!.position.y).toBeGreaterThan(290);
		for (const outcome of [north, south]) {
			for (const zone of zones) {
				const distance = Math.hypot(outcome.players[0]!.position.x - zone.x, outcome.players[0]!.position.y - zone.y);
				expect(distance).toBeGreaterThanOrEqual(ZONE_RADIUS + PLAYER_RADIUS);
			}
		}
	});

	test("hazard-seeking fixture: a legal shot drives the defender into its hazard from broad margins", () => {
		// The shooter sits east of the defender; a westbound shot drives the
		// defender into the east kill zone. The same drive works across powers
		// 4-8 and +/-5 degrees: the fixture does not depend on pixel-exact aim.
		const settings = build();
		const east = hazardZones(settings).find(zone => zone.x > 400)!;
		for (const [angle, power] of [[175, 6], [180, 4], [180, 6], [180, 8], [185, 6]]) {
			const setup = JSON.parse(JSON.stringify(settings)) as ReturnType<typeof createCanonicalPlayableMatchSettings>;
			setup.players[0]!.position = { x: 700, y: 225 };
			setup.players[1]!.position = { x: 650, y: 225 };
			const first = quiet(() => runShot(setup, 0, angle, power));
			const second = quiet(() => runShot(setup, 0, angle, power));
			expect(JSON.stringify(first.players)).toBe(JSON.stringify(second.players));
			expect(first.players[1]!.isDead).toBe(true);
			const deathDistance = Math.hypot(first.players[1]!.position.x - east.x, first.players[1]!.position.y - east.y);
			expect(deathDistance).toBeLessThan(ZONE_RADIUS + PLAYER_RADIUS);
			expect(first.players[0]!.isDead).toBe(false);
		}
	});

	test("ordinary actions move opponents toward and away from danger", () => {
		const settings = build();
		// Toward danger: the drive moves the defender from 110 px outside the
		// hazard to inside its lethal band.
		const setup = JSON.parse(JSON.stringify(settings)) as ReturnType<typeof createCanonicalPlayableMatchSettings>;
		setup.players[0]!.position = { x: 700, y: 225 };
		setup.players[1]!.position = { x: 650, y: 225 };
		const toward = quiet(() => runShot(setup, 0, 180, 6));
		expect(toward.players[1]!.position.x).toBeLessThan(540);
		// Away from danger: the flank shot moves the shooter out of the
		// corridor band (y 197..253) into the safe top lane.
		const away = quiet(() => runShot(settings, 0, 335, 4));
		expect(away.players[0]!.position.y).toBeLessThan(185);
	});

	test("explicit winner path: a scripted match ends in the hazard, deterministically", () => {
		const settings = build();
		const first = quiet(() => playScripted(settings, [
			{ team: 0, angle: 0, power: 1 },
			{ team: 1, angle: 180, power: 6 },
		]));
		const second = quiet(() => playScripted(settings, [
			{ team: 0, angle: 0, power: 1 },
			{ team: 1, angle: 180, power: 6 },
		]));
		expect(JSON.stringify(first.players)).toBe(JSON.stringify(second.players));
		expect(first.winnerTeam).toBe(0);
		// The loser died inside the east kill zone, not on a wall.
		const east = hazardZones(settings).find(zone => zone.x > 400)!;
		const loser = first.players.find(player => player.isDead)!;
		const deathDistance = Math.hypot(loser.position.x - east.x, loser.position.y - east.y);
		expect(deathDistance).toBeLessThan(ZONE_RADIUS + PLAYER_RADIUS);
		expect(loser.position.x).toBeGreaterThan(100);
		expect(loser.position.y).toBeGreaterThan(100);
	});

	test("deterministic mirrored turns from both sides", () => {
		const settings = build();
		const team0 = quiet(() => runShot(settings, 0, 0, 6));
		const team1 = quiet(() => runShot(settings, 1, 180, 6));
		expect(team0.players[0]!.isDead).toBe(true);
		expect(team1.players[1]!.isDead).toBe(true);
		expect(team1.players[1]!.position.x).toBeCloseTo(settings.worldSize.x - team0.players[0]!.position.x, 6);
		expect(team1.players[1]!.position.y).toBeCloseTo(team0.players[0]!.position.y, 6);
	});

	test("side-swapped equality and full qualification matrix with snapshot continuity and replay equality", () => {
		const mirrored = mirrorSettings(build());
		expect(() => validateGameSettings(mirrored)).not.toThrow();
		expect(mirrored.players[0]!.position.x).toBeCloseTo(mirrored.worldSize.x - 150, 6);
		expect(mirrored.players[0]!.team).toEqual([1]);
		for (const seed of MAP_QUALIFICATION_SEEDS) {
			const original = qualifyMap(MAP_ID, { seed });
			const swapped = qualifyMap(MAP_ID, { seed, variant: "side-swapped" });
			for (const result of [original, swapped]) {
				expect(result.spawnFindings).toEqual([]);
				expect(result.invariantFindings).toEqual([]);
				expect(result.checks.schemaValid).toBe(true);
				expect(result.checks.finiteSpawn).toBe(true);
				expect(result.checks.uniqueSpawn).toBe(true);
				expect(result.checks.noSolidOverlap).toBe(true);
				expect(result.checks.noLethalOverlap).toBe(true);
				expect(result.checks.containmentValid).toBe(true);
				expect(result.checks.legalFirstAction).toBe(true);
				expect(result.checks.boundedPlayback).toBe(true);
				expect(result.checks.deterministic).toBe(true);
				expect(result.checks.snapshotRestore).toBe(true);
				expect(result.checks.replayEquality).toBe(true);
				expect(result.checks.noPostCompletionMutation).toBe(true);
				expect(result.safetyLimitStatus).toBe("none");
				expect(["winner", "draw"]).toContain(result.result);
			}
			expect(swapped.result).toBe(original.result);
		}
	});

	test("browser-visible initial state", () => {
		const settings = build();
		const camera = new FitWorldCamera({ x: settings.worldSize.x, y: settings.worldSize.y });
		camera.resize(800, 450);
		expect(camera.getScaleFactor()).toBeGreaterThan(0);
		expect(camera.getWorldBounds()).toEqual({ x: 0, y: 0, w: 800, h: 450 });
		for (const player of settings.players) {
			expect(player.isDead).toBe(false);
			expect(camera.containsCircle(player.position, player.size)).toBe(true);
		}
	});

	test("catalog entry matches the shipped map and the report ledger", () => {
		const entry = getMapCatalogEntry(MAP_ID);
		expect(entry.source).toBe("src/settings/hazardControlMap.ts");
		expect(entry.browserAvailable).toBe(false);
		expect(entry.status).toBe("technically-qualified"); // 17.7 matrix evidence recorded
		expect(entry.spawnRegionCount).toBe(2);
		expect(entry.structureCount).toBe(1);
		expect(entry.hazardCount).toBe(2);
		expect(entry.hazardTypes).toEqual(["kill-zone"]);
		expect(entry.teamLayouts).toEqual([2]);
		expect(entry.figuresPerTeam).toEqual([1]);
		expect(entry.friction).toBe("tiles");
		expect(entry.drift).toBe(0);
		expect(entry.knownLimitations.some(limitation => limitation.includes("kill zone"))).toBe(true);
		expect(entry.knownLimitations.some(limitation => limitation.includes("random walk"))).toBe(true);
	});
});

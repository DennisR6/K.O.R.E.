import { describe, expect, test } from "bun:test";
import { buildMapSettings, getMapCatalogEntry } from "../src/content/mapCatalog.js";
import { GameEmitter } from "../src/emitter/EngineEmitter.js";
import { GameHandler, GameHandlerBuilder } from "../src/engine/Handler.js";
import { GameState } from "../src/engine/types.js";
import { SHAPE } from "../src/physics/physics.js";
import { RulePhase } from "../src/rules/types.js";
import { createCanonicalPlayableMatchSettings } from "../src/settings/canonicalPlayableMatch.js";
import { validateGameSettings } from "../src/settings/settings.js";
import { WinningSystem } from "../src/systems/WinningSystem.js";
import { FitWorldCamera } from "../src/ui/FitWorldCamera.js";
import { MAP_QUALIFICATION_SEEDS, inspectMapSettings, mirrorSettings, qualifyMap } from "./support/mapQualification.js";

/**
 * Section 17.5 - structure control map.
 *
 * Structure Control is a mirrored arena whose play is shaped by solid
 * columns, a central blocker, rebounds, and protected pockets. The arena
 * walls double as the containment kill boundary; the columns and blocker
 * create three navigable lanes (central corridor gaps, top lane, bottom
 * lane) and deterministic corner interactions, and no single structure
 * partitions the arena.
 *
 * Required characteristics: at least two distinct navigable lanes, no spawn
 * embedded in or trapped by solid geometry, no single structure permanently
 * partitioning opponents, deterministic line and corner interaction,
 * meaningful positional change from ordinary legal actions, and broad action
 * margins for real pointer input.
 * Required verification: initial-overlap scan, representative collision
 * fixtures, deterministic mirrored turns, bounded multi-contact resolution,
 * replay/restore equality, and no softlock under the map qualification
 * harness.
 */

const MAP_ID = "structure-control";
const PLAYER_RADIUS = 12;

function build(): ReturnType<typeof createCanonicalPlayableMatchSettings> {
	const template = createCanonicalPlayableMatchSettings();
	template.players = [template.players[0]!, template.players[6]!];
	return buildMapSettings(MAP_ID, template);
}

function quiet<T>(callback: () => T): T {
	const log = console.log;
	console.log = () => undefined;
	try { return callback(); } finally { console.log = log; }
}

interface ShotOutcome {
	frames: number;
	players: { position: { x: number; y: number }, isDead: boolean }[];
}

/** Runs one scripted first-turn action and returns the settled outcome. */
function runShot(settings: ReturnType<typeof createCanonicalPlayableMatchSettings>, angle: number, power: number, maxFrames = 900): ShotOutcome {
	const handler = new GameHandlerBuilder().defaultSystems().addSystem(new WinningSystem(2)).fromSettings(JSON.parse(JSON.stringify(settings))).build();
	const emitter = new GameEmitter(handler, settings.gameMode, 2, 1503);
	while (handler.getRuleState().phase !== RulePhase.Physics && handler.getRuleState().phase !== RulePhase.Complete) emitter.skipPhase();
	const actor = handler.toSettings().players[0]!;
	emitter.sendShot(actor.id, angle, power);
	let frames = 0;
	quiet(() => { while (handler.getState() === GameState.Playing && frames < maxFrames) { handler.tick(); frames++; } });
	return { frames, players: handler.toSettings().players.map(player => ({ position: { ...player.position }, isDead: !player.isPhysicsEnabled || !player.isDrawingEnabled })) };
}

describe("Section 17.5 structure control map", () => {
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

	test("spawn geometry is mirrored and not trapped by solid geometry", () => {
		const settings = build();
		const [a, b] = settings.players;
		expect(a!.position).toEqual({ x: 150, y: 225 });
		expect(b!.position).toEqual({ x: 650, y: 225 });
		expect(b!.position.x).toBe(settings.worldSize.x - a!.position.x);
		expect(b!.position.y).toBe(a!.position.y);
		// Every structure is at least 100 px from each spawn: no spawn is
		// embedded in or trapped by solid geometry.
		const solids = settings.mapBoundarys.filter(boundary => !("role" in boundary && boundary.role === "containment"));
		expect(solids.length).toBe(5);
		for (const player of settings.players) {
			for (const solid of solids) {
				const closestX = Math.max(solid.x, Math.min(player.position.x, solid.x + (solid.w ?? 0)));
				const closestY = Math.max(solid.y, Math.min(player.position.y, solid.y + (solid.h ?? 0)));
				const distance = Math.hypot(player.position.x - closestX, player.position.y - closestY);
				expect(distance).toBeGreaterThan(100);
			}
		}
	});

	test("at least two distinct navigable lanes with broad width", () => {
		const settings = build();
		const solids = settings.mapBoundarys.filter(boundary => !("role" in boundary && boundary.role === "containment"));
		// Top lane: between the top wall (y=0) and the top columns' top face.
		const topColumns = solids.filter(solid => solid.y < 100);
		const topFace = Math.min(...topColumns.map(solid => solid.y));
		expect(topFace - PLAYER_RADIUS).toBeGreaterThanOrEqual(2 * PLAYER_RADIUS);
		// Bottom lane: between the bottom columns' bottom face and the bottom wall.
		const bottomColumns = solids.filter(solid => (solid.y ?? 0) + (solid.h ?? 0) > 350);
		const bottomFace = Math.max(...bottomColumns.map(solid => (solid.y ?? 0) + (solid.h ?? 0)));
		expect(450 - bottomFace - PLAYER_RADIUS).toBeGreaterThanOrEqual(2 * PLAYER_RADIUS);
		// Central corridor: the blocker leaves two gaps wide enough for a puck.
		const blocker = solids.find(solid => (solid.w ?? 0) < 40 && (solid.h ?? 0) < 40);
		expect(blocker).toBeDefined();
		const corridorTop = blocker!.y - 150;
		const corridorBottom = 300 - (blocker!.y + (blocker!.h ?? 0));
		expect(corridorTop).toBeGreaterThanOrEqual(2 * PLAYER_RADIUS);
		expect(corridorBottom).toBeGreaterThanOrEqual(2 * PLAYER_RADIUS);
	});

	test("no single structure permanently partitions the arena", () => {
		const settings = build();
		const solids = settings.mapBoundarys.filter(boundary => !("role" in boundary && boundary.role === "containment"));
		for (const solid of solids) {
			// Every structure leaves open space on at least two opposite sides.
			const width = solid.w ?? 0;
			const height = solid.h ?? 0;
			expect(solid.x).toBeGreaterThan(0);
			expect(solid.x + width).toBeLessThan(settings.worldSize.x);
			expect(solid.y).toBeGreaterThan(0);
			expect(solid.y + height).toBeLessThan(settings.worldSize.y);
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

	test("no unavoidable first-turn elimination and safe legal openings exist", () => {
		const settings = build();
		let opponentKilled = 0;
		let safeOpenings = 0;
		for (let angle = 0; angle < 360; angle += 10) {
			for (let power = 1; power <= 10; power++) {
				const outcome = quiet(() => runShot(settings, angle, power));
				expect(outcome.players[1]!.isDead).toBe(false);
				if (!outcome.players[0]!.isDead) safeOpenings++;
			}
		}
		expect(opponentKilled).toBe(0);
		expect(safeOpenings).toBeGreaterThanOrEqual(2);
	}, 30_000);

	test("deterministic line interaction: duplicate corridor taps are bit-identical", () => {
		const settings = build();
		const first = quiet(() => runShot(settings, 0, 3));
		const second = quiet(() => runShot(settings, 0, 3));
		expect(JSON.stringify(first.players)).toBe(JSON.stringify(second.players));
		expect(first.players[0]!.isDead).toBe(false);
		// Meaningful positional change from an ordinary legal action.
		expect(first.players[0]!.position.x).toBeGreaterThan(300);
	});

	test("deterministic corner interaction: a column-corner graze reproduces exactly", () => {
		// Angle 348 grazes the right-top column corner and deflects the puck
		// into the bottom-left pocket; the same input must reproduce exactly.
		const settings = build();
		const first = quiet(() => runShot(settings, 348, 6));
		const second = quiet(() => runShot(settings, 348, 6));
		expect(JSON.stringify(first.players)).toBe(JSON.stringify(second.players));
		expect(first.players[0]!.isDead).toBe(false);
		// The deflection is meaningful: the puck ends on the opposite half.
		expect(first.players[0]!.position.y).toBeGreaterThan(350);
	});

	test("bounded multi-contact resolution: corner-pocket shots settle within the playback bound", () => {
		const settings = build();
		const first = quiet(() => runShot(settings, 334, 8, 1200));
		const second = quiet(() => runShot(settings, 334, 8, 1200));
		expect(first.frames).toBeLessThan(1200);
		expect(second.frames).toBeLessThan(1200);
		expect(JSON.stringify(first.players)).toBe(JSON.stringify(second.players));
		for (const outcome of [first, second]) {
			for (const player of outcome.players) {
				expect(Number.isFinite(player.position.x)).toBe(true);
				expect(Number.isFinite(player.position.y)).toBe(true);
			}
		}
	});

	test("both navigable lanes carry a puck across the arena", () => {
		const settings = build();
		const top = quiet(() => runShot(settings, 350, 6));
		expect(top.players[0]!.isDead).toBe(false);
		expect(top.players[0]!.position.x).toBeGreaterThan(500);
		const bottom = quiet(() => runShot(settings, 10, 6));
		expect(bottom.players[0]!.isDead).toBe(false);
		expect(bottom.players[0]!.position.x).toBeGreaterThan(500);
		expect(bottom.players[0]!.position.y).toBeGreaterThan(300);
	});

	test("broad action margins: corridor taps tolerate +/-3 degrees", () => {
		const settings = build();
		const outcomes = [357, 0, 3].map(angle => quiet(() => runShot(settings, angle, 3)));
		for (const outcome of outcomes) {
			expect(outcome.players[0]!.isDead).toBe(false);
			expect(outcome.players[0]!.position.x).toBeGreaterThan(300);
		}
		// The cluster is materially distinct from the spawn position.
		const xPositions = outcomes.map(outcome => outcome.players[0]!.position.x);
		expect(Math.min(...xPositions)).toBeGreaterThan(350);
	});

	test("deterministic mirrored turns from both sides", () => {
		const settings = build();
		const first = quiet(() => runShot(settings, 0, 3));
		// The mirrored shot from team 1 (angle 180) mirrors the team-0 result.
		const handler = new GameHandlerBuilder().defaultSystems().addSystem(new WinningSystem(2)).fromSettings(JSON.parse(JSON.stringify(settings))).build();
		const emitter = new GameEmitter(handler, settings.gameMode, 2, 1503);
		while (handler.getRuleState().phase !== RulePhase.Physics && handler.getRuleState().phase !== RulePhase.Complete) emitter.skipPhase();
		const actor = handler.toSettings().players[1]!;
		emitter.sendShot(actor.id, 180, 3);
		quiet(() => { let frames = 0; while (handler.getState() === GameState.Playing && frames < 900) { handler.tick(); frames++; } });
		const second = handler.toSettings().players;
		expect(second[1]!.position.x).toBeCloseTo(settings.worldSize.x - first.players[0]!.position.x, 6);
		expect(second[1]!.position.y).toBeCloseTo(first.players[0]!.position.y, 6);
		expect(second[0]!.position.x).toBeCloseTo(settings.worldSize.x - first.players[1]!.position.x, 6);
	});

	test("side-swapped equality and full qualification matrix with replay/restore equality", () => {
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
				// No softlock: every accepted turn settles within the bound.
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
	}, 30_000);

	test("browser-visible initial state", () => {
		const settings = build();
		const camera = new FitWorldCamera({ x: settings.worldSize.x, y: settings.worldSize.y });
		camera.resize(800, 450);
		expect(camera.getScaleFactor()).toBeGreaterThan(0);
		expect(camera.getWorldBounds()).toEqual({ x: 0, y: 0, w: 800, h: 450 });
		for (const player of settings.players) {
			expect(player.isPhysicsEnabled && player.isDrawingEnabled).toBe(true);
			expect(camera.containsCircle(player.position, player.size)).toBe(true);
		}
	});

	test("catalog entry matches the shipped map and the report ledger", () => {
		const entry = getMapCatalogEntry(MAP_ID);
		expect(entry.source).toBe("src/settings/structureControlMap.ts");
		expect(entry.browserAvailable).toBe(true);
		expect(entry.status).toBe("browser-qualified"); // 17.8 browser E2E evidence recorded
		expect(entry.spawnRegionCount).toBe(2);
		expect(entry.structureCount).toBe(10);
		expect(entry.hazardCount).toBe(1);
		expect(entry.teamLayouts).toEqual([2]);
		expect(entry.figuresPerTeam).toEqual([1]);
		expect(entry.friction).toBe("billiards");
		expect(entry.drift).toBe(0);
		expect(entry.knownLimitations.some(limitation => limitation.includes("central blocker"))).toBe(true);
	});
});

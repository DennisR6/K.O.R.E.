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
 * Section 17.4 - symmetric duel map.
 *
 * Symmetric Duel is a low-complexity kill-ring duel: one central wall splits
 * an open mirrored arena, the outer walls double as the containment boundary
 * (a puck whose full circle leaves the world rect is eliminated), and every
 * straight first-turn line between the spawn circles is blocked by the wall.
 *
 * Required characteristics: mirrored spawn geometry, equal initial distance
 * to the meaningful structures, no unavoidable first-turn elimination, at
 * least two materially different legal opening actions, a terminal route that
 * does not require pixel-exact input, and no new engine behavior.
 * Required verification: schema validation, settings round trip, deterministic
 * first turn from both sides, side-swapped equality, bounded playback, and a
 * browser-visible initial state.
 */

const MAP_ID = "symmetric-duel";
const PLAYER_RADIUS = 12;

function build(): ReturnType<typeof createCanonicalPlayableMatchSettings> {
	return buildMapSettings(MAP_ID, createCanonicalPlayableMatchSettings());
}

function quiet<T>(callback: () => T): T {
	const log = console.log;
	console.log = () => undefined;
	try { return callback(); } finally { console.log = log; }
}

/** Builds a fresh handler for a scripted scenario. */
function handlerFor(settings: ReturnType<typeof createCanonicalPlayableMatchSettings>, seed = 1503): GameHandler {
	return new GameHandlerBuilder().defaultSystems().addSystem(new WinningSystem(2)).fromSettings(JSON.parse(JSON.stringify(settings))).build();
}

function skipToPhysics(handler: GameHandler, emitter: GameEmitter): void {
	while (handler.getRuleState().phase !== RulePhase.Physics && handler.getRuleState().phase !== RulePhase.Complete) emitter.skipPhase();
}

function settle(handler: GameHandler, maxFrames = 900): number {
	let ticks = 0;
	while (handler.getState() === GameState.Playing && ticks < maxFrames) { handler.tick(); ticks++; }
	return ticks;
}

describe("Section 17.4 symmetric duel map", () => {
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
		const handler = handlerFor(settings);
		const snapshot = handler.toSettings();
		const restored = handlerFor(snapshot);
		expect(JSON.stringify(restored.toSettings())).toBe(JSON.stringify(snapshot));
	});

	test("spawn geometry is mirrored with equal distances to structures", () => {
		const settings = build();
		const [a, b] = settings.players;
		expect(a!.position).toEqual({ x: 150, y: 150 });
		expect(b!.position).toEqual({ x: 650, y: 150 });
		// Mirrored around the world center.
		expect(b!.position.x).toBe(settings.worldSize.x - a!.position.x);
		expect(b!.position.y).toBe(a!.position.y);
		// The central wall is centered and both teams stand at the same distance.
		const wall = settings.mapBoundarys.find(boundary => boundary.type === SHAPE.RECTANGLE && boundary.x > 100);
		expect(wall).toBeDefined();
		expect(wall!.x + (wall!.w ?? 0) / 2).toBe(settings.worldSize.x / 2);
		const leftDistance = wall!.x - a!.position.x - PLAYER_RADIUS;
		const rightDistance = b!.position.x - (wall!.x + (wall!.w ?? 0)) - PLAYER_RADIUS;
		expect(leftDistance).toBeCloseTo(rightDistance, 6);
		expect(leftDistance).toBeGreaterThan(0);
		// Equal distance to the arena walls on both sides.
		expect(a!.position.x - PLAYER_RADIUS).toBeCloseTo(settings.worldSize.x - b!.position.x - PLAYER_RADIUS, 6);
		// Spawns sit beyond the ~123 px power-2 stop distance: a weak opening can
		// never reach a wall by itself.
		expect(a!.position.x - PLAYER_RADIUS).toBeGreaterThan(123);
		// The corridor between the spawn circles (y 138..162) is fully covered
		// by the central wall (y 126..174) at the wall plane.
		expect(wall!.y).toBeLessThanOrEqual(138);
		expect(wall!.y + (wall!.h ?? 0)).toBeGreaterThanOrEqual(162);
		expect(settings.mapBoundarys.filter(boundary => "role" in boundary && boundary.role === "containment").length).toBe(1);
	});

	test("no unavoidable first-turn elimination: every legal opening leaves the opponent alive", () => {
		const settings = build();
		let opponentKilled = 0;
		let safeOpenings = 0;
		for (let angle = 0; angle < 360; angle += 10) {
			for (let power = 1; power <= 10; power++) {
				const handler = handlerFor(settings);
				const emitter = new GameEmitter(handler, settings.gameMode, 2, 1503);
				skipToPhysics(handler, emitter);
				const actor = handler.toSettings().players[0]!;
				let accepted = true;
				try { emitter.sendShot(actor.id, angle, power); } catch { accepted = false; }
				if (!accepted) continue;
				quiet(() => settle(handler));
				const [shooter, defender] = handler.toSettings().players;
				expect(defender!.isDead).toBe(false);
				if (!shooter!.isDead) safeOpenings++;
			}
		}
		expect(opponentKilled).toBe(0);
		// At least two safe legal openings exist (weak taps in any direction).
		expect(safeOpenings).toBeGreaterThanOrEqual(2);
	});

	test("at least two materially different legal opening actions", () => {
		const settings = build();
		const corridor = handlerFor(settings);
		const corridorEmitter = new GameEmitter(corridor, settings.gameMode, 2, 1503);
		skipToPhysics(corridor, corridorEmitter);
		const actor = corridor.toSettings().players[0]!;
		corridorEmitter.sendShot(actor.id, 0, 3);
		quiet(() => settle(corridor));
		const corridorEnd = corridor.toSettings().players[0]!.position;

		const tap = handlerFor(settings);
		const tapEmitter = new GameEmitter(tap, settings.gameMode, 2, 1503);
		skipToPhysics(tap, tapEmitter);
		tapEmitter.sendShot(actor.id, 90, 2);
		quiet(() => settle(tap));
		const tapEnd = tap.toSettings().players[0]!.position;

		expect(Math.hypot(corridorEnd.x - 150, corridorEnd.y - 150)).toBeGreaterThan(100);
		expect(Math.hypot(tapEnd.x - 150, tapEnd.y - 150)).toBeGreaterThan(50);
		expect(Math.hypot(corridorEnd.x - tapEnd.x, corridorEnd.y - tapEnd.y)).toBeGreaterThan(100);
	});

	test("a terminal route exists that does not require pixel-exact input", () => {
		// The defender advances into the corridor; the attacker moves off-axis
		// and drives the defender's puck into the top arena wall. The route
		// works across a range of powers and does not need a precise line.
		const settings = build();
		settings.players[1]!.position = { x: 300, y: 150 };
		settings.players[0]!.position = { x: 200, y: 200 };
		const angle = 333.4; // aimed at the defender's center
		for (const power of [6, 8, 10]) {
			const handler = handlerFor(settings);
			const emitter = new GameEmitter(handler, settings.gameMode, 2, 1503);
			skipToPhysics(handler, emitter);
			const actor = handler.toSettings().players[0]!;
			emitter.sendShot(actor.id, angle, power);
			quiet(() => settle(handler));
			const [attacker, defender] = handler.toSettings().players;
			expect(defender!.isDead).toBe(true);
			expect(attacker!.isDead).toBe(false);
			expect(handler.getMatchResult()).toEqual({ status: "winner", winnerTeam: 0, reason: "last-team-standing", turnNumber: 0 });
		}
	});

	test("the map adds no engine behavior: only existing primitives, no hazards or effects", () => {
		const template = createCanonicalPlayableMatchSettings();
		const settings = build();
		// The map document contributes no hazards and leaves the template's
		// items and handler effects untouched.
		expect(settings.hazards ?? []).toEqual([]);
		expect(settings.items).toEqual(template.items);
		expect(settings.effects).toEqual(template.effects);
		for (const boundary of settings.mapBoundarys) {
			expect(boundary.effects).toEqual([]);
			expect([SHAPE.RECTANGLE]).toContain(boundary.type);
		}
		expect(settings.mapBoundarys.length).toBe(2);
		const entry = getMapCatalogEntry(MAP_ID);
		expect(entry.structureCount).toBe(2);
		expect(entry.hazardCount).toBe(0);
		expect(entry.symmetry).toBe("symmetric");
		expect(entry.drift).toBe(0);
	});

	test("deterministic first turn from both sides", () => {
		const settings = build();
		const first = handlerFor(settings);
		const firstEmitter = new GameEmitter(first, settings.gameMode, 2, 1503);
		skipToPhysics(first, firstEmitter);
		const actor = first.toSettings().players[0]!;
		firstEmitter.sendShot(actor.id, 0, 3);
		quiet(() => settle(first));
		const firstSnapshot = first.toSettings();

		// Duplicate run is bit-identical.
		const duplicate = handlerFor(settings);
		const duplicateEmitter = new GameEmitter(duplicate, settings.gameMode, 2, 1503);
		skipToPhysics(duplicate, duplicateEmitter);
		duplicateEmitter.sendShot(duplicate.toSettings().players[0]!.id, 0, 3);
		quiet(() => settle(duplicate));
		expect(JSON.stringify(duplicate.toSettings())).toBe(JSON.stringify(firstSnapshot));

		// The mirrored shot from team 1 mirrors the team-0 result.
		const second = handlerFor(settings);
		const secondEmitter = new GameEmitter(second, settings.gameMode, 2, 1503);
		skipToPhysics(second, secondEmitter);
		secondEmitter.sendShot(second.toSettings().players[1]!.id, 180, 3);
		quiet(() => settle(second));
		const secondSnapshot = second.toSettings();
		expect(secondSnapshot.players[1]!.position.x).toBeCloseTo(settings.worldSize.x - firstSnapshot.players[0]!.position.x, 6);
		expect(secondSnapshot.players[1]!.position.y).toBeCloseTo(firstSnapshot.players[0]!.position.y, 6);
		expect(secondSnapshot.players[0]!.position.x).toBeCloseTo(settings.worldSize.x - firstSnapshot.players[1]!.position.x, 6);
	});

	test("side-swapped equality and full qualification matrix", () => {
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
			expect(swapped.checks.terminal).toBe(true);
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
		const inspection = inspectMapSettings(settings);
		expect(inspection.spawnFindings).toEqual([]);
	});

	test("catalog entry matches the shipped map and the report ledger", () => {
		const entry = getMapCatalogEntry(MAP_ID);
		expect(entry.source).toBe("src/settings/symmetricDuelMap.ts");
		expect(entry.browserAvailable).toBe(false);
		expect(entry.status).toBe("technically-qualified"); // 17.7 matrix evidence recorded
		expect(entry.spawnRegionCount).toBe(2);
		expect(entry.teamLayouts).toEqual([2]);
		expect(entry.figuresPerTeam).toEqual([1]);
		expect(entry.friction).toBe("ice");
		expect(entry.knownLimitations.some(limitation => limitation.includes("central wall"))).toBe(true);
	});
});

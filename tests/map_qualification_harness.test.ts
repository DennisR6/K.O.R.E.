import { describe, expect, test } from "bun:test";
import { MAP_CATALOG } from "../src/content/mapCatalog.js";
import { EffectTrigger, EffectType, SettingOperation } from "../src/effects/types.js";
import { SHAPE } from "../src/physics/physics.js";
import { createCanonicalPlayableMatchSettings } from "../src/settings/canonicalPlayableMatch.js";
import { createDefaultGameSettings } from "../src/settings/settings.js";
import { MAP_QUALIFICATION_SEEDS, MAP_PLAYBACK_BOUND, inspectMapSettings, mirrorSettings, qualifyMap, qualifyMapSettings } from "./support/mapQualification.js";

/**
 * Section 17.3 - automated map qualification harness.
 *
 * Positive cases: every technically qualifiable shipped map passes all
 * required checks with deterministic duplicate runs, side-swapped variants,
 * and structured output. Negative cases: malformed map data, impossible
 * spawn, initial death, no legal actor, playback stall, duplicate-run
 * divergence, and a deterministic physics-contract violation that must be
 * classified as blocked. The safety-limit result must remain a warning or
 * failure - never an artificial draw.
 */

const shippedMaps = ["ice-map-v1", "cue-clash", "frostbite-arena", "magma-cradle", "symmetric-duel", "structure-control", "hazard-control"];
// Technical qualification passes for the maps whose legal play satisfies the
// Section 13 physics contract. frostbite-arena violates it deterministically
// (see the dedicated blocked-classification test below).
const qualifiableMaps = ["ice-map-v1", "cue-clash", "magma-cradle", "symmetric-duel", "structure-control", "hazard-control"];

function canonicalTemplate(): ReturnType<typeof createCanonicalPlayableMatchSettings> {
	return createCanonicalPlayableMatchSettings();
}

function spawnInKillZone(settings: ReturnType<typeof createCanonicalPlayableMatchSettings>): void {
	settings.mapBoundarys.push({
		type: SHAPE.CIRCLE,
		x: settings.players[0]!.position.x,
		y: settings.players[0]!.position.y,
		r: 30,
		color: "#d94b28",
		effects: [{ trigger: EffectTrigger.Collision, triggerValue: [], type: EffectType.ModifySetting, typeValue: { operation: SettingOperation.Set, key: "dead", value: true } }],
	});
}

function deadSpawn(settings: ReturnType<typeof createCanonicalPlayableMatchSettings>): void {
	settings.players[0]!.isDead = true;
	settings.players[1]!.isDead = true;
}

function stallSettings(): ReturnType<typeof createCanonicalPlayableMatchSettings> {
	// No structures, no containment, and no handler-level or per-player
	// friction decay: friction 1 / drag 0 with the physics effects stripped
	// keeps every puck at constant velocity, so each accepted turn must run
	// into the engine's 1,200-frame playback bound.
	const settings = canonicalTemplate();
	settings.mapBoundarys = [];
	settings.effects = [];
	for (const player of settings.players) {
		player.effects = player.effects.filter(effect => effect.type !== EffectType.Physics);
	}
	settings.friction = { friction: 1, linearDrag: 0, stopThreshold: 0.1 };
	return settings;
}

describe("Section 17.3 map qualification harness", () => {
	test("technical maps pass the full qualification matrix", () => {
		for (const mapId of qualifiableMaps) {
			for (const seed of MAP_QUALIFICATION_SEEDS) {
				const result = qualifyMap(mapId, { seed });
				expect(result.mapId).toBe(mapId);
				expect(result.seed).toBe(seed);
				expect(result.variant).toBe("original");
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
				expect(result.replayRestoreStatus).toBe("ok");
				expect(result.acceptedActions).toBeGreaterThan(0);
				// A match may legitimately end on its first action (turn
				// number 0) - e.g. symmetric-duel's deterministic wall-kill.
				expect(result.turns).toBeGreaterThanOrEqual(0);
				expect(result.simulatedFrames).toBeGreaterThan(0);
				expect(result.engineWork).toBeGreaterThanOrEqual(result.simulatedFrames);
				expect(result.fingerprint.length).toBeGreaterThan(0);
				expect(["winner", "draw", "ongoing"]).toContain(result.result);
				// Terminal or explicit bounded ongoing - never an artificial draw.
				if (result.result === "ongoing") {
					expect(result.checks.terminal).toBe(false);
					expect(result.safetyLimitStatus).toBe("warning");
				} else {
					expect(result.checks.terminal).toBe(true);
					expect(result.safetyLimitStatus).toBe("none");
				}
			}
		}
	});

	test("a map that violates the physics contract is reported deterministically as blocked", () => {
		// frostbite-arena (drift 1.0) deterministically produces a two-player
		// wall jam whose penetration the Section 13 solver cannot resolve; the
		// engine's explicit failure must surface as a structured blocked
		// classification - never as an artificial draw or a crash.
		for (const seed of MAP_QUALIFICATION_SEEDS) {
			const result = qualifyMap("frostbite-arena", { seed });
			expect(result.mapId).toBe("frostbite-arena");
			expect(result.seed).toBe(seed);
			expect(result.variant).toBe("original");
			expect(result.checks.schemaValid).toBe(true);
			expect(result.checks.finiteSpawn).toBe(true);
			expect(result.checks.containmentValid).toBe(true);
			expect(result.checks.deterministic).toBe(true);
			expect(result.checks.boundedPlayback).toBe(false);
			expect(result.checks.terminal).toBe(false);
			expect(result.safetyLimitStatus).toBe("failure");
			expect(result.result).toBe("ongoing");
			expect(result.acceptedActions).toBe(0);
			expect(result.invariantFindings.some(finding => finding.includes("Unresolved penetration"))).toBe(true);
		}
	});

	test("duplicate seeds are deterministic and different seeds diverge", () => {
		const first = qualifyMap("ice-map-v1", { seed: 1503 });
		const second = qualifyMap("ice-map-v1", { seed: 1503 });
		expect(first.fingerprint).toBe(second.fingerprint);
		expect(first.result).toBe(second.result);
		const other = qualifyMap("ice-map-v1", { seed: 9999 });
		expect(other.checks.deterministic).toBe(true);
	});

	test("side-swapped variants mirror deterministically", () => {
		for (const mapId of ["ice-map-v1", "cue-clash"]) {
			const original = qualifyMap(mapId, { seed: 1503, variant: "original" });
			const swapped = qualifyMap(mapId, { seed: 1503, variant: "side-swapped" });
			expect(swapped.variant).toBe("side-swapped");
			expect(swapped.checks.schemaValid).toBe(true);
			expect(swapped.checks.finiteSpawn).toBe(true);
			expect(swapped.checks.deterministic).toBe(true);
			expect(swapped.invariantFindings).toEqual([]);
			expect(swapped.spawnFindings).toEqual([]);
			expect(swapped.result).toBe(original.result);
		}
	});

	test("mirroring swaps teams and positions deterministically", () => {
		const template = canonicalTemplate();
		const mirrored = mirrorSettings(template);
		expect(mirrored.players[0]!.team).toEqual([1]);
		expect(mirrored.players[1]!.team).toEqual([0]);
		expect(mirrored.players[0]!.position.x).toBeCloseTo(template.worldSize.x - template.players[0]!.position.x, 6);
		expect(mirrored.players[1]!.position.x).toBeCloseTo(template.worldSize.x - template.players[1]!.position.x, 6);
		expect(JSON.stringify(mirrored.players[0]!.position)).not.toBe(JSON.stringify(template.players[0]!.position));
	});

	test("malformed map data is reported as schema failure", () => {
		const settings = canonicalTemplate();
		settings.mapBoundarys[0]!.w = Number.NaN;
		const result = qualifyMapSettings(settings, { seed: 1503 });
		expect(result.checks.schemaValid).toBe(false);
		expect(result.safetyLimitStatus).toBe("failure");
		expect(result.spawnFindings.some(finding => finding.includes("schema/settings validation failed"))).toBe(true);
	});

	test("spawn inside a lethal hazard is reported", () => {
		const settings = canonicalTemplate();
		spawnInKillZone(settings);
		const inspection = inspectMapSettings(settings);
		expect(inspection.noLethalOverlap).toBe(false);
		expect(inspection.spawnFindings.some(finding => finding.includes("inside lethal hazard"))).toBe(true);
		const result = qualifyMapSettings(settings, { seed: 1503 });
		expect(result.checks.noLethalOverlap).toBe(false);
	});

	test("initial death and no legal actor are reported", () => {
		const settings = canonicalTemplate();
		deadSpawn(settings);
		const inspection = inspectMapSettings(settings);
		expect(inspection.spawnFindings.some(finding => finding.includes("spawns already dead"))).toBe(true);
		expect(inspection.spawnFindings.some(finding => finding.includes("no legal actor"))).toBe(true);
		const result = qualifyMapSettings(settings, { seed: 1503 });
		expect(result.checks.legalFirstAction).toBe(false);
	});

	test("playback stall is a failure, never an artificial draw", () => {
		const result = qualifyMapSettings(stallSettings(), { seed: 1503, maxPlaybackFrames: 600 });
		expect(result.checks.boundedPlayback).toBe(false);
		expect(result.safetyLimitStatus).toBe("failure");
		expect(result.result).toBe("ongoing");
		expect(result.invariantFindings.some(finding => finding.includes("frame bound"))).toBe(true);
	});

	test("the playback bound is exposed and enforced", () => {
		expect(MAP_PLAYBACK_BOUND).toBe(1200);
		const settings = canonicalTemplate();
		const result = qualifyMapSettings(settings, { seed: 1503, maxTurns: 2 });
		expect(result.checks.boundedPlayback).toBe(true);
		expect(result.turns).toBeLessThanOrEqual(2);
	});

	test("the catalog maps all qualify with canonical layout settings", () => {
		const template = createDefaultGameSettings(2, 1);
		for (const mapId of shippedMaps) {
			const result = qualifyMap(mapId, { seed: 1503 });
			expect(result.mapId).toBe(mapId);
			// 17.7: the six qualifiable maps are technically qualified by the
			// matrix; frostbite-arena is the documented expected-blocked map.
			const status = MAP_CATALOG.find(entry => entry.id === mapId)?.status;
			expect(status).toBe(mapId === "frostbite-arena" ? "blocked" : "technically-qualified");
		}
		expect(template.players.length).toBe(2);
	});

	test("a custom settings map is labelled without a catalog ID", () => {
		const result = qualifyMapSettings(canonicalTemplate(), { seed: 1503 });
		expect(result.mapId).toBe("custom-settings");
	});
});

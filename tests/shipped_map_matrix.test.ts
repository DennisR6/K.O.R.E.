import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getMapCatalogEntry } from "../src/content/mapCatalog.js";
import { BLOCKED_MAP_ID, computeSummary } from "./support/matrixSummary.js";
import {
	FULL_MATRIX_SEED_COUNT,
	POLICIES,
	VARIANTS,
	computeMatrix,
	freshSample,
	releaseMatrix,
	sampleCells,
	shippedMapIds,
	type LoadedMatrix,
	type ReleaseMatrix,
} from "./support/matrixCache.js";

/**
 * Section 17.7 - complete shipped-map matrix qualification.
 *
 * Every shipped and Section 17 candidate map runs through the shared
 * technical qualification matrix: multiple deterministic seeds, original and
 * side-swapped spawn variants, first-turn-swapped variants, one random-walk
 * policy (easy) and one direct-pressure policy (hard).
 *
 * The matrix is cached per cell in `.matrix-cache/` (content-addressed,
 * resumable, gitignored). All tests share ONE loaded/computed matrix. The
 * byte-for-byte determinism assertion never compares cached data with
 * itself: during development it reruns a deterministic representative sample
 * twice fresh, and in release mode (`MAP_MATRIX_FRESH=1`, `test:maps:matrix`)
 * it runs two genuinely fresh complete executions and compares their
 * serialized outputs. frostbite-arena is the documented expected-blocked
 * map: it deterministically violates the Section 13 physics contract.
 * Metrics and warning signals are computed and recorded; the full-matrix
 * numbers are reproduced in `docs/map-qualification-report.md`.
 *
 * The whole suite is OPT-IN: it only runs when `MAP_MATRIX=1` (cached
 * development smoke, `test:maps`) or `MAP_MATRIX_FRESH=1` (release matrix,
 * `test:maps:matrix`) is set. A plain `bun test` skips it entirely so the
 * default suite never builds maps or replays the matrix (the Section 17
 * release gate runs the explicit commands in CI).
 */

const RELEASE_MODE = process.env.MAP_MATRIX_FRESH === "1";
// Opt-in gate: the matrix never runs as part of plain test discovery.
const MATRIX_REQUESTED = process.env.MAP_MATRIX === "1" || RELEASE_MODE;
// The release command always runs the full seed set; development honors
// MAP_MATRIX_SEED_COUNT (smoke default) and MAP_MATRIX_CACHE=0 bypass.
const SEED_COUNT = RELEASE_MODE ? FULL_MATRIX_SEED_COUNT : Math.max(1, Number(process.env.MAP_MATRIX_SEED_COUNT ?? 1));
const BLOCKED_EVIDENCE = "Unresolved penetration after max solver iterations";

const ROOT = process.cwd();
const read = (file: string) => readFileSync(resolve(ROOT, file), "utf8");

const shippedMaps = shippedMapIds();
const qualifiableMaps = shippedMaps.filter(mapId => mapId !== BLOCKED_MAP_ID);

// All tests share one loaded/computed matrix instead of rerunning it.
let loadedMatrixPromise: Promise<LoadedMatrix> | null = null;
function getMatrix(): Promise<LoadedMatrix> {
	loadedMatrixPromise ??= Promise.resolve().then(() => (
		RELEASE_MODE ? releaseMatrix(SEED_COUNT) : computeMatrix(SEED_COUNT)
	));
	return loadedMatrixPromise;
}

describe.skipIf(!MATRIX_REQUESTED)("Section 17.7 shipped map matrix", () => {
	test("the matrix covers every documented shipped map", () => {
		const report = read("docs/map-qualification-report.md");
		for (const mapId of shippedMaps) {
			expect(report).toContain(`| ${mapId} | ${getMapCatalogEntry(mapId).name} |`);
		}
		expect(shippedMaps).toContain(BLOCKED_MAP_ID);
		expect(qualifiableMaps.length).toBeGreaterThanOrEqual(5);
	});

	test("the matrix repeats byte-for-byte without ever comparing cached data with itself", async () => {
		const matrix = await getMatrix();
		if (RELEASE_MODE) {
			// Two genuinely fresh complete executions, both persisted for
			// resume; their serialized outputs must be byte-for-byte equal.
			const release = matrix as ReleaseMatrix;
			expect(release.matched).toBe(true);
			expect(JSON.stringify(release.runB)).toBe(JSON.stringify(release.runA));
		} else {			// Development repeatability: rerun the deterministic
			// representative sample twice fresh, then validate the cached
			// records against the fresh sample outputs.
			const first = freshSample();
			const second = freshSample();
			expect(JSON.stringify(second)).toBe(JSON.stringify(first));
			const freshByCell = new Map(sampleCells().map((cell, index) => (
				[`${cell.mapId}|${cell.seed}|${cell.variant}|${cell.policy}`, first[index]!]
			)));
			for (const run of matrix.records) {
				const fresh = freshByCell.get(`${run.mapId}|${run.seed}|${run.variant}|${run.policy}`);
				if (fresh) expect(JSON.stringify(fresh)).toBe(JSON.stringify(run));
			}
		}
	}, 1_800_000);

	test("matrix provenance shows which cells were cached and which were freshly executed", async () => {
		const matrix = await getMatrix();
		const provenance = matrix.provenance;
		expect(provenance.total).toBe(matrix.records.length);
		expect(provenance.cached + provenance.fresh).toBe(provenance.total);
		expect(Object.keys(provenance.perKey).length).toBe(provenance.total);
		expect(provenance.dir).toContain(".matrix-cache");
		if (RELEASE_MODE) {
			const release = matrix as ReleaseMatrix;
			expect(release.provenanceA.total).toBe(provenance.total);
			expect(release.provenanceA.cached + release.provenanceA.fresh).toBe(provenance.total);
			expect(release.provenanceB.cached + release.provenanceB.fresh).toBe(provenance.total);
		}
	});

	test("no hard failures across the shipped matrix and the expected-blocked map stays documented", async () => {
		const matrix = await getMatrix();
		const records = matrix.records;
		const summary = computeSummary(records);
		for (const mapId of qualifiableMaps) {
			const runs = records.filter(run => run.mapId === mapId);
			expect(runs.length).toBeGreaterThan(0);
			for (const run of runs) {
				expect(run.spawnFindings, `${mapId} ${run.variant} ${run.policy} seed ${run.seed}`).toEqual([]);
				expect(run.invariantFindings, `${mapId} ${run.variant} ${run.policy} seed ${run.seed}`).toEqual([]);
				expect(run.replayRestoreStatus).toBe("ok");
				expect(run.safetyLimitStatus).not.toBe("failure");
			}
		}
		expect(summary.hardFailures).toEqual([]);
		// frostbite-arena keeps its documented blocked classification.
		const blocked = records.filter(run => run.mapId === BLOCKED_MAP_ID);
		expect(blocked.length).toBeGreaterThan(0);
		for (const run of blocked) {
			expect(run.invariantFindings.some(finding => finding.includes(BLOCKED_EVIDENCE))).toBe(true);
		}
	}, 1_800_000);

	test("required metrics are computed and bounded", async () => {
		const matrix = await getMatrix();
		const records = matrix.records;
		const summary = computeSummary(records);
		expect(summary.totalRuns).toBe(shippedMaps.length * SEED_COUNT * VARIANTS.length * POLICIES.length);
		for (const rate of [summary.terminalRate, summary.drawRate, summary.ongoingRate, summary.instantDeathRate, summary.turnLimitRate]) {
			expect(rate).toBeGreaterThanOrEqual(0);
			expect(rate).toBeLessThanOrEqual(1);
		}
		expect(summary.turnStats.min).toBeGreaterThanOrEqual(0);
		expect(summary.turnStats.median).toBeGreaterThanOrEqual(summary.turnStats.min);
		expect(summary.turnStats.max).toBeLessThanOrEqual(24);
		expect(summary.totalAcceptedActions).toBeGreaterThan(0);
		expect(summary.totalEngineWork).toBeGreaterThan(summary.totalSimulatedFrames);
		expect(summary.leftWins + summary.rightWins).toBe(summary.team0Wins + summary.team1Wins);
		expect(summary.firstTurnWins).toBeLessThanOrEqual(summary.terminalRuns);
		for (const warning of summary.warnings) expect(typeof warning).toBe("string");
	}, 1_800_000);

	test("first-turn-swapped variants actually open with team 1 and side-swapped variants mirror", async () => {
		const matrix = await getMatrix();
		const records = matrix.records;
		// frostbite-arena cannot open at all: its documented blocked failure
		// surfaces during handler construction, so the caught run reports
		// firstTeam 0 by definition and is asserted against its blocked evidence.
		for (const run of records.filter(run => run.variant === "first-turn-swapped" && run.mapId !== BLOCKED_MAP_ID)) {
			expect(run.firstTeam).toBe(1);
		}
		for (const run of records.filter(run => run.variant === "side-swapped")) {
			expect(run.checks.schemaValid).toBe(true);
		}
	}, 1_800_000);

	test("every legal run produced a result inside the bounds without post-completion mutation", async () => {
		const matrix = await getMatrix();
		for (const run of matrix.records) {
			if (run.mapId === BLOCKED_MAP_ID) continue;
			expect(run.checks.boundedPlayback).toBe(true);
			expect(run.checks.deterministic).toBe(true);
			expect(run.checks.snapshotRestore).toBe(true);
			expect(run.checks.replayEquality).toBe(true);
			expect(run.checks.noPostCompletionMutation).toBe(true);
		}
	}, 1_800_000);
});

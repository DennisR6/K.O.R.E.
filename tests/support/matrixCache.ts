import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { MAP_CATALOG, buildMapSettings } from "../../src/content/mapCatalog.js";
import { createCanonicalPlayableMatchSettings } from "../../src/settings/canonicalPlayableMatch.js";
import {
	MAP_DEFAULT_MAX_TURNS,
	MAP_PLAYBACK_BOUND,
	MATRIX_POLICY_LIMITS,
	qualifyMap,
	type MapQualificationOutput,
	type MatrixPolicy,
	type MapVariant,
} from "./mapQualification.js";

/**
 * Resumable, content-addressed cache for the Section 17.7 shipped-map matrix.
 *
 * A matrix cell is uniquely defined by the map's resolved settings, the seed,
 * the variant, the policy, the policy limits, the qualification limits, the
 * cache-schema version, and a fingerprint of every engine/physics/rule/AI/
 * harness source that can change a cell's output. Only successfully computed
 * and structurally validated records are stored; records are written
 * atomically (temp file + rename), so a crash never leaves a partial cell
 * behind and failed/incomplete cells are recomputed on the next run.
 *
 * Provenance metadata is preserved per cell so a run can show exactly which
 * cells were reused from the cache and which were freshly executed.
 */

export const FULL_MATRIX_SEED_COUNT = 12;
export const SMOKE_MATRIX_SEED_COUNT = 1;
// Deterministic seed sequence shared by every map/variant/policy cell.
export const SEEDS = [1503, 1504, 2107, 2717, 3329, 3927, 4583, 5011, 5741, 6173, 7331, 8501];
export const VARIANTS: MapVariant[] = ["original", "side-swapped", "first-turn-swapped"];
export const POLICIES: MatrixPolicy[] = ["easy", "hard"];

const CACHE_ROOT = join(process.cwd(), ".matrix-cache");
const SCHEMA_VERSION = 1;

// Source roots that can change a cell's output. Map-defining files
// (`src/settings/*Map.ts`, `canonicalPlayableMatch.ts`, `mapCatalog.ts`) are
// intentionally absent: their effect is fully captured by the per-cell hash
// of the resolved map settings, so touching one map only invalidates that
// map's cells instead of the whole matrix.
const CORE_SOURCE_PATHS = [
	"src/engine",
	"src/physics",
	"src/rules",
	"src/ai",
	"src/effects",
	"src/entity",
	"src/item",
	"src/systems",
	"src/structures",
	"src/emitter",
	"src/replay",
	"src/contracts",
	"src/utils",
	"src/settings/settings.ts",
	"tests/support/mapQualification.ts",
];

export interface MatrixCell {
	mapId: string;
	seed: number;
	variant: MapVariant;
	policy: MatrixPolicy;
}

export interface MatrixProvenance {
	total: number;
	cached: number;
	fresh: number;
	perKey: Record<string, "cache" | "fresh">;
	dir: string;
}

export interface LoadedMatrix {
	records: MapQualificationOutput[];
	provenance: MatrixProvenance;
}

export interface ReleaseMatrix extends LoadedMatrix {
	attemptId: string;
	runA: MapQualificationOutput[];
	runB: MapQualificationOutput[];
	provenanceA: MatrixProvenance;
	provenanceB: MatrixProvenance;
	matched: boolean;
}

export function shippedMapIds(): string[] {
	return MAP_CATALOG.filter(entry => entry.plannedSource === undefined).map(entry => entry.id);
}

export function matrixCells(seedCount: number): MatrixCell[] {
	const cells: MatrixCell[] = [];
	for (const mapId of shippedMapIds()) {
		for (let i = 0; i < seedCount; i++) {
			for (const variant of VARIANTS) {
				for (const policy of POLICIES) {
					cells.push({ mapId, seed: SEEDS[i % SEEDS.length]!, variant, policy });
				}
			}
		}
	}
	return cells;
}

// ---------------------------------------------------------------------------
// Content addressing
// ---------------------------------------------------------------------------

function collectFiles(target: string, out: string[]): void {
	const stat = statSync(target);
	if (stat.isFile()) {
		out.push(target);
		return;
	}
	for (const entry of readdirSync(target)) collectFiles(join(target, entry), out);
}

let coreFingerprintCache: string | null = null;

/** Hash over every source file that can influence a cell's output. */
export function coreFingerprint(): string {
	if (coreFingerprintCache !== null) return coreFingerprintCache;
	const hash = createHash("sha256");
	const files: string[] = [];
	for (const path of CORE_SOURCE_PATHS) collectFiles(path, files);
	files.sort();
	for (const file of files) {
		hash.update(relative(process.cwd(), file)).update("\0").update(readFileSync(file, "utf8")).update("\0");
	}
	coreFingerprintCache = hash.digest("hex");
	return coreFingerprintCache;
}

const settingsHashCache = new Map<string, string>();
const canonicalTemplate = createCanonicalPlayableMatchSettings();

/** Hash of the resolved map settings; changes whenever the map source does. */
function settingsHash(mapId: string): string {
	let cached = settingsHashCache.get(mapId);
	if (!cached) {
		cached = createHash("sha256").update(JSON.stringify(buildMapSettings(mapId, canonicalTemplate))).digest("hex");
		settingsHashCache.set(mapId, cached);
	}
	return cached;
}

/** Complete content-addressed cache key of one matrix cell. */
export function cellKey(cell: MatrixCell): string {
	const payload = JSON.stringify({
		schemaVersion: SCHEMA_VERSION,
		core: coreFingerprint(),
		settings: settingsHash(cell.mapId),
		seed: cell.seed,
		variant: cell.variant,
		policy: cell.policy,
		policyLimits: MATRIX_POLICY_LIMITS[cell.policy],
		maxTurns: MAP_DEFAULT_MAX_TURNS,
		maxPlaybackFrames: MAP_PLAYBACK_BOUND,
	});
	return createHash("sha256").update(payload).digest("hex");
}

// ---------------------------------------------------------------------------
// Store / load
// ---------------------------------------------------------------------------

/** Structural validation: a malformed or incomplete record is never reused. */
function isValidRecord(record: unknown, cell: MatrixCell): record is MapQualificationOutput {
	if (typeof record !== "object" || record === null) return false;
	const run = record as Partial<MapQualificationOutput>;
	return run.mapId === cell.mapId
		&& run.seed === cell.seed
		&& run.variant === cell.variant
		&& run.policy === cell.policy
		&& typeof run.checks === "object" && run.checks !== null
		&& typeof (run.checks as { schemaValid?: unknown }).schemaValid === "boolean"
		&& Number.isFinite(run.turns)
		&& Number.isFinite(run.simulatedFrames)
		&& Number.isFinite(run.engineWork)
		&& Number.isFinite(run.acceptedActions)
		&& Number.isFinite(run.firstTeam)
		&& typeof run.result === "string"
		&& typeof run.fingerprint === "string"
		&& typeof run.replayRestoreStatus === "string"
		&& typeof run.safetyLimitStatus === "string"
		&& Array.isArray(run.spawnFindings)
		&& Array.isArray(run.invariantFindings);
}

function storeCell(dir: string, cell: MatrixCell, key: string, record: MapQualificationOutput): void {
	mkdirSync(dir, { recursive: true });
	const tmp = join(dir, `${key}.tmp`);
	writeFileSync(tmp, JSON.stringify({ schemaVersion: SCHEMA_VERSION, cell, record }));
	renameSync(tmp, join(dir, `${key}.json`));
}

function loadCell(dir: string, cell: MatrixCell, key: string): MapQualificationOutput | null {
	const file = join(dir, `${key}.json`);
	if (!existsSync(file)) return null;
	let parsed: unknown;
	try {
		parsed = JSON.parse(readFileSync(file, "utf8"));
	} catch {
		return null;
	}
	if (typeof parsed !== "object" || parsed === null) return null;
	const envelope = parsed as { schemaVersion?: unknown; record?: unknown };
	if (envelope.schemaVersion !== SCHEMA_VERSION) return null;
	if (!isValidRecord(envelope.record, cell)) return null;
	return envelope.record;
}

function computeCell(cell: MatrixCell): MapQualificationOutput {
	return qualifyMap(cell.mapId, { seed: cell.seed, variant: cell.variant, policy: cell.policy });
}

/** Runs a cell list against one cache directory, reusing valid stored cells. */
function runCells(dir: string, cells: MatrixCell[], bypassCache: boolean): { records: MapQualificationOutput[]; provenance: MatrixProvenance } {
	const records: MapQualificationOutput[] = [];
	const provenance: MatrixProvenance = { total: 0, cached: 0, fresh: 0, perKey: {}, dir };
	for (const cell of cells) {
		const key = cellKey(cell);
		let record: MapQualificationOutput | null = null;
		let status: "cache" | "fresh" = "cache";
		if (!bypassCache) record = loadCell(dir, cell, key);
		if (!record) {
			record = computeCell(cell);
			storeCell(dir, cell, key, record);
			status = "fresh";
		}
		records.push(record);
		provenance.perKey[key] = status;
		if (status === "cache") provenance.cached++;
		else provenance.fresh++;
		provenance.total++;
	}
	return { records, provenance };
}

// ---------------------------------------------------------------------------
// Dev cache and release runs
// ---------------------------------------------------------------------------

/**
 * Development matrix: loads valid cells from the shared cell cache and
 * computes (and stores) everything that is missing or invalidated. Set
 * `MAP_MATRIX_CACHE=0` to bypass the cache entirely while still storing the
 * freshly computed cells.
 */
export function computeMatrix(seedCount: number): LoadedMatrix {
	const bypassCache = process.env.MAP_MATRIX_CACHE === "0";
	const dir = join(CACHE_ROOT, `v${SCHEMA_VERSION}`, "cells");
	const { records, provenance } = runCells(dir, matrixCells(seedCount), bypassCache);
	console.log(`map matrix: ${provenance.total} cells (cached ${provenance.cached}, fresh ${provenance.fresh}${bypassCache ? ", cache bypassed" : ""}) in ${dir}`);
	return { records, provenance };
}

/**
 * Release matrix: two genuinely fresh complete executions, each persisted
 * under its own attempt directory so a failed attempt can resume (rerun with
 * the same `MAP_MATRIX_ATTEMPT_ID`) and recompute only missing or invalidated
 * cells instead of restarting all completed work. The two executions are then
 * compared byte-for-byte; a mismatch means the determinism contract broke.
 */
export function releaseMatrix(seedCount: number): ReleaseMatrix {
	const attemptId = process.env.MAP_MATRIX_ATTEMPT_ID ?? `release-${new Date().toISOString().replace(/[:.]/g, "-")}`;
	const base = join(CACHE_ROOT, `v${SCHEMA_VERSION}`, "release", attemptId);
	const cells = matrixCells(seedCount);
	const runA = runCells(join(base, "a"), cells, false);
	const runB = runCells(join(base, "b"), cells, false);
	const matched = JSON.stringify(runA.records) === JSON.stringify(runB.records);
	writeFileSync(join(base, "manifest.json"), JSON.stringify({ attemptId, seedCount, cells: cells.length, matched, completedAt: new Date().toISOString() }));
	console.log(`map release attempt ${attemptId}: runA ${runA.provenance.cached} cached / ${runA.provenance.fresh} fresh, runB ${runB.provenance.cached} cached / ${runB.provenance.fresh} fresh, byte-for-byte ${matched ? "MATCH" : "MISMATCH"}`);
	return {
		attemptId,
		records: runA.records,
		provenance: runA.provenance,
		runA: runA.records,
		runB: runB.records,
		provenanceA: runA.provenance,
		provenanceB: runB.provenance,
		matched,
	};
}

// ---------------------------------------------------------------------------
// Deterministic representative sample (development repeatability)
// ---------------------------------------------------------------------------

/** One deterministic cell per shipped map, covering every variant/policy. */
export function sampleCells(): MatrixCell[] {
	return shippedMapIds().map((mapId, index) => ({
		mapId,
		seed: SEEDS[0]!,
		variant: VARIANTS[index % VARIANTS.length]!,
		policy: POLICIES[index % POLICIES.length]!,
	}));
}

/**
 * Freshly executes the representative sample without reading or writing the
 * cache. Used by the development byte-for-byte assertion: the sample is run
 * twice fresh (never cached-vs-cached) and additionally compared against the
 * corresponding cached records to validate the cache contents.
 */
export function freshSample(): MapQualificationOutput[] {
	return sampleCells().map(computeCell);
}

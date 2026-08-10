import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { FINAL_RELEASE_MAP_IDS, MAP_CATALOG, buildMapSettings, getFinalReleaseMapEntries, getMapCatalogEntry } from "../src/content/mapCatalog.js";
import { createDefaultGameSettings, validateGameSettings } from "../src/settings/settings.js";

/**
 * Section 17.2 - map content inventory.
 *
 * Asserts the authoritative map catalog: unique stable IDs, registered source
 * files, reachability through the validated loader, honest qualification
 * statuses, and the report ledger matching the catalog. Negative cases from
 * the task: duplicate IDs, unregistered shipped files, registry entries
 * without source data, source data not reachable through the validated
 * loader, and documentation claiming qualification without committed evidence.
 */

const ROOT = process.cwd();
const read = (file: string) => readFileSync(resolve(ROOT, file), "utf8");

const shippedMapIds = ["ice-map-v1", "cue-clash", "frostbite-arena", "magma-cradle", "symmetric-duel", "structure-control", "hazard-control", "aurora-basin", "lantern-gates", "ember-crossing"];
const plannedMapIds: string[] = [];
const allMapIds = [...shippedMapIds, ...plannedMapIds];

describe("Section 17.2 map content inventory", () => {
	test("final release roster excludes blocked maps from production selection", () => {
		expect(FINAL_RELEASE_MAP_IDS).not.toContain("frostbite-arena");
		expect(getFinalReleaseMapEntries().every(entry => entry.browserAvailable && entry.status !== "blocked")).toBe(true);
		expect(getFinalReleaseMapEntries(true).every(entry => entry.browserAvailable && entry.battleAvailable && entry.status !== "blocked")).toBe(true);
	});

	test("catalog IDs are unique and every shipped/planned map is registered", () => {
		const ids = MAP_CATALOG.map(entry => entry.id);
		expect(new Set(ids).size).toBe(ids.length);
		expect(new Set(ids)).toEqual(new Set(allMapIds));
		for (const entry of MAP_CATALOG) {
			expect(entry.id.length).toBeGreaterThan(0);
			expect(entry.name.length).toBeGreaterThan(0);
			expect(entry.source.length).toBeGreaterThan(0);
			expect(["symmetric", "asymmetric"]).toContain(entry.symmetry);
			// 17.8: the six qualifiable maps are browser-qualified (real-browser
			// evidence) and frostbite-arena stays blocked (evidence in the
			// map qualification report).
			expect(["candidate", "technically-qualified", "browser-qualified", "human-qualified", "blocked", "rejected"]).toContain(entry.status);
			expect(entry.status).toBe(entry.id === "frostbite-arena" ? "blocked" : "browser-qualified");
		}
	});

	test("shipped map source files exist and load through the validated loader", () => {
		const template = createDefaultGameSettings(2, 1);
		for (const mapId of shippedMapIds) {
			const entry = getMapCatalogEntry(mapId);
			expect(entry.plannedSource).toBeUndefined();
			// Source paths are space/brace-delimited: "src/...ts (note)" or "a.ts + b.ts".
			const sourceFiles = entry.source.split(/[ +()]/).filter(part => part.startsWith("src/"));
			for (const sourceFile of sourceFiles) expect(existsSync(resolve(ROOT, sourceFile))).toBe(true);
			const settings = buildMapSettings(mapId, template);
			expect(() => validateGameSettings(settings)).not.toThrow();
			expect(settings.players.length).toBe(2);
			for (const player of settings.players) {
				expect(Number.isFinite(player.position.x)).toBe(true);
				expect(Number.isFinite(player.position.y)).toBe(true);
			}
		}
	});

	test("catalog structure and hazard counts match the actually loaded map data", () => {
		const template = createDefaultGameSettings(2, 1);
		for (const mapId of shippedMapIds) {
			const entry = getMapCatalogEntry(mapId);
			const settings = buildMapSettings(mapId, template);
			expect(settings.mapBoundarys.length).toBe(entry.structureCount + entry.hazardCount);
			expect(entry.structureCount).toBeGreaterThan(0);
			expect(entry.hazardCount).toBeGreaterThanOrEqual(0);
			expect(entry.spawnRegionCount).toBe(2);
			expect(entry.drift).toBeGreaterThanOrEqual(0);
			expect(entry.drift).toBeLessThanOrEqual(1);
		}
	});

	test("every shipped map has a four-sided containment boundary and a death route", () => {
		const template = createDefaultGameSettings(2, 1);
		for (const mapId of shippedMapIds) {
			const settings = buildMapSettings(mapId, template);
			const containment = settings.mapBoundarys.find(boundary => boundary.role === "containment")
				?? settings.mapBoundarys.find(boundary => "w" in boundary && "h" in boundary && boundary.x === 0 && boundary.y === 0 && boundary.w === settings.worldSize.x && boundary.h === settings.worldSize.y);
			if (containment) {
				expect(containment, mapId).toMatchObject({ x: 0, y: 0, w: settings.worldSize.x, h: settings.worldSize.y });
				continue;
			}
			const rectangles = settings.mapBoundarys.filter(boundary => "w" in boundary && "h" in boundary);
			expect(rectangles.some(boundary => boundary.x <= settings.worldSize.x * 0.15), `${mapId} left`).toBe(true);
			expect(rectangles.some(boundary => boundary.x + boundary.w >= settings.worldSize.x * 0.85), `${mapId} right`).toBe(true);
			expect(rectangles.some(boundary => boundary.y <= settings.worldSize.y * 0.15), `${mapId} top`).toBe(true);
			expect(rectangles.some(boundary => boundary.y + boundary.h >= settings.worldSize.y * 0.85), `${mapId} bottom`).toBe(true);
		}
	});

	test("planned candidates are explicit and not silently loadable", () => {
		for (const mapId of plannedMapIds) {
			const entry = getMapCatalogEntry(mapId);
			expect(entry.plannedSource).toBeDefined();
			expect(entry.browserAvailable).toBe(false);
			expect(() => buildMapSettings(mapId, createDefaultGameSettings(2, 1))).toThrow(/not loadable yet/);
		}
	});

	test("unknown map IDs are rejected by the catalog", () => {
		expect(() => getMapCatalogEntry("no-such-map")).toThrow(/Unknown map catalog ID/);
	});

	test("the report ledger matches the catalog and claims no qualification without evidence", () => {
		const report = read("docs/map-qualification-report.md");
		for (const mapId of allMapIds) {
			expect(report).toContain(`| ${mapId} | ${getMapCatalogEntry(mapId).name} |`);
		}
		// Every required inventory field appears in the report.
		for (const field of ["Source", "Schema", "Dimensions", "Symmetry", "Spawns", "Structures", "Hazards", "Friction", "Drift", "Team layouts", "Browser", "Status", "Known limitations"]) {
			expect(report).toContain(field);
		}
		// 17.8: the six qualifiable maps carry browser-qualified in both
		// the catalog and the report ledger; frostbite-arena is blocked.
		for (const mapId of allMapIds) {
			const status = getMapCatalogEntry(mapId).status;
			expect(report).toMatch(new RegExp(`\\| ${mapId} \\| .* \\| ${status} \\|`));
		}
		expect(report).not.toMatch(/\| .* \| human-qualified \|/);
	});

	test("the catalog is named by the design contract and the report", () => {
		const report = read("docs/map-qualification-report.md");
		const contract = read("docs/map-design-contract.md");
		expect(report).toContain("src/content/mapCatalog.ts");
		expect(contract).toContain("src/content/mapCatalog.ts");
	});
});

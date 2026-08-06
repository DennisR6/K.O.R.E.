import { expect, test } from "bun:test";
import { createAuroraBasinMap } from "../src/content/maps/aurora-basin.js";
import { createEmberCrossingMap } from "../src/content/maps/ember-crossing.js";
import { createLanternGatesMap } from "../src/content/maps/lantern-gates.js";
import { kore } from "../src/kore/sdk/index.js";
import { buildMapSettings, getMapCatalogEntry } from "../src/content/mapCatalog.js";
import { GameDatabase } from "../src/server/db.js";
import { MapRepository } from "../src/server/mapRepository.js";
import { createCanonicalPlayableMatchSettings } from "../src/settings/canonicalPlayableMatch.js";
import { createDefaultGameSettings, validateGameSettings } from "../src/settings/settings.js";
import { qualifyMap } from "./support/mapQualification.js";

const maps = [
	["aurora-basin", createAuroraBasinMap],
	["lantern-gates", createLanternGatesMap],
	["ember-crossing", createEmberCrossingMap],
] as const;

test("competitive SDK map documents have stable fingerprints and valid mirrored spawns", () => {
	const authoredWithoutId = () => kore.createDefaultMap({ name: "Stable Authoring Probe" })
		.addPlayerSpawn({ teamNr: 0, x: 100, y: 150, w: 120, h: 120, playerCount: 1 })
		.addPlayerSpawn({ teamNr: 1, x: 580, y: 150, w: 120, h: 120, playerCount: 1 })
		.build();
	expect(JSON.stringify(authoredWithoutId())).toBe(JSON.stringify(authoredWithoutId()));
	const template = createDefaultGameSettings(2, 1);
	for (const [id, factory] of maps) {
		const first = factory();
		const second = factory();
		expect(first.metadata.id).toBe(id);
		expect(JSON.stringify(first)).toBe(JSON.stringify(second));
		expect(first.spawnRegions.map(spawn => spawn.team)).toEqual([0, 1]);
		const settings = buildMapSettings(id, template);
		validateGameSettings(settings);
		expect(JSON.stringify(settings)).toBe(JSON.stringify(buildMapSettings(id, template)));
	}
});

test("competitive SDK maps load only through the approved repository boundary", () => {
	const database = new GameDatabase(":memory:");
	for (const [index, [id, factory]] of maps.entries()) {
		const uuid = `00000000-0000-4000-8000-${String(index + 45).padStart(12, "0")}`;
		database.createMap({ id: uuid, document: factory(), status: "approved" });
	}
	const repository = new MapRepository(database);
	for (const [, [id]] of maps.entries()) {
		const uuid = `00000000-0000-4000-8000-${String(maps.findIndex(candidate => candidate[0] === id) + 45).padStart(12, "0")}`;
		const loaded = repository.buildSettings(uuid, createCanonicalPlayableMatchSettings());
		expect(loaded.settings.mapReference?.mapId).toBe(uuid);
		expect(loaded.settings.mapReference?.contentHash).toHaveLength(64);
		expect(getMapCatalogEntry(id).source).toContain("src/content/maps/");
	}
	database.close();
});

test("competitive SDK maps satisfy the focused deterministic qualification boundary", () => {
	for (const [id] of maps) {
		const result = qualifyMap(id, { seed: 4500, maxTurns: 12 });
		expect(result.checks.schemaValid, id).toBe(true);
		expect(result.checks.finiteSpawn, id).toBe(true);
		expect(result.checks.uniqueSpawn, id).toBe(true);
		expect(result.checks.snapshotRestore, id).toBe(true);
		expect(result.checks.replayEquality, id).toBe(true);
		expect(result.fingerprint.length, id).toBeGreaterThan(0);
	}
}, 120_000);

import { expect, test } from "bun:test";
import { MapRepository } from "../src/server/mapRepository.ts";
import { GameDatabase } from "../src/server/db.ts";
import { createCueClashMap } from "../src/settings/cueClashMap.ts";
import { createCanonicalPlayableMatchSettings } from "../src/settings/canonicalPlayableMatch.ts";

const DRAFT_ID = "0b91f50e-caa9-49b3-b944-3a31a5fbcbed";
const APPROVED_ID = "4e1831d6-3480-48db-926c-6b824c192e9e";

test("repository selects only approved immutable database maps and converts them through the loader", () => {
	const database = new GameDatabase(":memory:");
	database.createMap({ id: DRAFT_ID, document: createCueClashMap({ x: 800, y: 450 }) });
	database.createMap({ id: APPROVED_ID, document: createCueClashMap({ x: 800, y: 450 }), status: "approved" });
	const repository = new MapRepository(database);
	expect(() => repository.getApproved(DRAFT_ID)).toThrow(/not approved/);
	expect(repository.listApproved().map(map => map.id)).toEqual([APPROVED_ID]);
	const { map, settings } = repository.buildSettings(APPROVED_ID, createCanonicalPlayableMatchSettings());
	expect(map.contentHash).toHaveLength(64);
	expect(settings.worldSize).toEqual({ x: 800, y: 450 });
	expect(settings.mapBoundarys.length).toBeGreaterThan(0);
	database.close();
});

test("repository rejects retired IDs while retaining their immutable stored revision", () => {
	const database = new GameDatabase(":memory:");
	database.createMap({ id: APPROVED_ID, document: createCueClashMap({ x: 800, y: 450 }), status: "approved" });
	database.retireMap(APPROVED_ID);
	const repository = new MapRepository(database);
	expect(database.getMap(APPROVED_ID)?.status).toBe("retired");
	expect(() => repository.buildSettings(APPROVED_ID, createCanonicalPlayableMatchSettings())).toThrow(/not approved/);
	database.close();
});

import { expect, test } from "bun:test";
import { GameDatabase } from "../src/server/db.ts";
import { GameRegistry } from "../src/server/gameRegistry.ts";
import { MapRepository } from "../src/server/mapRepository.ts";
import { createCueClashMap } from "../src/settings/cueClashMap.ts";
import { createCanonicalPlayableMatchSettings } from "../src/settings/canonicalPlayableMatch.ts";

const MAP_ID = "ce604168-df70-468a-bb30-2ee49368cf8f";
const USERS = ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"];

test("persisted database-map matches retain expanded settings and immutable map identity after retirement", () => {
	const database = new GameDatabase(":memory:");
	database.createMap({ id: MAP_ID, document: createCueClashMap({ x: 800, y: 450 }), status: "approved" });
	const registry = new GameRegistry(database, 1);
	const repository = new MapRepository(database);
	const record = registry.createFromApprovedMap(repository, MAP_ID, createCanonicalPlayableMatchSettings(), USERS);
	const initial = record.handler.toSettings();
	expect(initial.mapReference?.mapId).toBe(MAP_ID);
	expect(initial.mapReference?.contentHash).toHaveLength(64);

	database.retireMap(MAP_ID);
	registry.evictInactive(record.lastAccess + 2);
	const restored = registry.get(record.id)!;
	expect(restored.handler.toSettings().mapReference).toEqual(initial.mapReference);
	expect(restored.handler.toSettings().mapBoundarys).toEqual(initial.mapBoundarys);
	expect(() => repository.buildSettings(MAP_ID, createCanonicalPlayableMatchSettings())).toThrow(/not approved/);
	database.close();
});

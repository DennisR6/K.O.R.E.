import { expect, test } from "bun:test";
import { GameDatabase, hashMapDocument } from "../src/server/db.ts";
import { createCueClashMap } from "../src/settings/cueClashMap.ts";

const MAP_ID = "6d5a59aa-5726-4e3e-8627-627f8f247063";

test("database maps are immutable UUID revisions with approval and retirement lifecycle", () => {
	const db = new GameDatabase(":memory:");
	const source = createCueClashMap({ x: 800, y: 450 });
	const draft = db.createMap({ id: MAP_ID, document: source, now: 10 });
	expect(draft.status).toBe("draft");
	expect(draft.approvedAt).toBeNull();
	expect(draft.contentHash).toBe(hashMapDocument(source));

	source.metadata.name = "mutated after insert";
	expect(db.getMap(MAP_ID)!.document.metadata.name).toBe("Cue Clash");
	expect(() => db.createMap({ id: MAP_ID, document: createCueClashMap({ x: 800, y: 450 }) })).toThrow();
	expect(db.approveMap(MAP_ID, 20)).toMatchObject({ status: "approved", approvedAt: 20 });
	expect(db.listMaps("approved").map(map => map.id)).toEqual([MAP_ID]);
	expect(db.retireMap(MAP_ID).status).toBe("retired");
	expect(db.getMap(MAP_ID)!.document.metadata.name).toBe("Cue Clash");
	db.close();
});

test("database map insertion rejects malformed documents and non-UUID identities", () => {
	const db = new GameDatabase(":memory:");
	expect(() => db.createMap({ id: "not-an-id", document: createCueClashMap({ x: 800, y: 450 }) })).toThrow(/UUID/);
	const malformed = createCueClashMap({ x: 800, y: 450 });
	malformed.drift = 2;
	expect(() => db.createMap({ id: "7d5a59aa-5726-4e3e-8627-627f8f247063", document: malformed })).toThrow(/map physics/);
	const unsupportedHazard = createCueClashMap({ x: 800, y: 450 });
	unsupportedHazard.hazards.push({ schemaVersion: 1, id: "unsupported", type: "teleport", trigger: { type: "collision" }, config: { x: 10, y: 10, r: 5 } });
	expect(() => db.createMap({ id: "8d5a59aa-5726-4e3e-8627-627f8f247063", document: unsupportedHazard })).toThrow(/map hazard/);
	db.close();
});

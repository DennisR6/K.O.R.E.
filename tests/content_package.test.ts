import { expect, test } from "bun:test";
import { kore } from "../src/kore/sdk/index.js";

function packageFixture(): Record<string, unknown> {
	const left = kore.createTeam({ teamNr: 0, playerCount: 1 });
	const right = kore.createTeam({ teamNr: 1, playerCount: 1 });
	const map = kore.createDefaultMap({ id: "pkg-map", name: "Package Map" })
		.addTeam(left).addTeam(right)
		.addPlayerSpawn({ team: left, x: 20, y: 150, w: 100, h: 100 })
		.addPlayerSpawn({ team: right, x: 680, y: 150, w: 100, h: 100 })
		.buildMapDocument();
	const item = kore.createItem({ id: "pkg-item", name: "Package Item", type: "utility", effects: [{ type: "shield", value: { capacity: 1 } }] });
	return { schemaVersion: 1, manifest: { id: "pkg", name: "Package", version: "1.0.0" }, maps: [map], items: [item], modes: [{ schemaVersion: 1, id: "pkg-mode", phases: ["aim", "charge", "push", "physics"], maxItemsPerTurn: 0, winCondition: "last-team-standing", itemEconomy: { fixedLoadouts: [], mapPickups: [] } }] };
}

test("loads all gameplay documents as detached SDK data and hashes canonically", () => {
	const first = packageFixture();
	const second = { ...(packageFixture()), items: [...(packageFixture().items as unknown[])].reverse(), manifest: { version: "1.0.0", name: "Package", id: "pkg" } };
	const loaded = kore.contentPackage.load(first);
	expect(loaded.package).not.toBe(first);
	expect(kore.contentPackage.hash(first)).toBe(kore.contentPackage.hash(second));
	(first.maps as unknown[]).length = 0;
	expect(loaded.package.maps).toHaveLength(1);
});

test("rejects unknown versions, duplicates, executable fields, module paths, and unsupported references", () => {
	const base = packageFixture();
	expect(() => kore.contentPackage.load({ ...base, schemaVersion: 2 })).toThrow("Unsupported");
	const items = base.items as unknown[];
	expect(() => kore.contentPackage.load({ ...base, items: [...items, items[0]] })).toThrow("Duplicate");
	expect(() => kore.contentPackage.load({ ...base, ui: { labels: { code: "ok" }, execute: "no" } })).toThrow("Executable");
	expect(() => kore.contentPackage.load({ ...base, audio: { sounds: { shot: { asset: "./module.js" } } } })).toThrow();
	const mode = { ...(base.modes as Record<string, unknown>[])[0], itemEconomy: { fixedLoadouts: [{ team: 0, items: [{ itemId: "missing", uses: 1 }] }], mapPickups: [] } };
	expect(() => kore.contentPackage.load({ ...base, modes: [mode] })).toThrow("unknown item");
});

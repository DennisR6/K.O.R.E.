import { kore } from "../src/kore/sdk/index.js";

/** A complete data-only package containing gameplay and presentation declarations. */
export function run(): Record<string, unknown> {
	const penguins = kore.createTeam({ teamNr: 0, name: "Penguins", playerCount: 1 });
	const bears = kore.createTeam({ teamNr: 1, name: "Bears", playerCount: 1 });
	const builder = kore.createDefaultMap({ id: "example-08-map", name: "Package Arena" })
		.addTeam(penguins).addTeam(bears)
		.addPlayerSpawn({ team: penguins, x: 40, y: 180, w: 120, h: 80 })
		.addPlayerSpawn({ team: bears, x: 640, y: 180, w: 120, h: 80 });
	const item = kore.createItem({ id: "example-08-shield", name: "Shield", type: "utility", effects: [{ type: "shield", value: { capacity: 1 } }] });
	const mode = { schemaVersion: 1 as const, id: "example-08-mode", phases: ["aim", "charge", "push", "physics"] as const, maxItemsPerTurn: 0, winCondition: "last-team-standing" as const, itemEconomy: { fixedLoadouts: [], mapPickups: [] } };
	const content = {
		schemaVersion: 1 as const,
		manifest: { id: "example-08-package", name: "Package Example", version: "1.0.0" },
		maps: [builder.buildMapDocument()], items: [item], modes: [mode],
		ui: { labels: { title: "Package Arena" } },
		audio: { sounds: { confirm: { asset: "package.confirm", bus: "ui" } } },
		presentation: { animations: [{ schemaVersion: 1 as const, id: "pulse", channel: "ui", durationTicks: 1, priority: 0, interruption: "replace" as const, tracks: [{ id: "scale", keyframes: [{ tick: 0, value: 1 }, { tick: 1, value: 1.1 }] }] }] },
	};
	const loaded = kore.contentPackage.load(content);
	return { id: loaded.package.manifest.id, hash: loaded.hash, mapCount: loaded.package.maps?.length ?? 0, itemCount: loaded.package.items?.length ?? 0 };
}

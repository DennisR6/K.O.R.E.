import { describe, expect, test } from "bun:test";
import { createMatchHandler } from "../src/scenes/matchPipeline.js";
import { importModText } from "../src/mods/importMod.js";

const MOD = {
	schemaVersion: 1,
	manifest: { id: "pipeline-mod", name: "Pipeline Mod", version: "1.0.0" },
	maps: [{
		schemaVersion: 1,
		metadata: { id: "pipeline-map", name: "Pipeline Map" },
		worldSize: { x: 800, y: 450 },
		friction: { friction: 0.02, linearDrag: 0.004, stopThreshold: 0.02 },
		drift: 0,
		arenaGeometry: [{ type: 2, x: 0, y: 0, w: 800, h: 450, role: "containment", effects: [] }],
		spawnRegions: [
			{ team: 0, x: 40, y: 150, w: 120, h: 140 },
			{ team: 1, x: 640, y: 150, w: 120, h: 140 },
		],
		hazards: [],
	}],
	items: [{
		schemaVersion: 1,
		id: "pipeline-item",
		name: "Pipeline Item",
		type: "defensive",
		effects: [{ type: "shield", value: { capacity: 10 } }],
		targetType: "self",
		duration: { type: "turns", value: 1 },
		useLimit: { perTurn: 1, perGame: 1 },
	}],
	modes: [{
		schemaVersion: 1,
		id: "pipeline-mode",
		phases: ["item", "aim", "charge", "push", "physics"],
		maxItemsPerTurn: 1,
		winCondition: "last-team-standing",
		itemEconomy: { fixedLoadouts: [], mapPickups: [] },
	}],
};

function loadedMod() {
	const state = importModText(JSON.stringify(MOD), { kind: "paste" });
	if (state.status !== "valid" || !state.package) throw new Error(state.error?.message ?? "test mod failed validation");
	return state.package;
}

describe("mod match pipeline", () => {
	test("converts the first package map and carries package items and mode", () => {
		const handler = createMatchHandler({ mode: "hotseat", mapId: "pipeline-map", mod: loadedMod() });
		const settings = handler.toSettings();
		expect(settings.worldSize).toEqual({ x: 800, y: 450 });
		expect(settings.mapBoundarys.some(boundary => boundary.role === "containment")).toBe(true);
		expect(settings.items.map(item => item.id)).toEqual(["pipeline-item"]);
		expect(settings.gameMode?.id).toBe("pipeline-mode");
		handler.dispose();
	});

	test("uses the same mod content for an autonomous battle", () => {
		const handler = createMatchHandler({ mode: "ai-battle", mapId: "pipeline-map", seed: 123, mod: loadedMod() });
		const settings = handler.toSettings();
		expect(settings.items[0]?.id).toBe("pipeline-item");
		expect(settings.gameMode?.id).toBe("pipeline-mode");
		expect(handler.getMouseHandler()).toBeDefined();
		handler.dispose();
	});
});

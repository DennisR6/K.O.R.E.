import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { GAMEPLAY_CONTENT_REGISTRY } from "../src/content/gameplayContentRegistry.js";

const statuses = new Set(["qualified", "unsupported", "blocked-from-selection"]);

describe("Section 15.2 shipped gameplay inventory", () => {
	test("registry inventories the shipped maps, modes, AI, and official items", () => {
		expect(GAMEPLAY_CONTENT_REGISTRY.maps.map(map => map.id)).toEqual([
			"ice-map-v1", "cue-clash", "frostbite-arena", "magma-cradle",
		]);
		expect(GAMEPLAY_CONTENT_REGISTRY.modes.map(mode => mode.id)).toEqual(["quick-slip-v1", "power-rush-v1", "local-ice-duel-v1", "current-turn"]);
		expect(GAMEPLAY_CONTENT_REGISTRY.ai.difficulties).toEqual(["easy", "medium", "hard"]);
		expect(GAMEPLAY_CONTENT_REGISTRY.items.ids).toHaveLength(11);
		expect(GAMEPLAY_CONTENT_REGISTRY.items.ids).toContain("vodka-zero");
	});

	test("every inventory entry has an explicit release status and selection state", () => {
		for (const map of GAMEPLAY_CONTENT_REGISTRY.maps) {
			expect(statuses.has(map.status)).toBe(true);
			expect(map.selection).toBeTruthy();
		}
		for (const mode of GAMEPLAY_CONTENT_REGISTRY.modes) {
			expect(statuses.has(mode.status)).toBe(true);
			expect(mode.selection).toBeTruthy();
		}
		expect(statuses.has(GAMEPLAY_CONTENT_REGISTRY.ai.status)).toBe(true);
		for (const item of GAMEPLAY_CONTENT_REGISTRY.items.selectableSets) expect(statuses.has(item.status)).toBe(true);
		for (const platform of GAMEPLAY_CONTENT_REGISTRY.platforms) expect(statuses.has(platform.status)).toBe(true);
		for (const control of GAMEPLAY_CONTENT_REGISTRY.controls) expect(statuses.has(control.status)).toBe(true);
	});

	test("the matrix documents the registry and the selection boundary", () => {
		const matrix = readFileSync("docs/gameplay-matrix.md", "utf8");
		expect(matrix).toContain("src/content/gameplayContentRegistry.ts");
		expect(matrix).toContain("local-ice-duel-v1");
		expect(matrix).toContain("blocked-from-selection");
		expect(matrix).toContain("unsupported");
		expect(matrix).toContain("11 IDs");
	});
});

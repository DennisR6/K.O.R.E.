import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { engine, EngineSystemRegistry } from "../src/engine/sdk/index.ts";
import { kore } from "../src/kore/sdk/index.ts";
import { createDefaultGameSettings } from "../src/settings/settings.ts";

test("generic Engine SDK authors JSON worlds without importing KORE", () => {
	const world = engine.createWorld({ id: "generic-world", worldSize: { x: 320, y: 180 } })
		.setBackground({ type: "color", value: "#000" })
		.addEntity(engine.createEntity({ id: "generic-entity", capabilities: ["position"] }))
		.addStructure(engine.createStructure({ shape: "rectangle", x: 0, y: 0, w: 320, h: 180 }))
		.addEffect(engine.createEffect({ type: "example", params: { value: 1 } }))
		.addCounter(engine.createCounterState({ id: "coins" }))
		.build();
	expect(JSON.parse(engine.buildJson(world))).toEqual(world);
	expect(() => engine.validate(world)).not.toThrow();
	expect(world.counters).toEqual([{ schemaVersion: 1, id: "coins", value: 0 }]);
	for (const file of ["src/engine/sdk/index.ts", "src/engine/sdk/systemRegistry.ts", "src/engine/sdk/worldBuilder.ts"]) {
		const source = readFileSync(file, "utf8");
		expect(source).not.toMatch(/from\s+["'].*(?:kore|settings|rules|item|ai|content|server|ui|menu|scenes)[/"']/);
	}
});

test("generic system registry resolves deterministic capabilities, optional systems, and replacements", () => {
	const registry = new EngineSystemRegistry()
		.register({ id: "physics.default", provides: ["physics"] })
		.register({ id: "effects", requires: ["physics"], after: ["physics.default"] })
		.register({ id: "debug.optional", optional: true });
	const framework = registry.select(["effects"]);
	expect(framework.systemOrder).toEqual(["physics.default", "effects"]);
	expect(framework.systems.map(system => system.systemId)).toEqual(["effects", "physics.default"]);
	expect(() => registry.validate(framework)).not.toThrow();
	expect(() => registry.register({ id: "effects" })).toThrow("Duplicate");

	const replacing = new EngineSystemRegistry()
		.register({ id: "physics.default", provides: ["physics"] })
		.register({ id: "physics.deterministic", provides: ["physics"], replaces: ["physics"] })
		.register({ id: "effects", requires: ["physics"] });
	expect(replacing.select(["physics.deterministic", "effects"]).systemOrder).toEqual(["physics.deterministic", "effects"]);
});

test("KORE SDK composes generic framework metadata through the canonical entry point", () => {
	expect(kore.engine.createWorld({ id: "extension", worldSize: { x: 1, y: 1 } }).build().id).toBe("extension");
	expect(kore.createDefaultFramework().systemOrder).toEqual(["core.movement", "core.numeric", "core.participation", "core.transform", "core.playback", "core.physics", "core.boundary", "core.game-state-manager"]);
	const handler = kore.createHandler(createDefaultGameSettings(2, 1));
	expect(handler.getSystems().map(system => (system as { systemId?: string }).systemId)).toEqual(kore.createDefaultFramework().systemOrder);
});

test("SDK architecture record documents the implemented layer and stability boundaries", () => {
	const document = readFileSync("SDK_ARCHITECTURE.md", "utf8");
	for (const heading of ["Purpose", "Layer model", "Engine SDK responsibilities", "KORE SDK responsibilities", "Canonical data lifecycle", "System and capability model", "Framework composition", "Extension and generated artifacts", "Stability guarantees", "Forbidden dependency directions", "Examples"]) {
		expect(document).toContain(heading);
	}
	expect(document).toContain("src/engine/sdk");
	expect(document).toContain("src/kore/sdk");
});

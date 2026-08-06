import { engine } from "../src/engine/sdk/index.js";

/**
 * Example 01: generic Engine SDK world authoring.
 *
 * The Engine SDK (`src/engine/sdk/index.ts`) is KORE-free. It authors JSON-safe
 * worlds, entities, structures, effects, and deterministic system metadata
 * that never reference game or browser code.
 */
export function run(): Record<string, unknown> {
	const world = engine.createWorld({ id: "example-01-world", worldSize: { x: 320, y: 180 } })
		.setBackground({ type: "color", color: "#101820" })
		.addEntity(engine.createEntity({ id: "token", capabilities: ["position", "visible"] }))
		.addStructure(engine.createStructure({ id: "floor", shape: "rectangle", x: 0, y: 0, w: 320, h: 180 }))
		.addEffect(engine.createEffect({ id: "example-effect", type: "example.effect", x: 1, y: 0 }))
		.build();

	const framework = engine.createSystemRegistry()
		.register({ id: "example.physics", schemaVersion: 1, provides: ["physics"], state: {} })
		.select(["example.physics"]);

	const json = engine.buildJson(world, 2);
	return {
		id: world.id,
		worldSize: world.worldSize,
		entityCount: world.entities.length,
		structureCount: world.structures.length,
		effectCount: world.effects.length,
		systemCount: framework.systems.length,
		jsonRoundTripPreservedId: JSON.parse(json).id === world.id,
	};
}

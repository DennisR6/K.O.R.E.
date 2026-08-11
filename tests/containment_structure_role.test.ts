import { expect, test } from "bun:test";
import { Player } from "../src/entity/Player.ts";
import { createPlayerSettings } from "../src/entity/types.ts";
import { EffectMove } from "../src/effects/movement.ts";
import { EffectPhysics } from "../src/effects/physics.ts";
import { EffectTrigger } from "../src/effects/types.ts";
import { GameHandlerBuilder } from "../src/kore/runtime/Handler.ts";
import { GameSettings, validateGameSettings } from "../src/settings/settings.ts";
import { getOuterContainmentBoundaries } from "../src/structures/containment.ts";
import { FullStructure } from "../src/structures/fullStructure.ts";
import { StructureCircle } from "../src/structures/structureCircle.ts";
import { StructureLine } from "../src/structures/structureLine.ts";
import { StructureRectangle } from "../src/structures/structureRectangle.ts";
import { SHAPE } from "../src/physics/physics.ts";
import { BoundarySystem } from "../src/systems/BoundarySystem.ts";

/**
 * Engine defect hardening 12.1: an explicit structure role contract separates
 * containment geometry from filled solid obstacles. Containment boundaries
 * must be interpreted by the boundary system only and must never resolve as
 * solid obstacles unless explicitly configured to serve both roles.
 */

/** Frictionless effects so movement is purely velocity-driven. */
function driftEffects() {
	return [
		{ trigger: EffectTrigger.Always, triggerValue: [], ...new EffectMove({ typeValue: { deltaTime: 1, x: 0, y: 0 } }).toSettings() },
		{ trigger: EffectTrigger.Always, triggerValue: [], ...new EffectPhysics({ typeValue: { friction: 1, linearDrag: 0, stopThreshold: 0 } }).toSettings() },
	];
}

/** Handler with boundary elimination plus the default physics/playback systems. */

test("a stationary player inside a default-role arena rect stays exactly fixed", () => {
	const player = new Player(createPlayerSettings({
		position: { x: 50, y: 80 },
		size: 10,
		velocity: { x: 0, y: 0 },
		effects: driftEffects(),
	}));
	const handler = new GameHandlerBuilder()
		.defaultSystems()
		.addSystem(new BoundarySystem())
		.addStructure(new StructureRectangle(0, 0, 100, 100))
		.addStructure(new StructureCircle(50, 50, 1, undefined, []))
		.addPlayer(player)
		.build();
	for (let frame = 0; frame < 100; frame++) handler.tick();
	// Regression: the arena rect used to resolve as a filled obstacle and push
	// the entity upward ~2 world units per tick. Containment must not move it.
	expect(player.getPos()).toEqual({ x: 50, y: 80 });
});

test("a moving player inside a default-role arena rect is not pushed by it", () => {
	const player = new Player(createPlayerSettings({
		position: { x: 30, y: 20 },
		size: 10,
		velocity: { x: 5, y: 0 },
		effects: driftEffects(),
	}));
	const handler = new GameHandlerBuilder()
		.defaultSystems()
		.addSystem(new BoundarySystem())
		.addStructure(new StructureRectangle(0, 0, 100, 100))
		.addStructure(new StructureCircle(50, 50, 1, undefined, []))
		.addPlayer(player)
		.build();
	for (let frame = 0; frame < 10; frame++) handler.tick();
	// Pure velocity integration: x advances exactly 5 per tick, y untouched.
	expect(player.getPos()).toEqual({ x: 80, y: 20 });
});

test("a player that leaves the default-role arena dies at the actual boundary", () => {
	const player = new Player(createPlayerSettings({
		position: { x: 30, y: 95 },
		size: 5,
		velocity: { x: 0, y: -5 },
		effects: driftEffects(),
	}));
	const handler = new GameHandlerBuilder()
		.defaultSystems()
		.addSystem(new BoundarySystem())
		.addStructure(new StructureRectangle(0, 0, 100, 100))
		.addStructure(new StructureCircle(50, 50, 1, undefined, []))
		.addPlayer(player)
		.build();
	// y=5 is still fully inside (5-5 >= 0); the next tick exits the arena.
	for (let frame = 0; frame < 20; frame++) handler.tick();
	expect(player.isDead()).toBe(true);
	expect(player.getPos().y).toBeLessThan(5);
});

test("an explicit containment circle is a boundary even without enclosing structures", () => {
	const small = new StructureCircle(50, 50, 30, undefined, [], "containment");
	expect(getOuterContainmentBoundaries([small])).toEqual([small]);
});

test("an explicit solid role overrides the outer-boundary heuristic", () => {
	const outer = new StructureRectangle(0, 0, 100, 100, undefined, [], "solid");
	const inner = new StructureCircle(50, 50, 5, undefined, []);
	expect(getOuterContainmentBoundaries([outer, inner])).toEqual([]);
});

test("an explicit both role serves containment and stays solid", () => {
	const outer = new StructureRectangle(0, 0, 100, 100, undefined, [], "both");
	const inner = new StructureCircle(50, 50, 5, undefined, []);
	expect(getOuterContainmentBoundaries([outer, inner])).toEqual([outer]);

	// The both-role rect still pushes an embedded entity (filled), while the
	// boundary system also kills players that leave it. The exact interior
	// exit direction is covered by the 12.2 collision tests.
	const player = new Player(createPlayerSettings({
		position: { x: 50, y: 80 },
		size: 10,
		velocity: { x: 0, y: 0 },
		effects: driftEffects(),
	}));
	const handler = new GameHandlerBuilder()
		.defaultSystems()
		.addSystem(new BoundarySystem())
		.addStructure(outer)
		.addStructure(inner)
		.addPlayer(player)
		.build();
	handler.tick();
	expect(player.getPos()).not.toEqual({ x: 50, y: 80 });
});

test("a solid rectangle still resolves overlap for embedded entities", () => {
	const player = new Player(createPlayerSettings({
		position: { x: 50, y: 50 },
		size: 10,
		velocity: { x: 0, y: 0 },
		effects: driftEffects(),
	}));
	const handler = new GameHandlerBuilder()
		.defaultSystems()
		.addStructure(new StructureRectangle(45, 45, 10, 10, undefined, [], "solid"))
		.addPlayer(player)
		.build();
	handler.tick();
	// The embedded circle must be depenetrated by the solid rect; the exact
	// nearest-edge exit semantics are asserted by the 12.2 tests.
	expect(player.getPos()).not.toEqual({ x: 50, y: 50 });
});

test("line segments are never containment boundaries", () => {
	const line = new StructureLine(0, 0, 100, 0, "black");
	expect(getOuterContainmentBoundaries([line])).toEqual([]);
});

test("the structure role round-trips through settings serialization", () => {
	const settings: GameSettings = {
		...GameSettings,
		mapBoundarys: [
			{ id: "role-circle", type: SHAPE.CIRCLE, x: 10, y: 10, r: 5, color: undefined, effects: [], role: "containment", physicsEnabled: true, drawingEnabled: true },
			{ id: "role-both", type: SHAPE.RECTANGLE, x: 0, y: 0, w: 100, h: 100, color: undefined, effects: [], role: "both", physicsEnabled: true, drawingEnabled: true },
			{ id: "role-plain", type: SHAPE.RECTANGLE, x: 200, y: 200, w: 10, h: 10, color: undefined, effects: [], physicsEnabled: true, drawingEnabled: true },
		],
	};
	expect(() => validateGameSettings(settings)).not.toThrow();
	const wrapped = settings.mapBoundarys.map(boundary => new FullStructure(boundary));
	expect(wrapped.map(structure => structure.getCollisionRole())).toEqual(["containment", "both", undefined]);
	expect(wrapped.map(structure => structure.toSettings())).toEqual(settings.mapBoundarys);
});

test("validateGameSettings rejects unknown structure roles", () => {
	const settings: GameSettings = {
		...GameSettings,
		mapBoundarys: [{ type: SHAPE.RECTANGLE, x: 0, y: 0, w: 100, h: 100, effects: [], role: "wall" as never }],
	};
	expect(() => validateGameSettings(settings)).toThrow("Invalid map boundary settings");
});

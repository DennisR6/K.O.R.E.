import { expect, test } from "bun:test";
import { createCollisionCommandBinding } from "../src/engine/sdk/collisionCommand.js";
import { createEngineEffectComposition } from "../src/engine/sdk/composition.js";
import { MOVEMENT_ADD_VELOCITY_EFFECT_ID } from "../src/engine/sdk/movementCapability.js";
import { PARTICIPATION_SET_DRAWING_EFFECT_ID, PARTICIPATION_SET_PHYSICS_EFFECT_ID } from "../src/engine/sdk/participationCapability.js";
import { GameHandlerBuilder } from "../src/engine/Handler.js";
import { createPlayerSettings } from "../src/entity/types.js";
import { Player } from "../src/entity/Player.js";
import { StructureCircle } from "../src/structures/structureCircle.js";
import { EffectTrigger, EffectType, SettingOperation } from "../src/effects/types.js";

function binding(effect: Parameters<typeof createCollisionCommandBinding>[0]) {
	return createCollisionCommandBinding(effect);
}

function runVelocityAdd(bindingOrLegacy: "current" | "legacy"): { x: number; y: number } {
	const player = new Player(createPlayerSettings({ position: { x: 25, y: 20 }, velocity: { x: 1, y: 4 } }));
	const structure = bindingOrLegacy === "current"
		? new StructureCircle(20, 20, 10, "red", [], "solid", `velocity-${bindingOrLegacy}`, true, true, [binding({ schemaVersion: 1, type: MOVEMENT_ADD_VELOCITY_EFFECT_ID, typeValue: { x: 3, y: -2 } })])
		: new StructureCircle(20, 20, 10, "red", [{ schemaVersion: 1, trigger: EffectTrigger.Collision, triggerValue: [], type: EffectType.ModifySetting, typeValue: { operation: SettingOperation.Add, key: "velocity", value: { x: 3, y: -2 } } }], "solid", `velocity-${bindingOrLegacy}`, true, true);
	const handler = new GameHandlerBuilder().defaultSystems().addStructure(structure).addPlayer(player).build();
	handler.tick();
	return player.getVel();
}

test("movement collision command preserves legacy velocity-add arithmetic", () => {
	expect(runVelocityAdd("current")).toEqual(runVelocityAdd("legacy"));
});

test("collision command host routes a relative movement command to the colliding entity", () => {
	const player = new Player(createPlayerSettings({ position: { x: 25, y: 20 }, velocity: { x: 0, y: 0 } }));
	const structure = new StructureCircle(20, 20, 10, "red", [], "solid", "collision-movement", true, true, [binding({
		schemaVersion: 1,
		type: MOVEMENT_ADD_VELOCITY_EFFECT_ID,
		typeValue: { x: 3, y: -2 },
	})]);
	const handler = new GameHandlerBuilder().defaultSystems().addStructure(structure).addPlayer(player).build();

	handler.tick();

	expect(player.getVel()).toEqual({ x: 3, y: -2 });
});

test("collision command host preserves composition order and suppresses persistent re-entry", () => {
	const player = new Player(createPlayerSettings({ position: { x: 25, y: 20 }, velocity: { x: 0, y: 0 } }));
	const structure = new StructureCircle(20, 20, 10, "red", [], "solid", "collision-participation", true, true, [binding(createEngineEffectComposition([
		{ schemaVersion: 1, type: MOVEMENT_ADD_VELOCITY_EFFECT_ID, typeValue: { x: 3, y: 0 } },
		{ schemaVersion: 1, type: PARTICIPATION_SET_PHYSICS_EFFECT_ID, typeValue: { enabled: false } },
		{ schemaVersion: 1, type: PARTICIPATION_SET_DRAWING_EFFECT_ID, typeValue: { enabled: false } },
	]))]);
	const handler = new GameHandlerBuilder().defaultSystems().addStructure(structure).addPlayer(player).build();

	const before = handler.toSettings();
	handler.tick();
	const after = handler.toSettings();
	handler.tick();

	expect(player.getVel()).toEqual({ x: 3, y: 0 });
	expect(player.isDead()).toBe(true);
	expect(after.mapBoundarys[0]!.collisionCommands).toEqual(before.mapBoundarys[0]!.collisionCommands);
	expect(player.getVel()).toEqual({ x: 3, y: 0 });
});

test("collision command bindings remain relative and survive structure snapshots", () => {
	const command = binding({ schemaVersion: 1, type: PARTICIPATION_SET_PHYSICS_EFFECT_ID, typeValue: { enabled: false } });
	const structure = new StructureCircle(40, 40, 10, "red", [], "solid", "collision-snapshot", true, true, [command]);
	const snapshot = structure.toSettings();

	expect(snapshot.collisionCommands).toEqual([{ schemaVersion: 1, type: "collision.command", effect: { schemaVersion: 1, type: PARTICIPATION_SET_PHYSICS_EFFECT_ID, typeValue: { enabled: false } } }]);
	expect(snapshot.collisionCommands?.[0]?.effect).not.toHaveProperty("target");
});

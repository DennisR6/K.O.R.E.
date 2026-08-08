import { expect, test } from "bun:test";
import { GameHandlerBuilder } from "../src/engine/Handler.ts";
import { Player } from "../src/entity/Player.ts";
import { createPlayerSettings } from "../src/entity/types.ts";
import { EffectModifyForce, applyForceModifiers } from "../src/effects/modifyForce.ts";
import { EffectModifyRotation, applyRotationModifiers } from "../src/effects/modifyRotation.ts";
import { EffectLockRotation } from "../src/effects/lockRotation.ts";
import { advanceTemporalModifier, createTemporalModifier } from "../src/engine/contracts/temporalModifier.ts";
import { advanceStructureLifecycle, createStructureLifecycle } from "../src/engine/contracts/structureLifecycle.ts";
import { EffectGhostMode } from "../src/effects/ghostMode.ts";
import { EffectSelectionLock } from "../src/effects/selectionLock.ts";
import { EffectSpawnTrigger } from "../src/effects/spawnTrigger.ts";
import { createOfficialItemLoader } from "../src/item/officialItems.ts";
import { EffectTrigger, EffectType } from "../src/effects/types.ts";

test("mixed effect stacking and conflict resolution behave deterministically", () => {
	// Stacking force multipliers (e.g. Anker 0.5 * Power-Dash 1.5 = 0.75)
	const forceRes = applyForceModifiers({ angle: 0, power: 10 }, [
		new EffectModifyForce({ typeValue: { factor: 0.5 } }),
		new EffectModifyForce({ typeValue: { factor: 1.5 } }),
	]);
	expect(forceRes.power).toBe(7.5);
	expect(forceRes.angle).toBe(0);

	// Stacking rotation modifiers
	const rotRes = applyRotationModifiers(350, [
		new EffectModifyRotation({ typeValue: { degrees: 20 } }),
		new EffectModifyRotation({ typeValue: { degrees: 30 } }),
	]);
	expect(rotRes).toBe(40);
});

test("mixed effect cleanup and expiration across turn progression", () => {
	const freeze = createTemporalModifier({ id: "target:freeze:0", target: { type: "entity", entityId: "target" }, effect: { schemaVersion: 1, type: "movement.scale-speed", typeValue: { factor: 0.5 }, target: { type: "entity", entityId: "target" } }, durationUnit: "turns", duration: 2 });
	const ghost = new EffectGhostMode({ typeValue: { durationTurns: 1 } });
	const lockRot = new EffectLockRotation({ typeValue: { durationTurns: 2 } });
	const selLock = new EffectSelectionLock({ typeValue: { durationTurns: 1 } });
	const wall = createStructureLifecycle({ id: "wall1:lifecycle", structureId: "wall1", durationUnit: "turns", duration: 2 });
	const trigger = new EffectSpawnTrigger({ typeValue: { triggerId: "trig1", delayTurns: 1 } });

	expect(freeze.remaining).toBe(2);
	expect(ghost.isActive()).toBe(true);
	expect(lockRot.isLocked()).toBe(true);
	expect(selLock.isLocked()).toBe(true);
	expect(trigger.hasFired()).toBe(false);

	// Advance turn 1
	const freezeAfterOne = advanceTemporalModifier(freeze)!;
	ghost.advanceTurn();
	lockRot.advanceTurn();
	selLock.advanceTurn();
	expect(trigger.advanceTurn()).toBe(true);

	expect(freezeAfterOne.remaining).toBe(1);
	expect(ghost.isActive()).toBe(false);
	expect(lockRot.isLocked()).toBe(true);
	expect(selLock.isLocked()).toBe(false);
	expect(advanceStructureLifecycle(wall)?.remaining).toBe(1);
	expect(trigger.hasFired()).toBe(true);

	// Advance turn 2
	const freezeAfterTwo = advanceTemporalModifier(freezeAfterOne);
	lockRot.advanceTurn();
	expect(advanceStructureLifecycle(advanceStructureLifecycle(wall)!) ).toBeUndefined(); // expires

	expect(freezeAfterTwo).toBeUndefined();
	expect(lockRot.isLocked()).toBe(false);
});

test("serialization round-trip and replay regression for mixed items and effects", () => {
	const loader = createOfficialItemLoader();
	expect(loader.getSource("anker")).toBe("built-in");
	expect(loader.getSource("jaegermeister-elixier")).toBe("built-in");

	const player = new Player(createPlayerSettings({
		position: { x: 100, y: 100 },
		rotation: 45,
		inventory: [{ itemId: "anker", remainingUses: 2, usesThisTurn: 0 }],
			effects: [
				{ schemaVersion: 1, type: EffectType.Movement, typeValue: { deltaTime: 0, x: 0, y: 0 }, trigger: EffectTrigger.Always, triggerValue: [] },
			],
	}));

	const handler = new GameHandlerBuilder().defaultSystems().addPlayer(player).build();
	const snapshot = handler.toSettings();

	const restored = new GameHandlerBuilder().defaultSystems().fromSettings(snapshot).build();
	expect(restored.toSettings()).toEqual(snapshot);

	const shotResult = handler.simulateTurn(player.getId(), 90, 5);
	expect(shotResult.actorId).toBe(player.getId());
	expect(shotResult.durationFrames).toBeGreaterThanOrEqual(0);
});

import { expect, test } from "bun:test";
import { GameHandlerBuilder } from "../src/engine/Handler.ts";
import { createPlayerSettings } from "../src/entity/types.ts";
import { Player } from "../src/entity/Player.ts";
import { NumericSystem } from "../src/systems/NumericSystem.ts";
import { ParticipationSystem } from "../src/systems/ParticipationSystem.ts";
import { NUMERIC_ADD_EFFECT_ID, NUMERIC_SET_EFFECT_ID } from "../src/engine/sdk/numericCapability.ts";
import { PARTICIPATION_SET_DRAWING_EFFECT_ID, PARTICIPATION_SET_PHYSICS_EFFECT_ID } from "../src/engine/sdk/participationCapability.ts";
import { MOVEMENT_SET_VELOCITY_EFFECT_ID } from "../src/engine/sdk/movementCapability.ts";
import { NUMERIC_RESET_EFFECT_ID } from "../src/engine/sdk/numericCapability.ts";
import type { NumericThresholdBinding, NumericThresholdEffect } from "../src/engine/contracts/numericState.ts";

function eliminationThreshold(resetValue?: number): NumericThresholdBinding {
	const effects: NumericThresholdEffect[] = [
		{ schemaVersion: 1, type: MOVEMENT_SET_VELOCITY_EFFECT_ID, typeValue: { x: 0, y: 0 } },
		{ schemaVersion: 1, type: PARTICIPATION_SET_PHYSICS_EFFECT_ID, typeValue: { enabled: false } },
		{ schemaVersion: 1, type: PARTICIPATION_SET_DRAWING_EFFECT_ID, typeValue: { enabled: false } },
	];
	return {
		schemaVersion: 1 as const,
		id: "hp",
		...(resetValue === undefined ? {} : { resetValue }),
		thresholds: [{
			schemaVersion: 1 as const,
			comparator: "below-or-equal" as const,
			value: 0,
			effects,
		}],
	};
}

test("numeric threshold mutation dispatches an ordered relative composition", () => {
	const player = createPlayerSettings({ numericThresholds: [eliminationThreshold()], velocity: { x: 4, y: -2 } });
	const handler = new GameHandlerBuilder()
		.defaultSystems()
		.addSystem(new NumericSystem())
		.addSystem(new ParticipationSystem())
		.addPlayer(new Player(player))
		.build();

	handler.dispatchEngineEffect({
		schemaVersion: 1,
		type: NUMERIC_ADD_EFFECT_ID,
		target: { type: "numeric", entityId: player.id, stateId: "hp" },
		typeValue: { amount: -30 },
	});

	const target = handler.getEntityManager().getEntities()[0]!;
	expect(target.getHP()).toBe(0);
	expect(target.physicsEnabled()).toBe(false);
	expect(target.drawingEnabled()).toBe(false);
	expect(target.getVel()).toEqual({ x: 0, y: 0 });
});

test("numeric reset uses a canonical non-zero resetValue and crosses thresholds", () => {
	const player = createPlayerSettings({ hp: 10, numericThresholds: [eliminationThreshold(-5)] });
	const handler = new GameHandlerBuilder().defaultSystems().addSystem(new NumericSystem()).addSystem(new ParticipationSystem()).addPlayer(new Player(player)).build();

	handler.dispatchEngineEffect({ schemaVersion: 1, type: NUMERIC_RESET_EFFECT_ID, target: { type: "numeric", entityId: player.id, stateId: "hp" }, typeValue: {} });

	const target = handler.getEntityManager().getEntities()[0]!;
	expect(target.getHP()).toBe(-5);
	expect(target.isDead()).toBe(true);
});

test("numeric reset rejects a state without resetValue", () => {
	const player = createPlayerSettings({ numericThresholds: [eliminationThreshold()] });
	const handler = new GameHandlerBuilder().defaultSystems().addSystem(new NumericSystem()).addPlayer(new Player(player)).build();

	expect(() => handler.dispatchEngineEffect({ schemaVersion: 1, type: NUMERIC_RESET_EFFECT_ID, target: { type: "numeric", entityId: player.id, stateId: "hp" }, typeValue: {} })).toThrow(/resetValue/);
});

test("numeric resetValue must be finite", () => {
	expect(() => createPlayerSettings({ numericThresholds: [{ schemaVersion: 1, id: "hp", resetValue: Number.POSITIVE_INFINITY, thresholds: [] }] })).toThrow(/finite/);
});

test("numeric resetValue survives PlayerSettings snapshot restore", () => {
	const player = createPlayerSettings({ numericThresholds: [eliminationThreshold(7)] });
	const restored = new Player(new Player(player).toSettings());

	expect(restored.toSettings().numericThresholds?.[0]?.resetValue).toBe(7);
});

test("numeric thresholds fire on crossings, not persistent conditions, and re-arm after re-entry", () => {
	const player = createPlayerSettings({ numericThresholds: [{ schemaVersion: 1, id: "hp", thresholds: [{ schemaVersion: 1, comparator: "below-or-equal", value: 0, effects: [{ schemaVersion: 1, type: MOVEMENT_SET_VELOCITY_EFFECT_ID, typeValue: { x: 0, y: 0 } }] }] }] });
	const runtime = new Player(player);
	const handler = new GameHandlerBuilder().defaultSystems().addSystem(new NumericSystem()).addSystem(new ParticipationSystem()).addPlayer(runtime).build();
	const target = handler.getEntityManager().getEntities()[0]!;
	const add = (amount: number) => handler.dispatchEngineEffect({ schemaVersion: 1, type: NUMERIC_ADD_EFFECT_ID, target: { type: "numeric", entityId: player.id, stateId: "hp" }, typeValue: { amount } });
	const set = (value: number) => handler.dispatchEngineEffect({ schemaVersion: 1, type: NUMERIC_SET_EFFECT_ID, target: { type: "numeric", entityId: player.id, stateId: "hp" }, typeValue: { value } });

	add(-30);
	target.setVel({ x: 7, y: 3 });
	add(-5);
	expect(target.getVel()).toEqual({ x: 7, y: 3 });

	set(10);
	add(-10);
	expect(target.getVel()).toEqual({ x: 0, y: 0 });
});

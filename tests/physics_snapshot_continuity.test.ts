import { describe, expect, test } from "bun:test";
import { GameHandlerBuilder } from "../src/engine/Handler.ts";
import type { EngineSettings } from "../src/engine/types.ts";
import { EffectTrigger, EffectType, SettingOperation } from "../src/effects/types.ts";
import { SHAPE } from "../src/physics/physics.ts";
import { createDefaultGameSettings } from "../src/settings/settings.ts";

function collisionDamage(damage: number) {
	return [{ schemaVersion: 1 as const, type: EffectType.NumericAdd, typeValue: { stateId: "hp", amount: -damage }, trigger: EffectTrigger.Collision, triggerValue: [] }];
}

function physicsFixture(): ReturnType<typeof createDefaultGameSettings> {
	const settings = createDefaultGameSettings(2, 1);
	settings.screenResolution = { x: 800, y: 450 };
	settings.worldSize = { x: 800, y: 450 };
	settings.friction = { friction: 1, linearDrag: 0, stopThreshold: 0.01 };
	settings.players[0]!.position = { x: 100, y: 100 };
	settings.players[0]!.size = 10;
	settings.players[1]!.position = { x: 650, y: 350 };
	settings.players[1]!.size = 10;
	settings.mapBoundarys = [
		{ type: SHAPE.RECTANGLE, x: 0, y: 0, w: 800, h: 450, role: "containment", effects: [] },
		{ type: SHAPE.LINE, x: 300, y: 0, x2: 300, y2: 450, color: "black", effects: [] },
		{ type: SHAPE.CIRCLE, x: 115, y: 100, r: 10, role: "solid", effects: collisionDamage(4) },
		{ type: SHAPE.CIRCLE, x: 115, y: 100, r: 10, role: "solid", effects: collisionDamage(3) },
	];
	return settings;
}

function restore(snapshot: EngineSettings) {
	return new GameHandlerBuilder().defaultSystems().fromSettings(JSON.parse(JSON.stringify(snapshot))).build();
}

function expectIdenticalContinuation(original: ReturnType<typeof restore>, restored: ReturnType<typeof restore>, ticks: number) {
	for (let tick = 0; tick < ticks; tick++) {
		original.tick();
		restored.tick();
		expect(restored.toSettings()).toEqual(original.toSettings());
	}
}

describe("physics snapshot continuity (13.9)", () => {
	test("restores high-speed movement before a line impact with its configured tick rate", () => {
		const handler = new GameHandlerBuilder().defaultSystems().fromSettings(physicsFixture()).build();
		handler.setTickRate(0.016);
		handler.getEntityManager().getEntities()[0]!.setVel({ x: 12_000, y: 0 });
		const snapshot = handler.toSettings();
		const restored = restore(snapshot);

		expect(restored.getTickRate()).toBe(0.016);
		expect(restored.toSettings().mapBoundarys[1]!.type).toBe(SHAPE.LINE);
		expectIdenticalContinuation(handler, restored, 4);
		expect(handler.getEntityManager().getEntities()[0]!.getPos().x).toBeLessThan(300);
	});

	test("restores persistent collision lifecycle state without reapplying effects", () => {
		const handler = new GameHandlerBuilder().defaultSystems().fromSettings(physicsFixture()).build();
		handler.tick();
		const player = handler.getEntityManager().getEntities()[0]!;
		expect(player.getHP()).toBe(23);
		const snapshot = handler.toSettings();
		expect(snapshot.physicsState?.activePairs).toHaveLength(2);
		const restored = restore(snapshot);

		expect(restored.toSettings()).toEqual(snapshot);
		expectIdenticalContinuation(handler, restored, 2);
		expect(player.getHP()).toBe(23);
	});

	test("preserves entry, separation, and re-entry state across a snapshot", () => {
		const handler = new GameHandlerBuilder().defaultSystems().fromSettings(physicsFixture()).build();
		handler.tick();
		const snapshot = handler.toSettings();
		const restored = restore(snapshot);
		const originalPlayer = handler.getEntityManager().getEntities()[0]!;
		const restoredPlayer = restored.getEntityManager().getEntities()[0]!;

		originalPlayer.setPos({ x: 500, y: 100 });
		restoredPlayer.setPos({ x: 500, y: 100 });
		expectIdenticalContinuation(handler, restored, 1);
		expect(handler.toSettings().physicsState?.activePairs).toEqual([]);

		originalPlayer.setPos({ x: 100, y: 100 });
		restoredPlayer.setPos({ x: 100, y: 100 });
		expectIdenticalContinuation(handler, restored, 1);
		expect(originalPlayer.getHP()).toBe(16);
	});

	test("rejects malformed, duplicate, unknown, and stale contact snapshots", () => {
		const handler = new GameHandlerBuilder().defaultSystems().fromSettings(physicsFixture()).build();
		handler.tick();
		const snapshot = handler.toSettings();
		const invalid = (activePairs: unknown) => ({ ...snapshot, physicsState: { activePairs } } as unknown as EngineSettings);

		expect(() => restore(invalid("not-an-array"))).toThrow("Invalid physics contact snapshot");
		expect(() => restore(invalid(["entity:unknown|structure:1"]))).toThrow("Invalid physics contact snapshot pair");
		expect(() => restore(invalid([snapshot.physicsState!.activePairs[0], snapshot.physicsState!.activePairs[0]]))).toThrow("Invalid physics contact snapshot pair");
		expect(() => restore(invalid(["entity:00000000-0000-0000-0000-000000000000|structure:1"]))).toThrow("Invalid physics contact snapshot pair");
	});
});

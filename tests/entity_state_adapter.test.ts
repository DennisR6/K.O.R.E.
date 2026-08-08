import { expect, test } from "bun:test";
import { createPlayerSettings } from "../src/entity/types.ts";
import { Player } from "../src/entity/Player.ts";
import { applyEngineStateToPlayer, playerToEngineState } from "../src/entity/stateAdapter.ts";

test("Player state adapter round-trips generic Transform and Movement state", () => {
	const source = new Player(createPlayerSettings({ position: { x: 10, y: 20 }, velocity: { x: 2, y: -1 }, rotation: 45, angularVelocity: 3, isPhysicsEnabled: false }));
	const state = playerToEngineState(source);
	const restored = new Player(createPlayerSettings());

	applyEngineStateToPlayer(restored, structuredClone(state));

	expect(playerToEngineState(restored)).toEqual(state);
});

test("adapter changes only the mapped runtime fields", () => {
	const player = new Player(createPlayerSettings({ hp: 12, team: [1] }));
	applyEngineStateToPlayer(player, {
		transform: { schemaVersion: 1, position: { x: 4, y: 5 }, rotation: 90 },
		movement: { schemaVersion: 1, velocity: { x: 1, y: 2 }, angularVelocity: 0, enabled: true },
	});

	const settings = player.toSettings();
	expect(settings.position).toEqual({ x: 4, y: 5 });
	expect(settings.velocity).toEqual({ x: 1, y: 2 });
	expect(settings.hp).toBe(12);
	expect(settings.team).toEqual([1]);
});

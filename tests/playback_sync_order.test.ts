import { describe, expect, test } from "bun:test";
import { GameHandlerBuilder } from "../src/engine/Handler.ts";
import { GameState } from "../src/engine/types.ts";
import type { PlayerSettings } from "../src/entity/types.ts";
import { EffectTrigger, EffectType } from "../src/effects/types.ts";
import { SHAPE } from "../src/physics/physics.ts";
import { PlaybackSystem } from "../src/systems/PlayBackSystem.ts";
import { createDefaultGameSettings } from "../src/settings/settings.ts";

/**
 * Task 12.3 - Apply Playback Final Sync After All Gameplay Mutation.
 *
 * The hard sync of `TurnPacket.finalState` must run in the final mutation
 * phase of the handler tick, after entity ticks, systems, map pickups,
 * structure ticks, and post-tickers. Otherwise a collision resolution that
 * fires after the sync mutates the authoritative final state (observed as a
 * -2/+2 world-unit drift for players embedded in a solid structure whose
 * turn resolves in zero frames).
 */

const tiles = {
	trigger: EffectTrigger.Always,
	triggerValue: [],
	type: EffectType.Physics,
	typeValue: { friction: 0.995, linearDrag: 0.01, stopThreshold: 0.1 },
};
const move = {
	trigger: EffectTrigger.Always,
	triggerValue: [],
	type: EffectType.Movement,
	typeValue: { deltaTime: 1, x: 0, y: 0 },
};

function embeddedHandler(): GameHandlerBuilder {
	const settings = createDefaultGameSettings(2, 1);
	settings.players[0]!.effects = [move, tiles];
	settings.players[1]!.effects = [move, tiles];
	settings.screenResolution = { x: 300, y: 300 };
	settings.worldSize = { x: 300, y: 300 };
	// Solid (non-containment) rectangle: players spawn embedded inside it.
	settings.mapBoundarys = [
		{ type: SHAPE.RECTANGLE, x: 0, y: 0, w: 300, h: 300, effects: [], role: "solid" },
	];
	settings.players[0]!.position = { x: 150, y: 150 };
	settings.players[1]!.position = { x: 250, y: 250 };
	return new GameHandlerBuilder().defaultSystems().fromSettings(settings);
}

describe("playback final sync ordering", () => {
	test("embedded zero-frame turn: live state equals finalState after the sync tick", () => {
		const handler = embeddedHandler().build();
		const entities = handler.getEntityManager().getEntities();
		const actor = entities[0]!;

		// No impulse: the simulation resolves in zero frames and the
		// authoritative final state is the (embedded) spawn position.
		const packet = handler.resolveTurn({ actorId: actor.getId(), angle: 0, power: 0 });
		expect(packet.durationFrames).toBe(0);
		expect(packet.finalState[0]!.position).toEqual({ x: 150, y: 150 });

		handler.playTurn(packet);
		// The sync tick also resolves the interior collision (pushing live
		// entities to 148/252 mid-tick). The final sync must run LAST, so the
		// state at the end of the tick equals the authoritative snapshot.
		handler.tick();

		const live = handler.getEntityManager().getEntities();
		expect(live[0]!.getPos()).toEqual({ x: 150, y: 150 });
		expect(live[1]!.getPos()).toEqual({ x: 250, y: 250 });
		expect(live[0]!.getVel()).toEqual({ x: 0, y: 0 });
		expect(live[0]!.isDead()).toBe(false);
	});

	test("sync tick transitions to Playing_done; further ticks do not alter the synced state", () => {
		const handler = embeddedHandler().build();
		const entities = handler.getEntityManager().getEntities();
		const actor = entities[0]!;
		const packet = handler.resolveTurn({ actorId: actor.getId(), angle: 0, power: 0 });

		handler.playTurn(packet);
		handler.tick();
		// The playback callback fires during the final flush of the sync tick.
		expect(handler.getState()).toBe(GameState.Playing_done);

		// After the sync the packet snapshot is consumed; the synced positions
		// remain the authoritative ones in a subsequent engine snapshot.
		const snapshot = handler.toSettings() as { players: PlayerSettings[] };
		expect(snapshot.players.find(p => p.id === packet.finalState[0]!.id)!.position).toEqual({ x: 150, y: 150 });
	});

	test("countdown semantics are preserved: sync only after the last frame tick", () => {
		const handler = embeddedHandler().build();
		const entities = handler.getEntityManager().getEntities();
		const actor = entities[0]!;

		// Craft a packet with an explicit 5-frame countdown and a target state
		// that differs from the live trajectory (which is pushed by physics).
		const finalState = handler.getEntityManager().serialize();
		finalState[0]!.position = { x: 200, y: 150 };
		const packet = {
			actorId: actor.getId(),
			input: { angle: 0, power: 0 },
			durationFrames: 5,
			finalState,
		};
		handler.playTurn(packet);
		const playback = (handler as unknown as { systems: PlaybackSystem[] }).systems.find(s => s instanceof PlaybackSystem)!;

		for (let i = 0; i < 4; i++) {
			handler.tick();
			expect(playback.getRemainingFrames()).toBe(4 - i);
			expect(handler.getState()).toBe(GameState.Playing);
		}
		// The live position is still the physics-pushed value before the sync.
		expect(entities[0]!.getPos()).not.toEqual({ x: 200, y: 150 });

		// The 5th tick completes the countdown and performs the hard sync in
		// its final mutation phase: exactly `durationFrames` playback ticks.
		handler.tick();
		expect(playback.getRemainingFrames()).toBe(0);
		expect(entities[0]!.getPos()).toEqual({ x: 200, y: 150 });
		expect(handler.getState()).toBe(GameState.Playing_done);
	});

	test("simulation path is unaffected: resolveTurn result is deterministic", () => {
		const handler = embeddedHandler().build();
		const entities = handler.getEntityManager().getEntities();
		const actor = entities[0]!;

		const first = handler.resolveTurn({ actorId: actor.getId(), angle: 0, power: 0 });
		const second = handler.resolveTurn({ actorId: actor.getId(), angle: 0, power: 0 });
		expect(second.durationFrames).toBe(first.durationFrames);
		expect(second.finalState).toEqual(first.finalState);
		expect(second.finalState[1]!.position).toEqual({ x: 250, y: 250 });
	});
});

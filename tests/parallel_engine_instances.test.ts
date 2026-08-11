import { describe, expect, test } from "bun:test";
import { GameHandlerBuilder } from "../src/kore/runtime/Handler.ts";
import { GameState } from "../src/kore/runtime/types.ts";
import { createDefaultGameSettings } from "../src/settings/settings.ts";

/**
 * Cross-system validation 11.5: independent engine instances built from the
 * same settings must evolve identically under identical turns, never share
 * mutable state, and diverge only by the turns applied to them.
 */
describe("Parallel Engine Instances", () => {
	test("independent handlers built from identical settings evolve identically", () => {
		const settings = createDefaultGameSettings(2, 2);
		const handlerA = new GameHandlerBuilder().defaultSystems().fromSettings(settings).build();
		const handlerB = new GameHandlerBuilder().defaultSystems().fromSettings(settings).build();

		// Initial snapshots are deep-equal (same id, same players, same map).
		expect(handlerB.toSettings()).toEqual(handlerA.toSettings());

		const ids = handlerA.getEntityManager().getEntities().map(entity => entity.getId());
		const turns = [
			{ actorId: ids[0]!, angle: 20, power: 3 },
			{ actorId: ids[2]!, angle: 200, power: 3 },
			{ actorId: ids[1]!, angle: 45, power: 4 },
			{ actorId: ids[3]!, angle: 160, power: 4 },
			{ actorId: ids[0]!, angle: 350, power: 2 },
		];

		for (const turn of turns) {
			const packetA = handlerA.resolveTurn(turn);
			const packetB = handlerB.resolveTurn(turn);

			// Identical simulation packets: same frame count and final state.
			expect(packetB.durationFrames).toBe(packetA.durationFrames);
			expect(packetB.finalState).toEqual(packetA.finalState);

			// Identical full engine snapshots after every turn.
			expect(handlerB.toSettings()).toEqual(handlerA.toSettings());
		}

		const entitiesA = handlerA.getEntityManager().getEntities();
		const entitiesB = handlerB.getEntityManager().getEntities();
		for (let i = 0; i < entitiesA.length; i++) {
			expect(entitiesB[i]!.getPos()).toEqual(entitiesA[i]!.getPos());
			expect(entitiesB[i]!.getVel()).toEqual(entitiesA[i]!.getVel());
			expect(entitiesB[i]!.isDead()).toBe(entitiesA[i]!.isDead());
		}
		expect(handlerB.getState()).toBe(handlerA.getState());
		expect(handlerB.getTurnNumber()).toBe(handlerA.getTurnNumber());
	});

	test("handlers never share mutable state across instances", () => {
		const settings = createDefaultGameSettings(2, 2);
		const handlerA = new GameHandlerBuilder().defaultSystems().fromSettings(settings).build();
		const handlerB = new GameHandlerBuilder().defaultSystems().fromSettings(settings).build();

		// Live entities are distinct objects with distinct position vectors.
		const entitiesA = handlerA.getEntityManager().getEntities();
		const entitiesB = handlerB.getEntityManager().getEntities();
		for (let i = 0; i < entitiesA.length; i++) {
			expect(entitiesB[i]).not.toBe(entitiesA[i]);
			expect(entitiesB[i]!.getPos()).not.toBe(entitiesA[i]!.getPos());
		}

		// Mutating one handler's live entity and ticking it must not leak.
		const snapshotBefore = JSON.stringify(handlerB.toSettings());
		entitiesA[0]!.getPos().x += 500;
		entitiesA[0]!.getVel().x = 100;
		handlerA.tick();
		handlerA.setState(GameState.Playing);
		expect(JSON.stringify(handlerB.toSettings())).toBe(snapshotBefore);
		expect(handlerB.getState()).toBe(GameState.Your_turn);
		expect(handlerB.getEntityManager().getEntities()[0]!.getPos().x).toBe(entitiesB[0]!.getPos().x);

		// Mutating the input settings object after construction must not leak
		// into either handler (construction deep-copies the data boundary).
		const snapshotA = JSON.stringify(handlerA.toSettings());
		settings.players[0]!.position = { x: 9999, y: 9999 };
		settings.players[0]!.effects = [];
		settings.mapBoundarys[0]!.w = 5;
		settings.friction = { friction: 0.5, linearDrag: 0.5, stopThreshold: 0.5 };
		expect(JSON.stringify(handlerA.toSettings())).toBe(snapshotA);
		expect(handlerA.toSettings().friction).toEqual({ friction: 0.995, linearDrag: 0.01, stopThreshold: 0.1 });
	});

	test("divergent turn sequences produce exactly the applied divergence", () => {
		const settings = createDefaultGameSettings(2, 2);
		const ids = settings.players.map(player => player.id);
		const sequenceShort = [
			{ actorId: ids[0]!, angle: 20, power: 3 },
			{ actorId: ids[2]!, angle: 200, power: 3 },
		];
		const sequenceLong = [
			...sequenceShort,
			{ actorId: ids[1]!, angle: 45, power: 4 },
			{ actorId: ids[3]!, angle: 160, power: 4 },
		];

		const handlerShort = new GameHandlerBuilder().defaultSystems().fromSettings(settings).build();
		const handlerLong = new GameHandlerBuilder().defaultSystems().fromSettings(settings).build();
		for (const turn of sequenceShort) handlerShort.resolveTurn(turn);
		for (const turn of sequenceLong) handlerLong.resolveTurn(turn);

		// Fresh handlers replaying the same sequences must match exactly; the
		// divergence between the two matches is only the turns each received.
		const replayShort = new GameHandlerBuilder().defaultSystems().fromSettings(settings).build();
		const replayLong = new GameHandlerBuilder().defaultSystems().fromSettings(settings).build();
		for (const turn of sequenceShort) replayShort.resolveTurn(turn);
		for (const turn of sequenceLong) replayLong.resolveTurn(turn);

		expect(handlerShort.toSettings()).toEqual(replayShort.toSettings());
		expect(handlerLong.toSettings()).toEqual(replayLong.toSettings());
		expect(handlerShort.toSettings()).not.toEqual(handlerLong.toSettings());

		// The short match is a prefix of the long one: replay the short sequence
		// on a fresh handler and apply the remaining turns to confirm the long
		// match continues exactly from the short match's final state.
		const continued = new GameHandlerBuilder().defaultSystems().fromSettings(settings).build();
		for (const turn of sequenceShort) continued.resolveTurn(turn);
		const continuation = [
			{ actorId: ids[1]!, angle: 45, power: 4 },
			{ actorId: ids[3]!, angle: 160, power: 4 },
		];
		for (const turn of continuation) continued.resolveTurn(turn);
		expect(continued.toSettings()).toEqual(handlerLong.toSettings());
	});

	test("parallel simulateTurn produces identical packets", () => {
		const settings = createDefaultGameSettings(2, 2);
		const handlerA = new GameHandlerBuilder().defaultSystems().fromSettings(settings).build();
		const handlerB = new GameHandlerBuilder().defaultSystems().fromSettings(settings).build();
		const actorId = settings.players[0]!.id;

		const packetA = handlerA.simulateTurn(actorId, 75, 5);
		const packetB = handlerB.simulateTurn(actorId, 75, 5);
		expect(packetB).toEqual(packetA);

		// simulateTurn must not commit anything to either handler.
		expect(handlerB.toSettings()).toEqual(handlerA.toSettings());
		const untouched = new GameHandlerBuilder().defaultSystems().fromSettings(settings).build();
		expect(handlerA.toSettings()).toEqual(untouched.toSettings());
	});
});

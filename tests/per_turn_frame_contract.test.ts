import { describe, expect, test } from "bun:test";
import { GameHandlerBuilder } from "../src/engine/Handler.ts";
import { GameState } from "../src/engine/types.ts";
import type { TurnPacket } from "../src/engine/types.ts";
import { createDefaultGameSettings } from "../src/settings/settings.ts";

/**
 * Task 12.4 - Enforce Deterministic Per-Turn Frame Counts.
 *
 * The frame-count contract: one turn with identical inputs resolves to
 * exactly `durationFrames` simulation ticks (authoritative `resolveTurn`
 * path) and the live `playTurn` path plays back exactly that many ticks
 * before completing its final sync. Both paths end with the same final
 * state, and the contract holds across fresh handler restores.
 */

function iceHandler(): GameHandlerBuilder {
	return new GameHandlerBuilder().defaultSystems().fromSettings(createDefaultGameSettings(2, 1));
}

function playToCompletion(handler: ReturnType<GameHandlerBuilder["build"]>): number {
	let ticks = 0;
	while (handler.getState() === GameState.Playing && ticks < 10_000) {
		handler.tick();
		ticks++;
	}
	return ticks;
}

const shots: Array<{ angle: number; power: number }> = [
	{ angle: 0, power: 1 },
	{ angle: 45, power: 4 },
	{ angle: 90, power: 2 },
	{ angle: 180, power: 3 },
	{ angle: 270, power: 1 },
	{ angle: 300, power: 4 },
];

describe("per-turn frame contract", () => {
	for (const { angle, power } of shots) {
		test(`shot (${angle}, ${power}): live playback ticks equal authoritative frames and final state matches`, () => {
			const handler = iceHandler().build();
			const actor = handler.getEntityManager().getEntities()[0]!;

			const packet = handler.simulateTurn(actor.getId(), angle, power);
			expect(packet.durationFrames).toBeGreaterThan(0);
			expect(packet.finalState).toHaveLength(2);

			handler.playTurn(packet);
			const ticks = playToCompletion(handler);
			expect(ticks).toBe(packet.durationFrames);
			expect(handler.getState()).toBe(GameState.Playing_done);

			const live = handler.getEntityManager().getEntities();
			for (let i = 0; i < live.length; i++) {
				expect(live[i]!.getPos()).toEqual(packet.finalState[i]!.position);
				expect(live[i]!.getVel()).toEqual(packet.finalState[i]!.velocity);
			}
		});
	}

	test("identical inputs resolve to identical frame counts and final state on a restored handler", () => {
		const handler = iceHandler().build();
		const actor = handler.getEntityManager().getEntities()[0]!;

		const first = handler.simulateTurn(actor.getId(), 120, 3);

		// Restore the engine from the authoritative snapshot and repeat the
		// exact same turn on a fresh handler.
		const restored = new GameHandlerBuilder()
			.defaultSystems()
			.fromSettings(handler.toSettings())
			.build();
		const restoredActor = restored.getEntityManager().getEntities()[0]!;
		const second = restored.simulateTurn(restoredActor.getId(), 120, 3);

		expect(second.durationFrames).toBe(first.durationFrames);
		expect(second.finalState).toEqual(first.finalState);

		// And the live playback of the restored packet takes exactly as many
		// ticks as the authoritative resolution counted.
		restored.playTurn(second);
		expect(playToCompletion(restored)).toBe(second.durationFrames);
	});

	test("authoritative resolveTurn path is deterministic across repeated runs", () => {
		const base = iceHandler().build();
		const baseline = base.toSettings();
		const packets: TurnPacket[] = [];
		for (let i = 0; i < 3; i++) {
			// Each authoritative resolution starts from the same restored state.
			const handler = new GameHandlerBuilder().defaultSystems().fromSettings(baseline).build();
			const actor = handler.getEntityManager().getEntities()[0]!;
			packets.push(handler.resolveTurn({ actorId: actor.getId(), angle: 200, power: 4 }));
		}
		for (let i = 1; i < packets.length; i++) {
			expect(packets[i]!.durationFrames).toBe(packets[0]!.durationFrames);
			expect(packets[i]!.finalState).toEqual(packets[0]!.finalState);
		}
	});
});

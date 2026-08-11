import { expect, test } from "bun:test";
import { GameEmitter } from "../src/emitter/EngineEmitter.ts";
import { GameState } from "../src/kore/runtime/types.ts";
import { createCanonicalPlayableMatchHandler, createCanonicalPlayableMatchSettings } from "../src/settings/canonicalPlayableMatch.ts";
import { validateGameSettings } from "../src/settings/settings.ts";

test("canonical playable match is stable, valid, actionable, and headlessly completable", () => {
	const settings = createCanonicalPlayableMatchSettings();
	expect(createCanonicalPlayableMatchSettings()).toEqual(settings);
	validateGameSettings(settings);
	const handler = createCanonicalPlayableMatchHandler();
	expect(handler.getState()).toBe(GameState.Your_turn);
	expect(handler.getActiveTeam()).toBe(0);
	expect(handler.getEntityManager().getEntities()).toHaveLength(12);

	// Deterministic headless completion sequence: team 0 kills one enemy per
	// turn (power 10), team 1 drifts harmlessly upward (angle 90, power 0.8).
	// Verified against the current ice-map spawns and center wall.
	const sequence = [
		{ team: 0, spawnIndex: 0, angle: 30, power: 10 },
		{ team: 1, spawnIndex: 0, angle: 90, power: 0.8 },
		{ team: 0, spawnIndex: 1, angle: 40, power: 10 },
		{ team: 1, spawnIndex: 1, angle: 90, power: 0.8 },
		{ team: 0, spawnIndex: 2, angle: 20, power: 10 },
		{ team: 1, spawnIndex: 2, angle: 90, power: 0.8 },
		{ team: 0, spawnIndex: 3, angle: 29, power: 10 },
		{ team: 1, spawnIndex: 3, angle: 90, power: 0.8 },
		{ team: 0, spawnIndex: 4, angle: 25, power: 10 },
		{ team: 1, spawnIndex: 4, angle: 90, power: 0.8 },
		{ team: 0, spawnIndex: 5, angle: 59, power: 10 },
	] as const;
	const spawns = [0, 1].map(team =>
		settings.players.filter(player => player.team[0] === team).map(player => player.position)
	);
	const emitter = new GameEmitter(handler, settings.gameMode!, 2, 14);
	for (const action of sequence) {
		const spawn = spawns[action.team]![action.spawnIndex]!;
		const entity = handler.getEntityManager().getEntities()
			.filter(entity => entity.getTeam().includes(action.team) && !entity.isDead())
			.sort((a, b) => Math.hypot(a.getPos().x - spawn.x, a.getPos().y - spawn.y)
				- Math.hypot(b.getPos().x - spawn.x, b.getPos().y - spawn.y))[0];
		expect(entity).toBeDefined();
		emitter.skipPhase();
		emitter.sendShot(entity!.getId(), action.angle, action.power);
		let ticks = 0;
		while (handler.getState() === GameState.Playing && ticks++ < 5000) handler.tick();
		expect(handler.getState()).not.toBe(GameState.Playing);
	}
	expect(handler.getState()).toBe(GameState.Game_over);
	expect(handler.getMatchResult()?.winnerTeam).toBe(0);
}, { timeout: 30_000 });

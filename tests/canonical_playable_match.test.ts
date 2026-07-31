import { expect, test } from "bun:test";
import { GameEmitter } from "../src/emitter/EngineEmitter.ts";
import { GameState } from "../src/engine/types.ts";
import { createCanonicalPlayableMatchHandler, createCanonicalPlayableMatchSettings } from "../src/settings/canonicalPlayableMatch.ts";
import { validateGameSettings } from "../src/settings/settings.ts";

test("canonical playable match is stable, valid, actionable, and headlessly completable", () => {
	const settings = createCanonicalPlayableMatchSettings();
	expect(createCanonicalPlayableMatchSettings()).toEqual(settings);
	validateGameSettings(settings);
	const handler = createCanonicalPlayableMatchHandler();
	const actor = handler.getEntityManager().getEntities().find(entity => entity.getTeam().includes(0))!;
	expect(handler.getState()).toBe(GameState.Your_turn);
	expect(handler.getActiveTeam()).toBe(0);
	const emitter = new GameEmitter(handler, settings.gameMode!, 2, 14);
	emitter.skipPhase();
	emitter.sendShot(actor.getId(), 220, 10);
	let ticks = 0;
	while (handler.getState() === GameState.Playing && ticks++ < 500) handler.tick();
	expect(handler.getState()).toBe(GameState.Game_over);
	expect(handler.getMatchResult()?.winnerTeam).toBe(1);
	expect(ticks).toBeLessThan(500);
});

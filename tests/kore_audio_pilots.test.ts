import { expect, test } from "bun:test";
import { GameHandlerBuilder } from "../src/kore/runtime/Handler.ts";
import { GameEmitter } from "../src/emitter/EngineEmitter.ts";
import { createKoreMainMenuSurface } from "../src/kore/ui/KoreMainMenuSurface.ts";
import { GameSettings } from "../src/settings/settings.ts";

test("KORE menu pilot emits semantic menu music and a UI confirmation without browser media access", () => {
	let started = 0;
	const menu = createKoreMainMenuSurface({ onPlayLocal: () => { started++; } });
	expect(menu.drainSoundCommands()).toMatchObject([{ type: "playMusic", soundId: "kore.music.menu", bus: "music" }]);
	menu.updateMouse(400, 100); menu.handleMousePressed(); // landing -> main menu
	menu.updateMouse(400, 220); menu.handleMousePressed(); // Play Offline
	menu.updateMouse(400, 160); menu.handleMousePressed(); // vs Player
	expect(started).toBe(1);
	expect(menu.drainSoundCommands()).toMatchObject([{ type: "playSound", soundId: "kore.ui.confirm", bus: "ui" }]);
});

test("KORE local gameplay pilot emits music at construction and a shot cue only after accepted playback", () => {
	const handler = new GameHandlerBuilder().defaultSystems().fromSettings(GameSettings).setPlayerTeam([0, 1]).build();
	const emitter = new GameEmitter(handler);
	expect(emitter.drainSoundCommands()).toMatchObject([{ type: "playMusic", soundId: "kore.music.match", bus: "music" }]);
	const actor = handler.getEntityManager().getEntities().find(entity => !entity.isDead() && entity.getTeam().includes(handler.getActiveTeam()))!;
	emitter.sendShot(actor.getId(), 0, 2);
	expect(emitter.drainSoundCommands()).toMatchObject([{ type: "playSound", soundId: "kore.game.shot", bus: "effects" }]);
});

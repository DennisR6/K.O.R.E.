import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { createMainMenuComposition, validateKoreMainMenuSettings } from "../src/kore/ui/mainMenu.ts";
import { createKoreMainMenuSurface } from "../src/kore/ui/KoreMainMenuSurface.ts";

test("central KORE main-menu composition builds validated JSON-safe UI and persistent audio settings", () => {
	const composition = createMainMenuComposition(); const settings = composition.build();
	expect(() => validateKoreMainMenuSettings(settings)).not.toThrow();
	expect(JSON.parse(composition.buildJson())).toEqual(settings);
	expect(settings.ui.activeScreen).toBe("landing");
	expect(settings.ui.screens.map(screen => screen.id)).toEqual(["landing", "main", "map-local", "map-online", "map-battle", "difficulty", "map-ai-easy", "map-ai-medium", "map-ai-hard"]);
	expect(settings.audio.persistentSources).toMatchObject([{ sourceId: "kore.menu", command: { type: "playMusic", soundId: "kore.music.menu" } }]);
	expect(settings.metadata.confirmationSoundId).toBe("kore.ui.confirm");
	expect(settings.metadata.confirmationCommands).toContain("kore.menu.start-local-game");
});

test("SDK menu surface uses explicit ticks, pure draws, semantic transitions, and snapshot reconstruction", () => {
	const menu = createKoreMainMenuSurface();
	const before = menu.toSettings();
	menu.getRuntime().draw({ drawText() {}, drawButton() {}, drawTextInput() {} });
	expect(menu.toSettings()).toEqual(before);
	menu.updateMouse(400, 100); menu.handleMousePressed();
	expect(menu.getRuntime().getActiveScreen()).toBe("main");
	menu.updateMouse(400, 205); menu.handleMousePressed();
	expect(menu.getRuntime().getActiveScreen()).toBe("map-battle");
	menu.updateMouse(210, 355); menu.handleMousePressed();
	expect(menu.getRuntime().getActiveScreen()).toBe("main");
	const restored = createKoreMainMenuSurface({}, JSON.parse(JSON.stringify(menu.toSettings())));
	expect(restored.toSettings().ui).toEqual(menu.toSettings().ui);
	expect(restored.drainSoundCommands()).toMatchObject([{ type: "playMusic", soundId: "kore.music.menu" }]);
	const source = readFileSync("src/kore/ui/mainMenu.ts", "utf8");
	expect(source).toContain("ui.createMenu"); expect(source).toContain("createKoreAudioSettings");
	expect(source).not.toContain("AudioManager");
	expect(readFileSync("src/kore/ui/KoreMainMenuSurface.ts", "utf8")).not.toMatch(/x\s*>=|y\s*>=|AudioManager/);
});

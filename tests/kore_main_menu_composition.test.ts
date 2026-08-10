import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { createMainMenuComposition, validateKoreMainMenuSettings } from "../src/kore/ui/mainMenu.ts";
import { createKoreMainMenuSurface } from "../src/kore/ui/KoreMainMenuSurface.ts";
import { KoreMenuCommand, KoreMenuDifficulty, KoreMenuId, KoreMenuMapIntent, KoreMenuScreen, parseKoreMenuCommand } from "../src/kore/ui/menuVocabulary.ts";

test("central KORE main-menu composition builds validated JSON-safe UI and persistent audio settings", () => {
	const composition = createMainMenuComposition(); const settings = composition.build();
	expect(() => validateKoreMainMenuSettings(settings)).not.toThrow();
	expect(JSON.parse(composition.buildJson())).toEqual(settings);
	expect(settings.ui.activeScreen).toBe(KoreMenuScreen.Landing);
	expect(settings.ui.screens.map(screen => screen.id)).toEqual([KoreMenuScreen.Landing, KoreMenuScreen.Main, KoreMenuScreen.OnlineSub, KoreMenuScreen.LocalSub, KoreMenuScreen.Settings, KoreMenuScreen.Credits, KoreMenuScreen.MapLocal, KoreMenuScreen.MapOnline, KoreMenuScreen.MapBattle, KoreMenuScreen.Difficulty, KoreMenuScreen.MapAiEasy, KoreMenuScreen.MapAiMedium, KoreMenuScreen.MapAiHard, KoreMenuScreen.Mods, KoreMenuScreen.ModImport, KoreMenuScreen.ModResult]);
	expect(settings.audio.persistentSources).toMatchObject([{ sourceId: KoreMenuId.AudioSource, command: { type: "playMusic", soundId: "kore.music.menu" } }]);
	expect(settings.metadata.confirmationSoundId).toBe("kore.ui.confirm");
	expect(settings.metadata.confirmationCommands).toContain(KoreMenuCommand.StartLocal);
});

test("SDK menu surface uses explicit ticks, pure draws, semantic transitions, and snapshot reconstruction", () => {
	const menu = createKoreMainMenuSurface();
	const before = menu.toSettings();
	menu.getRuntime().draw({ drawText() {}, drawButton() {}, drawTextInput() {}, drawImage() {} });
	expect(menu.toSettings()).toEqual(before);
	menu.updateMouse(400, 100); menu.handleMousePressed();
	expect(menu.getRuntime().getActiveScreen()).toBe(KoreMenuScreen.Main);
	menu.getRuntime().dispatch({ type: "navigate", target: KoreMenuScreen.MapBattle });
	menu.tick(16, 0);
	expect(menu.getRuntime().getActiveScreen()).toBe(KoreMenuScreen.MapBattle);
	menu.getRuntime().dispatch({ type: "back" });
	menu.tick(16, 0);
	expect(menu.getRuntime().getActiveScreen()).toBe(KoreMenuScreen.Main);
	const restored = createKoreMainMenuSurface({}, JSON.parse(JSON.stringify(menu.toSettings())));
	expect(restored.toSettings().ui).toEqual(menu.toSettings().ui);
	expect(restored.drainSoundCommands()).toMatchObject([{ type: "playMusic", soundId: "kore.music.menu" }]);
	const source = readFileSync("src/kore/ui/mainMenu.ts", "utf8");
	expect(source).toContain("ui.createMenu"); expect(source).toContain("createKoreAudioSettings");
	expect(source).not.toContain("AudioManager");
	expect(readFileSync("src/kore/ui/KoreMainMenuSurface.ts", "utf8")).not.toMatch(/x\s*>=|y\s*>=|AudioManager/);
});

test("KORE menu runtime narrows generic commands through its enum vocabulary", () => {
	expect(parseKoreMenuCommand(KoreMenuCommand.OpenAi, undefined)).toEqual({ type: KoreMenuCommand.OpenAi, payload: undefined });
	expect(parseKoreMenuCommand(KoreMenuCommand.OpenAiMaps, { difficulty: KoreMenuDifficulty.Hard })).toEqual({ type: KoreMenuCommand.OpenAiMaps, payload: { difficulty: KoreMenuDifficulty.Hard } });
	expect(parseKoreMenuCommand(KoreMenuCommand.SelectMap, { intent: KoreMenuMapIntent.Local, mapId: "ice-map-v1" })).toEqual({ type: KoreMenuCommand.SelectMap, payload: { intent: KoreMenuMapIntent.Local, mapId: "ice-map-v1" } });
	expect(parseKoreMenuCommand("kore.menu.unknown", undefined)).toBeUndefined();
	expect(parseKoreMenuCommand(KoreMenuCommand.SelectMap, { intent: "unknown", mapId: "ice-map-v1" })).toBeUndefined();
});

test("SDK menu exposes live hover and focused states to its renderer", () => {
	const menu = createKoreMainMenuSurface();
	menu.updateMouse(400, 100);
	menu.handleMousePressed();
	let onlineRect: { x: number; y: number; width: number; height: number } | undefined;
	menu.getRuntime().draw({
		drawText() {},
		drawTextInput() {},
		drawImage() {},
		drawButton(element) { if (element.id === "action-online") onlineRect = element.rect; },
	});
	expect(onlineRect).toBeDefined();
	menu.updateMouse(onlineRect!.x + onlineRect!.width / 2, onlineRect!.y + onlineRect!.height / 2);
	menu.tick(16, 0);
	let states: Record<string, { hovered?: boolean; focused?: boolean }> = {};
	menu.getRuntime().draw({
		drawText() {},
		drawTextInput() {},
		drawImage() {},
		drawButton(element) { states[element.id] = { hovered: element.hovered, focused: element.focused }; },
	});
	expect(states["action-online"]?.hovered).toBe(true);
});

test("main menu organizes actions and wraps long labels", () => {
	const menu = createKoreMainMenuSurface();
	menu.updateMouse(400, 100);
	menu.handleMousePressed();
	const buttons: Array<{ id: string; rect: { x: number; y: number; width: number; height: number } }> = [];
	menu.getRuntime().draw({ drawText() {}, drawTextInput() {}, drawImage() {}, drawButton(element) { if (element.id.startsWith("action-")) buttons.push({ id: element.id, rect: element.rect }); } });
	expect(buttons.length).toBeGreaterThan(0);
	expect(readFileSync("src/kore/ui/koreUiTheme.ts", "utf8")).toContain("wrapButtonLabel");
});

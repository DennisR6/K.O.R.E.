import { audio, type AudioRuntimeSettings, validateAudioSettings } from "../../engine/audio-sdk/index.js";
import { engine } from "../../engine/sdk/index.js";
import type { JsonValue } from "../../engine/contracts/systemSettings.js";
import { ui, validateUiSettings, type UiMenuSettings } from "../../engine/ui-sdk/index.js";
import { MAP_CATALOG } from "../../content/mapCatalog.js";
import { koreAudio, createKoreAudioSettings } from "../audio.js";
import { KoreMenuCommand, KoreMenuDifficulty, KoreMenuElement, KoreMenuId, KoreMenuMapIntent, KoreMenuScreen, KoreMenuStyle, KoreMenuText, koreMenuMapBackElementId, koreMenuMapElementId, koreMenuMapScreen, koreMenuMapTitleElementId, isKoreMenuCommand } from "./menuVocabulary.js";

export { KoreMenuCommand, KoreMenuDifficulty, KoreMenuMapIntent } from "./menuVocabulary.js";
export type KoreMainMenuSettings = { schemaVersion: 1; id: KoreMenuId.Composition; ui: UiMenuSettings; audio: AudioRuntimeSettings; metadata: { schemaVersion: 1; title: KoreMenuText.Title; worldSize: { width: number; height: number }; confirmationCommands: KoreMenuCommand[]; confirmationSoundId: string } };

const SIZE = { width: 800, height: 450 };
export class KoreMainMenuComposition {
	public build(): KoreMainMenuSettings {
		const menuMusic = koreAudio.command.menuMusic(KoreMenuId.AudioSource);
		const audioSettings = createKoreAudioSettings(KoreMenuId.AudioRuntime);
		const settings: KoreMainMenuSettings = {
			schemaVersion: 1,
			id: KoreMenuId.Composition,
			ui: buildUiSettings(),
			audio: { ...audioSettings, framework: audio.createDefaultFramework(), persistentSources: [{ sourceId: KoreMenuId.AudioSource, command: menuMusic }] },
			metadata: { schemaVersion: 1, title: KoreMenuText.Title, worldSize: { ...SIZE }, confirmationCommands: [KoreMenuCommand.OpenAi, KoreMenuCommand.OpenBattle, KoreMenuCommand.OpenOnline, KoreMenuCommand.StartLocal, KoreMenuCommand.OpenLocalMaps], confirmationSoundId: koreAudio.sounds.uiConfirm },
		};
		validateKoreMainMenuSettings(settings);
		return structuredClone(settings);
	}
	public buildJson(space: number = 2): string { return JSON.stringify(this.build(), null, space); }
}

/** The sole production source for KORE's menu screens, actions, and audio intent. */
export function createMainMenuComposition(): KoreMainMenuComposition { return new KoreMainMenuComposition(); }

export function validateKoreMainMenuSettings(value: unknown): asserts value is KoreMainMenuSettings {
	if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Malformed KORE main-menu settings");
	const settings = value as Partial<KoreMainMenuSettings>;
	if (settings.schemaVersion !== 1 || settings.id !== KoreMenuId.Composition || !settings.ui || !settings.audio || !settings.metadata || settings.metadata.schemaVersion !== 1 || settings.metadata.title !== KoreMenuText.Title || settings.metadata.worldSize?.width !== SIZE.width || settings.metadata.worldSize?.height !== SIZE.height || !Array.isArray(settings.metadata.confirmationCommands) || settings.metadata.confirmationCommands.some(command => typeof command !== "string" || !isKoreMenuCommand(command)) || typeof settings.metadata.confirmationSoundId !== "string") throw new Error("Malformed KORE main-menu settings");
	validateUiSettings(settings.ui); validateAudioSettings(settings.audio);
	if (!settings.audio.persistentSources.some(source => source.sourceId === KoreMenuId.AudioSource && source.command.type === "playMusic" && source.command.soundId === koreAudio.music.menu)) throw new Error("Main menu requires persistent menu music");
	for (const sound of settings.audio.persistentSources.map(source => source.command.soundId)) if (!(sound in koreAudio.assets)) throw new Error(`Unknown KORE menu sound '${sound}'`);
	if (!(settings.metadata.confirmationSoundId in koreAudio.assets)) throw new Error(`Unknown KORE menu confirmation sound '${settings.metadata.confirmationSoundId}'`);
	engine.createEntity(JSON.parse(JSON.stringify(settings)) as JsonValue);
}

export const koreMenuCommands = KoreMenuCommand;

function buildUiSettings(): UiMenuSettings {
	const builder = ui.createMenu({ id: KoreMenuId.Runtime, size: SIZE });
	builder.addScreen(ui.screen({ id: KoreMenuScreen.Landing, layout: ui.layout.absolute(), elements: [
		ui.text({ id: KoreMenuElement.LandingPrompt, text: KoreMenuText.LandingPrompt, rect: rect(200, 180, 480, 58), style: KoreMenuStyle.LandingPrompt, visible: false }),
		ui.button({ id: KoreMenuElement.LandingStart, text: "", rect: rect(0, 0, 800, 450), style: KoreMenuStyle.LandingHitbox, action: ui.action.navigate(KoreMenuScreen.Main) }),
	] }));
	builder.addScreen(ui.screen({ id: KoreMenuScreen.Main, layout: ui.layout.absolute(), elements: [
		menuButton(KoreMenuElement.MainAi, KoreMenuText.Ai, 270, 112, KoreMenuCommand.OpenAi),
		menuButton(KoreMenuElement.MainBattle, KoreMenuText.Battle, 270, 176, KoreMenuCommand.OpenBattle),
		menuButton(KoreMenuElement.MainOnline, KoreMenuText.Online, 270, 240, KoreMenuCommand.OpenOnline),
		menuButton(KoreMenuElement.MainLocal, KoreMenuText.Local, 270, 304, KoreMenuCommand.StartLocal),
		menuButton(KoreMenuElement.MainMaps, KoreMenuText.ChooseMap, 270, 368, KoreMenuCommand.OpenLocalMaps),
	] }));
	for (const intent of [KoreMenuMapIntent.Local, KoreMenuMapIntent.Online, KoreMenuMapIntent.Battle]) builder.addScreen(mapScreen(intent));
	builder.addScreen(difficultyScreen());
	for (const difficulty of Object.values(KoreMenuDifficulty)) builder.addScreen(mapScreen(KoreMenuMapIntent.Ai, difficulty));
	return builder.build();
}

function mapScreen(intent: KoreMenuMapIntent, difficulty?: KoreMenuDifficulty) {
	const eligible = MAP_CATALOG.filter(entry => entry.browserAvailable && (intent !== KoreMenuMapIntent.Battle || entry.battleAvailable));
	const title = intent === KoreMenuMapIntent.Ai ? `${KoreMenuText.ChooseMap} for ${difficulty} ${KoreMenuText.Ki}` : KoreMenuText.ChooseMap;
	const elements = [
		ui.text({ id: koreMenuMapTitleElementId(intent, difficulty), text: title, rect: rect(155, 25, 580, 42), style: KoreMenuStyle.MapTitle }),
		...(intent === KoreMenuMapIntent.Online ? [ui.text({ id: KoreMenuElement.MapOnlineNote, text: KoreMenuText.OnlineMapNote, rect: rect(155, 54, 560, 20), style: KoreMenuStyle.MapNote })] : []),
		...eligible.map((entry, index) => ui.button({ id: koreMenuMapElementId(intent, entry.id, difficulty), text: `${entry.name} (${entry.id})`, rect: rect(150, 80 + index * 50, 500, 40), style: KoreMenuStyle.MapRow, action: ui.action.emit(KoreMenuCommand.SelectMap, { intent, mapId: entry.id, ...(difficulty ? { difficulty } : {}) }) })),
		ui.button({ id: koreMenuMapBackElementId(intent, difficulty), text: KoreMenuText.Back, rect: rect(150, 80 + eligible.length * 50 + 8, 120, 34), style: KoreMenuStyle.Back, action: ui.action.back() }),
	];
	return ui.screen({ id: koreMenuMapScreen(intent, difficulty), layout: ui.layout.absolute(), elements });
}

function difficultyScreen() {
	return ui.screen({ id: KoreMenuScreen.Difficulty, layout: ui.layout.absolute(), elements: [
		ui.text({ id: KoreMenuElement.DifficultyTitle, text: KoreMenuText.ChooseAiDifficulty, rect: rect(265, 64, 300, 32), style: KoreMenuStyle.DifficultyTitle }),
		...Object.values(KoreMenuDifficulty).map((difficulty, index) => ui.button({ id: `difficulty-${difficulty}`, text: `${difficulty[0]!.toUpperCase()}${difficulty.slice(1)} ${KoreMenuText.Ki}`, rect: rect(270, 130 + index * 60, 260, 48), style: KoreMenuStyle.Difficulty, action: ui.action.emit(KoreMenuCommand.OpenAiMaps, { difficulty }) })),
		ui.button({ id: KoreMenuElement.DifficultyBack, text: KoreMenuText.Back, rect: rect(270, 320, 260, 42), style: KoreMenuStyle.DifficultyBack, action: ui.action.back() }),
	] });
}

function menuButton(id: KoreMenuElement, text: KoreMenuText, x: number, y: number, command: KoreMenuCommand) { return ui.button({ id, text, rect: rect(x, y, 260, 58), style: KoreMenuStyle.MainButton, action: ui.action.emit(command) }); }
function rect(x: number, y: number, width: number, height: number) { return { x, y, width, height }; }
export function mapScreenId(intent: KoreMenuMapIntent, difficulty?: KoreMenuDifficulty): KoreMenuScreen { return koreMenuMapScreen(intent, difficulty); }

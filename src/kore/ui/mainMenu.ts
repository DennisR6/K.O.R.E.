import { audio, type AudioRuntimeSettings, validateAudioSettings } from "../../engine/audio-sdk/index.js";
import { engine } from "../../engine/sdk/index.js";
import type { JsonValue } from "../../engine/contracts/systemSettings.js";
import { ui, validateUiSettings, type UiMenuSettings } from "../../engine/ui-sdk/index.js";
import { MAP_CATALOG } from "../../content/mapCatalog.js";
import { koreAudio, createKoreAudioSettings } from "../audio.js";
import { KoreMenuCommand, KoreMenuDifficulty, KoreMenuElement, KoreMenuId, KoreMenuMapIntent, KoreMenuScreen, KoreMenuStyle, KoreMenuText, isKoreMenuCommand, koreMenuDifficultyElementId, koreMenuMapBackElementId, koreMenuMapElementId, koreMenuMapScreen, koreMenuMapTitleElementId } from "./menuVocabulary.js";
import { createEnglishLanguage, translate, type LanguageCatalog } from "../../i18n/language.js";
import { getSelectableGameModes } from "../../rules/modeCatalog.js";

export { KoreMenuCommand, KoreMenuDifficulty, KoreMenuMapIntent } from "./menuVocabulary.js";
export type KoreMainMenuSettings = { schemaVersion: 1; id: KoreMenuId.Composition; ui: UiMenuSettings; audio: AudioRuntimeSettings; metadata: { schemaVersion: 1; title: string; worldSize: { width: number; height: number }; confirmationCommands: KoreMenuCommand[]; confirmationSoundId: string } };

export const MAIN_ACTIONS = {
	openOnline: KoreMenuCommand.OpenOnline,
	openBattle: KoreMenuCommand.OpenBattle,
	openAi: KoreMenuCommand.OpenAi,
	openLocalMaps: KoreMenuCommand.OpenLocalMaps,
	openAiMaps: KoreMenuCommand.OpenAiMaps,
	selectMap: KoreMenuCommand.SelectMap,
	startLocal: KoreMenuCommand.StartLocal,
	openOnlineFriends: KoreMenuCommand.OpenOnlineFriends,
} as const;

const SIZE = { width: 800, height: 450 };
const MENU_TITLE = "KORE";

// The production menu is authored in world coordinates and consumed by the
// generic UI SDK. Keep these bounds aligned with the browser/world contract.
const BTN_W = 132;
const BTN_H = 58;

/** The sole production source for KORE's menu screens, actions, and audio intent. */
export class KoreMainMenuComposition {
	public constructor(private readonly language: LanguageCatalog = createEnglishLanguage()) {}
	public build(): KoreMainMenuSettings {
		const menuMusic = koreAudio.command.menuMusic(KoreMenuId.AudioSource);
		const audioSettings = createKoreAudioSettings(KoreMenuId.AudioRuntime);
		const settings: KoreMainMenuSettings = {
			schemaVersion: 1,
			id: KoreMenuId.Composition,
			ui: buildUiSettings(this.language),
			audio: { ...audioSettings, framework: audio.createDefaultFramework(), persistentSources: [{ sourceId: KoreMenuId.AudioSource, command: menuMusic }] },
			metadata: { schemaVersion: 1, title: MENU_TITLE, worldSize: { ...SIZE }, confirmationCommands: [KoreMenuCommand.OpenAi, KoreMenuCommand.OpenBattle, KoreMenuCommand.OpenOnline, KoreMenuCommand.OpenOnlineFriends, KoreMenuCommand.OpenLocalMaps, KoreMenuCommand.OpenAiMaps, KoreMenuCommand.SelectMap, KoreMenuCommand.StartLocal], confirmationSoundId: koreAudio.sounds.uiConfirm },
		};
		validateKoreMainMenuSettings(settings);
		return structuredClone(settings);
	}
	public buildJson(space: number = 2): string { return JSON.stringify(this.build(), null, space); }
}

export function createMainMenuComposition(language?: LanguageCatalog): KoreMainMenuComposition { return new KoreMainMenuComposition(language); }

export function validateKoreMainMenuSettings(value: unknown): asserts value is KoreMainMenuSettings {
	if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Malformed KORE main-menu settings");
	const settings = value as Partial<KoreMainMenuSettings>;
	if (settings.schemaVersion !== 1 || settings.id !== KoreMenuId.Composition || !settings.ui || !settings.audio || !settings.metadata || settings.metadata.schemaVersion !== 1 || settings.metadata.title !== MENU_TITLE || settings.metadata.worldSize?.width !== SIZE.width || settings.metadata.worldSize?.height !== SIZE.height || !Array.isArray(settings.metadata.confirmationCommands) || settings.metadata.confirmationCommands.some(command => typeof command !== "string" || !isKoreMenuCommand(command)) || typeof settings.metadata.confirmationSoundId !== "string") throw new Error("Malformed KORE main-menu settings");
	validateUiSettings(settings.ui); validateAudioSettings(settings.audio);
	if (!settings.audio.persistentSources.some(source => source.sourceId === KoreMenuId.AudioSource && source.command.type === "playMusic" && source.command.soundId === koreAudio.music.menu)) throw new Error("Main menu requires persistent menu music");
	for (const sound of settings.audio.persistentSources.map(source => source.command.soundId)) if (!(sound in koreAudio.assets)) throw new Error(`Unknown KORE menu sound '${sound}'`);
	if (!(settings.metadata.confirmationSoundId in koreAudio.assets)) throw new Error(`Unknown KORE menu confirmation sound '${settings.metadata.confirmationSoundId}'`);
	engine.createEntity(JSON.parse(JSON.stringify(settings)) as JsonValue);
}

export const koreMenuCommands = KoreMenuCommand;

function buildUiSettings(language: LanguageCatalog): UiMenuSettings {
	const builder = ui.createMenu({ id: KoreMenuId.Runtime, size: SIZE });

	// 0. LANDING SCREEN
	builder.addScreen(
		ui.screen({
			id: KoreMenuScreen.Landing,
			layout: ui.layout.absolute(),
			elements: [
				ui.text({ id: KoreMenuElement.LandingPrompt, text: translate(language, KoreMenuText.LandingPrompt), rect: rect(200, 180, 480, 58), style: KoreMenuStyle.LandingPrompt, visible: false }),
				ui.button({ id: KoreMenuElement.LandingStart, text: "", rect: rect(0, 0, 800, 450), style: KoreMenuStyle.LandingHitbox, action: ui.action.navigate(KoreMenuScreen.Main) }),
			],
		})
	);

	// 1. HAUPTMENÜ. All interaction remains declared in SDK settings; the
	// renderer only projects the resulting runtime state.
	builder.addScreen(
		ui.screen({
			id: KoreMenuScreen.Main,
			layout: ui.layout.vertical({ gap: 28, justify: "space-between", align: "center", padding: { top: 35, right: 30, bottom: 50, left: 30 } }),
			elements: [
				ui.text({ id: KoreMenuElement.MainTitle, text: translate(language, KoreMenuText.Title), rect: rect(0, 0, 200, 48), style: KoreMenuStyle.MapTitle }),
				ui.container({
					id: KoreMenuElement.MainActions,
					rect: rect(0, 0, 740, BTN_H),
					layout: ui.layout.horizontal({ gap: 16, justify: "center", align: "center" }),
					style: KoreMenuStyle.MainActions,
						elements: [
							menuButton(KoreMenuElement.MainAi, translate(language, KoreMenuText.Ai), KoreMenuScreen.Difficulty, KoreMenuStyle.LocalButton),
							menuButton(KoreMenuElement.MainBattle, translate(language, KoreMenuText.Battle), KoreMenuScreen.MapBattle, KoreMenuStyle.MainButton),
							menuButton(KoreMenuElement.MainOnline, translate(language, KoreMenuText.Online), KoreMenuScreen.MapOnline, KoreMenuStyle.OnlineButton),
							ui.button({ id: KoreMenuElement.MainLocal, text: translate(language, KoreMenuText.Local), rect: rect(0, 0, BTN_W, BTN_H), style: KoreMenuStyle.LocalButton, action: ui.action.emit(KoreMenuCommand.StartLocal) }),
							ui.button({ id: KoreMenuElement.MainMaps, text: translate(language, KoreMenuText.ChooseMap), rect: rect(0, 0, BTN_W, BTN_H), style: KoreMenuStyle.SettingsButton, action: ui.action.emit(KoreMenuCommand.OpenLocalMaps) }),
					],
				}),
			],
		})
	);

	// 2. Map and difficulty screens are all declared in the same SDK menu.
	for (const intent of [KoreMenuMapIntent.Local, KoreMenuMapIntent.Online, KoreMenuMapIntent.Battle]) builder.addScreen(mapScreen(intent, undefined, language));
	builder.addScreen(difficultyScreen(language));
	for (const difficulty of Object.values(KoreMenuDifficulty)) builder.addScreen(mapScreen(KoreMenuMapIntent.Ai, difficulty, language));

	return builder.build();
}

/** Primary menu actions navigate; the navigation target is authored per button. */
function menuButton(id: KoreMenuElement, text: string, target: KoreMenuScreen, style: KoreMenuStyle = KoreMenuStyle.MainButton) {
	return ui.button({ id, text, rect: rect(0, 0, BTN_W, BTN_H), style, action: ui.action.navigate(target) });
}

function mapScreen(intent: KoreMenuMapIntent, difficulty: KoreMenuDifficulty | undefined, language: LanguageCatalog) {
	const eligible = MAP_CATALOG.filter(entry => entry.browserAvailable && (intent !== KoreMenuMapIntent.Battle || entry.battleAvailable));
	const withModes = intent === KoreMenuMapIntent.Local || intent === KoreMenuMapIntent.Online;
	const modes = withModes ? getSelectableGameModes() : [undefined];
	const rowHeight = withModes ? 18 : 36;
	const rowsPerMap = modes.length;
	const elements = [
		ui.text({ id: koreMenuMapTitleElementId(intent, difficulty), text: translate(language, KoreMenuText.ChooseMap), rect: rect(155, 25, 580, 42), style: KoreMenuStyle.MapTitle }),
		...(intent === KoreMenuMapIntent.Online
			? [ui.text({ id: KoreMenuElement.MapOnlineNote, text: translate(language, KoreMenuText.OnlineMapNote), rect: rect(155, 54, 560, 20), style: KoreMenuStyle.MapNote })]
			: []),
		...eligible.flatMap((entry, mapIndex) => modes.map((mode, index) =>
			ui.button({
				id: koreMenuMapElementId(intent, entry.id, difficulty, mode?.id),
				text: `${entry.name}${mode ? ` - ${mode.name}` : ""} (${entry.id})`,
				rect: rect(150, 80 + (mapIndex * rowsPerMap + index) * rowHeight, 500, rowHeight - 2),
				style: KoreMenuStyle.MapRow,
				action: ui.action.emit(KoreMenuCommand.SelectMap, { intent, mapId: entry.id, ...(mode ? { modeId: mode.id } : {}), ...(difficulty ? { difficulty } : {}) }),
			})
		)),
		ui.button({
			id: koreMenuMapBackElementId(intent, difficulty),
			text: translate(language, KoreMenuText.Back),
			rect: rect(150, 80 + eligible.length * rowsPerMap * rowHeight + 8, 120, 34),
			style: KoreMenuStyle.Back,
			action: ui.action.back(),
		}),
	];
	return ui.screen({ id: koreMenuMapScreen(intent, difficulty), layout: ui.layout.absolute(), elements });
}

function difficultyScreen(language: LanguageCatalog) {
	return ui.screen({
		id: KoreMenuScreen.Difficulty,
		layout: ui.layout.absolute(),
		elements: [
			ui.text({ id: KoreMenuElement.DifficultyTitle, text: translate(language, KoreMenuText.ChooseAiDifficulty), rect: rect(265, 64, 300, 32), style: KoreMenuStyle.DifficultyTitle }),
			...Object.values(KoreMenuDifficulty).map((difficulty, index) =>
				ui.button({
					id: koreMenuDifficultyElementId(difficulty),
					text: `${difficulty[0]!.toUpperCase()}${difficulty.slice(1)} KI`,
					rect: rect(270, 130 + index * 50, 260, 40),
					style: KoreMenuStyle.Difficulty,
					action: ui.action.emit(KoreMenuCommand.OpenAiMaps, { difficulty }),
				})
			),
			ui.button({ id: KoreMenuElement.DifficultyBack, text: translate(language, KoreMenuText.Back), rect: rect(270, 320, 260, 36), style: KoreMenuStyle.DifficultyBack, action: ui.action.back() }),
		],
	});
}

function rect(x: number, y: number, width: number, height: number) {
	return { x, y, width, height };
}

export function mapScreenId(intent: KoreMenuMapIntent, difficulty?: KoreMenuDifficulty): KoreMenuScreen { return koreMenuMapScreen(intent, difficulty); }

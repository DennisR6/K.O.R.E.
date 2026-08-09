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

const BTN_W = 180;
const BTN_H = 48;

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

	// 1. MAIN MENU
	builder.addScreen(
		ui.screen({
			id: KoreMenuScreen.Main,
			layout: ui.layout.vertical({ gap: 20, justify: "center", align: "center", padding: { top: 0, right: 30, bottom: 40, left: 30 } }),
			elements: [
        ui.container({
          id: "HelpContainer",
          rect: rect(0, 0, 740, 240),
          style: "HelpContainer",
          elements: 
          [
            ui.button({ id: "HelpButton", rect: rect(250, 40, 240, 270), style: "HelpButton", text:"" }),
            ui.container({
					id: KoreMenuElement.MainActions,
					rect: rect(0, 0, 740, 240),
					layout: ui.layout.vertical({ gap: 12, justify: "center", align: "center", padding: { top:  0, right: 0, bottom: 30, left: 0 } }),
					style: KoreMenuStyle.MainActions,
					elements: [
            ui.text({ id: KoreMenuElement.MainTitle, text: translate(language, KoreMenuText.Title), rect: rect(0, 0, 60, 48), style: KoreMenuStyle.MapTitle }),
						ui.container({
    id: "image-text-button",
    rect: { x: 0, y: 0, width: 220, height: 60 },
    layout: ui.layout.absolute(), style: KoreMenuStyle.OnlineButton,
	groupHover: true,
    elements: [
        ui.button({
            id: "action",
            text: "",
            rect: { x: 0, y: 0, width: 220, height: 60 },
			style: KoreMenuStyle.OnlineButton,
            action: ui.action.emit("ui.action.navigate(KoreMenuScreen.OnlineSub)"),
        }),
        ui.image({
            id: "icon",
            source: "/public/picture/menuicons/users.svg",
            rect: { x: 12, y: 10, width: 40, height: 40 },
			style: KoreMenuStyle.OnlineButton,
        }),
        ui.text({
            id: "label",
            text: translate(language, KoreMenuText.Online),	
            rect: { x: 64, y: 20, width: 140, height: 20 },
			style: KoreMenuStyle.OnlineButton,
        }),
    ],
}),
						menuButton(KoreMenuElement.MainLocal, translate(language, KoreMenuText.Local), KoreMenuScreen.LocalSub, KoreMenuStyle.LocalButton),
						ui.button({ id: KoreMenuElement.MainSettings, text: "Settings", rect: rect(0, 0, BTN_W, BTN_H), style: KoreMenuStyle.SettingsButton, action: ui.action.navigate(KoreMenuScreen.Settings) }),
						ui.button({ id: KoreMenuElement.MainCredits, text: "Credits", rect: rect(0, 0, BTN_W, BTN_H), style: KoreMenuStyle.CreditsButton, action: ui.action.navigate(KoreMenuScreen.Credits) }),
					],
				}),]
          }
        ),
			],
		})
	);

	// 2. ONLINE AND LOCAL SUBMENUS
	builder.addScreen(submenuScreen(KoreMenuScreen.OnlineSub, translate(language, KoreMenuText.Online), [
		ui.button({ id: "online-btn-matchmaking", text: "Matchmaking", rect: rect(0, 0, 180, BTN_H), style: KoreMenuStyle.MainButton, action: ui.action.navigate(KoreMenuScreen.MapOnline) }),
		ui.button({ id: "online-btn-friends", text: "vs Friends", rect: rect(0, 0, 180, BTN_H), style: KoreMenuStyle.MainButton, action: ui.action.emit(KoreMenuCommand.OpenOnlineFriends) }),
	]));
	builder.addScreen(submenuScreen(KoreMenuScreen.LocalSub, translate(language, KoreMenuText.Local), [
		ui.button({ id: "local-btn-vski", text: "vs KI", rect: rect(0, 0, 180, BTN_H), style: KoreMenuStyle.MainButton, action: ui.action.navigate(KoreMenuScreen.Difficulty) }),
		ui.button({ id: "local-btn-vsplayer", text: "vs Player", rect: rect(0, 0, 180, BTN_H), style: KoreMenuStyle.MainButton, action: ui.action.emit(KoreMenuCommand.StartLocal) }),
		ui.button({ id: "local-btn-kivski", text: "KI vs KI", rect: rect(0, 0, 180, BTN_H), style: KoreMenuStyle.MainButton, action: ui.action.navigate(KoreMenuScreen.MapBattle) }),
	]));
	builder.addScreen(simpleScreen(KoreMenuScreen.Settings, "Settings", language));
	builder.addScreen(simpleScreen(KoreMenuScreen.Credits, "Credits", language));

	// 3. Map and difficulty screens are all declared in the same SDK menu.
	for (const intent of [KoreMenuMapIntent.Local, KoreMenuMapIntent.Online, KoreMenuMapIntent.Battle]) builder.addScreen(mapScreen(intent, undefined, language));
	builder.addScreen(difficultyScreen(language));
	for (const difficulty of Object.values(KoreMenuDifficulty)) builder.addScreen(mapScreen(KoreMenuMapIntent.Ai, difficulty, language));

	return builder.build();
}

/** Primary menu actions navigate; the navigation target is authored per button. */
function menuButton(id: KoreMenuElement, text: string, target: KoreMenuScreen, style: KoreMenuStyle) {
	return ui.button({ id, text, rect: rect(0, 0, BTN_W, BTN_H), style, action: ui.action.navigate(target) });
}

function submenuScreen(id: KoreMenuScreen, title: string, buttons: ReturnType<typeof ui.button>[]) {
	return ui.screen({
		id,
		layout: ui.layout.vertical({ gap: 20, justify: "center", align: "center", padding: { top: 35, right: 30, bottom: 40, left: 30 } }),
		elements: [
			ui.text({ id: `${id}-title`, text: title, rect: rect(0, 0, 200, 40), style: KoreMenuStyle.MapTitle }),
			ui.container({ id: `${id}-actions`, rect: rect(0, 0, 740, 220), layout: ui.layout.vertical({ gap: 12, justify: "center", align: "center" }), elements: [...buttons, ui.button({ id: `${id}-back`, text: "Back", rect: rect(0, 0, 120, 36), style: KoreMenuStyle.Back, action: ui.action.back() })] }),
		],
	});
}

function simpleScreen(id: KoreMenuScreen, title: string, language: LanguageCatalog) {
	return ui.screen({
		id,
		layout: ui.layout.vertical({ gap: 20, justify: "center", align: "center" }),
		elements: [
			ui.text({ id: `${id}-title`, text: title, rect: rect(0, 0, 200, 40), style: KoreMenuStyle.MapTitle }),
			ui.button({ id: `${id}-back`, text: translate(language, KoreMenuText.Back), rect: rect(0, 0, 120, 36), style: KoreMenuStyle.Back, action: ui.action.back() }),
		],
	});
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

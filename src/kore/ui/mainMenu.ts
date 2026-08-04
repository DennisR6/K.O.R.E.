import { audio, type AudioRuntimeSettings, validateAudioSettings } from "../../engine/audio-sdk/index.js";
import { engine } from "../../engine/sdk/index.js";
import type { JsonValue } from "../../engine/contracts/systemSettings.js";
import { ui, validateUiSettings, type UiMenuSettings } from "../../engine/ui-sdk/index.js";
import { MAP_CATALOG } from "../../content/mapCatalog.js";
import { koreAudio, createKoreAudioSettings } from "../audio.js";

export type KoreMenuMapIntent = "local" | "online" | "battle" | "ai";
export type KoreMainMenuSettings = { schemaVersion: 1; id: "kore.main-menu"; ui: UiMenuSettings; audio: AudioRuntimeSettings; metadata: { schemaVersion: 1; title: string; worldSize: { width: number; height: number }; confirmationCommands: string[]; confirmationSoundId: string } };

const SIZE = { width: 800, height: 450 };
const MAIN_ACTIONS = {
	openAi: "kore.menu.open-ai",
	openBattle: "kore.menu.open-battle",
	openOnline: "kore.menu.open-online",
	startLocal: "kore.menu.start-local-game",
	openLocalMaps: "kore.menu.open-local-maps",
	selectMap: "kore.menu.select-map",
	openAiMaps: "kore.menu.open-ai-maps",
} as const;

export class KoreMainMenuComposition {
	public build(): KoreMainMenuSettings {
		const menuMusic = koreAudio.command.menuMusic("kore.menu");
		const audioSettings = createKoreAudioSettings("kore.menu.runtime");
		const settings: KoreMainMenuSettings = {
			schemaVersion: 1,
			id: "kore.main-menu",
			ui: buildUiSettings(),
			audio: { ...audioSettings, framework: audio.createDefaultFramework(), persistentSources: [{ sourceId: "kore.menu", command: menuMusic }] },
			metadata: { schemaVersion: 1, title: "KORE", worldSize: { ...SIZE }, confirmationCommands: [MAIN_ACTIONS.openAi, MAIN_ACTIONS.openBattle, MAIN_ACTIONS.openOnline, MAIN_ACTIONS.startLocal, MAIN_ACTIONS.openLocalMaps], confirmationSoundId: koreAudio.sounds.uiConfirm },
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
	if (settings.schemaVersion !== 1 || settings.id !== "kore.main-menu" || !settings.ui || !settings.audio || !settings.metadata || settings.metadata.schemaVersion !== 1 || settings.metadata.title !== "KORE" || settings.metadata.worldSize?.width !== SIZE.width || settings.metadata.worldSize?.height !== SIZE.height || !Array.isArray(settings.metadata.confirmationCommands) || settings.metadata.confirmationCommands.some(command => typeof command !== "string") || typeof settings.metadata.confirmationSoundId !== "string") throw new Error("Malformed KORE main-menu settings");
	validateUiSettings(settings.ui); validateAudioSettings(settings.audio);
	if (!settings.audio.persistentSources.some(source => source.sourceId === "kore.menu" && source.command.type === "playMusic" && source.command.soundId === koreAudio.music.menu)) throw new Error("Main menu requires persistent menu music");
	for (const sound of settings.audio.persistentSources.map(source => source.command.soundId)) if (!(sound in koreAudio.assets)) throw new Error(`Unknown KORE menu sound '${sound}'`);
	if (!(settings.metadata.confirmationSoundId in koreAudio.assets)) throw new Error(`Unknown KORE menu confirmation sound '${settings.metadata.confirmationSoundId}'`);
	engine.createEntity(JSON.parse(JSON.stringify(settings)) as JsonValue);
}

export const koreMenuCommands = MAIN_ACTIONS;

function buildUiSettings(): UiMenuSettings {
	const builder = ui.createMenu({ id: "kore.main-menu.ui", size: SIZE });
	builder.addScreen(ui.screen({ id: "landing", layout: ui.layout.absolute(), elements: [
		ui.text({ id: "landing-prompt", text: "drücke um zu starten", rect: rect(200, 180, 480, 58), style: "kore.menu.landing-prompt", visible: false }),
		ui.button({ id: "landing-start", text: "", rect: rect(0, 0, 800, 450), style: "kore.menu.landing-hitbox", action: ui.action.navigate("main") }),
	] }));
	builder.addScreen(ui.screen({ id: "main", layout: ui.layout.absolute(), elements: [
		menuButton("main-ai", "1 vs KI", 270, 112, MAIN_ACTIONS.openAi),
		menuButton("main-battle", "KI vs KI", 270, 176, MAIN_ACTIONS.openBattle),
		menuButton("main-online", "Play Online", 270, 240, MAIN_ACTIONS.openOnline),
		menuButton("main-local", "Play Local Game", 270, 304, MAIN_ACTIONS.startLocal),
		menuButton("main-maps", "Choose Map", 270, 368, MAIN_ACTIONS.openLocalMaps),
	] }));
	for (const intent of ["local", "online", "battle"] as const) builder.addScreen(mapScreen(intent));
	builder.addScreen(difficultyScreen());
	for (const difficulty of ["easy", "medium", "hard"] as const) builder.addScreen(mapScreen("ai", difficulty));
	return builder.build();
}

function mapScreen(intent: KoreMenuMapIntent, difficulty?: "easy" | "medium" | "hard") {
	const eligible = MAP_CATALOG.filter(entry => entry.browserAvailable && (intent !== "battle" || entry.battleAvailable));
	const title = intent === "ai" ? `Choose Map for ${difficulty} KI` : "Choose Map";
	const elements = [
		ui.text({ id: `map-${intent}-${difficulty ?? "root"}-title`, text: title, rect: rect(155, 25, 580, 42), style: "kore.menu.map-title" }),
		...(intent === "online" ? [ui.text({ id: "map-online-note", text: "Preference only — the server may choose Ice Map", rect: rect(155, 54, 560, 20), style: "kore.menu.map-note" })] : []),
		...eligible.map((entry, index) => ui.button({ id: `map-${intent}-${difficulty ?? "root"}-${entry.id}`, text: `${entry.name} (${entry.id})`, rect: rect(150, 80 + index * 50, 500, 40), style: "kore.menu.map-row", action: ui.action.emit(MAIN_ACTIONS.selectMap, { intent, mapId: entry.id, ...(difficulty ? { difficulty } : {}) }) })),
		ui.button({ id: `map-${intent}-${difficulty ?? "root"}-back`, text: "Back", rect: rect(150, 80 + eligible.length * 50 + 8, 120, 34), style: "kore.menu.back", action: ui.action.back() }),
	];
	return ui.screen({ id: mapScreenId(intent, difficulty), layout: ui.layout.absolute(), elements });
}

function difficultyScreen() {
	return ui.screen({ id: "difficulty", layout: ui.layout.absolute(), elements: [
		ui.text({ id: "difficulty-title", text: "Choose KI difficulty", rect: rect(265, 64, 300, 32), style: "kore.menu.difficulty-title" }),
		...(["easy", "medium", "hard"] as const).map((difficulty, index) => ui.button({ id: `difficulty-${difficulty}`, text: `${difficulty[0]!.toUpperCase()}${difficulty.slice(1)} KI`, rect: rect(270, 130 + index * 60, 260, 48), style: "kore.menu.difficulty", action: ui.action.emit(MAIN_ACTIONS.openAiMaps, { difficulty }) })),
		ui.button({ id: "difficulty-back", text: "Back", rect: rect(270, 320, 260, 42), style: "kore.menu.difficulty-back", action: ui.action.back() }),
	] });
}

function menuButton(id: string, text: string, x: number, y: number, command: string) { return ui.button({ id, text, rect: rect(x, y, 260, 58), style: "kore.menu.main-button", action: ui.action.emit(command) }); }
function rect(x: number, y: number, width: number, height: number) { return { x, y, width, height }; }
export function mapScreenId(intent: KoreMenuMapIntent, difficulty?: "easy" | "medium" | "hard"): string { return intent === "ai" ? `map-ai-${difficulty}` : `map-${intent}`; }

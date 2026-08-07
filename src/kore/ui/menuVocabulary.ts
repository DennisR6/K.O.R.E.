import type { JsonValue } from "../../engine/contracts/systemSettings.js";
import type { AiDifficulty } from "../../ai/types.js";
import { LANGUAGE_KEYS } from "../../i18n/language.js";
import { getSelectableGameModes } from "../../rules/modeCatalog.js";

/** KORE-owned menu vocabulary. These values serialize as strings for generic UI. */
export enum KoreMenuId {
	Composition = "kore.main-menu",
	Runtime = "kore.main-menu.ui",
	AudioSource = "kore.menu",
	AudioRuntime = "kore.menu.runtime",
}

export enum KoreMenuMapIntent {
	Local = "local",
	Online = "online",
	Battle = "battle",
	Ai = "ai",
}

export enum KoreMenuDifficulty {
	Easy = "easy",
	Medium = "medium",
	Hard = "hard",
}

export enum KoreMenuCommand {
	OpenAi = "kore.menu.open-ai",
	OpenBattle = "kore.menu.open-battle",
	OpenOnline = "kore.menu.open-online",
	OpenOnlineFriends = "kore.menu.open-online-friends",
	StartLocal = "kore.menu.start-local-game",
	OpenLocalMaps = "kore.menu.open-local-maps",
	SelectMap = "kore.menu.select-map",
	OpenAiMaps = "kore.menu.open-ai-maps",
}

export enum KoreMenuScreen {
	Landing = "landing",
	Main = "main",
	OnlineSub = "online_sub",
	LocalSub = "local_sub",
	Settings = "settings",
	Credits = "credits",
	Difficulty = "difficulty",
	MapLocal = "map-local",
	MapOnline = "map-online",
	MapBattle = "map-battle",
	MapAiEasy = "map-ai-easy",
	MapAiMedium = "map-ai-medium",
	MapAiHard = "map-ai-hard",
}

export enum KoreMenuElement {
	LandingPrompt = "landing-prompt",
	LandingStart = "landing-start",
	MainTitle = "main-title",
	MainActions = "main-actions",
	MainAi = "main-ai",
	MainBattle = "main-battle",
	MainOnline = "main-online",
	MainLocal = "main-local",
	MainMaps = "main-maps",
	MainSettings = "main-settings",
	MainCredits = "main-credits",
	OnlineSubTitle = "online-sub-title",
	LocalSubTitle = "local-sub-title",
	MapOnlineNote = "map-online-note",
	DifficultyTitle = "difficulty-title",
	DifficultyBack = "difficulty-back",
}

export enum KoreMenuStyle {
	LandingPrompt = "kore.menu.landing-prompt",
	LandingHitbox = "kore.menu.landing-hitbox",
	/** Shared KORE button theme styles; the renderer resolves them through KORE_UI_THEME. */
	MainButton = "kore.button.blue",
	OnlineButton = "kore.button.online",
	LocalButton = "kore.button.local",
	SettingsButton = "kore.button.settings",
	CreditsButton = "kore.button.credits",
	MainActions = "kore.menu.main-actions",
	MapTitle = "kore.menu.map-title",
	MapNote = "kore.menu.map-note",
	MapRow = "kore.menu.map-row",
	/** Back buttons keep their dedicated theme style. */
	Back = "kore.button.blue-back",
	DifficultyTitle = "kore.menu.difficulty-title",
	Difficulty = "kore.button.blue",
	DifficultyBack = "kore.button.blue-back",
}

export enum KoreMenuColor {
	Prompt = "#3b82f6",
	Text = "#f8fafc",
	Error = "#b91c1c",
}

export const KoreMenuText = {
	Title: LANGUAGE_KEYS.MenuTitle,
	LandingPrompt: LANGUAGE_KEYS.MenuLandingPrompt,
	Ai: LANGUAGE_KEYS.MenuAiButton,
	Battle: LANGUAGE_KEYS.MenuBattleButton,
	Online: LANGUAGE_KEYS.MenuOnlineButton,
	Local: LANGUAGE_KEYS.MenuLocalButton,
	ChooseMap: LANGUAGE_KEYS.MenuChooseMapButton,
	OnlineMapNote: LANGUAGE_KEYS.MenuOnlineMapNote,
	Back: LANGUAGE_KEYS.MenuBackButton,
	ChooseAiDifficulty: LANGUAGE_KEYS.MenuDifficultyTitle,
	Ki: LANGUAGE_KEYS.MenuKiLabel,
} as const;

const COMMANDS = new Set<string>(Object.values(KoreMenuCommand));
const INTENTS = new Set<string>(Object.values(KoreMenuMapIntent));
const DIFFICULTIES = new Set<string>(Object.values(KoreMenuDifficulty));

export type KoreMenuCommandMessage =
	| { type: KoreMenuCommand.OpenAi; payload: undefined }
	| { type: KoreMenuCommand.OpenBattle; payload: undefined }
	| { type: KoreMenuCommand.OpenOnline; payload: undefined }
	| { type: KoreMenuCommand.OpenOnlineFriends; payload: undefined }
	| { type: KoreMenuCommand.StartLocal; payload: undefined }
	| { type: KoreMenuCommand.OpenLocalMaps; payload: undefined }
	| { type: KoreMenuCommand.OpenAiMaps; payload: { difficulty: KoreMenuDifficulty } }
	| { type: KoreMenuCommand.SelectMap; payload: { intent: KoreMenuMapIntent; mapId: string; difficulty?: KoreMenuDifficulty; modeId?: string } };

export function isKoreMenuCommand(value: string): value is KoreMenuCommand { return COMMANDS.has(value); }
export function isKoreMenuMapIntent(value: unknown): value is KoreMenuMapIntent { return typeof value === "string" && INTENTS.has(value); }
export function isKoreMenuDifficulty(value: unknown): value is KoreMenuDifficulty { return typeof value === "string" && DIFFICULTIES.has(value); }

/** Narrows untrusted generic UI commands at the KORE boundary. */
export function parseKoreMenuCommand(command: string, payload: JsonValue | undefined): KoreMenuCommandMessage | undefined {
	if (!isKoreMenuCommand(command)) return undefined;
	if (command === KoreMenuCommand.OpenAiMaps) {
		if (!isRecord(payload) || !isKoreMenuDifficulty(payload.difficulty)) return undefined;
		return { type: command, payload: { difficulty: payload.difficulty } };
	}
	if (command === KoreMenuCommand.SelectMap) {
		if (!isRecord(payload) || !isKoreMenuMapIntent(payload.intent) || typeof payload.mapId !== "string" || (payload.difficulty !== undefined && !isKoreMenuDifficulty(payload.difficulty)) || (payload.modeId !== undefined && (typeof payload.modeId !== "string" || !getSelectableGameModes().some(mode => mode.id === payload.modeId)))) return undefined;
		return { type: command, payload: { intent: payload.intent, mapId: payload.mapId, ...(payload.difficulty === undefined ? {} : { difficulty: payload.difficulty }), ...(payload.modeId === undefined ? {} : { modeId: payload.modeId }) } };
	}
	if (payload !== undefined) return undefined;
	return { type: command, payload: undefined } as KoreMenuCommandMessage;
}

export function koreMenuMapScreen(intent: KoreMenuMapIntent, difficulty?: KoreMenuDifficulty): KoreMenuScreen {
	if (intent === KoreMenuMapIntent.Local) return KoreMenuScreen.MapLocal;
	if (intent === KoreMenuMapIntent.Online) return KoreMenuScreen.MapOnline;
	if (intent === KoreMenuMapIntent.Battle) return KoreMenuScreen.MapBattle;
	switch (difficulty) {
		case KoreMenuDifficulty.Easy: return KoreMenuScreen.MapAiEasy;
		case KoreMenuDifficulty.Medium: return KoreMenuScreen.MapAiMedium;
		case KoreMenuDifficulty.Hard: return KoreMenuScreen.MapAiHard;
		default: throw new Error("An AI map screen requires a KORE menu difficulty");
	}
}

/** Dynamic map-row IDs are derived only from validated KORE enum context and catalog data. */
export function koreMenuMapElementId(intent: KoreMenuMapIntent, mapId: string, difficulty?: KoreMenuDifficulty, modeId?: string): string { return `map-${intent}-${difficulty ?? "root"}-${mapId}${modeId ? `-${modeId}` : ""}`; }
export function koreMenuMapTitleElementId(intent: KoreMenuMapIntent, difficulty?: KoreMenuDifficulty): string { return `map-${intent}-${difficulty ?? "root"}-title`; }
export function koreMenuMapBackElementId(intent: KoreMenuMapIntent, difficulty?: KoreMenuDifficulty): string { return `map-${intent}-${difficulty ?? "root"}-back`; }
/** Difficulty-row IDs are derived solely from the closed difficulty enum. */
export function koreMenuDifficultyElementId(difficulty: KoreMenuDifficulty): string { return `difficulty-${difficulty}`; }

/** The KORE UI difficulty enum remains compatible with the AI domain contract. */
export function asAiDifficulty(difficulty: KoreMenuDifficulty): AiDifficulty { return difficulty; }

function isRecord(value: JsonValue | undefined): value is { [key: string]: JsonValue } { return !!value && typeof value === "object" && !Array.isArray(value); }

import type { JsonValue } from "../../engine/contracts/systemSettings.js";
import type { AiDifficulty } from "../../ai/types.js";

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
	StartLocal = "kore.menu.start-local-game",
	OpenLocalMaps = "kore.menu.open-local-maps",
	SelectMap = "kore.menu.select-map",
	OpenAiMaps = "kore.menu.open-ai-maps",
}

export enum KoreMenuScreen {
	Landing = "landing",
	Main = "main",
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
	MapOnlineNote = "map-online-note",
	DifficultyTitle = "difficulty-title",
	DifficultyBack = "difficulty-back",
}

export enum KoreMenuStyle {
	LandingPrompt = "kore.menu.landing-prompt",
	LandingHitbox = "kore.menu.landing-hitbox",
	MainButton = "kore.menu.main-button",
	MainActions = "kore.menu.main-actions",
	MapTitle = "kore.menu.map-title",
	MapNote = "kore.menu.map-note",
	MapRow = "kore.menu.map-row",
	Back = "kore.menu.back",
	DifficultyTitle = "kore.menu.difficulty-title",
	Difficulty = "kore.menu.difficulty",
	DifficultyBack = "kore.menu.difficulty-back",
}

export enum KoreMenuColor {
	Prompt = "blue",
	Text = "white",
	BackButton = "#475569",
	Button = "#102a43",
	Error = "#b91c1c",
}

export enum KoreMenuText {
	Title = "KORE",
	LandingPrompt = "drücke um zu starten",
	Ai = "1 vs KI",
	Battle = "KI vs KI",
	Online = "Play Online",
	Local = "Play Local Game",
	ChooseMap = "Choose Map",
	OnlineMapNote = "Preference only — the server may choose Ice Map",
	Back = "Back",
	ChooseAiDifficulty = "Choose KI difficulty",
	Ki = "KI",
}

const COMMANDS = new Set<string>(Object.values(KoreMenuCommand));
const INTENTS = new Set<string>(Object.values(KoreMenuMapIntent));
const DIFFICULTIES = new Set<string>(Object.values(KoreMenuDifficulty));

export type KoreMenuCommandMessage =
	| { type: KoreMenuCommand.OpenAi; payload: undefined }
	| { type: KoreMenuCommand.OpenBattle; payload: undefined }
	| { type: KoreMenuCommand.OpenOnline; payload: undefined }
	| { type: KoreMenuCommand.StartLocal; payload: undefined }
	| { type: KoreMenuCommand.OpenLocalMaps; payload: undefined }
	| { type: KoreMenuCommand.OpenAiMaps; payload: { difficulty: KoreMenuDifficulty } }
	| { type: KoreMenuCommand.SelectMap; payload: { intent: KoreMenuMapIntent; mapId: string; difficulty?: KoreMenuDifficulty } };

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
		if (!isRecord(payload) || !isKoreMenuMapIntent(payload.intent) || typeof payload.mapId !== "string" || (payload.difficulty !== undefined && !isKoreMenuDifficulty(payload.difficulty))) return undefined;
		return { type: command, payload: { intent: payload.intent, mapId: payload.mapId, ...(payload.difficulty === undefined ? {} : { difficulty: payload.difficulty }) } };
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
export function koreMenuMapElementId(intent: KoreMenuMapIntent, mapId: string, difficulty?: KoreMenuDifficulty): string { return `map-${intent}-${difficulty ?? "root"}-${mapId}`; }
export function koreMenuMapTitleElementId(intent: KoreMenuMapIntent, difficulty?: KoreMenuDifficulty): string { return `map-${intent}-${difficulty ?? "root"}-title`; }
export function koreMenuMapBackElementId(intent: KoreMenuMapIntent, difficulty?: KoreMenuDifficulty): string { return `map-${intent}-${difficulty ?? "root"}-back`; }

/** The KORE UI difficulty enum remains compatible with the AI domain contract. */
export function asAiDifficulty(difficulty: KoreMenuDifficulty): AiDifficulty { return difficulty; }

function isRecord(value: JsonValue | undefined): value is { [key: string]: JsonValue } { return !!value && typeof value === "object" && !Array.isArray(value); }

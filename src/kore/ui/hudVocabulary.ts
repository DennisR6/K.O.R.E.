/** KORE-owned serialized HUD identifiers. Generic UI continues to accept strings. */
import { LANGUAGE_KEYS } from "../../i18n/language.js";
export enum KoreHudId {
	Composition = "kore.game-hud",
	Runtime = "kore.game-hud.ui",
	AudioRuntime = "kore.hud.runtime",
	SoundSource = "kore.game-hud",
}

export enum KoreHudNamespace {
	Command = "kore.hud.",
}

export enum KoreHudScreen {
	Main = "hud",
}

export enum KoreHudElement {
	Turn = "hud-turn",
	State = "hud-state",
	Aim = "hud-aim",
	Rejection = "hud-rejection",
	Pause = "hud-pause",
	ItemsTitle = "hud-items-title",
	SkipItem = "hud-skip-item",
	ResultPanel = "hud-result-panel",
	Result = "hud-result",
	Rematch = "hud-rematch",
	Menu = "hud-menu",
	Replay = "hud-replay",
	Share = "hud-share",
	Paused = "hud-paused",
	Resume = "hud-resume",
}

export enum KoreHudStyle {
	Status = "kore.hud.status",
	StatusSmall = "kore.hud.status-small",
	Rejection = "kore.hud.rejection",
	Pause = "kore.hud.pause",
	ItemsTitle = "kore.hud.items-title",
	Item = "kore.hud.item",
	Skip = "kore.hud.skip",
	ResultPanel = "kore.hud.result-panel",
	ResultTitle = "kore.hud.result-title",
	ResultAction = "kore.hud.result-action",
	ResultSecondary = "kore.hud.result-secondary",
}

export enum KoreHudColor {
	Danger = "#b91c1c",
	Ink = "#0f172a",
	Panel = "#e2e8f0",
	Action = "#2563eb",
	Pause = "#475569",
	DefaultButton = "#334155",
	Text = "white",
	TeamOne = "#38bdf8",
	TeamTwo = "#fb7185",
}

export const KoreHudText = {
	Pause: LANGUAGE_KEYS.HudPause,
	Items: LANGUAGE_KEYS.HudItems,
	SkipItemPhase: LANGUAGE_KEYS.HudSkipPhase,
	Rematch: LANGUAGE_KEYS.HudRematch,
	Menu: LANGUAGE_KEYS.HudMenu,
	Replay: LANGUAGE_KEYS.HudReplay,
	Share: LANGUAGE_KEYS.HudShare,
	Paused: LANGUAGE_KEYS.HudPaused,
	Resume: LANGUAGE_KEYS.HudResume,
	None: LANGUAGE_KEYS.HudNone,
	Waiting: LANGUAGE_KEYS.HudWaiting,
} as const;

export enum KoreHudItemSlot {
	First = 0,
	Second = 1,
	Third = 2,
	Fourth = 3,
	Fifth = 4,
	Sixth = 5,
}

export const KORE_HUD_ITEM_SLOTS: readonly KoreHudItemSlot[] = [
	KoreHudItemSlot.First,
	KoreHudItemSlot.Second,
	KoreHudItemSlot.Third,
	KoreHudItemSlot.Fourth,
	KoreHudItemSlot.Fifth,
	KoreHudItemSlot.Sixth,
];

/** Dynamic item controls are derived solely from the closed slot enum. */
export function koreHudItemElementId(slot: KoreHudItemSlot): string { return `hud-item-${slot}`; }

import { audio, type AudioRuntimeSettings, validateAudioSettings } from "../../engine/audio-sdk/index.js";
import type { JsonValue } from "../../engine/contracts/systemSettings.js";
import { engine } from "../../engine/sdk/index.js";
import { ui, type UiMenuSettings, validateUiSettings } from "../../engine/ui-sdk/index.js";
import { createKoreAudioSettings, koreAudio } from "../audio.js";
import { KoreHudCommand, isKoreHudCommand } from "./hudCommands.js";

export type KoreGameHudSettings = { schemaVersion: 1; id: "kore.game-hud"; ui: UiMenuSettings; audio: AudioRuntimeSettings; metadata: { schemaVersion: 1; itemSlots: number; commandValues: string[] } };
const SIZE = { width: 800, height: 450 }; const ITEM_SLOTS = 6;

export class KoreGameHudComposition {
	public build(): KoreGameHudSettings {
		const settings: KoreGameHudSettings = { schemaVersion: 1, id: "kore.game-hud", ui: buildUi(), audio: { ...createKoreAudioSettings("kore.hud.runtime"), framework: audio.createDefaultFramework() }, metadata: { schemaVersion: 1, itemSlots: ITEM_SLOTS, commandValues: Object.values(KoreHudCommand) } };
		validateKoreGameHudSettings(settings); return structuredClone(settings);
	}
	public buildJson(space: number = 2): string { return JSON.stringify(this.build(), null, space); }
}
export function createGameHudComposition(): KoreGameHudComposition { return new KoreGameHudComposition(); }

export function validateKoreGameHudSettings(value: unknown): asserts value is KoreGameHudSettings {
	if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Malformed KORE HUD settings"); const settings = value as Partial<KoreGameHudSettings>;
	if (settings.schemaVersion !== 1 || settings.id !== "kore.game-hud" || !settings.ui || !settings.audio || !settings.metadata || settings.metadata.schemaVersion !== 1 || settings.metadata.itemSlots !== ITEM_SLOTS || !Array.isArray(settings.metadata.commandValues) || settings.metadata.commandValues.some(command => typeof command !== "string" || !isKoreHudCommand(command))) throw new Error("Malformed KORE HUD settings");
	validateUiSettings(settings.ui); validateAudioSettings(settings.audio); engine.createEntity(JSON.parse(JSON.stringify(settings)) as JsonValue);
	for (const element of settings.ui.screens.flatMap(screen => screen.elements)) if (element.action?.type === "emit" && element.action.command.startsWith("kore.hud.") && !isKoreHudCommand(element.action.command)) throw new Error(`Unknown KORE HUD command '${element.action.command}'`);
}

function buildUi(): UiMenuSettings {
	const builder = ui.createMenu({ id: "kore.game-hud.ui", size: SIZE });
	builder.addScreen(ui.screen({ id: "hud", layout: ui.layout.absolute(), elements: [
		ui.text({ id: "hud-turn", text: "", rect: rect(18, 12, 350, 20), style: "kore.hud.status" }),
		ui.text({ id: "hud-state", text: "", rect: rect(18, 32, 350, 18), style: "kore.hud.status-small" }),
		ui.text({ id: "hud-aim", text: "", rect: rect(18, 50, 350, 18), style: "kore.hud.status-small" }),
		ui.text({ id: "hud-rejection", text: "", rect: rect(18, 420, 500, 20), style: "kore.hud.rejection", visible: false }),
		ui.button({ id: "hud-pause", text: "Pause", rect: rect(710, 10, 76, 30), style: "kore.hud.pause", action: ui.action.emit(KoreHudCommand.Pause) }),
		ui.text({ id: "hud-items-title", text: "Items", rect: rect(510, 48, 260, 18), style: "kore.hud.items-title", visible: false }),
		...Array.from({ length: ITEM_SLOTS }, (_, index) => ui.button({ id: `hud-item-${index}`, text: "", rect: rect(520, 70 + index * 38, 250, 30), style: "kore.hud.item", enabled: false, visible: false })),
		ui.button({ id: "hud-skip-item", text: "Skip phase", rect: rect(560, 310, 200, 34), style: "kore.hud.skip", action: ui.action.emit(KoreHudCommand.SkipItemPhase), visible: false }),
		ui.button({ id: "hud-result-panel", text: "", rect: rect(210, 95, 380, 315), style: "kore.hud.result-panel", enabled: false, visible: false }),
		ui.text({ id: "hud-result", text: "", rect: rect(230, 120, 360, 50), style: "kore.hud.result-title", visible: false }),
		ui.button({ id: "hud-rematch", text: "Rematch", rect: rect(245, 300, 145, 48), style: "kore.hud.result-action", action: ui.action.emit(KoreHudCommand.Rematch), visible: false }),
		ui.button({ id: "hud-menu", text: "Menu", rect: rect(410, 300, 145, 48), style: "kore.hud.result-action", action: ui.action.emit(KoreHudCommand.ReturnToMenu), visible: false }),
		ui.button({ id: "hud-replay", text: "Replay", rect: rect(245, 355, 145, 32), style: "kore.hud.result-secondary", action: ui.action.emit(KoreHudCommand.Replay), visible: false }),
		ui.button({ id: "hud-share", text: "Share", rect: rect(410, 355, 145, 32), style: "kore.hud.result-secondary", action: ui.action.emit(KoreHudCommand.Share), visible: false }),
		ui.text({ id: "hud-paused", text: "Paused", rect: rect(330, 180, 160, 40), style: "kore.hud.result-title", visible: false }),
		ui.button({ id: "hud-resume", text: "Resume", rect: rect(330, 240, 140, 42), style: "kore.hud.result-action", action: ui.action.emit(KoreHudCommand.Resume), visible: false }),
	] })); return builder.build();
}
function rect(x: number, y: number, width: number, height: number) { return { x, y, width, height }; }
export const koreHudSoundIds = { confirm: koreAudio.sounds.uiConfirm } as const;

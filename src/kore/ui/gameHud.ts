import { audio, type AudioRuntimeSettings, validateAudioSettings } from "../../engine/audio-sdk/index.js";
import type { JsonValue } from "../../engine/contracts/systemSettings.js";
import { engine } from "../../engine/sdk/index.js";
import { ui, type UiMenuSettings, validateUiSettings } from "../../engine/ui-sdk/index.js";
import { createKoreAudioSettings, koreAudio } from "../audio.js";
import { KoreHudCommand, isKoreHudCommand } from "./hudCommands.js";
import { KORE_HUD_ITEM_SLOTS, KoreHudElement, KoreHudId, KoreHudNamespace, KoreHudScreen, KoreHudStyle, KoreHudText, koreHudItemElementId } from "./hudVocabulary.js";

export type KoreGameHudSettings = { schemaVersion: 1; id: KoreHudId.Composition; ui: UiMenuSettings; audio: AudioRuntimeSettings; metadata: { schemaVersion: 1; itemSlots: number; commandValues: KoreHudCommand[] } };
const SIZE = { width: 800, height: 450 }; const ITEM_SLOTS = KORE_HUD_ITEM_SLOTS.length;

export class KoreGameHudComposition {
	public build(): KoreGameHudSettings {
		const settings: KoreGameHudSettings = { schemaVersion: 1, id: KoreHudId.Composition, ui: buildUi(), audio: { ...createKoreAudioSettings(KoreHudId.AudioRuntime), framework: audio.createDefaultFramework() }, metadata: { schemaVersion: 1, itemSlots: ITEM_SLOTS, commandValues: Object.values(KoreHudCommand) } };
		validateKoreGameHudSettings(settings); return structuredClone(settings);
	}
	public buildJson(space: number = 2): string { return JSON.stringify(this.build(), null, space); }
}
export function createGameHudComposition(): KoreGameHudComposition { return new KoreGameHudComposition(); }

export function validateKoreGameHudSettings(value: unknown): asserts value is KoreGameHudSettings {
	if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Malformed KORE HUD settings"); const settings = value as Partial<KoreGameHudSettings>;
	if (settings.schemaVersion !== 1 || settings.id !== KoreHudId.Composition || !settings.ui || !settings.audio || !settings.metadata || settings.metadata.schemaVersion !== 1 || settings.metadata.itemSlots !== ITEM_SLOTS || !Array.isArray(settings.metadata.commandValues) || settings.metadata.commandValues.some(command => typeof command !== "string" || !isKoreHudCommand(command))) throw new Error("Malformed KORE HUD settings");
	validateUiSettings(settings.ui); validateAudioSettings(settings.audio); engine.createEntity(JSON.parse(JSON.stringify(settings)) as JsonValue);
	for (const element of settings.ui.screens.flatMap(screen => screen.elements)) if (element.action?.type === "emit" && element.action.command.startsWith(KoreHudNamespace.Command) && !isKoreHudCommand(element.action.command)) throw new Error(`Unknown KORE HUD command '${element.action.command}'`);
}

function buildUi(): UiMenuSettings {
	const builder = ui.createMenu({ id: KoreHudId.Runtime, size: SIZE });
	builder.addScreen(ui.screen({ id: KoreHudScreen.Main, layout: ui.layout.absolute(), elements: [
		ui.text({ id: KoreHudElement.Turn, text: "", rect: rect(18, 12, 350, 20), style: KoreHudStyle.Status }),
		ui.text({ id: KoreHudElement.State, text: "", rect: rect(18, 32, 350, 18), style: KoreHudStyle.StatusSmall }),
		ui.text({ id: KoreHudElement.Aim, text: "", rect: rect(18, 50, 350, 18), style: KoreHudStyle.StatusSmall }),
		ui.text({ id: KoreHudElement.Rejection, text: "", rect: rect(18, 420, 500, 20), style: KoreHudStyle.Rejection, visible: false }),
		ui.button({ id: KoreHudElement.Pause, text: KoreHudText.Pause, rect: rect(710, 10, 76, 30), style: KoreHudStyle.Pause, action: ui.action.emit(KoreHudCommand.Pause) }),
		ui.text({ id: KoreHudElement.ItemsTitle, text: KoreHudText.Items, rect: rect(510, 48, 260, 18), style: KoreHudStyle.ItemsTitle, visible: false }),
		...KORE_HUD_ITEM_SLOTS.map(slot => ui.button({ id: koreHudItemElementId(slot), text: "", rect: rect(520, 70 + slot * 38, 250, 30), style: KoreHudStyle.Item, enabled: false, visible: false })),
		ui.button({ id: KoreHudElement.SkipItem, text: KoreHudText.SkipItemPhase, rect: rect(560, 310, 200, 34), style: KoreHudStyle.Skip, action: ui.action.emit(KoreHudCommand.SkipItemPhase), visible: false }),
		ui.button({ id: KoreHudElement.ResultPanel, text: "", rect: rect(210, 95, 380, 315), style: KoreHudStyle.ResultPanel, enabled: false, visible: false }),
		ui.text({ id: KoreHudElement.Result, text: "", rect: rect(230, 120, 360, 50), style: KoreHudStyle.ResultTitle, visible: false }),
		ui.button({ id: KoreHudElement.Rematch, text: KoreHudText.Rematch, rect: rect(245, 300, 145, 48), style: KoreHudStyle.ResultAction, action: ui.action.emit(KoreHudCommand.Rematch), visible: false }),
		ui.button({ id: KoreHudElement.Menu, text: KoreHudText.Menu, rect: rect(410, 300, 145, 48), style: KoreHudStyle.ResultAction, action: ui.action.emit(KoreHudCommand.ReturnToMenu), visible: false }),
		ui.button({ id: KoreHudElement.Replay, text: KoreHudText.Replay, rect: rect(245, 355, 145, 32), style: KoreHudStyle.ResultSecondary, action: ui.action.emit(KoreHudCommand.Replay), visible: false }),
		ui.button({ id: KoreHudElement.Share, text: KoreHudText.Share, rect: rect(410, 355, 145, 32), style: KoreHudStyle.ResultSecondary, action: ui.action.emit(KoreHudCommand.Share), visible: false }),
		ui.text({ id: KoreHudElement.Paused, text: KoreHudText.Paused, rect: rect(330, 180, 160, 40), style: KoreHudStyle.ResultTitle, visible: false }),
		ui.button({ id: KoreHudElement.Resume, text: KoreHudText.Resume, rect: rect(330, 240, 140, 42), style: KoreHudStyle.ResultAction, action: ui.action.emit(KoreHudCommand.Resume), visible: false }),
	] })); return builder.build();
}
function rect(x: number, y: number, width: number, height: number) { return { x, y, width, height }; }
export const koreHudSoundIds = { confirm: koreAudio.sounds.uiConfirm } as const;

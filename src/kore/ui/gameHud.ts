import { audio, type AudioRuntimeSettings, validateAudioSettings } from "@coffeemakerstudio/roast";
import type { JsonValue } from "@coffeemakerstudio/roast";
import { engine } from "@coffeemakerstudio/roast";
import { ui, type UiMenuSettings, validateUiSettings } from "@coffeemakerstudio/drip";
import { createKoreAudioSettings, koreAudio } from "../audio.js";
import { KoreHudCommand, isKoreHudCommand } from "./hudCommands.js";
import { KORE_HUD_ITEM_SLOTS, KoreHudElement, KoreHudId, KoreHudNamespace, KoreHudScreen, KoreHudStyle, KoreHudText, koreHudItemElementId } from "./hudVocabulary.js";
import { createEnglishLanguage, translate, type LanguageCatalog } from "../../i18n/language.js";

export type KoreGameHudSettings = { schemaVersion: 1; id: KoreHudId.Composition; ui: UiMenuSettings; audio: AudioRuntimeSettings; metadata: { schemaVersion: 1; itemSlots: number; commandValues: KoreHudCommand[] } };
const SIZE = { width: 800, height: 450 }; const ITEM_SLOTS = KORE_HUD_ITEM_SLOTS.length;

export class KoreGameHudComposition {
	public constructor(private readonly language: LanguageCatalog = createEnglishLanguage()) {}
	public build(): KoreGameHudSettings {
		const settings: KoreGameHudSettings = { schemaVersion: 1, id: KoreHudId.Composition, ui: buildUi(this.language), audio: { ...createKoreAudioSettings(KoreHudId.AudioRuntime), framework: audio.createDefaultFramework() }, metadata: { schemaVersion: 1, itemSlots: ITEM_SLOTS, commandValues: Object.values(KoreHudCommand) } };
		validateKoreGameHudSettings(settings); return structuredClone(settings);
	}
	public buildJson(space: number = 2): string { return JSON.stringify(this.build(), null, space); }
}
export function createGameHudComposition(language?: LanguageCatalog): KoreGameHudComposition { return new KoreGameHudComposition(language); }

export function validateKoreGameHudSettings(value: unknown): asserts value is KoreGameHudSettings {
	if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Malformed KORE HUD settings"); const settings = value as Partial<KoreGameHudSettings>;
	if (settings.schemaVersion !== 1 || settings.id !== KoreHudId.Composition || !settings.ui || !settings.audio || !settings.metadata || settings.metadata.schemaVersion !== 1 || settings.metadata.itemSlots !== ITEM_SLOTS || !Array.isArray(settings.metadata.commandValues) || settings.metadata.commandValues.some(command => typeof command !== "string" || !isKoreHudCommand(command))) throw new Error("Malformed KORE HUD settings");
	validateUiSettings(settings.ui); validateAudioSettings(settings.audio); engine.createEntity(JSON.parse(JSON.stringify(settings)) as JsonValue);
	for (const element of settings.ui.screens.flatMap(screen => screen.elements)) if ((element.kind === "button" || element.kind === "textInput") && element.action?.type === "emit" && element.action.command.startsWith(KoreHudNamespace.Command) && !isKoreHudCommand(element.action.command)) throw new Error(`Unknown KORE HUD command '${element.action.command}'`);
}

function buildUi(language: LanguageCatalog): UiMenuSettings {
	const builder = ui.createMenu({ id: KoreHudId.Runtime, size: SIZE });
	builder.addScreen(ui.screen({ id: KoreHudScreen.Main, layout: ui.layout.absolute(), elements: [
		ui.text({ id: KoreHudElement.Turn, text: "", rect: rect(18, 12, 350, 20), style: KoreHudStyle.Status }),
		ui.text({ id: KoreHudElement.State, text: "", rect: rect(18, 32, 350, 18), style: KoreHudStyle.StatusSmall }),
		ui.text({ id: KoreHudElement.Aim, text: "", rect: rect(18, 50, 350, 18), style: KoreHudStyle.StatusSmall }),
		ui.text({ id: KoreHudElement.Tutorial, text: translate(language, KoreHudText.Tutorial), rect: rect(18, 72, 470, 18), style: KoreHudStyle.StatusSmall, visible: false }),
		ui.text({ id: KoreHudElement.Rejection, text: "", rect: rect(18, 420, 500, 20), style: KoreHudStyle.Rejection, visible: false }),
		ui.button({ id: KoreHudElement.Pause, text: translate(language, KoreHudText.Pause), rect: rect(710, 10, 76, 30), style: KoreHudStyle.Pause, action: ui.action.emit(KoreHudCommand.Pause) }),
		ui.button({ id: KoreHudElement.Report, text: translate(language, KoreHudText.Report), rect: rect(625, 10, 76, 30), style: KoreHudStyle.Pause, action: ui.action.emit(KoreHudCommand.Report) }),
		ui.button({ id: KoreHudElement.ReportPanel, text: "", rect: rect(150, 70, 500, 310), style: KoreHudStyle.ResultPanel, enabled: false, visible: false }),
		ui.text({ id: KoreHudElement.ReportTitle, text: translate(language, KoreHudText.ReportTitle), rect: rect(180, 90, 440, 30), style: KoreHudStyle.ResultTitle, visible: false }),
		ui.button({ id: KoreHudElement.ReportCategoryConduct, text: translate(language, KoreHudText.ReportConduct), rect: rect(180, 145, 200, 34), style: KoreHudStyle.ResultAction, action: ui.action.emit(KoreHudCommand.ReportCategory, { category: "conduct" }), visible: false }),
		ui.button({ id: KoreHudElement.ReportCategoryTechnical, text: translate(language, KoreHudText.ReportTechnical), rect: rect(400, 145, 200, 34), style: KoreHudStyle.ResultAction, action: ui.action.emit(KoreHudCommand.ReportCategory, { category: "technical" }), visible: false }),
		ui.textInput({ id: KoreHudElement.ReportText, text: "", rect: rect(180, 195, 420, 55), style: KoreHudStyle.StatusSmall, value: "", visible: false }),
		ui.button({ id: KoreHudElement.ReportSubmit, text: translate(language, KoreHudText.ReportSubmit), rect: rect(180, 285, 200, 40), style: KoreHudStyle.ResultAction, action: ui.action.emit(KoreHudCommand.SubmitReport), visible: false }),
		ui.button({ id: KoreHudElement.ReportCancel, text: translate(language, KoreHudText.ReportCancel), rect: rect(400, 285, 200, 40), style: KoreHudStyle.ResultSecondary, action: ui.action.emit(KoreHudCommand.CancelReport), visible: false }),
		ui.text({ id: KoreHudElement.ItemsTitle, text: translate(language, KoreHudText.Items), rect: rect(510, 48, 260, 18), style: KoreHudStyle.ItemsTitle, visible: false }),
		...KORE_HUD_ITEM_SLOTS.map(slot => ui.button({ id: koreHudItemElementId(slot), text: "", rect: rect(520, 70 + slot * 38, 250, 30), style: KoreHudStyle.Item, enabled: false, visible: false })),
		ui.button({ id: KoreHudElement.SkipItem, text: translate(language, KoreHudText.SkipItemPhase), rect: rect(560, 310, 200, 34), style: KoreHudStyle.Skip, action: ui.action.emit(KoreHudCommand.SkipItemPhase), visible: false }),
		ui.button({ id: KoreHudElement.ResultPanel, text: "", rect: rect(210, 95, 380, 315), style: KoreHudStyle.ResultPanel, enabled: false, visible: false }),
		ui.text({ id: KoreHudElement.Result, text: "", rect: rect(230, 120, 360, 50), style: KoreHudStyle.ResultTitle, visible: false }),
		ui.button({ id: KoreHudElement.Rematch, text: translate(language, KoreHudText.Rematch), rect: rect(245, 300, 145, 48), style: KoreHudStyle.ResultAction, action: ui.action.emit(KoreHudCommand.Rematch), visible: false }),
		ui.button({ id: KoreHudElement.Menu, text: translate(language, KoreHudText.Menu), rect: rect(410, 300, 145, 48), style: KoreHudStyle.ResultAction, action: ui.action.emit(KoreHudCommand.ReturnToMenu), visible: false }),
		ui.button({ id: KoreHudElement.ReplayShare, text: translate(language, KoreHudText.ReplayShare), rect: rect(300, 355, 200, 32), style: KoreHudStyle.ResultSecondary, action: ui.action.emit(KoreHudCommand.ReplayShare), visible: false }),
		ui.text({ id: KoreHudElement.Paused, text: translate(language, KoreHudText.Paused), rect: rect(330, 180, 160, 40), style: KoreHudStyle.ResultTitle, visible: false }),
		ui.button({ id: KoreHudElement.Resume, text: translate(language, KoreHudText.Resume), rect: rect(330, 240, 140, 42), style: KoreHudStyle.ResultAction, action: ui.action.emit(KoreHudCommand.Resume), visible: false }),
	] })); return builder.build();
}
function rect(x: number, y: number, width: number, height: number) { return { x, y, width, height }; }
export const koreHudSoundIds = { confirm: koreAudio.sounds.uiConfirm } as const;

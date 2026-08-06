import { ui, validateUiSettings, type UiMenuSettings } from "../../engine/ui-sdk/index.js";
import { createEnglishLanguage, translate, LANGUAGE_KEYS, type LanguageCatalog } from "../../i18n/language.js";

export enum KoreReplayElement {
	Title = "replay-title",
	Token = "replay-token",
	Load = "replay-load",
	Paste = "replay-paste",
	Status = "replay-status",
}

export enum KoreReplayCommand {
	Load = "kore.replay.load",
	Paste = "kore.replay.paste",
}

export interface KoreReplayViewerSettings {
	schemaVersion: 1;
	id: "kore.replay-viewer";
	ui: UiMenuSettings;
}

/** Authoritative replay controls; browser hosts only project this composition. */
export function createReplayViewerComposition(language: LanguageCatalog = createEnglishLanguage()): KoreReplayViewerSettings {
	const settings: KoreReplayViewerSettings = {
		schemaVersion: 1,
		id: "kore.replay-viewer",
		ui: ui.createMenu({ id: "kore.replay-viewer.ui", size: { width: 800, height: 450 } })
			.addScreen(ui.screen({
				id: "replay",
				layout: ui.layout.vertical({ gap: 12, align: "center", padding: { top: 28, right: 24, bottom: 24, left: 24 } }),
				elements: [
					ui.text({ id: KoreReplayElement.Title, text: translate(language, LANGUAGE_KEYS.ReplayTitle), rect: { x: 0, y: 0, width: 480, height: 32 }, style: "kore.replay.title" }),
					ui.textInput({ id: KoreReplayElement.Token, text: "", value: "", rect: { x: 0, y: 0, width: 480, height: 34 }, style: "kore.replay.token" }),
					ui.button({ id: KoreReplayElement.Load, text: translate(language, LANGUAGE_KEYS.ReplayLoad), rect: { x: 0, y: 0, width: 180, height: 36 }, style: "kore.button.blue", action: ui.action.emitValues(KoreReplayCommand.Load, [KoreReplayElement.Token]) }),
					ui.button({ id: KoreReplayElement.Paste, text: translate(language, LANGUAGE_KEYS.ReplayPaste), rect: { x: 0, y: 0, width: 220, height: 36 }, style: "kore.button.blue-back", action: ui.action.emit(KoreReplayCommand.Paste) }),
					ui.text({ id: KoreReplayElement.Status, text: "", rect: { x: 0, y: 0, width: 560, height: 30 }, style: "kore.replay.status" }),
				],
			}))
			.build(),
	};
	validateKoreReplayViewerSettings(settings);
	return structuredClone(settings);
}

export function validateKoreReplayViewerSettings(value: unknown): asserts value is KoreReplayViewerSettings {
	if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Malformed KORE replay viewer settings");
	const settings = value as Partial<KoreReplayViewerSettings>;
	if (settings.schemaVersion !== 1 || settings.id !== "kore.replay-viewer" || !settings.ui) throw new Error("Malformed KORE replay viewer settings");
	validateUiSettings(settings.ui);
}

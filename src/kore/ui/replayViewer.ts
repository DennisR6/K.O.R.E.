import { ui, validateUiSettings, type UiMenuSettings } from "@coffeemakerstudio/drip";
import { createEnglishLanguage, translate, LANGUAGE_KEYS, type LanguageCatalog } from "../../i18n/language.js";
import { KoreMenuStyle } from "./menuVocabulary.js";

export enum KoreReplayId {
	Composition = "kore.replay-viewer",
	Runtime = "kore.replay-viewer.ui",
}

export enum KoreReplayScreen {
	Main = "replay",
}

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

export enum KoreReplayStyle {
	Title = "kore.replay.title",
	Token = "kore.replay.token",
	Status = "kore.replay.status",
	/** Primary/back buttons reuse the shared KORE button theme styles. */
	Load = KoreMenuStyle.MainButton,
	Paste = KoreMenuStyle.Back,
}

export interface KoreReplayViewerSettings {
	schemaVersion: 1;
	id: KoreReplayId.Composition;
	ui: UiMenuSettings;
}

/** Authoritative replay controls; browser hosts only project this composition. */
export function createReplayViewerComposition(language: LanguageCatalog = createEnglishLanguage()): KoreReplayViewerSettings {
	const settings: KoreReplayViewerSettings = {
		schemaVersion: 1,
		id: KoreReplayId.Composition,
		ui: ui.createMenu({ id: KoreReplayId.Runtime, size: { width: 800, height: 450 } })
			.addScreen(ui.screen({
				id: KoreReplayScreen.Main,
				layout: ui.layout.absolute(),
				elements: [
					ui.text({ id: KoreReplayElement.Title, text: translate(language, LANGUAGE_KEYS.ReplayTitle), rect: { x: 32, y: 22, width: 440, height: 32 }, style: KoreReplayStyle.Title }),
					ui.textInput({ id: KoreReplayElement.Token, text: "", value: "", rect: { x: 32, y: 174, width: 450, height: 38 }, style: KoreReplayStyle.Token }),
					ui.button({ id: KoreReplayElement.Load, text: translate(language, LANGUAGE_KEYS.ReplayLoad), rect: { x: 32, y: 224, width: 150, height: 38 }, style: KoreReplayStyle.Load, action: ui.action.emitValues(KoreReplayCommand.Load, [KoreReplayElement.Token]) }),
					ui.button({ id: KoreReplayElement.Paste, text: translate(language, LANGUAGE_KEYS.ReplayPaste), rect: { x: 194, y: 224, width: 170, height: 38 }, style: KoreReplayStyle.Paste, action: ui.action.emit(KoreReplayCommand.Paste) }),
					ui.text({ id: KoreReplayElement.Status, text: "", rect: { x: 32, y: 292, width: 450, height: 48 }, style: KoreReplayStyle.Status }),
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
	if (settings.schemaVersion !== 1 || settings.id !== KoreReplayId.Composition || !settings.ui) throw new Error("Malformed KORE replay viewer settings");
	validateUiSettings(settings.ui);
}

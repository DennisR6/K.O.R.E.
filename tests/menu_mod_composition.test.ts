import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { createEnglishLanguage } from "../src/i18n/language.js";
import { createMainMenuComposition } from "../src/kore/ui/mainMenu.js";
import { KoreMenuCommand, KoreMenuElement, KoreMenuScreen, KoreMenuText, parseKoreMenuCommand } from "../src/kore/ui/menuVocabulary.js";
import type { UiAction, UiElementSettings, UiMenuSettings, UiScreenSettings } from "@coffeemakerstudio/drip";

function screenOf(ui: UiMenuSettings, id: string): UiScreenSettings {
	const screen = ui.screens.find(candidate => candidate.id === id);
	if (!screen) throw new Error(`Missing screen '${id}'`);
	return screen;
}

function findDeepElement(screen: UiScreenSettings, id: string): UiElementSettings {
	const search = (elements: UiElementSettings[]): UiElementSettings | undefined => {
		for (const el of elements) {
			if (el.id === id) return el;
			if (el.kind === "container") {
				const found = search(el.elements);
				if (found) return found;
			}
		}
		return undefined;
	};
	const element = search(screen.elements);
	if (!element) throw new Error(`Missing element '${id}'`);
	return element;
}

function elementOf(screen: UiScreenSettings, id: string): UiElementSettings {
	return findDeepElement(screen, id);
}

function emitCommand(element: UiElementSettings): string | undefined {
	if (element.kind !== "button" || element.action?.type !== "emit") return undefined;
	return element.action.command;
}

function actionOf(element: UiElementSettings): UiAction | undefined {
	return element.kind === "button" || element.kind === "textInput" ? element.action : undefined;
}

describe("mod menu composition", () => {
	const settings = createMainMenuComposition().build();
	const ui = settings.ui;

	test("mods screen declares file load, paste, status, and back", () => {
		const screen = screenOf(ui, KoreMenuScreen.Mods);
		expect(emitCommand(elementOf(screen, KoreMenuElement.ModsLoadFile))).toBe(KoreMenuCommand.ImportModFile);
		expect(emitCommand(elementOf(screen, KoreMenuElement.ModsPaste))).toBe(KoreMenuCommand.ImportModPaste);
		const status = elementOf(screen, KoreMenuElement.ModsStatus);
		expect(status.kind).toBe("text");
		expect((status as Extract<UiElementSettings, { kind: "text" }>).text).toContain("No mod loaded");
		expect(actionOf(elementOf(screen, KoreMenuElement.ModsBack))?.type).toBe("back");
	});

	test("import screen declares a text input, validate, and back", () => {
		const screen = screenOf(ui, KoreMenuScreen.ModImport);
		const input = elementOf(screen, KoreMenuElement.ModImportInput);
		expect(input.kind).toBe("textInput");
		expect(emitCommand(elementOf(screen, KoreMenuElement.ModImportValidate))).toBe(KoreMenuCommand.ValidateMod);
		expect(actionOf(elementOf(screen, KoreMenuElement.ModImportBack))?.type).toBe("back");
	});

	test("result screen declares summary and both test launches", () => {
		const screen = screenOf(ui, KoreMenuScreen.ModResult);
		expect(elementOf(screen, KoreMenuElement.ModResultSummary).kind).toBe("text");
		expect(emitCommand(elementOf(screen, KoreMenuElement.ModResult1v1))).toBe(KoreMenuCommand.LaunchMod1v1);
		expect(emitCommand(elementOf(screen, KoreMenuElement.ModResultBattle))).toBe(KoreMenuCommand.LaunchModAiBattle);
		expect(actionOf(elementOf(screen, KoreMenuElement.ModResultBack))?.type).toBe("back");
	});

	test("every new command parses as a payload-free KORE command", () => {
		const commands = [KoreMenuCommand.OpenMods, KoreMenuCommand.ImportModFile, KoreMenuCommand.ImportModPaste, KoreMenuCommand.ValidateMod, KoreMenuCommand.LaunchMod1v1, KoreMenuCommand.LaunchModAiBattle];
		for (const command of commands) {
			expect(parseKoreMenuCommand(command, undefined)?.type).toBe(command);
			expect(parseKoreMenuCommand(command, { surprise: true })).toBeUndefined();
			expect(parseKoreMenuCommand("kore.menu.not-a-command", undefined)).toBeUndefined();
		}
	});

	test("mod texts resolve in the English catalog and both language JSON documents", () => {
		const en = createEnglishLanguage();
		for (const key of Object.values(KoreMenuText)) expect(en.strings[key]).toBeTruthy();
		const modKeys = Object.values(KoreMenuText).filter(key => key.startsWith("kore.ui.mods") || key === KoreMenuText.Mods);
		const de = JSON.parse(readFileSync("public/i18n/de_de.json", "utf8")) as { strings: Record<string, string> };
		expect(de.strings[KoreMenuText.ModsLoadFile]).toBe("JSON-Datei laden");
		expect(de.strings[KoreMenuText.ModTestBattle]).toBe("KI gegen KI testen");
		for (const file of ["public/i18n/en_en.json", "public/i18n/de_de.json"]) {
			const document = JSON.parse(readFileSync(file, "utf8")) as { strings: Record<string, string> };
			for (const key of modKeys) expect(document.strings[key]).toBeTruthy();
		}
	});
});

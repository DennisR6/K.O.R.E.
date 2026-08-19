import { expect, test } from "bun:test";
import { LANGUAGE_KEYS, loadLanguage, resolveBrowserLanguage } from "../src/i18n/language.js";
import { createMainMenuComposition } from "../src/kore/ui/mainMenu.js";
import type { UiElementSettings } from "@coffeemakerstudio/drip";

function response(document: unknown): Response {
	return new Response(JSON.stringify(document), { status: 200, headers: { "content-type": "application/json" } });
}

test("browser language detection selects the best available normalized pack", () => {
	expect(resolveBrowserLanguage(["de-DE", "en-US"])).toBe("de_de");
	expect(resolveBrowserLanguage(["en-EN", "de-DE"])).toBe("en_en");
	expect(resolveBrowserLanguage(["ru-RU", "en-US"])).toBe("en_en");
	expect(resolveBrowserLanguage(["ru-RU", "de-DE"])).toBe("de_de");
});

test("language loader loads the selected language and keeps en_en as the fallback", async () => {
	const documents: Record<string, unknown> = {
		"en_en.json": { language: "en_en", strings: { ...Object.fromEntries(Object.values(LANGUAGE_KEYS).map(key => [key, `English ${key}`])) } },
		"de_de.json": { language: "de_de", strings: { [LANGUAGE_KEYS.MenuOnlineButton]: "Online spielen" } },
	};
	const language = await loadLanguage("de_de", "./languages", async url => response(documents[url.split("/").pop()!]));
	expect(language.language).toBe("de_de");
	expect(language.strings[LANGUAGE_KEYS.MenuOnlineButton]).toBe("Online spielen");
	expect(language.strings[LANGUAGE_KEYS.MenuLocalButton]).toBe(`English ${LANGUAGE_KEYS.MenuLocalButton}`);
});

test("English is a complete language document", async () => {
	await expect(loadLanguage("en_en", "./languages", async () => response({ language: "en_en", strings: {} }))).rejects.toThrow(/missing/);
});

test("checked-in language packs match the complete language key contract", async () => {
	const required = new Set(Object.values(LANGUAGE_KEYS));
	for (const code of ["en_en", "de_de"] as const) {
		const document = await Bun.file(`public/i18n/${code}.json`).json() as { language?: unknown; strings?: Record<string, unknown> };
		expect(document.language).toBe(code);
		expect(document.strings && typeof document.strings).toBe("object");
		const strings = document.strings ?? {};
		for (const key of required) expect(Object.prototype.hasOwnProperty.call(strings, key)).toBe(true);
	}
});

test("loaded language catalogs provide translated menu labels", async () => {
	const language = await loadLanguage("de_de", "./public/i18n", async url => {
		const file = url.endsWith("de_de.json") ? { language: "de_de", strings: { [LANGUAGE_KEYS.MenuOnlineButton]: "Online spielen" } } : { language: "en_en", strings: Object.fromEntries(Object.values(LANGUAGE_KEYS).map(key => [key, key])) };
		return response(file);
	});
	const settings = createMainMenuComposition(language).build();
	const main = settings.ui.screens.find(screen => screen.id === "main")!;
	const findElement = (elements: UiElementSettings[], id: string): UiElementSettings | undefined => {
		for (const element of elements) {
			if (element.id === id) return element;
			if (element.kind === "container") {
				const nested = findElement(element.elements, id);
				if (nested) return nested;
			}
		}
		return undefined;
	};
	const online = findElement(main.elements, "label-online");
	expect(online?.kind === "text" ? online.text : undefined).toBe("Online spielen");
});

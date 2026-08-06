import { expect, test } from "bun:test";
import { LANGUAGE_KEYS, loadLanguage } from "../src/i18n/language.js";
import { createMainMenuComposition } from "../src/kore/ui/mainMenu.js";

function response(document: unknown): Response {
	return new Response(JSON.stringify(document), { status: 200, headers: { "content-type": "application/json" } });
}

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

test("loaded language catalogs provide translated menu labels", async () => {
	const language = await loadLanguage("de_de", "./public/i18n", async url => {
		const file = url.endsWith("de_de.json") ? { language: "de_de", strings: { [LANGUAGE_KEYS.MenuOnlineButton]: "Online spielen" } } : { language: "en_en", strings: Object.fromEntries(Object.values(LANGUAGE_KEYS).map(key => [key, key])) };
		return response(file);
	});
	const settings = createMainMenuComposition(language).build();
	const main = settings.ui.screens.find(screen => screen.id === "main")!;
	const actions = main.elements.find(element => element.id === "main-actions");
	const online = actions?.kind === "container" ? actions.elements.find(element => element.id === "main-online") : undefined;
	expect(online?.kind === "button" ? online.text : undefined).toBe("Online spielen");
});

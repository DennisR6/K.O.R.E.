import { describe, expect, test } from "bun:test";
import { createKoreMainMenuSurface } from "../src/kore/ui/KoreMainMenuSurface.ts";
import { KoreMenuElement, KoreMenuScreen } from "../src/kore/ui/menuVocabulary.ts";
import type { UiMenuSettings, UiScreenSettings, UiElementSettings } from "@coffeemakerstudio/drip";
import type { ModError } from "../src/mods/types.ts";

const VALID_PACKAGE = {
	schemaVersion: 1,
	manifest: { id: "test-mod", name: "Test Mod", version: "1.0.0" },
	maps: [
		{
			schemaVersion: 1,
			metadata: { id: "mod-map", name: "Mod Map" },
			worldSize: { x: 800, y: 450 },
			friction: { friction: 0.02, linearDrag: 0.004, stopThreshold: 0.02 },
			drift: 0,
			arenaGeometry: [{ type: 2, x: 0, y: 0, w: 800, h: 450, role: "containment", effects: [] }],
			spawnRegions: [
				{ team: 0, x: 40, y: 150, w: 120, h: 140 },
				{ team: 1, x: 640, y: 150, w: 120, h: 140 },
			],
			hazards: [],
		},
	],
	items: [
		{
			schemaVersion: 1,
			id: "mod-item",
			name: "Mod Item",
			type: "defensive",
			effects: [{ type: "shield", value: { capacity: 10 } }],
			targetType: "self",
			duration: { type: "turns", value: 1 },
			useLimit: { perTurn: 1, perGame: 1 },
		},
	],
	modes: [
		{
			schemaVersion: 1,
			id: "mod-mode",
			phases: ["item", "aim", "charge", "push", "physics"],
			maxItemsPerTurn: 1,
			winCondition: "last-team-standing",
			itemEconomy: { fixedLoadouts: [], mapPickups: [] },
		},
	],
};

const VALID_TEXT = JSON.stringify(VALID_PACKAGE, null, 2);

function press(menu: ReturnType<typeof createKoreMainMenuSurface>, x: number, y: number): void {
	menu.updateMouse(x, y);
	menu.handleMousePressed();
}

function type(menu: ReturnType<typeof createKoreMainMenuSurface>, key: string): void {
	menu.handleKeyPressed({ key } as KeyboardEvent);
}

function screen(ui: UiMenuSettings, id: string): UiScreenSettings {
	const found = ui.screens.find(candidate => candidate.id === id);
	if (!found) throw new Error(`Missing screen '${id}'`);
	return found;
}

function element(ui: UiMenuSettings, screenId: string, elementId: string): UiElementSettings {
	const found = screen(ui, screenId).elements.find(candidate => candidate.id === elementId);
	if (!found) throw new Error(`Missing element '${elementId}' in '${screenId}'`);
	return found;
}

function textOf(ui: UiMenuSettings, screenId: string, elementId: string): string {
	const el = element(ui, screenId, elementId);
	return el.kind === "text" ? el.text : "";
}

function valueOf(ui: UiMenuSettings, screenId: string, elementId: string): string {
	const el = element(ui, screenId, elementId);
	return el.kind === "textInput" ? el.value ?? "" : "";
}

function enabledOf(ui: UiMenuSettings, screenId: string, elementId: string): boolean {
	const el = element(ui, screenId, elementId);
	return "enabled" in el ? (el.enabled ?? true) : true;
}

async function flush(): Promise<void> { await new Promise(resolve => setTimeout(resolve, 0)); }

describe("mod menu surface wiring", () => {
	test("keyboard typing flows into the focused import input", () => {
		const menu = createKoreMainMenuSurface();
		press(menu, 400, 100); // landing -> main
		press(menu, 715, 371); // Mods
		expect(menu.getRuntime().getActiveScreen()).toBe(KoreMenuScreen.Mods);
		press(menu, 400, 215); // Paste JSON -> import screen
		expect(menu.getRuntime().getActiveScreen()).toBe(KoreMenuScreen.ModImport);
		press(menu, 400, 180); // focus the input
		type(menu, "a");
		type(menu, "b");
		type(menu, "Backspace");
		expect(valueOf(menu.toSettings().ui, KoreMenuScreen.ModImport, KoreMenuElement.ModImportInput)).toBe("a");
	});

	test("paste writes the clipboard text into the import input", async () => {
		const menu = createKoreMainMenuSurface({ onReadModClipboard: async () => ({ ok: true, text: VALID_TEXT }) });
		press(menu, 400, 100);
		press(menu, 715, 371);
		press(menu, 400, 215);
		await flush();
		expect(menu.getRuntime().getActiveScreen()).toBe(KoreMenuScreen.ModImport);
		expect(valueOf(menu.toSettings().ui, KoreMenuScreen.ModImport, KoreMenuElement.ModImportInput)).toBe(VALID_TEXT);
	});

	test("clipboard denial renders an actionable hint", async () => {
		const error: ModError = { category: "io", message: "Clipboard access was denied." };
		const menu = createKoreMainMenuSurface({ onReadModClipboard: async () => ({ ok: false, error }) });
		press(menu, 400, 100);
		press(menu, 715, 371);
		press(menu, 400, 215);
		await flush();
		expect(textOf(menu.toSettings().ui, KoreMenuScreen.ModImport, KoreMenuElement.ModImportHint)).toMatch(/Clipboard access was denied/);
	});

	test("a host without clipboard support still reports an error", async () => {
		const menu = createKoreMainMenuSurface();
		press(menu, 400, 100);
		press(menu, 715, 371);
		press(menu, 400, 215);
		await flush();
		expect(textOf(menu.toSettings().ui, KoreMenuScreen.ModImport, KoreMenuElement.ModImportHint)).toMatch(/Clipboard unavailable/);
	});

	test("validate imports the input content and shows the mod summary with enabled launches", () => {
		const menu = createKoreMainMenuSurface();
		menu.drainSoundCommands(); // menu music
		press(menu, 400, 100);
		press(menu, 715, 371);
		press(menu, 400, 215);
		press(menu, 400, 180); // focus the input
		for (const char of VALID_TEXT) type(menu, char);
		press(menu, 400, 296); // Validate
		expect(menu.getRuntime().getActiveScreen()).toBe(KoreMenuScreen.ModResult);
		const summary = textOf(menu.toSettings().ui, KoreMenuScreen.ModResult, KoreMenuElement.ModResultSummary);
		expect(summary).toContain("Test Mod");
		expect(summary).toContain("test-mod");
		expect(summary).toContain("Version 1.0.0");
		expect(summary).toContain("1 item(s)");
		expect(enabledOf(menu.toSettings().ui, KoreMenuScreen.ModResult, KoreMenuElement.ModResult1v1)).toBe(true);
		expect(enabledOf(menu.toSettings().ui, KoreMenuScreen.ModResult, KoreMenuElement.ModResultBattle)).toBe(true);
		expect(menu.drainSoundCommands().at(-1)).toMatchObject({ type: "playSound", soundId: "kore.ui.confirm", bus: "ui" });
	});

	test("invalid JSON shows an error summary and disables the test launches", () => {
		const menu = createKoreMainMenuSurface();
		press(menu, 400, 100);
		press(menu, 715, 371);
		press(menu, 400, 215);
		press(menu, 400, 180);
		for (const char of '{"broken":') type(menu, char);
		press(menu, 400, 296);
		expect(menu.getRuntime().getActiveScreen()).toBe(KoreMenuScreen.ModResult);
		expect(textOf(menu.toSettings().ui, KoreMenuScreen.ModResult, KoreMenuElement.ModResultSummary)).toMatch(/Mod error: /);
		expect(enabledOf(menu.toSettings().ui, KoreMenuScreen.ModResult, KoreMenuElement.ModResult1v1)).toBe(false);
		expect(enabledOf(menu.toSettings().ui, KoreMenuScreen.ModResult, KoreMenuElement.ModResultBattle)).toBe(false);
	});

	test("launch commands invoke the host callbacks only for a validated mod", () => {
		let launched1v1 = 0;
		let launchedBattle = 0;
		const menu = createKoreMainMenuSurface({
			onLaunchMod1v1: () => { launched1v1++; },
			onLaunchModAiBattle: () => { launchedBattle++; },
		});
		press(menu, 400, 100);
		press(menu, 715, 371);
		press(menu, 400, 215);
		press(menu, 400, 180);
		for (const char of '{"broken":') type(menu, char);
		press(menu, 400, 296); // invalid -> result screen
		press(menu, 260, 266); // Test 1 vs AI (disabled)
		press(menu, 540, 266); // Test AI vs AI (disabled)
		expect(launched1v1).toBe(0);
		expect(launchedBattle).toBe(0);
	});

	test("a validated mod launch hands the detached package to the host callback", () => {
		let received: unknown;
		const menu = createKoreMainMenuSurface({ onLaunchMod1v1: mod => { received = mod; } });
		menu.drainSoundCommands(); // menu music
		press(menu, 400, 100);
		press(menu, 715, 371);
		menu.importModText(VALID_TEXT, { kind: "file", fileName: "mod.json" });
		expect(menu.getRuntime().getActiveScreen()).toBe(KoreMenuScreen.ModResult);
		press(menu, 260, 266);
		expect(received).toBeDefined();
		const pkg = received as { package: { manifest: { id: string } } };
		expect(pkg.package.manifest.id).toBe("test-mod");
		expect(menu.drainSoundCommands()).toMatchObject([{ type: "playSound", soundId: "kore.ui.confirm", bus: "ui" }]);
	});

	test("file import updates the mods status and host io errors render as mod errors", () => {
		const menu = createKoreMainMenuSurface();
		press(menu, 400, 100);
		press(menu, 715, 371);
		menu.importModText(VALID_TEXT, { kind: "file", fileName: "mod.json" });
		press(menu, 400, 356); // back -> mods screen
		expect(menu.getRuntime().getActiveScreen()).toBe(KoreMenuScreen.Mods);
		expect(textOf(menu.toSettings().ui, KoreMenuScreen.Mods, KoreMenuElement.ModsStatus)).toMatch(/Test Mod \(/);
		menu.importModError({ category: "size", message: "The mod file is too large (limit 2 MB)." }, { kind: "file", fileName: "big.json" });
		expect(menu.getRuntime().getActiveScreen()).toBe(KoreMenuScreen.ModResult);
		expect(textOf(menu.toSettings().ui, KoreMenuScreen.ModResult, KoreMenuElement.ModResultSummary)).toMatch(/2 MB/);
	});

	test("the mod back chain returns through import to the mods screen", () => {
		const menu = createKoreMainMenuSurface();
		press(menu, 400, 100);
		press(menu, 715, 371);
		press(menu, 400, 215); // mods -> import
		menu.importModText(VALID_TEXT, { kind: "paste" });
		expect(menu.getRuntime().getActiveScreen()).toBe(KoreMenuScreen.ModResult);
		press(menu, 400, 340); // result back
		expect(menu.getRuntime().getActiveScreen()).toBe(KoreMenuScreen.ModImport);
		press(menu, 400, 356); // import back
		expect(menu.getRuntime().getActiveScreen()).toBe(KoreMenuScreen.Mods);
	});
});

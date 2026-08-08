import { describe, expect, test } from "bun:test";
import type { RenderContext } from "../src/engine/RenderContext.js";
import type { JsonValue } from "../src/engine/contracts/systemSettings.js";
import type { UiElementSettings, UiMenuSettings } from "../src/engine/ui-sdk/index.js";
import { createKoreMainMenuSurface } from "../src/kore/ui/KoreMainMenuSurface.js";
import { KORE_UI_THEME, resolveKoreButtonStyle, resolveKoreButtonTheme } from "../src/kore/ui/koreUiTheme.js";
import { createMainMenuComposition, koreMenuCommands } from "../src/kore/ui/mainMenu.js";
import { KoreMenuCommand, KoreMenuDifficulty, KoreMenuMapIntent, KoreMenuScreen, KoreMenuStyle, isKoreMenuCommand, isKoreMenuMapIntent, koreMenuMapScreen, parseKoreMenuCommand } from "../src/kore/ui/menuVocabulary.js";

function press(menu: ReturnType<typeof createKoreMainMenuSurface>, x: number, y: number): void {
	menu.updateMouse(x, y);
	menu.handleMousePressed();
}

/** Collects every action authored on any screen of the canonical menu composition. */
function collectActions(settings: UiMenuSettings): Array<{ command?: string; target?: string; payload?: JsonValue }> {
	const actions: Array<{ command?: string; target?: string; payload?: JsonValue }> = [];
	const visit = (elements: UiElementSettings[]): void => {
		for (const element of elements) {
			if (element.kind === "container") { visit(element.elements); continue; }
			const action = (element as { action?: { type: string; command?: string; target?: string; payload?: JsonValue } }).action;
			if (!action) continue;
			if (action.type === "emit") actions.push({ command: action.command, payload: action.payload });
			else if (action.type === "emitValues") actions.push({ command: action.command });
			else if (action.type === "navigate") actions.push({ target: action.target });
		}
	};
	for (const screen of settings.screens) visit(screen.elements);
	return actions;
}

/** Records every stroke/fill color the renderer is asked to use. */
class RecordingRenderContext implements RenderContext {
	public readonly strokeColors: string[] = [];
	public readonly fillColors: string[] = [];
	public WORLD_SIZE_X = 800;
	public WORLD_SIZE_Y = 450;
	public drawCircle(): void { }
	public drawRect(): void { }
	public drawText(): void { }
	public setFillColor(color: string): void { this.fillColors.push(color); }
	public setOpacity(): void { }
	public setNoFill(): void { }
	public setStrokeColor(color: string): void { this.strokeColors.push(color); }
	public setStroke(): void { }
	public noStroke(): void { }
	public rotate(): void { }
	public scale(): void { }
	public translate(): void { }
	public drawImage(): void { }
	public getScreenSize(): { width: number; height: number } { return { width: 800, height: 450 }; }
	public clear(): void { }
	public push(): void { }
	public pop(): void { }
	public line(): void { }
	public resizeCanvas(): void { }
	public setScaleFactor(): void { }
	public getScaleFactor(): number { return 1; }
	public toWorld(val: number): number { return val; }
	public toPixel(val: number): number { return val; }
	public windowScale(): number { return 1; }
	public beginClip(): void { }
	public endClip(): void { }
	public mouseWheel(): void { }
	public getTextWidth(): number { return 0; }
}

describe("KORE UI vocabulary regression", () => {
	test("menu commands are authored exclusively through the typed enum, never raw strings", () => {
		expect(koreMenuCommands).toBe(KoreMenuCommand);
		for (const command of Object.values(KoreMenuCommand)) expect(isKoreMenuCommand(command)).toBe(true);
		const actions = collectActions(createMainMenuComposition().build().ui);
		expect(actions.length).toBeGreaterThan(0);
		for (const action of actions) {
			if (action.command !== undefined) expect(isKoreMenuCommand(action.command), `unknown command '${action.command}'`).toBe(true);
			if (action.target !== undefined) expect(Object.values(KoreMenuScreen) as string[]).toContain(action.target);
			if (action.payload !== undefined && typeof action.payload === "object" && action.payload !== null && "intent" in action.payload) {
				expect(isKoreMenuMapIntent(action.payload.intent), `unknown map intent '${String(action.payload.intent)}'`).toBe(true);
			}
		}
	});

	test("parseKoreMenuCommand resolves every authored command to a typed message", () => {
		for (const command of Object.values(KoreMenuCommand)) {
			const payload: JsonValue | undefined = command === KoreMenuCommand.OpenAiMaps
				? { difficulty: KoreMenuDifficulty.Medium }
				: command === KoreMenuCommand.SelectMap
					? { intent: KoreMenuMapIntent.Local, mapId: "ice-map-v1" }
					: undefined;
			const parsed = parseKoreMenuCommand(command, payload);
			expect(parsed, `command '${command}' must parse`).toBeDefined();
			expect(parsed?.type).toBe(command);
		}
	});

	test("every authored button style resolves through the theme registry; unknown styles are rejected", () => {
		const settings = createMainMenuComposition().build().ui;
		const visited = new Set<string>();
		const visit = (elements: UiElementSettings[]): void => {
			for (const element of elements) {
				if (element.kind === "container") { visit(element.elements); continue; }
				if (element.kind === "button" || element.kind === "textInput") {
					const style = element.style;
					expect(style, `element '${element.id}' has no style`).toBeDefined();
					// The landing hitbox is intentionally a non-theme button style; the renderer skips it.
					if (style === KoreMenuStyle.LandingHitbox) continue;
					visited.add(style!);
					expect(() => resolveKoreButtonTheme(style), `style '${style}' must be registered`).not.toThrow();
				}
			}
		};
		for (const screen of settings.screens) visit(screen.elements);
		expect(visited.size).toBeGreaterThan(0);
		expect(() => resolveKoreButtonTheme("kore.menu.not-a-style")).toThrow(/Unknown KORE UI button style/);
	});

	test("button themes may define only normal and fall back for interaction states", () => {
		const normal = {
			background: "#000000",
			borderColor: "#ffffff",
			borderWidth: 1,
			borderRadius: 4,
			textColor: "#ffffff",
			fontSize: 16,
		};
		const theme = { normal };

		for (const state of ["normal", "hover", "active", "focused", "disabled"] as const) {
			expect(resolveKoreButtonStyle(theme, state)).toBe(normal);
		}
	});

	test("map rows and back buttons render distinct registered theme borders through the full UI path", () => {
		const menu = createKoreMainMenuSurface();
		press(menu, 400, 100); // landing -> main menu
		press(menu, 589, 368); // Choose Map -> map-local
		expect(menu.getRuntime().getActiveScreen()).toBe(KoreMenuScreen.MapLocal);
		const recorder = new RecordingRenderContext();
		menu.draw(recorder);
		const rowBorder = KORE_UI_THEME[KoreMenuStyle.MapRow]!.normal.borderColor;
		const backBorder = KORE_UI_THEME[KoreMenuStyle.Back]!.normal.borderColor;
		expect(recorder.strokeColors).toContain(rowBorder);
		expect(recorder.strokeColors).toContain(backBorder);
		expect(rowBorder).not.toBe(backBorder);
	});

	test("map and difficulty back buttons keep their dedicated theme styles", () => {
		const settings = createMainMenuComposition().build().ui;
		const findElement = (screenId: string, elementId: string): UiElementSettings | undefined => {
			for (const screen of settings.screens) {
				if (screen.id !== screenId) continue;
				for (const element of screen.elements) if (element.id === elementId) return element;
			}
			return undefined;
		};
		const mapBack = findElement(KoreMenuScreen.MapLocal, "map-local-root-back");
		expect(mapBack?.style).toBe(KoreMenuStyle.Back);
		const difficultyBack = findElement(KoreMenuScreen.Difficulty, "difficulty-back");
		expect(difficultyBack?.style).toBe(KoreMenuStyle.DifficultyBack);
		expect(KoreMenuStyle.Back as string).toBe("kore.button.blue-back");
		expect(KoreMenuStyle.DifficultyBack as string).toBe("kore.button.blue-back");
	});

	test("typed command dispatch through the generic runtime navigates to the ai map screen", () => {
		const menu = createKoreMainMenuSurface();
		menu.getRuntime().dispatch({
			type: "emit",
			command: KoreMenuCommand.OpenAiMaps,
			payload: { difficulty: KoreMenuDifficulty.Hard },
		});
		menu.tick(16, 0);
		expect(menu.getRuntime().getActiveScreen()).toBe(koreMenuMapScreen(KoreMenuMapIntent.Ai, KoreMenuDifficulty.Hard));
	});
});

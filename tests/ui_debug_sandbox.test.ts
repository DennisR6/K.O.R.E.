import { expect, test } from "bun:test";
import { isUiDebugSandboxUrl, createUiDebugSandboxSettings } from "../src/debug/uiSandbox.ts";
import { ui } from "@coffeemakerstudio/drip";

test("UI debug route activates only for the explicit query parameter", () => {
	expect(isUiDebugSandboxUrl(new URL("https://example.test/?debug=ui"))).toBe(true);
	expect(isUiDebugSandboxUrl(new URL("https://example.test/?debugui=1"))).toBe(true);
	expect(isUiDebugSandboxUrl(new URL("https://example.test/?debug=other"))).toBe(false);
	expect(isUiDebugSandboxUrl(new URL("https://example.test/"))).toBe(false);
});

test("all UI debug sandbox screens validate and are reachable through declared navigation", () => {
	const settings = createUiDebugSandboxSettings();
	expect(() => ui.validate(settings)).not.toThrow();
	const ids = new Set(settings.screens.map(screen => screen.id));
	for (const screen of settings.screens) {
		for (const element of screen.elements) {
			if (element.action?.type === "navigate") expect(ids.has(element.action.target)).toBe(true);
		}
	}
	expect(ids).toEqual(new Set(["overview", "components", "input", "text", "navigation", "page-a", "page-b", "page-c", "state", "lifecycle", "multiple", "validation"]));
});

test("sandbox reconstruction preserves text, navigation history, and semantic form commands", () => {
	const runtime = ui.fromSettings(createUiDebugSandboxSettings());
	runtime.tick({ pointer: { x: 20, y: 142, justPressed: true } }); // Text overview button
	expect(runtime.getActiveScreen()).toBe("text");
	runtime.tick({ pointer: { x: 30, y: 100, justPressed: true } });
	runtime.tick({ keyboard: { textInput: "Ada Lovelace" } });
	runtime.tick({ pointer: { x: 350, y: 140, justPressed: true } });
	expect(runtime.drainCommands()).toEqual([{ command: "debug-form-submit", payload: { first: "Ada Lovelace", second: "" } }]);
	const saved = JSON.parse(JSON.stringify(runtime.toSettings()));
	const restored = ui.fromSettings(saved);
	expect(restored.toSettings()).toEqual(saved);
});

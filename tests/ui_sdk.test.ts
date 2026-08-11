import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { ui, type UiRenderer } from "@coffeemakerstudio/drip";

function settings() {
	return ui.createMenu({ id: "menu", size: { width: 400, height: 300 } })
		.addScreen(ui.screen({ id: "main", layout: ui.layout.absolute(), elements: [
			ui.text({ id: "title", text: "Title", rect: { x: 10, y: 10, width: 100, height: 20 } }),
			ui.button({ id: "next", text: "Next", rect: { x: 10, y: 50, width: 100, height: 40 }, action: ui.action.navigate("form") }),
		] }))
		.addScreen(ui.screen({ id: "form", layout: ui.layout.absolute(), elements: [
			ui.textInput({ id: "name", text: "", rect: { x: 10, y: 20, width: 200, height: 40 } }),
			ui.button({ id: "emit", text: "Save", rect: { x: 10, y: 80, width: 100, height: 40 }, action: ui.action.emit("save-name") }),
			ui.button({ id: "back", text: "Back", rect: { x: 10, y: 140, width: 100, height: 40 }, action: ui.action.back() }),
		] }))
		.build();
}

test("generic UI runtime changes state only through explicit ticks and reconstructs from settings", () => {
	const runtime = ui.fromSettings(settings());
	expect(runtime.getActiveScreen()).toBe("main");
	runtime.tick({ pointer: { x: 20, y: 60, justPressed: true } });
	expect(runtime.getActiveScreen()).toBe("form");
	runtime.tick({ pointer: { x: 20, y: 30, justPressed: true } });
	runtime.tick({ keyboard: { textInput: "Ada" } });
	const serialized = runtime.toSettings();
	expect(serialized.screens[1]!.elements.find(element => element.id === "name")!.value).toBe("Ada");
	const restored = ui.fromSettings(JSON.parse(JSON.stringify(serialized)));
	expect(restored.toSettings()).toEqual(serialized);

	// No `tick()` means no input processing or hidden progression.
	restored.draw(renderer());
	expect(restored.toSettings()).toEqual(serialized);
});

test("containers can activate actions from empty pointer space", () => {
	const menu = ui.createMenu({ id: "container-action", size: { width: 200, height: 100 } })
		.addScreen(ui.screen({ id: "main", elements: [
			ui.container({ id: "surface", text: "Surface", rect: { x: 0, y: 0, width: 200, height: 100 }, action: ui.action.emit("surface-pressed"), elements: [
				ui.text({ id: "label", text: "Surface", rect: { x: 20, y: 20, width: 100, height: 20 } }),
			] }),
		] }))
		.build();
	const runtime = ui.fromSettings(menu);
	runtime.tick({ pointer: { x: 180, y: 80, justPressed: true } });
	expect(runtime.drainCommands()).toEqual([{ command: "surface-pressed" }]);
	const surface = runtime.toSettings().screens[0]!.elements[0]!;
	expect(surface).toMatchObject({ text: "Surface", action: { type: "emit", command: "surface-pressed" } });
	expect(surface.kind === "container" ? surface.elements[0] : undefined).toMatchObject({ kind: "text", text: "Surface" });
});

test("keyboard navigation focuses and activates visible controls", () => {
	const runtime = ui.fromSettings(settings());
	runtime.tick({ keyboard: { pressedKeys: ["Tab"] } });
	expect(runtime.getFocusedElementId()).toBe("next");
	runtime.tick({ keyboard: { pressedKeys: ["Enter"] } });
	expect(runtime.getActiveScreen()).toBe("form");
});

test("draw is pure, capability systems skip unsupported elements, and semantic commands are explicit", () => {
	const runtime = ui.fromSettings(settings());
	const before = runtime.toSettings();
	const commands: string[] = [];
	const first = renderer(commands);
	runtime.draw(first);
	runtime.draw(first);
	expect(runtime.toSettings()).toEqual(before);
	expect(commands).toEqual(["text:title", "button:next", "text:title", "button:next"]);

	runtime.tick({ pointer: { x: 20, y: 60, justPressed: true } });
	runtime.tick({ pointer: { x: 20, y: 90, justPressed: true } });
	expect(runtime.drainCommands()).toEqual([{ command: "save-name" }]);
});

test("icon buttons remain serializable and are exposed to the host renderer", () => {
	const menu = ui.createMenu({ id: "icons", size: { width: 200, height: 100 } })
		.addScreen(ui.screen({ id: "main", elements: [
			ui.button({ id: "settings", text: "Settings", icon: "settings", rect: { x: 0, y: 0, width: 120, height: 30 } }),
			ui.image({ id: "logo", source: "logo.png", rect: { x: 0, y: 40, width: 80, height: 40 } }),
		] }))
		.build();
	const runtime = ui.fromSettings(JSON.parse(JSON.stringify(menu)));
	let icon: string | undefined;
	let source: string | undefined;
	runtime.draw({ drawText() {}, drawTextInput() {}, drawImage(element) { source = element.source; }, drawButton(element) { icon = element.icon; } });
	expect(icon).toBe("settings");
	expect(source).toBe("logo.png");
	expect(runtime.toSettings().screens[0]!.elements[0]).toMatchObject({ icon: "settings" });
	expect(runtime.toSettings().screens[0]!.elements[1]).toMatchObject({ kind: "image", source: "logo.png" });
	expect(() => ui.validate({ ...menu, screens: [{ ...menu.screens[0], elements: [{ ...menu.screens[0]!.elements[0], icon: 42 }] }] })).toThrow();
});

test("opt-in styles inherit through container parents and preserve authored settings", () => {
	const menu = ui.createMenu({ id: "inheritance", size: { width: 300, height: 200 } })
		.addScreen(ui.screen({ id: "main", elements: [
			ui.container({ id: "panel", style: "parent", rect: { x: 0, y: 0, width: 300, height: 200 }, elements: [
				ui.text({ id: "direct", text: "Direct", inheritStyle: true, style: "local", rect: { x: 0, y: 0, width: 80, height: 20 } }),
				ui.container({ id: "nested", inheritStyle: true, rect: { x: 0, y: 30, width: 300, height: 100 }, elements: [
					ui.button({ id: "nested-button", text: "Nested", inheritStyle: true, rect: { x: 0, y: 0, width: 80, height: 20 } }),
				] }),
			] }),
		] }))
		.build();
	const runtime = ui.fromSettings(menu);
	const styles: Array<string | undefined> = [];
	runtime.draw({
		drawText(element) { styles.push(element.style); },
		drawButton(element) { styles.push(element.style); },
		drawTextInput() {},
		drawImage() {},
	});
	expect(styles).toEqual(["local", "parent"]);
	const serialized = runtime.toSettings();
	expect(serialized.screens[0]!.elements[0]).toMatchObject({ style: "parent" });
	const panel = serialized.screens[0]!.elements[0]!;
	if (panel.kind !== "container") throw new Error("Expected panel container");
	expect(panel.elements[0]).toMatchObject({ style: "local", inheritStyle: true });
	expect(panel.elements[1]).toMatchObject({ inheritStyle: true });
	const standalone = ui.fromSettings(ui.createMenu({ id: "standalone", size: { width: 100, height: 100 } })
		.addScreen(ui.screen({ id: "main", elements: [ui.text({ id: "text", text: "Text", inheritStyle: true, rect: { x: 0, y: 0, width: 50, height: 20 } })] }))
		.build());
	let style: string | undefined;
	standalone.draw({ drawText: element => { style = element.style; }, drawButton() {}, drawTextInput() {}, drawImage() {} });
	expect(style).toBeUndefined();
});

test("groupHover propagates container hover to visible descendant leaves", () => {
	const menu = ui.createMenu({ id: "group-hover", size: { width: 200, height: 120 } })
		.addScreen(ui.screen({ id: "main", elements: [
			ui.container({ id: "group", groupHover: true, rect: { x: 0, y: 0, width: 200, height: 100 }, elements: [
				ui.button({ id: "child", text: "Child", rect: { x: 10, y: 10, width: 60, height: 20 } }),
			] }),
		] }))
		.build();
	const runtime = ui.fromSettings(menu);
	let childHovered = false;
	const draw = () => runtime.draw({ drawText() {}, drawTextInput() {}, drawImage() {}, drawButton(element) { childHovered = element.hovered === true; } });
	runtime.tick({ pointer: { x: 180, y: 80 } });
	draw();
	expect(childHovered).toBe(true);
	expect(runtime.getHoveredElementId()).toBeUndefined();
	runtime.tick({ pointer: { x: 199, y: 119 } });
	draw();
	expect(childHovered).toBe(false);
});

test("button components are authored through the generic UI SDK and can be replaced at runtime", () => {
	const component = ui.component.image("public/items/mystery_box.svg");
	const menu = ui.createMenu({ id: "components", size: { width: 200, height: 100 } })
		.addScreen(ui.screen({ id: "main", elements: [ui.button({ id: "item", text: "", component, rect: { x: 0, y: 0, width: 80, height: 40 } })] }))
		.build();
	const runtime = ui.fromSettings(menu);
	let source: string | undefined;
	runtime.draw({ drawText() {}, drawTextInput() {}, drawImage(element) { source = element.component?.source ?? element.source; }, drawButton(element) { source = element.component?.source; } });
	expect(source).toBe("public/items/mystery_box.svg");
	expect(runtime.setElementComponent("item", ui.component.image("replacement.svg"))).toBe(true);
	expect(runtime.toSettings().screens[0]!.elements[0]).toMatchObject({ component: { type: "image", source: "replacement.svg" } });
});

test("generic UI SDK is independent from KORE and uses registry-selected deterministic systems", () => {
	const framework = ui.createDefaultFramework();
	expect(framework.systemOrder).toEqual(["ui.visibility", "ui.layout", "ui.input.pointer", "ui.focus", "ui.input.keyboard", "ui.text-input", "ui.button", "ui.navigation", "ui.render"]);
	expect(() => ui.validate(settings())).not.toThrow();
	const source = readFileSync("node_modules/@coffeemakerstudio/drip/src/ui-sdk/index.ts", "utf8");
	expect(source).not.toMatch(/from\s+["'].*(?:kore|settings|rules|item|ai|content|server|menu|scenes|RenderContext)[/"']/);
	expect(source).not.toContain("requestAnimationFrame");
	expect(source).not.toContain("addEventListener");
	expect(readFileSync("node_modules/@coffeemakerstudio/roast/src/sdk/index.ts", "utf8")).not.toContain("ui-sdk");
});

test("multiple UI runtimes are independent and the architecture record matches the public model", () => {
	const first = ui.fromSettings(settings());
	const second = ui.fromSettings(settings());
	first.tick({ pointer: { x: 20, y: 60, justPressed: true } });
	expect(first.getActiveScreen()).toBe("form");
	expect(second.getActiveScreen()).toBe("main");
	const document = readFileSync("UI_SDK_ARCHITECTURE.md", "utf8");
	for (const heading of ["Purpose", "Layer model", "Passive engine lifecycle", "Capability model", "System model", "Input lifecycle", "Rendering lifecycle", "Serialization lifecycle", "Engine switching", "UI actions", "Framework composition", "Generic versus KORE responsibilities", "Extension and generation model", "Stability guarantees"]) expect(document).toContain(heading);
});

test("images pass pointer clicks through to actionable elements below", () => {
	const menu = ui.createMenu({ id: "image-pass-through", size: { width: 200, height: 100 } })
		.addScreen(ui.screen({ id: "main", elements: [
			ui.button({ id: "underlay", text: "Underlay", rect: { x: 20, y: 20, width: 120, height: 50 }, action: ui.action.emit("underlay-clicked") }),
			ui.image({ id: "overlay", source: "overlay.svg", rect: { x: 20, y: 20, width: 120, height: 50 } }),
		] }))
		.build();
	const runtime = ui.fromSettings(menu);
	runtime.tick({ pointer: { x: 60, y: 40, justPressed: true } });
	expect(runtime.drainCommands()).toEqual([{ command: "underlay-clicked" }]);
});

test("overlapping UI elements prioritize top-most (later declared) elements for hit testing", () => {
	const menu = ui.createMenu({ id: "overlap", size: { width: 400, height: 300 } })
		.addScreen(ui.screen({ id: "main", layout: ui.layout.absolute(), elements: [
			ui.button({ id: "bottom", text: "Bottom", rect: { x: 50, y: 50, width: 200, height: 100 }, action: ui.action.emit("click-bottom") }),
			ui.button({ id: "top", text: "Top", rect: { x: 50, y: 50, width: 200, height: 100 }, action: ui.action.emit("click-top") }),
		] }))
		.build();

	const runtime = ui.fromSettings(menu);
	runtime.tick({ pointer: { x: 100, y: 100, justPressed: true } });
	expect(runtime.drainCommands()).toEqual([{ command: "click-top" }]);
});

function renderer(commands: string[] = []): UiRenderer {
	return {
		drawText(element) { commands.push(`text:${element.id}`); },
		drawButton(element) { commands.push(`button:${element.id}`); },
		drawTextInput(element) { commands.push(`input:${element.id}`); },
		drawImage(element) { commands.push(`image:${element.id}`); },
	};
}

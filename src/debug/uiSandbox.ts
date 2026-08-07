import type p5Types from "p5";
import { P5Renderer } from "../engine/drawingEngine.js";
import type { UiAction, UiInput, UiMenuSettings, UiPoint, UiRenderer, UiRuntime } from "../engine/ui-sdk/index.js";
import { ui, validateUiSettings } from "../engine/ui-sdk/index.js";

export const UI_DEBUG_QUERY = "ui";
export function isUiDebugSandboxUrl(url: URL): boolean { return url.searchParams.get("debug") === UI_DEBUG_QUERY || url.searchParams.get("debugui") === "1"; }

const SIZE = { width: 800, height: 450 };
const NAV: Array<[string, string]> = [["Components", "components"], ["Input", "input"], ["Text", "text"], ["Navigation", "navigation"], ["State", "state"], ["Lifecycle", "lifecycle"], ["Multiple", "multiple"], ["Validation", "validation"]];

const rect = (x: number, y: number, width: number = 150, height: number = 30) => ({ x, y, width, height });
const text = (id: string, value: string, x: number, y: number, width: number = 300) => ui.text({ id, text: value, rect: rect(x, y, width, 20) });
const button = (id: string, value: string, x: number, y: number, action: UiAction, enabled: boolean = true) => ui.button({ id, text: value, rect: rect(x, y), action, enabled });
const nav = (back: string = "overview") => [button("nav-back", "Overview", 20, 400, ui.action.navigate(back)), ...NAV.map(([label, target], index) => button(`nav-${target}`, label, 180 + (index % 4) * 150, 360 + Math.floor(index / 4) * 38, ui.action.navigate(target)))];

/** All sandbox screens are authored exclusively through the public generic UI SDK. */
export function createUiDebugSandboxSettings(): UiMenuSettings {
	return ui.createMenu({ id: "ui-sdk-debug-sandbox", size: SIZE })
		.addScreen(ui.screen({ id: "overview", layout: ui.layout.absolute(), elements: [
			text("title", "Generic UI SDK Debug Sandbox", 20, 20, 520),
			text("subtitle", "Explicit tick/draw • semantic actions • JSON reconstruction", 20, 48, 620),
			...NAV.map(([label, target], index) => button(`overview-${target}`, label, 20 + (index % 2) * 170, 90 + Math.floor(index / 2) * 42, ui.action.navigate(target))),
			button("exit", "Exit debug UI", 380, 258, ui.action.emit("sandbox:exit")),
		] }))
		.addScreen(ui.screen({ id: "components", layout: ui.layout.absolute(), elements: [
			text("components-title", "Components: ui.text(), ui.button(), ui.textInput(), ui.layout.absolute()", 20, 20, 700),
			text("visible-label", "Visible label", 20, 60),
			ui.text({ id: "hidden-label", text: "Hidden label (toggle me)", rect: rect(20, 86, 230, 20), visible: false }),
			button("toggle-hidden", "Toggle hidden", 260, 80, { type: "toggleVisibility", target: "hidden-label" }),
			button("disabled", "Disabled button", 20, 120, ui.action.emit("components:disabled"), false),
			button("enable-disabled", "Enable disabled", 180, 120, ui.action.setEnabled("disabled", true)),
			button("change-text", "Change label", 350, 120, ui.action.setText("visible-label", "Text changed through semantic action")),
			ui.textInput({ id: "component-input", text: "", rect: rect(20, 170, 260, 36), style: "debug-input" }),
			button("component-emit", "Emit command", 300, 172, ui.action.emitValues("components:emit", ["component-input"])),
			text("layout-note", "Vertical layout is demonstrated on the Lifecycle screen.", 20, 225, 500),
			...nav(),
		] }))
		.addScreen(ui.screen({ id: "input", layout: ui.layout.absolute(), elements: [
			text("input-title", "Pointer and Focus: overlapping targets, disabled/hidden targets, focus diagnostics", 20, 20, 720),
			button("pointer-a", "Pointer A", 30, 80, ui.action.emit("pointer:a")),
			button("pointer-b", "Pointer B overlap", 100, 95, ui.action.emit("pointer:b")),
			ui.textInput({ id: "pointer-field", text: "Click to focus", rect: rect(30, 150, 260, 36) }),
			text("pointer-label", "Text labels are non-interactive", 30, 205),
			button("pointer-disabled", "Disabled target", 30, 235, ui.action.emit("pointer:disabled"), false),
			ui.text({ id: "pointer-hidden", text: "Invisible target", rect: rect(30, 280, 200, 20), visible: false }),
			button("hide-pointer", "Toggle invisible", 250, 275, { type: "toggleVisibility", target: "pointer-hidden" }),
			...nav(),
		] }))
		.addScreen(ui.screen({ id: "text", layout: ui.layout.absolute(), elements: [
			text("text-title", "Text Input: focus, spaces, numbers, symbols, Backspace and value serialization", 20, 20, 740),
			text("first-label", "First input", 20, 65),
			ui.textInput({ id: "first", text: "", rect: rect(20, 88, 300, 36) }),
			text("second-label", "Second input", 20, 145),
			ui.textInput({ id: "second", text: "", rect: rect(20, 168, 300, 36) }),
			button("submit-form", "Emit entered values", 340, 128, ui.action.emitValues("debug-form-submit", ["first", "second"])),
			...nav(),
		] }))
		.addScreen(ui.screen({ id: "navigation", layout: ui.layout.absolute(), elements: [
			text("navigation-title", "Navigation Home: test navigate(), direct links, back history and reconstruction", 20, 20, 740),
			button("nav-a", "Page A", 20, 80, ui.action.navigate("page-a")), button("nav-c", "Page C direct", 190, 80, ui.action.navigate("page-c")),
			...nav(),
		] }))
		.addScreen(ui.screen({ id: "page-a", layout: ui.layout.absolute(), elements: [text("a-title", "Navigation Page A", 20, 20), button("a-next", "Forward to B", 20, 80, ui.action.navigate("page-b")), button("a-back", "Back", 190, 80, ui.action.back()), ...nav("navigation") ] }))
		.addScreen(ui.screen({ id: "page-b", layout: ui.layout.absolute(), elements: [text("b-title", "Navigation Page B", 20, 20), button("b-next", "Forward to C", 20, 80, ui.action.navigate("page-c")), button("b-back", "Back", 190, 80, ui.action.back()), ...nav("navigation") ] }))
		.addScreen(ui.screen({ id: "page-c", layout: ui.layout.absolute(), elements: [text("c-title", "Navigation Page C", 20, 20), button("c-back", "Back", 20, 80, ui.action.back()), button("c-home", "Navigation home", 190, 80, ui.action.navigate("navigation")), ...nav("navigation") ] }))
		.addScreen(ui.screen({ id: "state", layout: ui.layout.absolute(), elements: [
			text("state-title", "State and Reconstruction: export settings, JSON, reconstruct or reset", 20, 20, 700),
			ui.textInput({ id: "state-value", text: "state survives reconstruction", rect: rect(20, 70, 350, 36) }),
			button("export-settings", "Export settings", 20, 130, ui.action.emit("sandbox:export-settings")),
			button("export-json", "Export JSON", 190, 130, ui.action.emit("sandbox:export-json")),
			button("reconstruct", "Reconstruct runtime", 360, 130, ui.action.emit("sandbox:reconstruct")),
			button("reset", "Reset runtime", 530, 130, ui.action.emit("sandbox:reset")), ...nav(),
		] }))
		.addScreen(ui.screen({ id: "lifecycle", layout: ui.layout.vertical({ gap: 8, padding: 18, align: "start" }), elements: [
			text("life-title", "Explicit Lifecycle: tick/draw controls are host-level debug switches", 0, 0, 700),
			button("life-tick", "Toggle tick", 0, 0, ui.action.emit("lifecycle:tick")),
			button("life-draw", "Toggle draw", 0, 0, ui.action.emit("lifecycle:draw")),
			button("life-both", "Enable tick + draw", 0, 0, ui.action.emit("lifecycle:both")),
			text("life-note", "F7 toggles tick and F8 toggles draw even while UI ticking is disabled.", 0, 0, 700),
			button("life-back", "Overview", 0, 0, ui.action.navigate("overview")),
		] }))
		.addScreen(ui.screen({ id: "multiple", layout: ui.layout.absolute(), elements: [text("multiple-title", "Multiple runtimes: independent A and B panels below", 20, 20, 650), text("multiple-note", "Click each panel to focus its input; reconstruct commands affect only that runtime.", 20, 48, 700), ...nav() ] }))
		.addScreen(ui.screen({ id: "validation", layout: ui.layout.absolute(), elements: [
			text("validation-title", "Validation: valid and invalid settings are tested without crashing the sandbox", 20, 20, 740),
			button("valid-minimal", "Valid minimal", 20, 80, ui.action.emit("validation:valid-minimal")),
			button("valid-multi", "Valid multi-screen", 190, 80, ui.action.emit("validation:valid-multi")),
			button("invalid-duplicate-screen", "Duplicate screen", 20, 125, ui.action.emit("validation:duplicate-screen")),
			button("invalid-duplicate-element", "Duplicate element", 190, 125, ui.action.emit("validation:duplicate-element")),
			button("invalid-active", "Missing active", 360, 125, ui.action.emit("validation:missing-active")),
			button("invalid-nav", "Bad navigation", 20, 170, ui.action.emit("validation:bad-navigation")),
			button("invalid-dimensions", "Bad dimensions", 190, 170, ui.action.emit("validation:bad-dimensions")),
			button("invalid-framework", "Bad framework", 360, 170, ui.action.emit("validation:bad-framework")), ...nav(),
		] }))
		.build();
}

function miniSettings(id: string, command: string): UiMenuSettings {
	return ui.createMenu({ id, size: { width: 340, height: 180 } }).addScreen(ui.screen({ id: "main", layout: ui.layout.absolute(), elements: [
		text(`${id}-title`, id, 10, 10, 200), ui.textInput({ id: `${id}-value`, text: "", rect: rect(10, 42, 220, 34) }),
		button(`${id}-emit`, "Emit", 10, 90, ui.action.emitValues(`${command}:emit`, [`${id}-value`])), button(`${id}-rebuild`, "Reconstruct", 170, 90, ui.action.emit(`${command}:reconstruct`)),
	] })).build();
}

/** Browser event adapter owned by the sandbox host, never by generic UI systems. */
export class BrowserUiInputAdapter {
	private pointer = { x: 0, y: 0, pressed: false, justPressed: false, justReleased: false };
	private keys: string[] = []; private text = "";
	public constructor(private readonly canvas: HTMLCanvasElement, private readonly toWorld: (x: number, y: number) => UiPoint) {
		canvas.tabIndex = 0;
		canvas.addEventListener("pointermove", this.move); canvas.addEventListener("pointerdown", this.down); canvas.addEventListener("pointerup", this.up);
		canvas.addEventListener("keydown", this.keydown);
	}
	public consume(): UiInput {
		const input: UiInput = { pointer: { ...this.pointer }, keyboard: { pressedKeys: [...this.keys], textInput: this.text } };
		this.pointer.justPressed = false; this.pointer.justReleased = false; this.keys = []; this.text = "";
		return input;
	}
	public dispose(): void { this.canvas.removeEventListener("pointermove", this.move); this.canvas.removeEventListener("pointerdown", this.down); this.canvas.removeEventListener("pointerup", this.up); this.canvas.removeEventListener("keydown", this.keydown); }
	private setPointer(event: PointerEvent): void { const bounds = this.canvas.getBoundingClientRect(); const point = this.toWorld(event.clientX - bounds.left, event.clientY - bounds.top); this.pointer.x = point.x; this.pointer.y = point.y; }
	private move = (event: PointerEvent) => this.setPointer(event);
	private down = (event: PointerEvent) => { this.canvas.focus(); this.setPointer(event); this.pointer.pressed = true; this.pointer.justPressed = true; };
	private up = (event: PointerEvent) => { this.setPointer(event); this.pointer.pressed = false; this.pointer.justReleased = true; };
	private keydown = (event: KeyboardEvent) => { this.keys.push(event.key); if (event.key.length === 1) this.text += event.key; };
}

class SandboxRenderer implements UiRenderer {
	public constructor(private readonly renderer: P5Renderer, private readonly offset: UiPoint = { x: 0, y: 0 }) { }
	public drawText(element: Parameters<UiRenderer["drawText"]>[0]): void { this.renderer.setFillColor("#e2e8f0"); this.renderer.drawText(element.text ?? "", element.rect.x + this.offset.x, element.rect.y + this.offset.y + 16, 15); }
	public drawButton(element: Parameters<UiRenderer["drawButton"]>[0]): void {
		this.renderer.setFillColor(element.enabled ? (element.focused ? "#2563eb" : "#334155") : "#64748b");
		this.renderer.drawRect(element.rect.x + this.offset.x, element.rect.y + this.offset.y, element.rect.width, element.rect.height);
		this.renderer.setFillColor("#f8fafc"); this.renderer.drawText(element.text ?? "", element.rect.x + this.offset.x + 8, element.rect.y + this.offset.y + 20, 14);
	}
	public drawTextInput(element: Parameters<UiRenderer["drawTextInput"]>[0]): void {
		this.renderer.setFillColor(element.focused ? "#fef3c7" : "#e2e8f0"); this.renderer.drawRect(element.rect.x + this.offset.x, element.rect.y + this.offset.y, element.rect.width, element.rect.height);
		this.renderer.setFillColor("#0f172a"); this.renderer.drawText(element.text ?? "", element.rect.x + this.offset.x + 6, element.rect.y + this.offset.y + 22, 14);
	}
	public drawImage(element: Parameters<UiRenderer["drawImage"]>[0]): void {
		if (element.source) this.renderer.drawImage(element.source, element.rect.x + this.offset.x, element.rect.y + this.offset.y, element.rect.width, element.rect.height);
	}
}

/** Starts the p5 host loop; the UI runtimes remain passive and are ticked/drawn explicitly here. */
export function startUiDebugSandbox(): void {
	let runtime: UiRuntime = ui.fromSettings(createUiDebugSandboxSettings());
	let runtimeA: UiRuntime = ui.fromSettings(miniSettings("Runtime A", "runtime-a"));
	let runtimeB: UiRuntime = ui.fromSettings(miniSettings("Runtime B", "runtime-b"));
	let tickEnabled = true; let drawEnabled = true; let tickCount = 0; let drawCount = 0; let latestCommand = "none"; let validation = "not run"; let reconstruction = "not run"; let exported = ""; let latestPointer: UiInput["pointer"];
	(window as unknown as { uiDebugSandbox?: { getSettings(): UiMenuSettings; getDiagnostics(): Record<string, unknown> } }).uiDebugSandbox = {
		getSettings: () => runtime.toSettings(),
		getDiagnostics: () => ({ tickEnabled, drawEnabled, tickCount, drawCount, latestCommand, validation, reconstruction }),
	};
	const sketch = (p: p5Types) => {
		let renderer: P5Renderer; let adapter: BrowserUiInputAdapter;
		p.setup = () => { p.createCanvas(SIZE.width, SIZE.height); renderer = new P5Renderer(p, 1, SIZE.width); adapter = new BrowserUiInputAdapter((p as unknown as { canvas: HTMLCanvasElement }).canvas, (x, y) => ({ x: renderer.toWorld(x), y: renderer.toWorld(y) })); };
		p.draw = () => {
			if (!renderer) return;
			const input = adapter.consume(); latestPointer = input.pointer;
			if (input.keyboard?.pressedKeys?.includes("F7")) tickEnabled = !tickEnabled;
			if (input.keyboard?.pressedKeys?.includes("F8")) drawEnabled = !drawEnabled;
			if (tickEnabled) { runtime.tick(input, 1); tickCount++; handleCommands(runtime.drainCommands()); tickMultiple(input); }
			renderer.clear("#0f172a");
			const beforeDraw = JSON.stringify(runtime.toSettings());
			if (drawEnabled) { runtime.draw(new SandboxRenderer(renderer)); drawCount++; if (runtime.getActiveScreen() === "multiple") { runtimeA.draw(new SandboxRenderer(renderer, { x: 20, y: 110 })); runtimeB.draw(new SandboxRenderer(renderer, { x: 430, y: 110 })); } }
			const drawPure = beforeDraw === JSON.stringify(runtime.toSettings());
			drawDiagnostics(renderer, runtime, { tickEnabled, drawEnabled, tickCount, drawCount, latestPointer, latestCommand, validation, reconstruction, exported, drawPure });
		};
	};
	const P5Constructor = window.p5 as unknown as new (factory: (instance: p5Types) => void) => unknown;
	new P5Constructor(sketch);

	function tickMultiple(input: UiInput): void {
		if (runtime.getActiveScreen() !== "multiple") return;
		const route = (offset: number, width: number): UiInput => ({ pointer: input.pointer && input.pointer.x >= offset && input.pointer.x <= offset + width ? { ...input.pointer, x: input.pointer.x - offset, y: input.pointer.y - 110 } : undefined, keyboard: input.keyboard });
		runtimeA.tick(route(20, 340), 1); runtimeB.tick(route(430, 340), 1);
		for (const command of runtimeA.drainCommands()) if (command.command === "runtime-a:reconstruct") runtimeA = ui.fromSettings(JSON.parse(JSON.stringify(runtimeA.toSettings()))); else latestCommand = `${command.command} ${JSON.stringify(command.payload ?? "")}`;
		for (const command of runtimeB.drainCommands()) if (command.command === "runtime-b:reconstruct") runtimeB = ui.fromSettings(JSON.parse(JSON.stringify(runtimeB.toSettings()))); else latestCommand = `${command.command} ${JSON.stringify(command.payload ?? "")}`;
	}
	function handleCommands(commands: ReturnType<UiRuntime["drainCommands"]>): void {
		for (const command of commands) {
			latestCommand = `${command.command} ${JSON.stringify(command.payload ?? "")}`;
			if (command.command === "sandbox:exit") { const url = new URL(window.location.href); url.searchParams.delete("debug"); url.searchParams.delete("debugui"); window.location.assign(url.toString()); }
			if (command.command === "sandbox:export-settings") exported = JSON.stringify(runtime.toSettings(), null, 2);
			if (command.command === "sandbox:export-json") exported = JSON.stringify(runtime.toSettings());
			if (command.command === "sandbox:reconstruct") { const saved = JSON.parse(JSON.stringify(runtime.toSettings())) as UiMenuSettings; runtime = ui.fromSettings(saved); reconstruction = JSON.stringify(runtime.toSettings()) === JSON.stringify(saved) ? "reconstructed equivalent runtime" : "reconstruction mismatch"; }
			if (command.command === "sandbox:reset") { runtime = ui.fromSettings(createUiDebugSandboxSettings()); reconstruction = "reset to fresh runtime"; }
			if (command.command === "lifecycle:tick") tickEnabled = !tickEnabled;
			if (command.command === "lifecycle:draw") drawEnabled = !drawEnabled;
			if (command.command === "lifecycle:both") { tickEnabled = true; drawEnabled = true; }
			if (command.command.startsWith("validation:")) validation = validateExample(command.command.slice("validation:".length));
		}
	}
}

function validateExample(name: string): string {
	try {
		const value = createUiDebugSandboxSettings();
		const candidate = JSON.parse(JSON.stringify(value)) as UiMenuSettings;
		if (name === "duplicate-screen") candidate.screens.push({ ...candidate.screens[0]! });
		if (name === "duplicate-element") candidate.screens[0]!.elements.push({ ...candidate.screens[0]!.elements[0]! });
		if (name === "missing-active") candidate.activeScreen = "missing";
		if (name === "bad-navigation") (candidate.screens[0]!.elements.find(element => element.kind === "button")!.action as { target: string }).target = "missing";
		if (name === "bad-dimensions") candidate.size.width = -1;
		if (name === "bad-framework") candidate.framework.systemOrder.reverse();
		validateUiSettings(candidate);
		return `valid: ${name}`;
	} catch (error) { return `rejected ${name}: ${error instanceof Error ? error.message : String(error)}`; }
}

function drawDiagnostics(renderer: P5Renderer, runtime: UiRuntime, state: { tickEnabled: boolean; drawEnabled: boolean; tickCount: number; drawCount: number; latestPointer: UiInput["pointer"]; latestCommand: string; validation: string; reconstruction: string; exported: string; drawPure: boolean }): void {
	renderer.setFillColor("#111827"); renderer.drawRect(595, 8, 198, 332); renderer.setFillColor("#f8fafc");
	const lines = ["HOST DIAGNOSTICS", `screen: ${runtime.getActiveScreen()}`, `history: ${runtime.toSettings().history.join(">") || "-"}`, `focus: ${runtime.getFocusedElementId() ?? "-"}`, `hover: ${runtime.getHoveredElementId() ?? "-"}`, `pressed: ${runtime.getPressedTargetId() ?? "-"}`, `pointer: ${state.latestPointer ? `${Math.round(state.latestPointer.x)},${Math.round(state.latestPointer.y)}` : "-"}`, `tick/draw: ${state.tickEnabled}/${state.drawEnabled}`, `counts: ${state.tickCount}/${state.drawCount}`, `draw pure: ${state.drawPure}`, `command: ${state.latestCommand.slice(0, 24)}`, `validation: ${state.validation.slice(0, 24)}`, `rebuild: ${state.reconstruction.slice(0, 24)}`, `json: ${state.exported ? `${state.exported.length} chars` : "-"}`];
	lines.forEach((line, index) => renderer.drawText(line, 604, 28 + index * 21, index === 0 ? 13 : 11));
}

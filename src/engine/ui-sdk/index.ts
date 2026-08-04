import { assertJsonValue, type JsonValue } from "../contracts/systemSettings.js";
import { EngineSystemRegistry, type EngineFrameworkSettings } from "../sdk/index.js";

export type UiPoint = { x: number; y: number };
export type UiRect = { x: number; y: number; width: number; height: number };
export type UiAction =
	| { type: "navigate"; target: string }
	| { type: "back" }
	| { type: "emit"; command: string; payload?: JsonValue }
	| { type: "setValue"; target: string; value: JsonValue }
	| { type: "toggleVisibility"; target: string }
	| { type: "closeOverlay" }
	| { type: "select"; target: string; value: JsonValue };
export type UiLayout = { type: "absolute" } | { type: "vertical"; gap?: number; padding?: number; align?: "start" | "center" | "end" };
export type UiElementKind = "button" | "text" | "textInput";

export interface UiElementSettings {
	id: string;
	kind: UiElementKind;
	rect: UiRect;
	text: string;
	visible?: boolean;
	enabled?: boolean;
	focusable?: boolean;
	style?: string;
	action?: UiAction;
	value?: string;
}
export interface UiScreenSettings { id: string; layout?: UiLayout; visible?: boolean; elements: UiElementSettings[] }
export interface UiMenuSettings {
	schemaVersion: 1;
	id: string;
	size: { width: number; height: number };
	activeScreen: string;
	history: string[];
	screens: UiScreenSettings[];
	theme?: Record<string, JsonValue>;
	framework: EngineFrameworkSettings;
}
export interface UiPointerState { x: number; y: number; pressed?: boolean; justPressed?: boolean; justReleased?: boolean }
export interface UiKeyboardState { pressedKeys?: readonly string[]; textInput?: string }
export interface UiInput { pointer?: UiPointerState; keyboard?: UiKeyboardState }
export interface UiCommand { command: string; payload?: JsonValue }

/** Narrow UI capabilities used by systems; runtime element classes are never required. */
export interface IUiPosition { rect: UiRect }
export interface IUiVisible { visible: boolean }
export interface IUiEnabled { enabled: boolean }
export interface IUiFocusable { focused: boolean }
export interface IUiPointerTarget extends IUiPosition { containsPoint(point: UiPoint): boolean }
export interface IUiPressable { action?: UiAction }
export interface IUiTextContent { text: string }
export interface IUiTextInput extends IUiTextContent, IUiFocusable { value: string; insertText(value: string): void; deleteBackward(): void }

interface UiRuntimeElement extends IUiPosition, IUiVisible, IUiEnabled, Partial<IUiFocusable>, Partial<IUiPressable>, Partial<IUiTextInput> {
	id: string;
	kind: UiElementKind;
	style?: string;
	containsPoint(point: UiPoint): boolean;
	toSettings(): UiElementSettings;
}

/** Renderer port supplied explicitly by a host; it has no browser or canvas dependency. */
export interface UiRenderer {
	drawText(element: Readonly<UiRuntimeElement>): void;
	drawButton(element: Readonly<UiRuntimeElement>): void;
	drawTextInput(element: Readonly<UiRuntimeElement>): void;
}

type UiSystem = { id: string; tick?(runtime: UiRuntime, input: UiInput, deltaTime: number): void; draw?(runtime: UiRuntime, renderer: UiRenderer): void };

/** Explicitly ticked/drawn generic UI runtime. It owns no timers, DOM listeners, or render loop. */
export class UiRuntime {
	private readonly screens = new Map<string, { settings: UiScreenSettings; elements: UiRuntimeElement[] }>();
	private readonly systems: UiSystem[];
	private activeScreen: string;
	private history: string[];
	private pendingPress: string | undefined;
	private pendingActions: UiAction[] = [];
	private emitted: UiCommand[] = [];

	public constructor(private readonly settings: UiMenuSettings) {
		validateUiSettings(settings);
		this.activeScreen = settings.activeScreen;
		this.history = [...settings.history];
		for (const screen of settings.screens) this.screens.set(screen.id, { settings: clone(screen), elements: screen.elements.map(createElement) });
		this.systems = settings.framework.systemOrder.map(createUiSystem);
		this.layout();
	}
	public static fromSettings(settings: UiMenuSettings): UiRuntime { return new UiRuntime(settings); }
	/** Advances UI state only when called by the host. */
	public tick(input: UiInput = {}, deltaTime: number = 1): void { for (const system of this.systems) system.tick?.(this, input, deltaTime); }
	/** Renders current state only; this method does not mutate persistent UI state. */
	public draw(renderer: UiRenderer): void { for (const system of this.systems) system.draw?.(this, renderer); }
	public toSettings(): UiMenuSettings {
		const screens = [...this.screens.values()].map(screen => ({ ...clone(screen.settings), elements: screen.elements.map(element => element.toSettings()) }));
		return { ...clone(this.settings), activeScreen: this.activeScreen, history: [...this.history], screens };
	}
	public getActiveElements(): readonly UiRuntimeElement[] { return this.screens.get(this.activeScreen)!.elements; }
	public getActiveScreen(): string { return this.activeScreen; }
	public drainCommands(): UiCommand[] { const commands = this.emitted.map(clone); this.emitted = []; return commands; }
	public explain(): string { return `UI '${this.settings.id}' uses ${this.systems.map(system => system.id).join(", ")} with explicit tick() and draw().`; }

	// System-facing capability operations. These remain explicit and testable.
	public layout(): void {
		const screen = this.screens.get(this.activeScreen)!;
		if (screen.settings.layout?.type !== "vertical") return;
		const { gap = 0, padding = 0, align = "start" } = screen.settings.layout;
		let y = padding;
		for (const element of screen.elements) {
			if (!element.visible) continue;
			if (align === "center") element.rect.x = (this.settings.size.width - element.rect.width) / 2;
			else if (align === "end") element.rect.x = this.settings.size.width - padding - element.rect.width;
			else element.rect.x = padding;
			element.rect.y = y;
			y += element.rect.height + gap;
		}
	}
	public pointer(input: UiPointerState | undefined): void {
		this.pendingPress = undefined;
		if (!input?.justPressed) return;
		const point = { x: input.x, y: input.y };
		const target = this.getActiveElements().find(element => hasPointerTarget(element) && element.visible && element.enabled && element.containsPoint(point));
		this.pendingPress = target?.id;
	}
	public focus(): void {
		if (!this.pendingPress) return;
		for (const element of this.getActiveElements()) if (hasFocusable(element)) element.focused = element.id === this.pendingPress;
	}
	public keyboard(input: UiKeyboardState | undefined): void {
		const focused = this.getActiveElements().find(hasTextInput);
		if (!focused) return;
		if (input?.textInput) focused.insertText(input.textInput);
		if (input?.pressedKeys?.includes("Backspace")) focused.deleteBackward();
	}
	public press(): void {
		if (!this.pendingPress) return;
		const target = this.getActiveElements().find(element => element.id === this.pendingPress);
		if (target && hasPressable(target) && target.enabled && target.visible && target.action) this.pendingActions.push(clone(target.action));
	}
	public navigate(): void {
		for (const action of this.pendingActions.splice(0)) this.applyAction(action);
	}
	public render(renderer: UiRenderer): void {
		for (const element of this.getActiveElements()) {
			if (!element.visible) continue;
			if (element.kind === "button") renderer.drawButton(element);
			else if (element.kind === "textInput") renderer.drawTextInput(element);
			else renderer.drawText(element);
		}
	}
	private applyAction(action: UiAction): void {
		if (action.type === "navigate") {
			if (!this.screens.has(action.target)) return;
			this.history.push(this.activeScreen); this.activeScreen = action.target; this.layout(); return;
		}
		if (action.type === "back") { const previous = this.history.pop(); if (previous) { this.activeScreen = previous; this.layout(); } return; }
		if (action.type === "toggleVisibility" || action.type === "closeOverlay") {
			const target = action.type === "closeOverlay" ? this.getActiveElements()[0]?.id : action.target;
			const element = this.getActiveElements().find(candidate => candidate.id === target); if (element) element.visible = !element.visible; return;
		}
		if (action.type === "setValue" || action.type === "select") {
			const element = this.getActiveElements().find(candidate => candidate.id === action.target); if (element && hasTextInput(element) && typeof action.value === "string") element.value = action.value; return;
		}
		if (action.type === "emit") this.emitted.push({ command: action.command, ...(action.payload === undefined ? {} : { payload: clone(action.payload) }) });
	}
}

class UiElement implements UiRuntimeElement {
	public visible: boolean; public enabled: boolean; public focused: boolean; public value: string;
	public constructor(private readonly settings: UiElementSettings) { this.visible = settings.visible ?? true; this.enabled = settings.enabled ?? true; this.focused = false; this.value = settings.value ?? settings.text; }
	public get id(): string { return this.settings.id; } public get kind(): UiElementKind { return this.settings.kind; }
	public get rect(): UiRect { return this.settings.rect; } public set rect(value: UiRect) { this.settings.rect = value; }
	public get text(): string { return this.settings.text; } public set text(value: string) { this.settings.text = value; }
	public get style(): string | undefined { return this.settings.style; } public get action(): UiAction | undefined { return this.settings.action; }
	public containsPoint(point: UiPoint): boolean { return point.x >= this.rect.x && point.x <= this.rect.x + this.rect.width && point.y >= this.rect.y && point.y <= this.rect.y + this.rect.height; }
	public insertText(value: string): void { this.value += value; this.text = this.value; }
	public deleteBackward(): void { this.value = this.value.slice(0, -1); this.text = this.value; }
	public toSettings(): UiElementSettings { return { ...clone(this.settings), rect: clone(this.rect), text: this.text, visible: this.visible, enabled: this.enabled, ...(this.kind === "textInput" ? { value: this.value } : {}) }; }
}

const UI_SYSTEMS: Record<string, UiSystem> = {
	"ui.visibility": { id: "ui.visibility" },
	"ui.layout": { id: "ui.layout", tick: runtime => runtime.layout() },
	"ui.input.pointer": { id: "ui.input.pointer", tick: (runtime, input) => runtime.pointer(input.pointer) },
	"ui.focus": { id: "ui.focus", tick: runtime => runtime.focus() },
	"ui.input.keyboard": { id: "ui.input.keyboard", tick: (runtime, input) => runtime.keyboard(input.keyboard) },
	"ui.text-input": { id: "ui.text-input" },
	"ui.button": { id: "ui.button", tick: runtime => runtime.press() },
	"ui.navigation": { id: "ui.navigation", tick: runtime => runtime.navigate() },
	"ui.render": { id: "ui.render", draw: (runtime, renderer) => runtime.render(renderer) },
};
function createUiSystem(id: string): UiSystem { const system = UI_SYSTEMS[id]; if (!system) throw new Error(`Unknown UI system '${id}'`); return system; }

/** Default generic UI framework: layout → pointer → focus → keyboard/text → button → navigation → render. */
export function createDefaultUiFramework(): EngineFrameworkSettings {
	const registry = new EngineSystemRegistry()
		.register({ id: "ui.visibility", provides: ["ui.visibility"] })
		.register({ id: "ui.layout", provides: ["ui.layout"], after: ["ui.visibility"] })
		.register({ id: "ui.input.pointer", provides: ["ui.pointer"], after: ["ui.layout"] })
		.register({ id: "ui.focus", requires: ["ui.pointer"], provides: ["ui.focus"], after: ["ui.input.pointer"] })
		.register({ id: "ui.input.keyboard", provides: ["ui.keyboard"], after: ["ui.focus"] })
		.register({ id: "ui.text-input", requires: ["ui.focus", "ui.keyboard"], after: ["ui.input.keyboard"] })
		.register({ id: "ui.button", requires: ["ui.pointer"], after: ["ui.focus", "ui.text-input"] })
		.register({ id: "ui.navigation", after: ["ui.button", "ui.text-input"] })
		.register({ id: "ui.render", requires: ["ui.layout"], after: ["ui.navigation"] });
	return registry.select(["ui.visibility", "ui.layout", "ui.input.pointer", "ui.focus", "ui.input.keyboard", "ui.text-input", "ui.button", "ui.navigation", "ui.render"]);
}

export class UiMenuBuilder {
	private readonly screens: UiScreenSettings[] = [];
	private framework = createDefaultUiFramework();
	public constructor(private readonly id: string, private readonly size: { width: number; height: number }) { if (!id || !positive(size.width) || !positive(size.height)) throw new Error("A UI menu requires an ID and positive size"); }
	public addScreen(screen: UiScreenSettings): this { this.screens.push(clone(screen)); return this; }
	public useFramework(framework: EngineFrameworkSettings): this { this.framework = clone(framework); return this; }
	public build(): UiMenuSettings { const settings: UiMenuSettings = { schemaVersion: 1, id: this.id, size: clone(this.size), activeScreen: this.screens[0]?.id ?? "", history: [], screens: clone(this.screens), framework: clone(this.framework) }; validateUiSettings(settings); return settings; }
	public buildJson(space: number = 2): string { return JSON.stringify(this.build(), null, space); }
	public explain(): string { return "Builds a JSON-safe explicit-tick UI menu with screens, semantic actions, and registry-selected systems."; }
}

function createElement(settings: UiElementSettings): UiRuntimeElement { return new UiElement(clone(settings)); }
function hasPointerTarget(value: UiRuntimeElement): value is UiRuntimeElement & IUiPointerTarget { return typeof value.containsPoint === "function"; }
function hasFocusable(value: UiRuntimeElement): value is UiRuntimeElement & IUiFocusable { return "focused" in value && value.kind !== "text"; }
function hasPressable(value: UiRuntimeElement): value is UiRuntimeElement & IUiPressable { return value.kind === "button"; }
function hasTextInput(value: UiRuntimeElement): value is UiRuntimeElement & IUiTextInput { return value.kind === "textInput" && value.focused === true; }
function positive(value: number): boolean { return Number.isFinite(value) && value > 0; }
function clone<T>(value: T): T { return structuredClone(value); }

/** Validates generic UI settings without KORE-specific routes, themes, or labels. */
export function validateUiSettings(settings: unknown): asserts settings is UiMenuSettings {
	if (!settings || typeof settings !== "object" || Array.isArray(settings)) throw new Error("Invalid UI settings");
	const value = settings as Partial<UiMenuSettings>;
	if (value.schemaVersion !== 1 || typeof value.id !== "string" || !value.size || !positive(value.size.width) || !positive(value.size.height) || !Array.isArray(value.screens) || typeof value.activeScreen !== "string" || !Array.isArray(value.history)) throw new Error("Invalid UI settings");
	const screenIds = new Set<string>();
	for (const screen of value.screens) {
		if (!screen || typeof screen.id !== "string" || screenIds.has(screen.id) || !Array.isArray(screen.elements)) throw new Error("Invalid UI screen");
		screenIds.add(screen.id);
	}
	for (const screen of value.screens) {
		const elementIds = new Set<string>();
		for (const element of screen.elements) validateElement(element, elementIds, screenIds);
	}
	if (!screenIds.has(value.activeScreen)) throw new Error("UI active screen is missing");
	if (value.history.some(id => !screenIds.has(id))) throw new Error("UI navigation history references an unknown screen");
	if (value.theme !== undefined) assertJsonValue(value.theme);
	if (!value.framework) throw new Error("UI framework is required");
	const expected = createDefaultUiFramework().systemOrder;
	if (value.framework.systemOrder.join("|") !== expected.join("|")) throw new Error("Unsupported UI framework order");
}
function validateElement(element: UiElementSettings, ids: Set<string>, screenIds: Set<string>): void {
	if (!element || typeof element.id !== "string" || ids.has(element.id) || (element.kind !== "button" && element.kind !== "text" && element.kind !== "textInput") || typeof element.text !== "string" || !element.rect || ![element.rect.x, element.rect.y, element.rect.width, element.rect.height].every(Number.isFinite) || element.rect.width < 0 || element.rect.height < 0) throw new Error("Invalid UI element");
	ids.add(element.id);
	if (element.action) validateAction(element.action, screenIds);
}
function validateAction(action: UiAction, screenIds: Set<string>): void {
	if (action.type === "navigate" && !screenIds.has(action.target)) throw new Error("UI navigation target is missing");
	if (action.type === "emit" && (!action.command || typeof action.command !== "string")) throw new Error("Invalid UI command");
	assertJsonValue(action);
}

/** Single generic UI SDK entry point. */
export const ui = {
	createMenu(options: { id: string; size: { width: number; height: number } }): UiMenuBuilder { return new UiMenuBuilder(options.id, options.size); },
	fromSettings(settings: UiMenuSettings): UiRuntime { return UiRuntime.fromSettings(settings); },
	createDefaultFramework: createDefaultUiFramework,
	validate: validateUiSettings,
	screen(settings: UiScreenSettings): UiScreenSettings { return clone(settings); },
	button(settings: Omit<UiElementSettings, "kind">): UiElementSettings { return { ...clone(settings), kind: "button", focusable: settings.focusable ?? true }; },
	text(settings: Omit<UiElementSettings, "kind" | "action">): UiElementSettings { return { ...clone(settings), kind: "text", focusable: false }; },
	textInput(settings: Omit<UiElementSettings, "kind">): UiElementSettings { return { ...clone(settings), kind: "textInput", focusable: true, value: settings.value ?? settings.text }; },
	layout: { absolute(): UiLayout { return { type: "absolute" }; }, vertical(options: Omit<Extract<UiLayout, { type: "vertical" }>, "type"> = {}): UiLayout { return { type: "vertical", ...options }; } },
	action: { navigate(target: string): UiAction { return { type: "navigate", target }; }, back(): UiAction { return { type: "back" }; }, emit(command: string, payload?: JsonValue): UiAction { return { type: "emit", command, ...(payload === undefined ? {} : { payload }) }; } },
	types: { containsPoint(rect: UiRect, point: UiPoint): boolean { return point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height; } },
} as const;

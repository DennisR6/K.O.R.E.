import { assertJsonValue, type JsonValue } from "../contracts/systemSettings.js";
import { EngineSystemRegistry, type EngineFrameworkSettings } from "../sdk/index.js";

export type UiPoint = { x: number; y: number };
export type UiRect = { x: number; y: number; width: number; height: number };
export type UiAction =
	| { type: "navigate"; target: string }
	| { type: "back" }
	| { type: "emit"; command: string; payload?: JsonValue }
	| { type: "emitValues"; command: string; targets: string[] }
	| { type: "setValue"; target: string; value: JsonValue }
	| { type: "setEnabled"; target: string; enabled: boolean }
	| { type: "setText"; target: string; text: string }
	| { type: "toggleVisibility"; target: string }
	| { type: "closeOverlay" }
	| { type: "select"; target: string; value: JsonValue };

/** Main-axis justification for flow layouts. */
export type UiJustify = "start" | "center" | "end" | "space-between" | "space-around" | "space-evenly";
/** Cross-axis alignment for flow layouts. */
export type UiAlign = "start" | "center" | "end" | "stretch";
/** Canonical padding. One deterministic representation in serialized settings. */
export type UiPadding = { top: number; right: number; bottom: number; left: number };
/** Authoring-time padding shorthand; normalized immediately into UiPadding. */
export type UiPaddingInput = number | UiPadding | { horizontal: number; vertical: number };

/** Authoring-time layout input; the builders normalize it into UiLayout. */
export type UiLayoutInput = {
	type: "absolute" | "horizontal" | "vertical";
	gap?: number;
	padding?: UiPaddingInput;
	justify?: UiJustify;
	align?: UiAlign;
};
/** Canonical layout settings. `absolute` keeps local child coordinates. */
export type UiLayout =
	| { type: "absolute"; padding?: UiPadding }
	| { type: "horizontal"; gap?: number; padding?: UiPadding; justify?: UiJustify; align?: UiAlign }
	| { type: "vertical"; gap?: number; padding?: UiPadding; justify?: UiJustify; align?: UiAlign };

export type UiElementKind = "button" | "text" | "textInput" | "image" | "container";

/** Host-rendered visual component. The generic SDK stores it but never loads assets. */
export interface UiComponentSettings {
	type: "image";
	source: string;
}

export interface UiTextSettings {
	kind: "text";
	id: string;
	rect: UiRect;
	text: string;
	visible?: boolean;
	enabled?: boolean;
	focusable?: boolean;
	style?: string;
}
export interface UiButtonSettings {
	kind: "button";
	id: string;
	rect: UiRect;
	text: string;
	/** Optional host-defined icon identifier, kept JSON-safe and asset-agnostic. */
	icon?: string;
	/** Optional visual component rendered inside the button by the host renderer. */
	component?: UiComponentSettings;
	visible?: boolean;
	enabled?: boolean;
	focusable?: boolean;
	style?: string;
	action?: UiAction;
}
export interface UiTextInputSettings {
	kind: "textInput";
	id: string;
	rect: UiRect;
	text: string;
	visible?: boolean;
	enabled?: boolean;
	focusable?: boolean;
	style?: string;
	action?: UiAction;
	value?: string;
}
export interface UiImageSettings {
	kind: "image";
	id: string;
	rect: UiRect;
	/** Host-defined asset key or URL; the generic SDK never loads it. */
	source: string;
	visible?: boolean;
	enabled?: boolean;
	style?: string;
}
/** Canonical container element: owns children and a layout definition. */
export interface UiContainerSettings {
	kind: "container";
	id: string;
	rect: UiRect;
	layout: UiLayout;
	elements: UiElementSettings[];
	visible?: boolean;
	enabled?: boolean;
	style?: string;
}
export type UiElementSettings = UiTextSettings | UiButtonSettings | UiTextInputSettings | UiImageSettings | UiContainerSettings;
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

/** Builder input types; every shorthand is normalized before serialization. */
export type UiButtonInput = Omit<UiButtonSettings, "kind">;
export type UiTextElementInput = Omit<UiTextSettings, "kind">;
export type UiTextInputElementInput = Omit<UiTextInputSettings, "kind">;
export type UiImageInput = Omit<UiImageSettings, "kind">;
export type UiContainerInput = {
	id: string;
	rect: UiRect;
	layout?: UiLayoutInput;
	elements: UiElementSettings[];
	visible?: boolean;
	enabled?: boolean;
	style?: string;
};
export type UiScreenInput = Omit<UiScreenSettings, "layout"> & { layout?: UiLayoutInput };

/** Narrow UI capabilities used by systems; runtime element classes are never required. */
export interface IUiPosition { rect: UiRect }
export interface IUiVisible { visible: boolean }
export interface IUiEnabled { enabled: boolean }
export interface IUiFocusable { focused: boolean }
export interface IUiHovered { hovered: boolean }
export interface IUiPressState { pressed: boolean }
export interface IUiIcon { icon?: string }
export interface IUiComponent { component?: UiComponentSettings }
export interface IUiImage { source?: string }
export interface IUiPointerTarget extends IUiPosition { containsPoint(point: UiPoint): boolean }
export interface IUiPressable { action?: UiAction }
export interface IUiTextContent { text: string }
export interface IUiTextInput extends IUiTextContent, IUiFocusable { value: string; insertText(value: string): void; deleteBackward(): void }

export interface UiRuntimeElement extends IUiPosition, IUiVisible, IUiEnabled, Partial<IUiFocusable>, Partial<IUiHovered>, Partial<IUiPressState>, Partial<IUiPressable>, Partial<IUiTextInput>, IUiIcon, IUiImage, IUiComponent {
	id: string;
	kind: UiElementKind;
	/** Authored local rectangle, retained separately from resolved world geometry. */
	readonly localRect: UiRect;
	style?: string;
	containsPoint(point: UiPoint): boolean;
	toSettings(): UiElementSettings;
}

/** Runtime container node: layout-only, never focusable, never rendered directly. */
export interface UiContainerRuntime extends IUiPosition, IUiVisible, IUiEnabled {
	id: string;
	kind: "container";
	/** Authored local rectangle, retained separately from resolved world geometry. */
	readonly localRect: UiRect;
	style?: string;
	layout: UiLayout;
	elements: UiRuntimeNode[];
	containsPoint(point: UiPoint): boolean;
	toSettings(): UiContainerSettings;
}

export type UiRuntimeNode = UiRuntimeElement | UiContainerRuntime;

/** Renderer port supplied explicitly by a host; it has no browser or canvas dependency. */
export interface UiRenderer {
	drawText(element: Readonly<UiRuntimeElement>): void;
	drawButton(element: Readonly<UiRuntimeElement>): void;
	drawTextInput(element: Readonly<UiRuntimeElement>): void;
	drawImage(element: Readonly<UiRuntimeElement>): void;
}

type UiSystem = { id: string; tick?(runtime: UiRuntime, input: UiInput, deltaTime: number): void; draw?(runtime: UiRuntime, renderer: UiRenderer): void };

/** Explicitly ticked/drawn generic UI runtime. It owns no timers, DOM listeners, or render loop. */
export class UiRuntime {
	private readonly screens = new Map<string, { settings: UiScreenSettings; elements: UiRuntimeNode[] }>();
	private readonly systems: UiSystem[];
	private activeScreen: string;
	private history: string[];
	private pendingPress: string | undefined;
	private hovered: string | undefined;
	private pendingKeyboard: UiKeyboardState | undefined;
	private pendingActions: UiAction[] = [];
	private emitted: UiCommand[] = [];

	public constructor(private readonly settings: UiMenuSettings) {
		validateUiSettings(settings);
		this.activeScreen = settings.activeScreen;
		this.history = [...settings.history];
		for (const screen of settings.screens) this.screens.set(screen.id, { settings: clone(screen), elements: screen.elements.map(createNode) });
		this.systems = settings.framework.systemOrder.map(createUiSystem);
		this.layout();
	}
	public static fromSettings(settings: UiMenuSettings): UiRuntime { return new UiRuntime(settings); }
	/** Advances UI state only when called by the host. */
	public tick(input: UiInput = {}, deltaTime: number = 1): void { for (const system of this.systems) system.tick?.(this, input, deltaTime); }
	/** Renders current state only; this method does not mutate persistent UI state. */
	public draw(renderer: UiRenderer): void { for (const system of this.systems) system.draw?.(this, renderer); }
	public toSettings(): UiMenuSettings {
		const screens = [...this.screens.values()].map(screen => ({ ...clone(screen.settings), elements: screen.elements.map(node => node.toSettings()) }));
		return { ...clone(this.settings), activeScreen: this.activeScreen, history: [...this.history], screens };
	}
	/** Top-level runtime nodes of the active screen, in declaration order. */
	public getActiveElements(): readonly UiRuntimeNode[] { return this.screens.get(this.activeScreen)!.elements; }
	public getActiveScreen(): string { return this.activeScreen; }
	public getFocusedElementId(): string | undefined { return this.activeLeaves().find(hasFocusable)?.id; }
	public getElementValue(id: string): string | undefined { const element = this.findElementAnywhere(id); return element?.kind === "textInput" ? element.value : undefined; }
	public getHoveredElementId(): string | undefined { return this.hovered; }
	public getPressedTargetId(): string | undefined { return this.pendingPress; }
	/** Applies a validated semantic action during an explicit host-controlled tick. */
	public dispatch(action: UiAction): void { validateAction(action, new Set(this.screens.keys()), "action", true); this.applyAction(clone(action)); }
	/** Changes a declared element's visibility (nested containers included) and reflows the active screen. */
	public setElementVisible(id: string, visible: boolean): boolean {
		const node = this.findNodeAnywhere(id);
		if (!node) return false;
		node.visible = visible;
		this.layout();
		return true;
	}
	/** Rebinds a declared interactive element through the public generic action contract. */
	public setElementAction(id: string, action: UiAction | undefined): boolean {
		if (action) validateAction(action, new Set(this.screens.keys()), "action", true);
		const element = this.findElementAnywhere(id);
		if (!element) return false;
		element.action = action ? clone(action) : undefined;
		return true;
	}
	/** Updates enabled state through a reusable host-facing UI primitive. */
	public setElementEnabled(id: string, enabled: boolean): boolean {
		const node = this.findNodeAnywhere(id);
		if (!node) return false;
		node.enabled = enabled;
		return true;
	}
	/** Updates element text through the same anywhere-scope host primitive (text/button/input). */
	public setElementText(id: string, text: string): boolean {
		const element = this.findElementAnywhere(id);
		if (!element) return false;
		element.text = text;
		return true;
	}
	/** Updates a host-rendered visual component without coupling the runtime to asset loading. */
	public setElementComponent(id: string, component: UiComponentSettings | undefined): boolean {
		if (component) validateUiComponent(component, `element "${id}" component`);
		const element = this.findElementAnywhere(id);
		if (!element || element.kind !== "button") return false;
		element.component = component ? clone(component) : undefined;
		return true;
	}
	public drainCommands(): UiCommand[] { const commands = this.emitted.map(clone); this.emitted = []; return commands; }
	public explain(): string { return `UI '${this.settings.id}' uses ${this.systems.map(system => system.id).join(", ")} with explicit tick() and draw().`; }

	// System-facing capability operations. These remain explicit and testable.
	/** Canonical recursive layout pass for the active screen. Deterministic and pure numeric. */
	public layout(): void {
		const screen = this.screens.get(this.activeScreen);
		if (!screen) return;
		const size = this.settings.size;
		this.resolveLayout({ x: 0, y: 0, width: size.width, height: size.height }, screen.settings.layout ?? { type: "absolute" }, screen.elements, true, true);
	}
	public pointer(input: UiPointerState | undefined): void {
		this.pendingPress = undefined;
		this.hovered = undefined;
		for (const element of this.activeLeaves()) {
			if ("hovered" in element) element.hovered = false;
			if ("pressed" in element) element.pressed = false;
		}
		if (!input) return;
		const point = { x: input.x, y: input.y };
		const target = this.findPointerTarget(point);
		this.hovered = target?.id;
		if (target && "hovered" in target) target.hovered = true;
		if (target && input.pressed && "pressed" in target) target.pressed = true;
		if (input.justPressed) this.pendingPress = target?.id;
	}
	public focus(): void {
		if (!this.pendingPress) return;
		for (const element of this.activeLeaves()) if (hasFocusable(element)) element.focused = element.id === this.pendingPress;
	}
	public keyboard(input: UiKeyboardState | undefined): void {
		this.pendingKeyboard = input;
	}
	public textInput(): void {
		const focused = this.activeLeaves().find(hasTextInput);
		if (!focused) { this.pendingKeyboard = undefined; return; }
		if (this.pendingKeyboard?.textInput) focused.insertText(this.pendingKeyboard.textInput);
		if (this.pendingKeyboard?.pressedKeys?.includes("Backspace")) focused.deleteBackward();
		this.pendingKeyboard = undefined;
	}
	public press(): void {
		if (!this.pendingPress) return;
		const found = this.findLeaf(this.pendingPress);
		if (found && hasPressable(found.element) && found.enabled && found.visible && found.element.action) this.pendingActions.push(clone(found.element.action));
	}
	public navigate(): void {
		for (const action of this.pendingActions.splice(0)) this.applyAction(action);
	}
	public render(renderer: UiRenderer): void {
		this.renderNodes(renderer, this.activeScreenNodes(), true);
	}
	private applyAction(action: UiAction): void {
		if (action.type === "navigate") {
			if (!this.screens.has(action.target)) return;
			this.history.push(this.activeScreen); this.activeScreen = action.target; this.layout(); return;
		}
		if (action.type === "back") { const previous = this.history.pop(); if (previous) { this.activeScreen = previous; this.layout(); } return; }
		if (action.type === "toggleVisibility" || action.type === "closeOverlay") {
			const target = action.type === "closeOverlay" ? this.activeScreenNodes()[0]?.id : action.target;
			const node = this.findNode(target); if (node) { node.visible = !node.visible; this.layout(); } return;
		}
		if (action.type === "setValue" || action.type === "select") {
			const element = this.findElement(action.target); if (element && isTextInputElement(element) && typeof action.value === "string") element.value = action.value; return;
		}
		if (action.type === "setEnabled") { const node = this.findNode(action.target); if (node) node.enabled = action.enabled; return; }
		if (action.type === "setText") { const element = this.findElement(action.target); if (element) element.text = action.text; return; }
		if (action.type === "emitValues") {
			const payload: { [key: string]: JsonValue } = {};
			for (const target of action.targets) {
				const element = this.findElement(target);
				if (element && isTextInputElement(element)) payload[target] = element.value;
			}
			this.emitted.push({ command: action.command, payload }); return;
		}
		if (action.type === "emit") this.emitted.push({ command: action.command, ...(action.payload === undefined ? {} : { payload: clone(action.payload) }) });
	}

	/** Single recursive geometry resolver shared by rendering, pointer, and focus. */
	private resolveLayout(parent: UiRect, layout: UiLayout, nodes: UiRuntimeNode[], parentVisible: boolean, parentEnabled: boolean): void {
		const padding = normalizePadding(layout.padding);
		const content: UiRect = {
			x: parent.x + padding.left,
			y: parent.y + padding.top,
			width: Math.max(0, parent.width - padding.left - padding.right),
			height: Math.max(0, parent.height - padding.top - padding.bottom),
		};
		if (layout.type === "absolute") {
			// Absolute child position = content origin + child local position.
			for (const node of nodes) {
				const visible = node.visible && parentVisible;
				const enabled = node.enabled && parentEnabled;
				node.rect = { x: content.x + node.localRect.x, y: content.y + node.localRect.y, width: node.localRect.width, height: node.localRect.height };
				if (isContainerNode(node)) this.resolveLayout(node.rect, node.layout, node.elements, visible, enabled);
			}
			return;
		}
		const horizontal = layout.type === "horizontal";
		const gap = layout.gap ?? 0;
		const justify = layout.justify ?? "start";
		const align = layout.align ?? "start";
		// Only effectively visible children participate in flow layout; hidden
		// children collapse. Disabled children keep their layout space.
		const participants: Array<{ node: UiRuntimeNode; mainSize: number; crossSize: number }> = [];
		for (const node of nodes) {
			if (!(node.visible && parentVisible)) continue;
			participants.push({ node, mainSize: horizontal ? node.rect.width : node.rect.height, crossSize: horizontal ? node.rect.height : node.rect.width });
		}
		const count = participants.length;
		const contentMain = horizontal ? content.width : content.height;
		const contentCross = horizontal ? content.height : content.width;
		const totalMain = participants.reduce((sum, participant) => sum + participant.mainSize, 0) + (count > 1 ? gap * (count - 1) : 0);
		const remaining = contentMain - totalMain;
		const offsets = mainAxisOffsets(count, gap, remaining, justify);
		for (let index = 0; index < count; index++) {
			const participant = participants[index]!;
			const node = participant.node;
			const priorSize = participants.slice(0, index).reduce((sum, prior) => sum + prior.mainSize, 0);
			const mainPos = offsets[index]! + priorSize;
			let crossPos: number;
			let resolvedCrossSize = participant.crossSize;
			if (align === "stretch") { resolvedCrossSize = contentCross; crossPos = 0; }
			else if (align === "center") crossPos = (contentCross - participant.crossSize) / 2;
			else if (align === "end") crossPos = contentCross - participant.crossSize;
			else crossPos = 0;
			const rect: UiRect = horizontal
				? { x: content.x + mainPos, y: content.y + crossPos, width: participant.mainSize, height: resolvedCrossSize }
				: { x: content.x + crossPos, y: content.y + mainPos, width: resolvedCrossSize, height: participant.mainSize };
			node.rect = rect;
			if (isContainerNode(node)) this.resolveLayout(rect, node.layout, node.elements, node.visible && parentVisible, node.enabled && parentEnabled);
		}
	}

	private activeScreenNodes(): UiRuntimeNode[] { return this.screens.get(this.activeScreen)!.elements; }
	/** Depth-first leaf traversal in declaration order. */
	private activeLeaves(): UiRuntimeElement[] {
		const leaves: UiRuntimeElement[] = [];
		const walk = (nodes: UiRuntimeNode[]): void => {
			for (const node of nodes) {
				if (isContainerNode(node)) walk(node.elements);
				else leaves.push(node);
			}
		};
		walk(this.activeScreenNodes());
		return leaves;
	}
	private findPointerTarget(point: UiPoint, nodes: UiRuntimeNode[] = this.activeScreenNodes(), parentVisible: boolean = true, parentEnabled: boolean = true): UiRuntimeElement | undefined {
		for (const node of nodes) {
			const visible = node.visible && parentVisible;
			const enabled = node.enabled && parentEnabled;
			if (isContainerNode(node)) {
				const hit = this.findPointerTarget(point, node.elements, visible, enabled);
				if (hit) return hit;
				continue;
			}
			if (visible && enabled && node.containsPoint(point)) return node;
		}
		return undefined;
	}
	private findLeaf(id: string, nodes: UiRuntimeNode[] = this.activeScreenNodes(), parentVisible: boolean = true, parentEnabled: boolean = true): { element: UiRuntimeElement; visible: boolean; enabled: boolean } | undefined {
		for (const node of nodes) {
			const visible = node.visible && parentVisible;
			const enabled = node.enabled && parentEnabled;
			if (isContainerNode(node)) {
				const found = this.findLeaf(id, node.elements, visible, enabled);
				if (found) return found;
				continue;
			}
			if (node.id === id) return { element: node, visible, enabled };
		}
		return undefined;
	}
	private findNode(id: string, nodes: UiRuntimeNode[] = this.activeScreenNodes()): UiRuntimeNode | undefined {
		for (const node of nodes) {
			if (node.id === id) return node;
			if (isContainerNode(node)) {
				const found = this.findNode(id, node.elements);
				if (found) return found;
			}
		}
		return undefined;
	}
	private findElement(id: string, nodes: UiRuntimeNode[] = this.activeScreenNodes()): UiRuntimeElement | undefined {
		for (const node of nodes) {
			if (isContainerNode(node)) {
				const found = this.findElement(id, node.elements);
				if (found) return found;
				continue;
			}
			if (node.id === id) return node;
		}
		return undefined;
	}
	private findNodeAnywhere(id: string): UiRuntimeNode | undefined {
		for (const screen of this.screens.values()) {
			const found = this.findNode(id, screen.elements);
			if (found) return found;
		}
		return undefined;
	}
	private findElementAnywhere(id: string): UiRuntimeElement | undefined {
		for (const screen of this.screens.values()) {
			const found = this.findElement(id, screen.elements);
			if (found) return found;
		}
		return undefined;
	}
	private renderNodes(renderer: UiRenderer, nodes: UiRuntimeNode[], parentVisible: boolean): void {
		for (const node of nodes) {
			const visible = node.visible && parentVisible;
			if (isContainerNode(node)) { this.renderNodes(renderer, node.elements, visible); continue; }
			if (!visible) continue;
			if (node.kind === "button") renderer.drawButton(node);
			else if (node.kind === "textInput") renderer.drawTextInput(node);
			else if (node.kind === "image") renderer.drawImage(node);
			else renderer.drawText(node);
		}
	}
}

class UiElement implements UiRuntimeElement {
	public visible: boolean; public enabled: boolean; public focused: boolean; public hovered: boolean; public pressed: boolean; public value: string;
	public readonly localRect: UiRect;
	public constructor(private readonly settings: UiTextSettings | UiButtonSettings | UiTextInputSettings | UiImageSettings) { this.localRect = clone(settings.rect); this.visible = settings.visible ?? true; this.enabled = settings.enabled ?? true; this.focused = false; this.hovered = false; this.pressed = false; this.value = "value" in settings ? settings.value ?? settings.text : "text" in settings ? settings.text : ""; }
	public get id(): string { return this.settings.id; } public get kind(): UiElementKind { return this.settings.kind; }
	public get rect(): UiRect { return this.settings.rect; } public set rect(value: UiRect) { this.settings.rect = value; }
	public get text(): string { return "text" in this.settings ? this.settings.text : ""; } public set text(value: string) { if ("text" in this.settings) this.settings.text = value; }
	public get icon(): string | undefined { return this.settings.kind === "button" ? this.settings.icon : undefined; }
	public get component(): UiComponentSettings | undefined { return this.settings.kind === "button" ? this.settings.component : undefined; }
	public set component(value: UiComponentSettings | undefined) { if (this.settings.kind === "button") this.settings.component = value; }
	public get source(): string | undefined { return this.settings.kind === "image" ? this.settings.source : undefined; }
	public get style(): string | undefined { return this.settings.style; } public get action(): UiAction | undefined { return this.settings.kind === "text" ? undefined : (this.settings as UiButtonSettings | UiTextInputSettings).action; } public set action(value: UiAction | undefined) { if (this.settings.kind !== "text") (this.settings as UiButtonSettings | UiTextInputSettings).action = value; }
	public containsPoint(point: UiPoint): boolean { return point.x >= this.rect.x && point.x <= this.rect.x + this.rect.width && point.y >= this.rect.y && point.y <= this.rect.y + this.rect.height; }
	public insertText(value: string): void { this.value += value; this.text = this.value; }
	public deleteBackward(): void { this.value = this.value.slice(0, -1); this.text = this.value; }
	public toSettings(): UiElementSettings {
		const base = { ...clone(this.settings), rect: clone(this.localRect), text: this.text, visible: this.visible, enabled: this.enabled };
		// The leaf union keeps `value` only on text inputs; the runtime spreads
		// the authored settings back into the same canonical kind.
		return this.kind === "textInput" ? { ...base, value: this.value } as UiTextInputSettings : base as UiTextSettings | UiButtonSettings | UiImageSettings;
	}
}

class UiContainer implements UiContainerRuntime {
	public visible: boolean; public enabled: boolean;
	public readonly localRect: UiRect;
	public readonly layout: UiLayout;
	public readonly elements: UiRuntimeNode[];
	public constructor(private readonly settings: UiContainerSettings) {
		this.localRect = clone(settings.rect);
		this.visible = settings.visible ?? true;
		this.enabled = settings.enabled ?? true;
		this.layout = clone(settings.layout);
		this.elements = settings.elements.map(createNode);
	}
	public get id(): string { return this.settings.id; } public get kind(): "container" { return "container"; }
	public get rect(): UiRect { return this.settings.rect; } public set rect(value: UiRect) { this.settings.rect = value; }
	public get style(): string | undefined { return this.settings.style; }
	public containsPoint(point: UiPoint): boolean { return point.x >= this.rect.x && point.x <= this.rect.x + this.rect.width && point.y >= this.rect.y && point.y <= this.rect.y + this.rect.height; }
	public toSettings(): UiContainerSettings { return { ...clone(this.settings), rect: clone(this.localRect), visible: this.visible, enabled: this.enabled, elements: this.elements.map(node => node.toSettings()) }; }
}

const UI_SYSTEMS: Record<string, UiSystem> = {
	"ui.visibility": { id: "ui.visibility" },
	"ui.layout": { id: "ui.layout", tick: runtime => runtime.layout() },
	"ui.input.pointer": { id: "ui.input.pointer", tick: (runtime, input) => runtime.pointer(input.pointer) },
	"ui.focus": { id: "ui.focus", tick: runtime => runtime.focus() },
	"ui.input.keyboard": { id: "ui.input.keyboard", tick: (runtime, input) => runtime.keyboard(input.keyboard) },
	"ui.text-input": { id: "ui.text-input", tick: runtime => runtime.textInput() },
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

function createNode(settings: UiElementSettings): UiRuntimeNode { const cloned = clone(settings); return cloned.kind === "container" ? new UiContainer(cloned) : new UiElement(cloned as UiTextSettings | UiButtonSettings | UiTextInputSettings | UiImageSettings); }
function isContainerNode(node: UiRuntimeNode): node is UiContainerRuntime { return node.kind === "container"; }
function hasFocusable(value: UiRuntimeElement): value is UiRuntimeElement & IUiFocusable { return "focused" in value && value.kind !== "text"; }
function hasPressable(value: UiRuntimeElement): value is UiRuntimeElement & IUiPressable { return value.kind === "button"; }
function hasTextInput(value: UiRuntimeElement): value is UiRuntimeElement & IUiTextInput { return value.kind === "textInput" && value.focused === true; }
function isTextInputElement(value: UiRuntimeElement): value is UiRuntimeElement & IUiTextInput { return value.kind === "textInput"; }
function positive(value: number): boolean { return Number.isFinite(value) && value > 0; }
function isRecord(value: unknown): value is Record<string, unknown> { return !!value && typeof value === "object" && !Array.isArray(value); }
function clone<T>(value: T): T { return structuredClone(value); }
function range(count: number, compute: (index: number) => number): number[] { return Array.from({ length: count }, (_, index) => compute(index)); }

/** Normalizes any accepted padding shorthand into the canonical four-side form. */
function normalizePadding(padding: UiPaddingInput | undefined): UiPadding {
	if (padding === undefined) return { top: 0, right: 0, bottom: 0, left: 0 };
	if (typeof padding === "number") return { top: padding, right: padding, bottom: padding, left: padding };
	if ("horizontal" in padding) return { top: padding.vertical, right: padding.horizontal, bottom: padding.vertical, left: padding.horizontal };
	return { top: padding.top, right: padding.right, bottom: padding.bottom, left: padding.left };
}

/** Normalizes layout input into the canonical JSON-safe form (UiPadding only). */
function normalizeLayout(input: UiLayoutInput): UiLayout {
	const result: Record<string, unknown> = { type: input.type };
	if (input.gap !== undefined) result.gap = input.gap;
	if (input.padding !== undefined) result.padding = normalizePadding(input.padding);
	if (input.justify !== undefined) result.justify = input.justify;
	if (input.align !== undefined) result.align = input.align;
	return result as UiLayout;
}

/**
 * Deterministic main-axis offsets for a flow layout.
 *
 * - `start`: children begin at the start edge.
 * - `center`: the whole child group is centered.
 * - `end`: children end at the far edge.
 * - `space-between`: no outer spacing, equal spacing between children.
 * - `space-around`: equal space around each child, half-size outer edges.
 * - `space-evenly`: equal spacing before, between, and after children.
 *
 * The configured gap always applies between consecutive children and is never
 * added before the first or after the last child. Single-child rules:
 * `space-between` behaves like `start`; `space-around` and `space-evenly`
 * center the child. When children overflow the content rectangle
 * (`remaining < 0`) every justification falls back to `start` with the fixed
 * gap; negative distributed spacing is never generated.
 */
function mainAxisOffsets(count: number, gap: number, remaining: number, justify: UiJustify): number[] {
	if (count === 0) return [];
	if (count === 1) {
		if (justify === "start" || justify === "space-between" || remaining < 0) return [0];
		if (justify === "end") return [remaining];
		return [remaining / 2];
	}
	if (remaining < 0) return range(count, index => index * gap);
	switch (justify) {
		case "start": return range(count, index => index * gap);
		case "center": return range(count, index => index * gap + remaining / 2);
		case "end": return range(count, index => index * gap + remaining);
		case "space-between": return range(count, index => index * (gap + remaining / (count - 1)));
		case "space-around": return range(count, index => remaining / (2 * count) + index * (gap + remaining / count));
		case "space-evenly": return range(count, index => remaining / (count + 1) + index * (gap + remaining / (count + 1)));
	}
}

const ELEMENT_KEYS: Record<Exclude<UiElementKind, "container">, ReadonlySet<string>> & { container: ReadonlySet<string> } = {
	text: new Set(["kind", "id", "rect", "text", "visible", "enabled", "focusable", "style"]),
	button: new Set(["kind", "id", "rect", "text", "icon", "component", "visible", "enabled", "focusable", "style", "action"]),
	textInput: new Set(["kind", "id", "rect", "text", "visible", "enabled", "focusable", "style", "action", "value"]),
	image: new Set(["kind", "id", "rect", "source", "visible", "enabled", "style"]),
	container: new Set(["kind", "id", "rect", "layout", "elements", "visible", "enabled", "style"]),
};
const LAYOUT_KEYS = new Set(["type", "gap", "padding", "justify", "align"]);
const PADDING_KEYS = new Set(["top", "right", "bottom", "left"]);
const RECT_KEYS = new Set(["x", "y", "width", "height"]);
const LAYOUT_TYPES = new Set(["absolute", "horizontal", "vertical"]);
const JUSTIFIES = new Set<UiJustify>(["start", "center", "end", "space-between", "space-around", "space-evenly"]);
const ALIGNS = new Set<UiAlign>(["start", "center", "end", "stretch"]);

/** Validates generic UI settings without KORE-specific routes, themes, or labels. */
export function validateUiSettings(settings: unknown): asserts settings is UiMenuSettings {
	if (!settings || typeof settings !== "object" || Array.isArray(settings)) throw new Error("Invalid UI settings");
	const value = settings as Record<string, unknown>;
	if (value.schemaVersion !== 1 || typeof value.id !== "string" || !value.size || !isRecord(value.size) || !positive(Number(value.size.width)) || !positive(Number(value.size.height)) || !Array.isArray(value.screens) || typeof value.activeScreen !== "string" || !Array.isArray(value.history)) throw new Error("Invalid UI settings");
	const screenIds = new Set<string>();
	const seenScreens = new WeakSet<object>();
	for (const screen of value.screens) {
		if (!isRecord(screen)) throw new Error("Invalid UI screen");
		if (typeof screen.id !== "string" || screen.id.length === 0 || screenIds.has(screen.id)) throw new Error("Invalid UI screen");
		if (seenScreens.has(screen)) throw new Error("Invalid UI screen");
		seenScreens.add(screen);
		for (const key of Object.keys(screen)) if (key !== "id" && key !== "layout" && key !== "visible" && key !== "elements") throw new Error("Invalid UI screen");
		if (screen.layout !== undefined) validateLayout(screen.layout, `screen "${screen.id}"`);
		if (screen.visible !== undefined && typeof screen.visible !== "boolean") throw new Error("Invalid UI screen");
		if (!Array.isArray(screen.elements)) throw new Error("Invalid UI screen");
		screenIds.add(screen.id);
	}
	for (const screen of value.screens) {
		const elementIds = new Set<string>();
		const ancestors = new WeakSet<object>();
		for (const element of screen.elements) validateElement(element, elementIds, screenIds, `screen "${screen.id}"`, ancestors, true);
	}
	if (!screenIds.has(value.activeScreen)) throw new Error("UI active screen is missing");
	if (value.history.some(id => typeof id !== "string" || !screenIds.has(id))) throw new Error("UI navigation history references an unknown screen");
	if (value.theme !== undefined) assertJsonValue(value.theme);
	if (!value.framework || !isRecord(value.framework)) throw new Error("UI framework is required");
	const expected = createDefaultUiFramework().systemOrder;
	if (!Array.isArray(value.framework.systemOrder) || value.framework.systemOrder.join("|") !== expected.join("|")) throw new Error("Unsupported UI framework order");
}

/** Recursive element validation with screen/container/element paths and cycle rejection. */
function validateElement(value: unknown, ids: Set<string>, screenIds: Set<string>, path: string, ancestors: WeakSet<object>, requireScreenTargets: boolean): asserts value is UiElementSettings {
	if (!isRecord(value)) throw invalidElement(path, "malformed element");
	if (ancestors.has(value)) throw invalidElement(path, "cyclic element tree");
	ancestors.add(value);
	try {
		const kind = value.kind;
		if (typeof value.id !== "string" || value.id.length === 0) throw invalidElement(path, "missing or invalid id");
		if (kind !== "button" && kind !== "text" && kind !== "textInput" && kind !== "image" && kind !== "container") throw invalidElement(path, `unsupported element kind '${String(kind)}'`);
		const allowed = ELEMENT_KEYS[kind];
		for (const key of Object.keys(value)) if (!allowed.has(key)) throw invalidElement(path, `unknown field '${key}'`);
		const id = value.id;
		if (ids.has(id)) throw invalidElement(path, `duplicate element id '${id}'`);
		ids.add(id);
		const childPath = `${path} > ${kind} "${id}"`;
		validateRect(value.rect, childPath);
		if (value.visible !== undefined && typeof value.visible !== "boolean") throw invalidElement(childPath, "invalid visible state");
		if (value.enabled !== undefined && typeof value.enabled !== "boolean") throw invalidElement(childPath, "invalid enabled state");
		if (value.style !== undefined && typeof value.style !== "string") throw invalidElement(childPath, "invalid style");
		if (kind === "container") {
			if (value.layout === undefined) throw invalidElement(childPath, "missing layout");
			validateLayout(value.layout, childPath);
			if (!Array.isArray(value.elements)) throw invalidElement(childPath, "missing elements");
			for (const child of value.elements) validateElement(child, ids, screenIds, childPath, ancestors, requireScreenTargets);
		} else if (kind === "image") {
			if (typeof value.source !== "string" || value.source.length === 0) throw invalidElement(childPath, "invalid image source");
		} else {
			if (typeof value.text !== "string") throw invalidElement(childPath, "invalid text");
			if (value.icon !== undefined && (typeof value.icon !== "string" || value.icon.length === 0)) throw invalidElement(childPath, "invalid icon");
			if (value.component !== undefined) validateUiComponent(value.component, `${childPath}.component`);
			if (value.focusable !== undefined && typeof value.focusable !== "boolean") throw invalidElement(childPath, "invalid focusable state");
			if (kind === "textInput" && value.value !== undefined && typeof value.value !== "string") throw invalidElement(childPath, "invalid value");
			if (value.action !== undefined) validateAction(value.action as UiAction, screenIds, childPath, requireScreenTargets);
		}
	} finally {
		ancestors.delete(value);
	}
}

export function validateUiComponent(value: unknown, path: string = "component"): asserts value is UiComponentSettings {
	if (!isRecord(value) || value.type !== "image" || typeof value.source !== "string" || value.source.length === 0 || Object.keys(value).some(key => key !== "type" && key !== "source")) throw new Error(`Invalid ${path}`);
}

function validateLayout(value: unknown, path: string): asserts value is UiLayout {
	if (!isRecord(value)) throw invalidElement(path, "invalid layout");
	if (typeof value.type !== "string" || !LAYOUT_TYPES.has(value.type)) throw invalidElement(path, "invalid layout type");
	for (const key of Object.keys(value)) if (!LAYOUT_KEYS.has(key)) throw invalidElement(path, `unknown layout field '${key}'`);
	if (value.type === "absolute" && (value.gap !== undefined || value.justify !== undefined || value.align !== undefined)) throw invalidElement(path, "absolute layout must not declare flow fields");
	if (value.gap !== undefined && (typeof value.gap !== "number" || !Number.isFinite(value.gap) || value.gap < 0)) throw invalidElement(path, "invalid gap");
	if (value.padding !== undefined) validatePadding(value.padding, path);
	if (value.justify !== undefined && !JUSTIFIES.has(value.justify as UiJustify)) throw invalidElement(path, "invalid justification");
	if (value.align !== undefined && !ALIGNS.has(value.align as UiAlign)) throw invalidElement(path, "invalid alignment");
}

function validatePadding(value: unknown, path: string): void {
	if (typeof value === "number") { if (Number.isFinite(value) && value >= 0) return; throw invalidElement(path, "invalid padding"); }
	if (!isRecord(value)) throw invalidElement(path, "invalid padding");
	for (const key of Object.keys(value)) if (!PADDING_KEYS.has(key)) throw invalidElement(path, "invalid padding");
	for (const side of PADDING_KEYS) if (typeof value[side] !== "number" || !Number.isFinite(value[side]) || (value[side] as number) < 0) throw invalidElement(path, "invalid padding");
}

function validateRect(value: unknown, path: string): asserts value is UiRect {
	if (!isRecord(value)) throw invalidElement(path, "invalid rect");
	for (const key of Object.keys(value)) if (!RECT_KEYS.has(key)) throw invalidElement(path, "invalid rect");
	for (const key of RECT_KEYS) if (typeof value[key] !== "number" || !Number.isFinite(value[key])) throw invalidElement(path, "invalid rect");
	if ((value.width as number) < 0 || (value.height as number) < 0) throw invalidElement(path, "negative size");
}

function validateAction(action: UiAction, screenIds: Set<string>, path: string, requireScreenTargets: boolean): void {
	if (action.type === "navigate" && requireScreenTargets && !screenIds.has(action.target)) throw invalidElement(path, "UI navigation target is missing");
	if (action.type === "emit" && (!action.command || typeof action.command !== "string")) throw invalidElement(path, "Invalid UI command");
	if (action.type === "emitValues" && (!action.command || !Array.isArray(action.targets) || action.targets.some(target => typeof target !== "string"))) throw invalidElement(path, "Invalid UI value command");
	if (action.type === "setEnabled" && (typeof action.target !== "string" || typeof action.enabled !== "boolean")) throw invalidElement(path, "Invalid UI enabled action");
	if (action.type === "setText" && (typeof action.target !== "string" || typeof action.text !== "string")) throw invalidElement(path, "Invalid UI text action");
	assertJsonValue(action);
}

function invalidElement(path: string, reason: string): Error { return new Error(`Invalid UI element in ${path}: ${reason}`); }

/** Single generic UI SDK entry point. */
export const ui = {
	createMenu(options: { id: string; size: { width: number; height: number } }): UiMenuBuilder { return new UiMenuBuilder(options.id, options.size); },
	fromSettings(settings: UiMenuSettings): UiRuntime { return UiRuntime.fromSettings(settings); },
	createDefaultFramework: createDefaultUiFramework,
	validate: validateUiSettings,
	screen(settings: UiScreenInput): UiScreenSettings {
		const input = clone(settings);
		const result: UiScreenSettings = { id: input.id, elements: input.elements.map(element => clone(element)) };
		if (input.layout !== undefined) result.layout = normalizeLayout(input.layout);
		if (input.visible !== undefined) result.visible = input.visible;
		return result;
	},
	button(settings: UiButtonInput): UiButtonSettings { if (settings.component) validateUiComponent(settings.component); return { ...clone(settings), kind: "button", focusable: settings.focusable ?? true }; },
	text(settings: UiTextElementInput): UiTextSettings { return { ...clone(settings), kind: "text", focusable: false }; },
	textInput(settings: UiTextInputElementInput): UiTextInputSettings { return { ...clone(settings), kind: "textInput", focusable: true, value: settings.value ?? settings.text }; },
	image(settings: UiImageInput): UiImageSettings { return { ...clone(settings), kind: "image" }; },
	component: {
		image(source: string): UiComponentSettings { const component = { type: "image", source } as UiComponentSettings; validateUiComponent(component); return component; },
	},
	container(settings: UiContainerInput): UiContainerSettings {
		let input: UiContainerInput;
		try {
			input = clone(settings);
		} catch (error) {
			throw new Error(`UI container input must be acyclic JSON data: ${error instanceof Error ? error.message : String(error)}`);
		}
		const result: UiContainerSettings = {
			kind: "container",
			id: input.id,
			rect: clone(input.rect),
			layout: normalizeLayout(input.layout ?? ({ type: "absolute" } as const)),
			elements: input.elements.map(element => clone(element)),
		};
		if (input.visible !== undefined) result.visible = input.visible;
		if (input.enabled !== undefined) result.enabled = input.enabled;
		if (input.style !== undefined) result.style = input.style;
		// Structural subtree validation (navigate targets are checked at menu build).
		const ids = new Set<string>();
		validateElement(result, ids, new Set<string>(), `container "${input.id}"`, new WeakSet<object>(), false);
		return result;
	},
	layout: {
		absolute(options: { padding?: UiPaddingInput } = {}): UiLayout { return normalizeLayout({ type: "absolute", ...options }); },
		horizontal(options: Omit<UiLayoutInput, "type"> = {}): UiLayout { return normalizeLayout({ type: "horizontal", ...options }); },
		vertical(options: Omit<UiLayoutInput, "type"> = {}): UiLayout { return normalizeLayout({ type: "vertical", ...options }); },
	},
	action: {
		navigate(target: string): UiAction { return { type: "navigate", target }; }, back(): UiAction { return { type: "back" }; }, emit(command: string, payload?: JsonValue): UiAction { return { type: "emit", command, ...(payload === undefined ? {} : { payload }) }; },
		emitValues(command: string, targets: string[]): UiAction { return { type: "emitValues", command, targets: [...targets] }; },
		setEnabled(target: string, enabled: boolean): UiAction { return { type: "setEnabled", target, enabled }; }, setText(target: string, text: string): UiAction { return { type: "setText", target, text }; },
	},
	types: { containsPoint(rect: UiRect, point: UiPoint): boolean { return point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height; } },
} as const;

/** Standalone public UI SDK declaration. */
type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
type EngineFrameworkSettings = { schemaVersion: 1; systems: Array<{ systemId: string; schemaVersion: 1; state: Record<string, unknown> }>; systemOrder: string[] };
export type UiPoint = {
    x: number;
    y: number;
};
export type UiRect = {
    x: number;
    y: number;
    width: number;
    height: number;
};
export type UiAction = {
    type: "navigate";
    target: string;
} | {
    type: "back";
} | {
    type: "emit";
    command: string;
    payload?: JsonValue;
} | {
    type: "emitValues";
    command: string;
    targets: string[];
} | {
    type: "setValue";
    target: string;
    value: JsonValue;
} | {
    type: "setEnabled";
    target: string;
    enabled: boolean;
} | {
    type: "setText";
    target: string;
    text: string;
} | {
    type: "toggleVisibility";
    target: string;
} | {
    type: "closeOverlay";
} | {
    type: "select";
    target: string;
    value: JsonValue;
};
/** Main-axis justification for flow layouts. */
export type UiJustify = "start" | "center" | "end" | "space-between" | "space-around" | "space-evenly";
/** Cross-axis alignment for flow layouts. */
export type UiAlign = "start" | "center" | "end" | "stretch";
/** Canonical padding. One deterministic representation in serialized settings. */
export type UiPadding = {
    top: number;
    right: number;
    bottom: number;
    left: number;
};
/** Authoring-time padding shorthand; normalized immediately into UiPadding. */
export type UiPaddingInput = number | UiPadding | {
    horizontal: number;
    vertical: number;
};
/** Authoring-time layout input; the builders normalize it into UiLayout. */
export type UiLayoutInput = {
    type: "absolute" | "horizontal" | "vertical";
    gap?: number;
    padding?: UiPaddingInput;
    justify?: UiJustify;
    align?: UiAlign;
};
/** Canonical layout settings. `absolute` keeps local child coordinates. */
export type UiLayout = {
    type: "absolute";
    padding?: UiPadding;
} | {
    type: "horizontal";
    gap?: number;
    padding?: UiPadding;
    justify?: UiJustify;
    align?: UiAlign;
} | {
    type: "vertical";
    gap?: number;
    padding?: UiPadding;
    justify?: UiJustify;
    align?: UiAlign;
};
export type UiElementKind = "button" | "text" | "textInput" | "image" | "container";
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
export interface UiScreenSettings {
    id: string;
    layout?: UiLayout;
    visible?: boolean;
    elements: UiElementSettings[];
}
export interface UiMenuSettings {
    schemaVersion: 1;
    id: string;
    size: {
        width: number;
        height: number;
    };
    activeScreen: string;
    history: string[];
    screens: UiScreenSettings[];
    theme?: Record<string, JsonValue>;
    framework: EngineFrameworkSettings;
}
export interface UiPointerState {
    x: number;
    y: number;
    pressed?: boolean;
    justPressed?: boolean;
    justReleased?: boolean;
}
export interface UiKeyboardState {
    pressedKeys?: readonly string[];
    textInput?: string;
}
export interface UiInput {
    pointer?: UiPointerState;
    keyboard?: UiKeyboardState;
}
export interface UiCommand {
    command: string;
    payload?: JsonValue;
}
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
export type UiScreenInput = Omit<UiScreenSettings, "layout"> & {
    layout?: UiLayoutInput;
};
/** Narrow UI capabilities used by systems; runtime element classes are never required. */
export interface IUiPosition {
    rect: UiRect;
}
export interface IUiVisible {
    visible: boolean;
}
export interface IUiEnabled {
    enabled: boolean;
}
export interface IUiFocusable {
    focused: boolean;
}
export interface IUiHovered {
    hovered: boolean;
}
export interface IUiPressState {
    pressed: boolean;
}
export interface IUiIcon {
    icon?: string;
}
export interface IUiImage {
    source?: string;
}
export interface IUiPointerTarget extends IUiPosition {
    containsPoint(point: UiPoint): boolean;
}
export interface IUiPressable {
    action?: UiAction;
}
export interface IUiTextContent {
    text: string;
}
export interface IUiTextInput extends IUiTextContent, IUiFocusable {
    value: string;
    insertText(value: string): void;
    deleteBackward(): void;
}
export interface UiRuntimeElement extends IUiPosition, IUiVisible, IUiEnabled, Partial<IUiFocusable>, Partial<IUiHovered>, Partial<IUiPressState>, Partial<IUiPressable>, Partial<IUiTextInput>, IUiIcon, IUiImage {
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
/** Explicitly ticked/drawn generic UI runtime. It owns no timers, DOM listeners, or render loop. */
export declare class UiRuntime {
    private readonly settings;
    private readonly screens;
    private readonly systems;
    private activeScreen;
    private history;
    private pendingPress;
    private hovered;
    private pendingKeyboard;
    private pendingActions;
    private emitted;
    constructor(settings: UiMenuSettings);
    static fromSettings(settings: UiMenuSettings): UiRuntime;
    /** Advances UI state only when called by the host. */
    tick(input?: UiInput, deltaTime?: number): void;
    /** Renders current state only; this method does not mutate persistent UI state. */
    draw(renderer: UiRenderer): void;
    toSettings(): UiMenuSettings;
    /** Top-level runtime nodes of the active screen, in declaration order. */
    getActiveElements(): readonly UiRuntimeNode[];
    getActiveScreen(): string;
    getFocusedElementId(): string | undefined;
    getHoveredElementId(): string | undefined;
    getPressedTargetId(): string | undefined;
    /** Applies a validated semantic action during an explicit host-controlled tick. */
    dispatch(action: UiAction): void;
    /** Changes a declared element's visibility (nested containers included) and reflows the active screen. */
    setElementVisible(id: string, visible: boolean): boolean;
    /** Rebinds a declared interactive element through the public generic action contract. */
    setElementAction(id: string, action: UiAction | undefined): boolean;
    /** Updates enabled state through a reusable host-facing UI primitive. */
    setElementEnabled(id: string, enabled: boolean): boolean;
    /** Updates element text through the same anywhere-scope host primitive (text/button/input). */
    setElementText(id: string, text: string): boolean;
    drainCommands(): UiCommand[];
    explain(): string;
    /** Canonical recursive layout pass for the active screen. Deterministic and pure numeric. */
    layout(): void;
    pointer(input: UiPointerState | undefined): void;
    focus(): void;
    keyboard(input: UiKeyboardState | undefined): void;
    textInput(): void;
    press(): void;
    navigate(): void;
    render(renderer: UiRenderer): void;
    private applyAction;
    /** Single recursive geometry resolver shared by rendering, pointer, and focus. */
    private resolveLayout;
    private activeScreenNodes;
    /** Depth-first leaf traversal in declaration order. */
    private activeLeaves;
    private findPointerTarget;
    private findLeaf;
    private findNode;
    private findElement;
    private findNodeAnywhere;
    private findElementAnywhere;
    private renderNodes;
}
/** Default generic UI framework: layout → pointer → focus → keyboard/text → button → navigation → render. */
export declare function createDefaultUiFramework(): EngineFrameworkSettings;
export declare class UiMenuBuilder {
    private readonly id;
    private readonly size;
    private readonly screens;
    private framework;
    constructor(id: string, size: {
        width: number;
        height: number;
    });
    addScreen(screen: UiScreenSettings): this;
    useFramework(framework: EngineFrameworkSettings): this;
    build(): UiMenuSettings;
    buildJson(space?: number): string;
    explain(): string;
}
/** Validates generic UI settings without KORE-specific routes, themes, or labels. */
export declare function validateUiSettings(settings: unknown): asserts settings is UiMenuSettings;
/** Single generic UI SDK entry point. */
export declare const ui: {
    readonly createMenu: (options: {
        id: string;
        size: {
            width: number;
            height: number;
        };
    }) => UiMenuBuilder;
    readonly fromSettings: (settings: UiMenuSettings) => UiRuntime;
    readonly createDefaultFramework: typeof createDefaultUiFramework;
    readonly validate: typeof validateUiSettings;
    readonly screen: (settings: UiScreenInput) => UiScreenSettings;
    readonly button: (settings: UiButtonInput) => UiButtonSettings;
    readonly text: (settings: UiTextElementInput) => UiTextSettings;
    readonly textInput: (settings: UiTextInputElementInput) => UiTextInputSettings;
    readonly image: (settings: UiImageInput) => UiImageSettings;
    readonly container: (settings: UiContainerInput) => UiContainerSettings;
    readonly layout: {
        readonly absolute: (options?: {
            padding?: UiPaddingInput;
        }) => UiLayout;
        readonly horizontal: (options?: Omit<UiLayoutInput, "type">) => UiLayout;
        readonly vertical: (options?: Omit<UiLayoutInput, "type">) => UiLayout;
    };
    readonly action: {
        readonly navigate: (target: string) => UiAction;
        readonly back: () => UiAction;
        readonly emit: (command: string, payload?: JsonValue) => UiAction;
        readonly emitValues: (command: string, targets: string[]) => UiAction;
        readonly setEnabled: (target: string, enabled: boolean) => UiAction;
        readonly setText: (target: string, text: string) => UiAction;
    };
    readonly types: {
        readonly containsPoint: (rect: UiRect, point: UiPoint) => boolean;
    };
};

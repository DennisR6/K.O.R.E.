import type { IDrawer, RenderContext } from "../../engine/RenderContext.js";
import type { IMouse } from "../../engine/types.js";
import { UiRuntime, type UiCommand, type UiRenderer, type UiRuntimeElement, type UiRuntimeNode } from "../../engine/ui-sdk/index.js";
import { createReplayViewerComposition, KoreReplayCommand, KoreReplayElement, KoreReplayStyle } from "./replayViewer.js";
import { createEnglishLanguage, type LanguageCatalog } from "../../i18n/language.js";

export type ReplayViewerSurfaceCallbacks = {
	onLoad: (token: string) => void | Promise<void>;
	onPaste: () => string | undefined | Promise<string | undefined>;
};

export class KoreReplayViewerSurface implements IMouse, IDrawer {
	private readonly runtime: UiRuntime;
	private mouse = { x: 0, y: 0 };
	public readonly acceptsUiInputWhileLocked = true;

	public constructor(private readonly callbacks: ReplayViewerSurfaceCallbacks, language: LanguageCatalog = createEnglishLanguage(), initialToken = "") {
		this.runtime = UiRuntime.fromSettings(createReplayViewerComposition(language).ui);
		this.setToken(initialToken);
	}
	public setStatus(text: string): void { this.runtime.dispatch({ type: "setText", target: KoreReplayElement.Status, text }); }
	public getRuntime(): UiRuntime { return this.runtime; }
	public setToken(token: string): void { this.runtime.dispatch({ type: "setValue", target: KoreReplayElement.Token, value: token }); }
	public getToken(): string {
		const node = findElement(this.runtime.getActiveElements(), KoreReplayElement.Token);
		return node?.value ?? "";
	}
	public updateMouse(x: number, y: number): void { this.mouse = { x, y }; }
	public handleMousePressed(): void { this.runtime.tick({ pointer: { ...this.mouse, pressed: true, justPressed: true } }); this.handleCommands(this.runtime.drainCommands()); }
	public handleMouseReleased(): void { this.runtime.tick({ pointer: { ...this.mouse, justReleased: true } }); this.handleCommands(this.runtime.drainCommands()); }
	public handleMouseWheel(_event: WheelEvent): void { }
	public handleKeyPressed(event: KeyboardEvent): void {
		this.runtime.tick({ keyboard: { pressedKeys: [event.key], textInput: event.key.length === 1 ? event.key : undefined } });
		this.handleCommands(this.runtime.drainCommands());
	}
	public load(): void { void this.callbacks.onLoad(this.getToken()); }
	public paste(): void { void Promise.resolve(this.callbacks.onPaste()).then(value => { if (value !== undefined) this.setToken(value); }); }
	public tick(deltaTime = 1): void { this.runtime.tick({ pointer: { ...this.mouse } }, deltaTime); this.handleCommands(this.runtime.drainCommands()); }
	public draw(renderer: RenderContext): void { this.runtime.draw(new ReplayViewerRenderer(renderer)); }

	private handleCommands(commands: UiCommand[]): void {
		for (const command of commands) {
			if (command.command === KoreReplayCommand.Load) this.load();
			if (command.command === KoreReplayCommand.Paste) this.paste();
		}
	}
}

class ReplayViewerRenderer implements UiRenderer {
	public constructor(private readonly renderer: RenderContext) { }
	public drawText(element: Readonly<UiRuntimeElement>): void {
		this.renderer.setFillColor("#f8fafc");
		this.renderer.drawText(element.text ?? "", element.rect.x, element.rect.y + 24, element.id === KoreReplayElement.Title ? 30 : 16);
	}
	public drawButton(element: Readonly<UiRuntimeElement>): void {
		this.renderer.setFillColor(element.style === KoreReplayStyle.Paste ? "#0f172a" : "#1d4ed8");
		this.renderer.drawRect(element.rect.x, element.rect.y, element.rect.width, element.rect.height);
		this.renderer.setFillColor("#ffffff");
		this.renderer.drawText(element.text ?? "", element.rect.x + 10, element.rect.y + 24, 14);
	}
	public drawTextInput(element: Readonly<UiRuntimeElement>): void {
		this.renderer.setFillColor("#e2e8f0");
		this.renderer.drawRect(element.rect.x, element.rect.y, element.rect.width, element.rect.height);
		this.renderer.setFillColor("#0f172a");
		this.renderer.drawText(element.value ?? "", element.rect.x + 8, element.rect.y + 23, 14);
	}
	public drawImage(element: Readonly<UiRuntimeElement>): void {
		if (element.source) this.renderer.drawImage(element.source, element.rect.x, element.rect.y, element.rect.width, element.rect.height);
	}
}

function findElement(nodes: readonly UiRuntimeNode[], id: string): UiRuntimeElement | undefined {
	for (const node of nodes) {
		if (node.id === id && node.kind !== "container") return node;
		if ("elements" in node) {
			const found = findElement(node.elements, id);
			if (found) return found;
		}
	}
	return undefined;
}

export function createKoreReplayViewerSurface(callbacks: ReplayViewerSurfaceCallbacks, language: LanguageCatalog, initialToken = ""): KoreReplayViewerSurface {
	return new KoreReplayViewerSurface(callbacks, language, initialToken);
}

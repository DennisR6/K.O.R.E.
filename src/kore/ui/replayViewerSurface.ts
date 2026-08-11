import type { IDrawer, RenderContext } from "../runtime/RenderContext.js";
import type { IMouse } from "../runtime/types.js";
import { UiRuntime, type UiCommand, type UiRenderer, type UiRuntimeElement, type UiRuntimeNode } from "@coffeemakerstudio/drip";
import { createReplayViewerComposition, KoreReplayCommand, KoreReplayElement, KoreReplayStyle } from "./replayViewer.js";
import { createEnglishLanguage, type LanguageCatalog } from "../../i18n/language.js";

export type ReplayViewerSurfaceCallbacks = {
	onLoad: (token: string) => void | Promise<void>;
	onPaste: () => string | undefined | Promise<string | undefined>;
};

export class KoreReplayViewerSurface implements IMouse, IDrawer {
	private readonly runtime: UiRuntime;
	private mouse = { x: 0, y: 0 };
	private playbackLoaded = false;
	public readonly acceptsUiInputWhileLocked = true;

	public constructor(private readonly callbacks: ReplayViewerSurfaceCallbacks, language: LanguageCatalog = createEnglishLanguage(), initialToken = "") {
		this.runtime = UiRuntime.fromSettings(createReplayViewerComposition(language).ui);
		this.setToken(initialToken);
	}
	public setStatus(text: string): void { this.runtime.dispatch({ type: "setText", target: KoreReplayElement.Status, text }); }
	/** Once a replay is loaded, the game world must remain unobstructed by the archive form. */
	public setPlaybackLoaded(loaded: boolean): void {
		this.playbackLoaded = loaded;
	}
	public isPlaybackLoaded(): boolean { return this.playbackLoaded; }
	public getRuntime(): UiRuntime { return this.runtime; }
	public setToken(token: string): void { this.runtime.dispatch({ type: "setValue", target: KoreReplayElement.Token, value: token }); }
	public getToken(): string {
		const node = findElement(this.runtime.getActiveElements(), KoreReplayElement.Token);
		return node?.value ?? "";
	}
	public updateMouse(x: number, y: number): void { this.mouse = { x, y }; }
	public handleMousePressed(): void { if (this.playbackLoaded) return; this.runtime.tick({ pointer: { ...this.mouse, pressed: true, justPressed: true } }); this.handleCommands(this.runtime.drainCommands()); }
	public handleMouseReleased(): void { if (this.playbackLoaded) return; this.runtime.tick({ pointer: { ...this.mouse, justReleased: true } }); this.handleCommands(this.runtime.drainCommands()); }
	public handleMouseWheel(_event: WheelEvent): void { }
	public handleKeyPressed(event: KeyboardEvent): void {
		if (this.playbackLoaded) return;
		this.runtime.tick({ keyboard: { pressedKeys: [event.key], textInput: event.key.length === 1 ? event.key : undefined } });
		this.handleCommands(this.runtime.drainCommands());
	}
	public load(): void { void this.callbacks.onLoad(this.getToken()); }
	public paste(): void { void Promise.resolve(this.callbacks.onPaste()).then(value => { if (value !== undefined) this.setToken(value); }); }
	public tick(deltaTime = 1): void { if (this.playbackLoaded) return; this.runtime.tick({ pointer: { ...this.mouse } }, deltaTime); this.handleCommands(this.runtime.drainCommands()); }
	public draw(renderer: RenderContext): void {
		if (this.playbackLoaded) return;
		const replayRenderer = new ReplayViewerRenderer(renderer);
		replayRenderer.drawShell();
		this.runtime.draw(replayRenderer);
	}

	private handleCommands(commands: UiCommand[]): void {
		for (const command of commands) {
			if (command.command === KoreReplayCommand.Load) this.load();
			if (command.command === KoreReplayCommand.Paste) this.paste();
		}
	}
}

class ReplayViewerRenderer implements UiRenderer {
	public constructor(private readonly renderer: RenderContext) { }
	public drawShell(): void {
		const renderer = this.renderer;
		renderer.setFillColor("#020617", 0.68);
		renderer.drawRect(0, 0, 800, 450);
		renderer.setFillColor("#0f172a", 0.96);
		renderer.drawRect(0, 0, 800, 68);
		renderer.setFillColor("#22d3ee");
		renderer.drawRect(28, 24, 4, 22, 2);
		renderer.setFillColor("#67e8f9");
		renderer.drawText("KORE / REPLAYS", 44, 31, 11);
		renderer.setFillColor("#94a3b8");
		renderer.drawText("READ-ONLY MATCH PLAYBACK", 44, 50, 10);
		renderer.setFillColor("#0f172a", 0.78);
		renderer.drawRect(18, 92, 492, 330, 16);
		renderer.setFillColor("#0f172a", 0.94);
		renderer.drawRect(526, 92, 256, 330, 16);
		renderer.setFillColor("#64748b");
		renderer.drawText("REPLAY ARCHIVE", 32, 108, 10);
		renderer.drawText("SHARE ID", 32, 162, 10);
		renderer.setFillColor("#475569");
		renderer.drawText("Paste a share ID to restore a match", 32, 148, 11);
		renderer.setFillColor("#22d3ee");
		renderer.drawText("MATCH VIEW", 550, 118, 10);
		renderer.setFillColor("#e2e8f0");
		renderer.drawText("Playback controls", 550, 143, 18);
		renderer.setFillColor("#64748b");
		renderer.drawText("The recorded match is reconstructed", 550, 176, 11);
		renderer.drawText("from its original deterministic state.", 550, 193, 11);
		renderer.setFillColor("#1e293b");
		renderer.drawRect(550, 224, 208, 1);
		renderer.setFillColor("#64748b");
	}
	public drawText(element: Readonly<UiRuntimeElement>): void {
		this.renderer.setFillColor(element.id === KoreReplayElement.Title ? "#f8fafc" : "#cbd5e1");
		this.renderer.drawText(element.text ?? "", element.rect.x, element.rect.y + (element.id === KoreReplayElement.Title ? 25 : 20), element.id === KoreReplayElement.Title ? 25 : 13);
	}
	public drawButton(element: Readonly<UiRuntimeElement>): void {
		this.renderer.setFillColor(element.style === KoreReplayStyle.Paste ? "#1e293b" : "#22d3ee");
		this.renderer.drawRect(element.rect.x, element.rect.y, element.rect.width, element.rect.height, 8);
		this.renderer.setFillColor("#ffffff");
		this.renderer.drawText(element.text ?? "", element.rect.x + 12, element.rect.y + 25, 12);
	}
	public drawTextInput(element: Readonly<UiRuntimeElement>): void {
		this.renderer.setFillColor("#020617");
		this.renderer.drawRect(element.rect.x, element.rect.y, element.rect.width, element.rect.height, 7);
		this.renderer.setStrokeColor("#334155");
		this.renderer.setStroke(1);
		this.renderer.setNoFill();
		this.renderer.drawRect(element.rect.x, element.rect.y, element.rect.width, element.rect.height, 7);
		this.renderer.setFillColor("#e2e8f0");
		this.renderer.drawText(element.value || "Enter replay share ID", element.rect.x + 12, element.rect.y + 25, 12);
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

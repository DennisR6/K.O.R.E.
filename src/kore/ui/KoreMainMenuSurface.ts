import { AudioEmitter, type AudioCommand, type ISoundEmitter } from "../../engine/audio-sdk/index.js";
import type { IMouse } from "../../engine/types.js";
import type { RenderContext } from "../../engine/RenderContext.js";
import { UiRuntime, type UiCommand, type UiRenderer } from "../../engine/ui-sdk/index.js";
import { AssetList } from "../../assetManager/assets/assetRegistry.js";
import type { AiDifficulty } from "../../ai/types.js";
import { koreAudio } from "../audio.js";
import { createMainMenuComposition, validateKoreMainMenuSettings, type KoreMainMenuSettings } from "./mainMenu.js";
import { KoreMenuColor, KoreMenuCommand, KoreMenuElement, KoreMenuId, KoreMenuMapIntent, KoreMenuScreen, KoreMenuStyle, asAiDifficulty, koreMenuMapScreen, parseKoreMenuCommand, type KoreMenuCommandMessage } from "./menuVocabulary.js";
import { Canvas2DUiRenderer, type UiElementState } from "./koreUiTheme.js";

export interface KoreMainMenuCallbacks {
	onPlayLocal?: () => void;
	onSelectMap?: (mapId: string, modeId?: string) => void;
	getStartError?: () => string | undefined;
	onPlayOnline?: (mapId?: string, modeId?: string) => void;
	onPlayOnlineFriends?: () => void;
	onPlayAiBattle?: (mapId: string) => void;
	onPlayAiOpponent?: (difficulty: AiDifficulty, mapId: string) => void;
	/** Draws an optional world layer underneath the menu UI. */
	drawBackground?: (renderer: RenderContext) => boolean;
}

/** KORE controller/adapter around the SDK-authored canonical menu settings. */
export class KoreMainMenuSurface implements IMouse, ISoundEmitter {
	private readonly runtime: UiRuntime;
	private readonly sounds = new AudioEmitter(KoreMenuId.AudioSource);
	private mouse = { x: 0, y: 0 };
	private landingTicks = 0;
	public readonly soundSourceId = this.sounds.soundSourceId;
	public constructor(private readonly callbacks: KoreMainMenuCallbacks = {}, private readonly initialSettings: KoreMainMenuSettings = createMainMenuComposition().build()) {
		validateKoreMainMenuSettings(initialSettings);
		this.runtime = UiRuntime.fromSettings(initialSettings.ui);
		for (const source of initialSettings.audio.persistentSources) this.sounds.emit(source.command);
	}
	public getRuntime(): UiRuntime { return this.runtime; }
	public toSettings(): KoreMainMenuSettings { return { ...structuredClone(this.initialSettings), ui: this.runtime.toSettings() }; }
	public drainSoundCommands(): AudioCommand[] { return this.sounds.drainSoundCommands(); }
	public updateMouse(x: number, y: number): void { this.mouse = { x, y }; }
	public handleMousePressed(): void { this.runtime.tick({ pointer: { ...this.mouse, justPressed: true, pressed: true } }); this.handleCommands(this.runtime.drainCommands()); }
	public handleMouseReleased(): void { this.runtime.tick({ pointer: { ...this.mouse, justReleased: true } }); this.handleCommands(this.runtime.drainCommands()); }
	public handleMouseWheel(_event: WheelEvent): void { }
	public tick(_deltaTime: number, _friction: number): void {
		// Keep pointer state flowing through the SDK even when no button event
		// occurred. This is what makes the renderer's hover state live.
		this.runtime.tick({ pointer: { ...this.mouse } });
		if (this.runtime.getActiveScreen() === KoreMenuScreen.Landing && this.landingTicks++ > 300) this.runtime.setElementVisible(KoreMenuElement.LandingPrompt, true);
		this.handleCommands(this.runtime.drainCommands());
	}
	public draw(ctx: RenderContext): void {
		ctx.push();
		const backgroundDrawn = this.callbacks.drawBackground?.(ctx) ?? false;
		if (!backgroundDrawn) ctx.drawImage(AssetList.slipstrikeTitelbildschirmPNG);
		// Keep the landing artwork bright; the dark translucent backdrop is only
		// needed once the actual menu controls are visible.
		if (this.runtime.getActiveScreen() !== KoreMenuScreen.Landing) {
			ctx.noStroke();
			ctx.setFillColor("#000000", 0.45);
			ctx.drawRect(0, 0, 800, 450);
		}

		// Nutzt den modernisierten Theme-Renderer für das Canvas-Viewport
		this.runtime.draw(new KoreMenuRenderer(ctx));

		const error = this.callbacks.getStartError?.();
		if (error) { ctx.setFillColor(KoreMenuColor.Error); ctx.drawText(error, 80, 390, 18); }
		ctx.pop();
	}
	private handleCommands(commands: UiCommand[]): void {
		for (const command of commands) {
			const parsed = parseKoreMenuCommand(command.command, command.payload);
			if (parsed) this.handleCommand(parsed);
		}
	}
	private handleCommand(command: KoreMenuCommandMessage): void {
		switch (command.type) {
			case KoreMenuCommand.OpenAi: this.confirm(command.type); this.runtime.dispatch({ type: "navigate", target: KoreMenuScreen.Difficulty }); return;
			case KoreMenuCommand.OpenBattle: this.confirm(command.type); this.runtime.dispatch({ type: "navigate", target: KoreMenuScreen.MapBattle }); return;
			case KoreMenuCommand.OpenLocalMaps: this.confirm(command.type); this.runtime.dispatch({ type: "navigate", target: KoreMenuScreen.MapLocal }); return;
			case KoreMenuCommand.OpenOnline: this.confirm(command.type); this.runtime.dispatch({ type: "navigate", target: KoreMenuScreen.MapOnline }); return;
			case KoreMenuCommand.OpenOnlineFriends: this.confirm(command.type); this.callbacks.onPlayOnlineFriends?.(); return;
			case KoreMenuCommand.StartLocal: this.confirm(command.type); this.callbacks.onPlayLocal?.(); return;
			case KoreMenuCommand.OpenAiMaps: this.runtime.dispatch({ type: "navigate", target: koreMenuMapScreen(KoreMenuMapIntent.Ai, command.payload.difficulty) }); return;
			case KoreMenuCommand.SelectMap: this.selectMap(command.payload); return;
		}
	}
	private selectMap(value: Extract<KoreMenuCommandMessage, { type: KoreMenuCommand.SelectMap }>["payload"]): void {
		if (value.intent === KoreMenuMapIntent.Battle) this.callbacks.onPlayAiBattle?.(value.mapId);
		else if (value.intent === KoreMenuMapIntent.Online) this.callbacks.onPlayOnline?.(value.mapId, value.modeId);
		else if (value.intent === KoreMenuMapIntent.Ai && value.difficulty) this.callbacks.onPlayAiOpponent?.(asAiDifficulty(value.difficulty), value.mapId);
		else if (value.intent === KoreMenuMapIntent.Local) this.callbacks.onSelectMap?.(value.mapId, value.modeId);
	}
	private confirm(command: KoreMenuCommand): void { if (this.initialSettings.metadata.confirmationCommands.includes(command)) this.sounds.emit(koreAudio.command.uiConfirm(this.soundSourceId, this.initialSettings.metadata.confirmationSoundId)); }
}

/** KORE visual projection of generic UI elements using Theme Tokens; owns no state or input. */
class KoreMenuRenderer implements UiRenderer {
	private readonly themeRenderer: Canvas2DUiRenderer;

	public constructor(private readonly ctx: RenderContext) {
		this.themeRenderer = new Canvas2DUiRenderer(ctx);
	}

	public drawText(element: Parameters<UiRenderer["drawText"]>[0]): void {
		if (element.style === KoreMenuStyle.LandingPrompt) {
			this.ctx.setFillColor(KoreMenuColor.Prompt);
			this.ctx.drawText(element.text ?? "", element.rect.x, element.rect.y + 20, 48);
			return;
		}

		this.ctx.setFillColor(KoreMenuColor.Text);
		const fontSize = element.style === KoreMenuStyle.MapTitle ? 34
			: element.style === KoreMenuStyle.DifficultyTitle ? 28
			: element.style === KoreMenuStyle.MapNote ? 16 : 20;
		const yOffset = element.style === KoreMenuStyle.MapTitle ? 30 : 16;

		this.ctx.drawText(element.text ?? "", element.rect.x, element.rect.y + yOffset, fontSize);
	}

	public drawButton(element: Parameters<UiRenderer["drawButton"]>[0]): void {
		// Unsichtbare Interaktions-Hitboxen werden übersprungen
		if (element.style === KoreMenuStyle.LandingHitbox) return;

		// Der authored Style wird unverändert an die Theme-Registry gereicht;
		// unbekannte oder fehlende Styles werden dort abgelehnt statt
		// stillschweigend durch einen anderen Style ersetzt.
		const themeKey = element.style;

		// Ermittle den aktiven Interaktions-Zustand aus dem SDK-Element
		const state = this.resolveElementState(element);

		// Rendere den Button über das neue Theme-System
		this.themeRenderer.drawButton(element.rect, element.text ?? "", themeKey, state);
	}

	public drawTextInput(element: Parameters<UiRenderer["drawTextInput"]>[0]): void {
		this.drawButton(element);
	}
	public drawImage(element: Parameters<UiRenderer["drawImage"]>[0]): void {
		if (element.source) this.ctx.drawImage(element.source, element.rect.x, element.rect.y, element.rect.width, element.rect.height);
	}

	/** Mappt die Capability-Eigenschaften des SDK-Elements auf den Theme-Zustand */
	private resolveElementState(element: { enabled?: boolean; pressed?: boolean; focused?: boolean; hovered?: boolean }): UiElementState {
		if (element.enabled === false) return "disabled";
		if (element.pressed) return "active";
		if (element.focused) return "focused";
		if (element.hovered) return "hover";
		return "normal";
	}
}

export function createKoreMainMenuSurface(
	callbacks: KoreMainMenuCallbacks = {},
	settings: KoreMainMenuSettings = createMainMenuComposition().build()
): KoreMainMenuSurface {
	return new KoreMainMenuSurface(callbacks, settings);
}

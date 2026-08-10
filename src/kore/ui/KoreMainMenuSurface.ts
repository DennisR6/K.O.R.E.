import { AudioEmitter, type AudioCommand, type ISoundEmitter } from "../../engine/audio-sdk/index.js";
import type { IMouse } from "../../engine/types.js";
import type { RenderContext } from "../../engine/RenderContext.js";
import { UiRuntime, type UiCommand, type UiRenderer } from "../../engine/ui-sdk/index.js";
import { AssetList } from "../../assetManager/assets/assetRegistry.js";
import type { AiDifficulty } from "../../ai/types.js";
import type { LoadedContentPackage } from "../../content/package.js";
import { koreAudio } from "../audio.js";
import { createMainMenuComposition, validateKoreMainMenuSettings, type KoreMainMenuSettings } from "./mainMenu.js";
import { KoreMenuColor, KoreMenuCommand, KoreMenuElement, KoreMenuId, KoreMenuMapIntent, KoreMenuScreen, KoreMenuStyle, KoreMenuText, asAiDifficulty, koreMenuMapScreen, parseKoreMenuCommand, type KoreMenuCommandMessage } from "./menuVocabulary.js";
import { Canvas2DUiRenderer, findKoreButtonTheme, type UiElementState } from "./koreUiTheme.js";
import { importModText } from "../../mods/importMod.js";
import { createEmptyModState, type ModDocumentState, type ModError, type ModSource } from "../../mods/types.js";
import type { ReadClipboardResult } from "../../mods/browserClipboard.js";
import { createEnglishLanguage, formatLanguage, translate, type LanguageCatalog } from "../../i18n/language.js";
import { startupMark } from "../../engine/startupTelemetry.js";

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
	/** Host opens the hidden mod JSON file picker; picked text arrives through importModText. */
	onImportModFile?: () => void;
	/** Browser clipboard read; absent in non-browser hosts. */
	onReadModClipboard?: () => Promise<ReadClipboardResult>;
	/** Launches a canonical test match from a validated mod package. */
	onLaunchMod1v1?: (mod: LoadedContentPackage) => void;
	/** Launches a KI-vs-KI test battle from a validated mod package. */
	onLaunchModAiBattle?: (mod: LoadedContentPackage) => void;
}

/** KORE controller/adapter around the SDK-authored canonical menu settings. */
export class KoreMainMenuSurface implements IMouse, ISoundEmitter {
	private readonly runtime: UiRuntime;
	private readonly sounds = new AudioEmitter(KoreMenuId.AudioSource);
	private mouse = { x: 0, y: 0 };
	private landingTicks = 0;
	private readonly language: LanguageCatalog;
	private mod: ModDocumentState = createEmptyModState();
	public readonly soundSourceId = this.sounds.soundSourceId;
	public constructor(private readonly callbacks: KoreMainMenuCallbacks = {}, private readonly initialSettings: KoreMainMenuSettings = createMainMenuComposition().build(), language: LanguageCatalog = createEnglishLanguage()) {
		validateKoreMainMenuSettings(initialSettings);
		this.runtime = UiRuntime.fromSettings(initialSettings.ui);
		this.language = language;
		for (const source of initialSettings.audio.persistentSources) this.sounds.emit(source.command);
	}
	public getRuntime(): UiRuntime { return this.runtime; }
	public toSettings(): KoreMainMenuSettings { return { ...structuredClone(this.initialSettings), ui: this.runtime.toSettings() }; }
	public drainSoundCommands(): AudioCommand[] { return this.sounds.drainSoundCommands(); }
	public updateMouse(x: number, y: number): void { this.mouse = { x, y }; }
	public handleMousePressed(): void { this.runtime.tick({ pointer: { ...this.mouse, justPressed: true, pressed: true } }); this.handleCommands(this.runtime.drainCommands()); }
	public handleMouseReleased(): void { this.runtime.tick({ pointer: { ...this.mouse, justReleased: true } }); this.handleCommands(this.runtime.drainCommands()); }
	public handleMouseWheel(_event: WheelEvent): void { }
	public handleKeyPressed(event: KeyboardEvent): void {
		this.runtime.tick({ keyboard: { pressedKeys: [event.key], textInput: event.key.length === 1 ? event.key : undefined } });
		this.handleCommands(this.runtime.drainCommands());
	}
	/** Host-supplied mod text (file picker result) enters the same validated import pipeline. */
	public importModText(text: string, source: ModSource): void { this.applyModImport(importModText(text, source)); }
	/** Host-reported platform failure (file size, read error) renders like an invalid import. */
	public importModError(error: ModError, source: ModSource): void { this.applyModImport({ ...createEmptyModState(), status: "invalid", source, error }); }
	public tick(_deltaTime: number, _friction: number): void {
		// Keep pointer state flowing through the SDK even when no button event
		// occurred. This is what makes the renderer's hover state live.
		this.runtime.tick({ pointer: { ...this.mouse } });
		if (this.runtime.getActiveScreen() === KoreMenuScreen.Landing && this.landingTicks++ > 300) this.runtime.setElementVisible(KoreMenuElement.LandingContainer, true);
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
			ctx.setFillColor("#000000", 0.65);
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
			case KoreMenuCommand.StartLocal: this.confirm(command.type); startupMark("game.start.requested", { mode: "hotseat" }); this.callbacks.onPlayLocal?.(); return;
			case KoreMenuCommand.OpenAiMaps: this.runtime.dispatch({ type: "navigate", target: koreMenuMapScreen(KoreMenuMapIntent.Ai, command.payload.difficulty) }); return;
			case KoreMenuCommand.SelectMap: this.selectMap(command.payload); return;
			case KoreMenuCommand.OpenMods: this.confirm(command.type); this.runtime.dispatch({ type: "navigate", target: KoreMenuScreen.Mods }); return;
			case KoreMenuCommand.ImportModFile: this.confirm(command.type); this.callbacks.onImportModFile?.(); return;
			case KoreMenuCommand.ImportModPaste: this.confirm(command.type); this.handleModPaste(); return;
			case KoreMenuCommand.ValidateMod: this.confirm(command.type); this.validateImportedText(); return;
			case KoreMenuCommand.LaunchMod1v1: this.launchMod("1v1"); return;
			case KoreMenuCommand.LaunchModAiBattle: this.launchMod("battle"); return;
		}
	}
	private handleModPaste(): void {
		this.runtime.dispatch({ type: "navigate", target: KoreMenuScreen.ModImport });
		const reader = this.callbacks.onReadModClipboard;
		if (!reader) {
			this.runtime.dispatch({ type: "setText", target: KoreMenuElement.ModImportHint, text: formatLanguage(this.language, KoreMenuText.ModError, { error: "Clipboard unavailable" }) });
			return;
		}
		void reader().then(result => {
			if (!result.ok) {
				this.runtime.dispatch({ type: "setText", target: KoreMenuElement.ModImportHint, text: formatLanguage(this.language, KoreMenuText.ModError, { error: result.error.message }) });
				return;
			}
			this.runtime.dispatch({ type: "setText", target: KoreMenuElement.ModImportHint, text: translate(this.language, KoreMenuText.ModImportHint) });
			this.runtime.dispatch({ type: "setValue", target: KoreMenuElement.ModImportInput, value: result.text });
		});
	}
	private validateImportedText(): void { this.applyModImport(importModText(this.getModInput(), { kind: "paste" })); }
	private getModInput(): string {
		for (const node of this.runtime.getActiveElements()) if (node.id === KoreMenuElement.ModImportInput && "value" in node) return node.value ?? "";
		return "";
	}
	private launchMod(target: "1v1" | "battle"): void {
		if (this.mod.status !== "valid" || !this.mod.package) return;
		this.confirm(target === "1v1" ? KoreMenuCommand.LaunchMod1v1 : KoreMenuCommand.LaunchModAiBattle);
		if (target === "1v1") this.callbacks.onLaunchMod1v1?.(this.mod.package);
		else this.callbacks.onLaunchModAiBattle?.(this.mod.package);
	}
	private applyModImport(next: ModDocumentState): void {
		this.mod = next;
		const valid = next.status === "valid" && next.package;
		this.runtime.dispatch({ type: "navigate", target: KoreMenuScreen.ModResult });
		if (valid) {
			const manifest = next.package!.package.manifest;
			const items = next.package!.package.items?.length ?? 0;
			const effects = next.package!.package.items?.reduce((count, item) => count + (item.effects?.length ?? 0), 0) ?? 0;
			this.runtime.dispatch({ type: "setText", target: KoreMenuElement.ModResultSummary, text: [formatLanguage(this.language, KoreMenuText.ModResultName, { name: manifest.name }), formatLanguage(this.language, KoreMenuText.ModResultId, { id: manifest.id }), formatLanguage(this.language, KoreMenuText.ModResultMeta, { version: manifest.version, items, effects })].join("\n") });
			this.runtime.setElementText(KoreMenuElement.ModsStatus, `${manifest.name} (${next.package!.hash.slice(0, 8)})`);
			this.runtime.dispatch({ type: "setEnabled", target: KoreMenuElement.ModResult1v1, enabled: true });
			this.runtime.dispatch({ type: "setEnabled", target: KoreMenuElement.ModResultBattle, enabled: true });
		} else {
			this.runtime.dispatch({ type: "setText", target: KoreMenuElement.ModResultSummary, text: formatLanguage(this.language, KoreMenuText.ModError, { error: next.error?.message ?? "Unknown error" }) });
			this.runtime.setElementText(KoreMenuElement.ModsStatus, translate(this.language, KoreMenuText.ModsStatusEmpty));
			this.runtime.dispatch({ type: "setEnabled", target: KoreMenuElement.ModResult1v1, enabled: false });
			this.runtime.dispatch({ type: "setEnabled", target: KoreMenuElement.ModResultBattle, enabled: false });
		}
	}
	private selectMap(value: Extract<KoreMenuCommandMessage, { type: KoreMenuCommand.SelectMap }>["payload"]): void {
		if (value.intent === KoreMenuMapIntent.Battle) { startupMark("game.start.requested", { mode: "ai-battle", mapId: value.mapId }); this.callbacks.onPlayAiBattle?.(value.mapId); }
		else if (value.intent === KoreMenuMapIntent.Online) { startupMark("game.start.requested", { mode: "online", mapId: value.mapId }); this.callbacks.onPlayOnline?.(value.mapId, value.modeId); }
		else if (value.intent === KoreMenuMapIntent.Ai && value.difficulty) { startupMark("game.start.requested", { mode: "human-vs-ai", mapId: value.mapId }); this.callbacks.onPlayAiOpponent?.(asAiDifficulty(value.difficulty), value.mapId); }
		else if (value.intent === KoreMenuMapIntent.Local) { startupMark("game.start.requested", { mode: "hotseat", mapId: value.mapId }); this.callbacks.onSelectMap?.(value.mapId, value.modeId); }
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

		const theme = findKoreButtonTheme(element.style);
		const textColor = theme?.[element.hovered ? "hover" : "normal"]?.textColor ?? (element.hovered ? KoreMenuColor.HoverText : KoreMenuColor.Text);
		this.ctx.setFillColor(textColor);
		const fontSize = element.style === KoreMenuStyle.MapTitle ? 34
			: element.style === KoreMenuStyle.DifficultyTitle ? 28
			: element.style === KoreMenuStyle.MapNote ? 16 : 20;
		const yOffset = element.style === KoreMenuStyle.MapTitle ? 30 : 16;

		const lines = (element.text ?? "").split("\n");
		lines.forEach((line, index) => this.ctx.drawText(line, element.rect.x, element.rect.y + yOffset + index * (fontSize + 6), fontSize));
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
		if (!element.source) return;
		const theme = findKoreButtonTheme(element.style);
		const state = element.hovered ? "hover" : "normal";
		const color = theme?.[state]?.textColor;
		this.ctx.drawImage(element.source, element.rect.x, element.rect.y, element.rect.width, element.rect.height, undefined, undefined, undefined, undefined, color);
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
	settings: KoreMainMenuSettings = createMainMenuComposition().build(),
	language: LanguageCatalog = createEnglishLanguage()
): KoreMainMenuSurface {
	return new KoreMainMenuSurface(callbacks, settings, language);
}

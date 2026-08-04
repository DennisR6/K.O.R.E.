import { AudioEmitter, type AudioCommand, type ISoundEmitter } from "../../engine/audio-sdk/index.js";
import type { IMouse } from "../../engine/types.js";
import type { RenderContext } from "../../engine/RenderContext.js";
import { UiRuntime, type UiCommand, type UiRenderer } from "../../engine/ui-sdk/index.js";
import { AssetList } from "../../assetManager/assets/assetRegistry.js";
import type { AiDifficulty } from "../../ai/types.js";
import { koreAudio } from "../audio.js";
import { createMainMenuComposition, validateKoreMainMenuSettings, type KoreMainMenuSettings } from "./mainMenu.js";
import { KoreMenuColor, KoreMenuCommand, KoreMenuElement, KoreMenuId, KoreMenuMapIntent, KoreMenuScreen, KoreMenuStyle, asAiDifficulty, parseKoreMenuCommand, koreMenuMapScreen, type KoreMenuCommandMessage } from "./menuVocabulary.js";

export interface KoreMainMenuCallbacks {
	onPlayLocal?: () => void;
	onSelectMap?: (mapId: string) => void;
	getStartError?: () => string | undefined;
	onPlayOnline?: (mapId?: string) => void;
	onPlayAiBattle?: (mapId: string) => void;
	onPlayAiOpponent?: (difficulty: AiDifficulty, mapId: string) => void;
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
		this.runtime.tick({});
		if (this.runtime.getActiveScreen() === KoreMenuScreen.Landing && this.landingTicks++ > 300) this.runtime.setElementVisible(KoreMenuElement.LandingPrompt, true);
		this.handleCommands(this.runtime.drainCommands());
	}
	public draw(ctx: RenderContext): void {
		ctx.push(); ctx.drawImage(AssetList.slipstrikeTitelbildschirmPNG);
		this.runtime.draw(new KoreMenuRenderer(ctx));
		const error = this.callbacks.getStartError?.(); if (error) { ctx.setFillColor(KoreMenuColor.Error); ctx.drawText(error, 80, 390, 18); }
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
			case KoreMenuCommand.StartLocal: this.confirm(command.type); this.callbacks.onPlayLocal?.(); return;
			case KoreMenuCommand.OpenAiMaps: this.runtime.dispatch({ type: "navigate", target: koreMenuMapScreen(KoreMenuMapIntent.Ai, command.payload.difficulty) }); return;
			case KoreMenuCommand.SelectMap: this.selectMap(command.payload); return;
		}
	}
	private selectMap(value: Extract<KoreMenuCommandMessage, { type: KoreMenuCommand.SelectMap }> ["payload"]): void {
		if (value.intent === KoreMenuMapIntent.Battle) this.callbacks.onPlayAiBattle?.(value.mapId);
		else if (value.intent === KoreMenuMapIntent.Online) this.callbacks.onPlayOnline?.(value.mapId);
		else if (value.intent === KoreMenuMapIntent.Ai && value.difficulty) this.callbacks.onPlayAiOpponent?.(asAiDifficulty(value.difficulty), value.mapId);
		else if (value.intent === KoreMenuMapIntent.Local) this.callbacks.onSelectMap?.(value.mapId);
	}
	private confirm(command: KoreMenuCommand): void { if (this.initialSettings.metadata.confirmationCommands.includes(command)) this.sounds.emit(koreAudio.command.uiConfirm(this.soundSourceId, this.initialSettings.metadata.confirmationSoundId)); }
}

/** KORE visual projection of generic UI elements; it owns no UI state or input. */
class KoreMenuRenderer implements UiRenderer {
	public constructor(private readonly ctx: RenderContext) { }
	public drawText(element: Parameters<UiRenderer["drawText"]>[0]): void {
		if (element.style === KoreMenuStyle.LandingPrompt) { this.ctx.setFillColor(KoreMenuColor.Prompt); this.ctx.drawText(element.text ?? "", element.rect.x, element.rect.y + 20, 48); return; }
		this.ctx.setFillColor(KoreMenuColor.Text); this.ctx.drawText(element.text ?? "", element.rect.x, element.rect.y + (element.style === KoreMenuStyle.MapTitle ? 30 : 16), element.style === KoreMenuStyle.MapTitle ? 34 : element.style === KoreMenuStyle.DifficultyTitle ? 28 : element.style === KoreMenuStyle.MapNote ? 16 : 20);
	}
	public drawButton(element: Parameters<UiRenderer["drawButton"]>[0]): void {
		if (element.style === KoreMenuStyle.LandingHitbox) return;
		this.ctx.setFillColor(element.style === KoreMenuStyle.DifficultyBack || element.style === KoreMenuStyle.Back ? KoreMenuColor.BackButton : KoreMenuColor.Button);
		this.ctx.drawRect(element.rect.x, element.rect.y, element.rect.width, element.rect.height); this.ctx.setFillColor(KoreMenuColor.Text);
		const size = element.style === KoreMenuStyle.MainButton ? 28 : element.style === KoreMenuStyle.MapRow ? 20 : element.style === KoreMenuStyle.Difficulty ? 22 : 20;
		const label = element.text ?? "";
		const x = element.style === KoreMenuStyle.MainButton ? element.rect.x + 28 : element.style === KoreMenuStyle.MapRow ? element.rect.x + 20 : element.rect.x + Math.max(8, (element.rect.width - label.length * (size * 0.5)) / 2);
		this.ctx.drawText(element.text ?? "", x, element.rect.y + (element.rect.height > 40 ? 31 : 25), size);
	}
	public drawTextInput(element: Parameters<UiRenderer["drawTextInput"]>[0]): void { this.drawButton(element); }
}

export function createKoreMainMenuSurface(callbacks: KoreMainMenuCallbacks = {}, settings: KoreMainMenuSettings = createMainMenuComposition().build()): KoreMainMenuSurface { return new KoreMainMenuSurface(callbacks, settings); }

import { AudioEmitter, type AudioCommand, type ISoundEmitter } from "../../engine/audio-sdk/index.js";
import type { IMouse } from "../../engine/types.js";
import type { IDrawer, RenderContext } from "../../engine/RenderContext.js";
import { UiRuntime, type UiCommand, type UiRenderer } from "../../engine/ui-sdk/index.js";
import { koreAudio } from "../audio.js";
import { createGameHudComposition, validateKoreGameHudSettings, type KoreGameHudSettings } from "./gameHud.js";
import { assertNeverHudCommand, parseKoreHudCommand, KoreHudCommand, type KoreHudCommandMessage } from "./hudCommands.js";
import { hudResultText, hudStateText, type KoreHudProjection } from "./gameHudProjection.js";
import { KORE_HUD_ITEM_SLOTS, KoreHudColor, KoreHudElement, KoreHudId, KoreHudStyle, KoreHudText, koreHudItemElementId } from "./hudVocabulary.js";
import { RulePhase } from "../../rules/types.js";

export interface KoreHudCommandPort { handle(command: KoreHudCommandMessage): boolean | void; }
export interface KoreGameHudCapabilities { canSkipItemPhase?: boolean; canPause?: boolean; }

/** SDK HUD adapter: projection in, typed semantic commands/audio out. */
export class KoreGameHudSurface implements IMouse, IDrawer, ISoundEmitter {
	private readonly runtime: UiRuntime;
	private readonly sounds = new AudioEmitter(KoreHudId.SoundSource);
	private projection: KoreHudProjection | undefined;
	private mouse = { x: 0, y: 0 }; private paused = false; private rejection: string | undefined;
	public readonly soundSourceId = this.sounds.soundSourceId;
	public constructor(private readonly port: KoreHudCommandPort, private readonly gameplayInput?: IMouse, private readonly initialSettings: KoreGameHudSettings = createGameHudComposition().build(), private readonly capabilities: Required<KoreGameHudCapabilities> = { canSkipItemPhase: true, canPause: true }) { validateKoreGameHudSettings(initialSettings); this.runtime = UiRuntime.fromSettings(initialSettings.ui); }
	public getRuntime(): UiRuntime { return this.runtime; }
	public getGameplayInput(): IMouse | undefined { return this.gameplayInput; }
	public isVisible(): boolean { return !!this.projection?.match.result; }
	public toSettings(): KoreGameHudSettings { return { ...structuredClone(this.initialSettings), ui: this.runtime.toSettings() }; }
	public drainSoundCommands(): AudioCommand[] { return this.sounds.drainSoundCommands(); }
	public applyProjection(projection: KoreHudProjection): void {
		this.projection = structuredClone(projection); const turn = projection.turn;
		this.setText(KoreHudElement.Turn, `Team ${turn.activeTeam + 1} | ${turn.phase} | Turn ${turn.number + 1}`);
		this.setText(KoreHudElement.State, projection.match.waiting ? KoreHudText.Waiting : hudStateText(turn.engineState));
		this.setText(KoreHudElement.Aim, `Actor: ${turn.selectedActorId ?? KoreHudText.None} | Aim: ${turn.aimAngle === null ? KoreHudText.None : `${turn.aimAngle.toFixed(1)}°`} | Power: ${Math.round(turn.power * 10) / 10}`);
		const itemsVisible = turn.phase === RulePhase.Item && !projection.match.result;
		this.runtime.setElementVisible(KoreHudElement.ItemsTitle, itemsVisible); this.runtime.setElementVisible(KoreHudElement.SkipItem, itemsVisible && this.capabilities.canSkipItemPhase); this.runtime.setElementEnabled(KoreHudElement.SkipItem, itemsVisible && !projection.match.inputLocked && this.capabilities.canSkipItemPhase);
		for (const slot of KORE_HUD_ITEM_SLOTS) {
			const item = projection.inventory[slot]; const id = koreHudItemElementId(slot); this.runtime.setElementVisible(id, !!item && itemsVisible); this.runtime.setElementEnabled(id, !!item?.enabled);
			this.setText(id, item ? `${item.itemId} (${item.remainingUses})` : "");
			this.runtime.setElementAction(id, item ? { type: "emit", command: KoreHudCommand.UseItem, payload: { itemId: item.itemId, target: { type: "self" } } } : undefined);
		}
		const resultVisible = !!projection.match.result;
		for (const id of [KoreHudElement.ResultPanel, KoreHudElement.Result, KoreHudElement.Rematch, KoreHudElement.Menu, KoreHudElement.Replay, KoreHudElement.Share]) this.runtime.setElementVisible(id, resultVisible);
		this.setText(KoreHudElement.Result, hudResultText(projection.match.result));
		this.rejection = projection.rejection; this.runtime.setElementVisible(KoreHudElement.Rejection, !!this.rejection); this.setText(KoreHudElement.Rejection, this.rejection ? `Action rejected: ${this.rejection}` : "");
		this.paused = projection.match.paused;
		this.runtime.setElementVisible(KoreHudElement.Paused, this.paused && this.capabilities.canPause); this.runtime.setElementVisible(KoreHudElement.Resume, this.paused && this.capabilities.canPause); this.runtime.setElementVisible(KoreHudElement.Pause, !this.paused && !resultVisible && this.capabilities.canPause);
	}
	public tick(deltaTime: number = 1, _friction: number = 0): void { this.runtime.tick({}, deltaTime); this.route(this.runtime.drainCommands()); }
	public draw(renderer: RenderContext): void { this.runtime.draw(new KoreHudRenderer(renderer)); }
	public updateMouse(x: number, y: number): void { this.mouse = { x, y }; this.gameplayInput?.updateMouse(x, y); }
	public handleMousePressed(): void {
		this.runtime.tick({ pointer: { ...this.mouse, pressed: true, justPressed: true } }); const hit = this.runtime.getPressedTargetId(); this.route(this.runtime.drainCommands());
		if (!hit && !this.paused && !this.projection?.match.result) this.gameplayInput?.handleMousePressed();
	}
	public handleMouseReleased(): void { this.runtime.tick({ pointer: { ...this.mouse, justReleased: true } }); this.route(this.runtime.drainCommands()); if (!this.paused && !this.projection?.match.result) this.gameplayInput?.handleMouseReleased(); }
	public handleMouseWheel(event: WheelEvent): void { if (!this.paused && !this.projection?.match.result) this.gameplayInput?.handleMouseWheel(event); }
	public reset(): void { this.gameplayInput?.reset?.(); }
	private route(commands: UiCommand[]): void {
		for (const raw of commands) { const command = parseKoreHudCommand(raw.command, raw.payload); if (!command) { this.rejection = `Unknown HUD command '${raw.command}'`; continue; } try { this.handle(command); } catch (error) { this.rejection = error instanceof Error ? error.message : "HUD action rejected"; } }
	}
	private handle(command: KoreHudCommandMessage): void {
		switch (command.type) {
			case KoreHudCommand.UseItem: this.dispatch(command); return;
			case KoreHudCommand.SkipItemPhase: this.dispatch(command); return;
			case KoreHudCommand.Pause: this.dispatch(command); this.paused = true; return;
			case KoreHudCommand.Resume: this.dispatch(command); this.paused = false; return;
			case KoreHudCommand.Rematch: case KoreHudCommand.Replay: case KoreHudCommand.Share: case KoreHudCommand.ReturnToMenu: this.dispatch(command); return;
			default: return assertNeverHudCommand(command);
		}
	}
	private dispatch(command: KoreHudCommandMessage): void { if (this.port.handle(command) !== false) this.confirm(); }
	private confirm(): void { this.sounds.emit(koreAudio.command.uiConfirm(this.soundSourceId)); }
	private setText(id: KoreHudElement | string, text: string): void { this.runtime.dispatch({ type: "setText", target: id, text }); }
}

class KoreHudRenderer implements UiRenderer {
	public constructor(private readonly renderer: RenderContext) { }
	public drawText(element: Parameters<UiRenderer["drawText"]>[0]): void { if (!element.text) return; this.renderer.setFillColor(element.style === KoreHudStyle.Rejection ? KoreHudColor.Danger : KoreHudColor.Ink); this.renderer.drawText(element.text, element.rect.x, element.rect.y + (element.style === KoreHudStyle.ResultTitle ? 32 : 16), element.style === KoreHudStyle.Status ? 16 : element.style === KoreHudStyle.ResultTitle ? 28 : 14); }
	public drawButton(element: Parameters<UiRenderer["drawButton"]>[0]): void { const style = element.style; this.renderer.setFillColor(style === KoreHudStyle.ResultPanel ? KoreHudColor.Panel : style === KoreHudStyle.ResultAction || style === KoreHudStyle.ResultSecondary || style === KoreHudStyle.Skip ? KoreHudColor.Action : style === KoreHudStyle.Pause ? KoreHudColor.Pause : KoreHudColor.DefaultButton); this.renderer.drawRect(element.rect.x, element.rect.y, element.rect.width, element.rect.height); if (element.text) { this.renderer.setFillColor(KoreHudColor.Text); this.renderer.drawText(element.text, element.rect.x + 10, element.rect.y + Math.min(23, element.rect.height - 8), 14); } }
	public drawTextInput(element: Parameters<UiRenderer["drawTextInput"]>[0]): void { this.drawButton(element); }
}

export function createKoreGameHudSurface(port: KoreHudCommandPort, gameplayInput?: IMouse, settings: KoreGameHudSettings = createGameHudComposition().build(), capabilities: KoreGameHudCapabilities = {}): KoreGameHudSurface {
	return new KoreGameHudSurface(port, gameplayInput, settings, { canSkipItemPhase: capabilities.canSkipItemPhase ?? true, canPause: capabilities.canPause ?? true });
}

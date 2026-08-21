import { AudioEmitter, type AudioCommand, type ISoundEmitter } from "@coffeemakerstudio/roast";
import type { IMouse } from "../runtime/types.js";
import type { IDrawer, RenderContext } from "../runtime/RenderContext.js";
import { UiRuntime, type UiCommand, type UiRenderer } from "@coffeemakerstudio/drip";
import { koreAudio } from "../audio.js";
import { createGameHudComposition, validateKoreGameHudSettings, type KoreGameHudSettings } from "./gameHud.js";
import { assertNeverHudCommand, parseKoreHudCommand, KoreHudCommand, type KoreHudCommandMessage, type KoreReportCategory } from "./hudCommands.js";
import { hudResultText, hudStateText, type KoreHudProjection } from "./gameHudProjection.js";
import { KORE_HUD_ITEM_SLOTS, KoreHudColor, KoreHudElement, KoreHudId, KoreHudStyle, koreHudItemElementId } from "./hudVocabulary.js";
import { RulePhase } from "../../rules/types.js";
import type { ItemTarget } from "../../item/target.js";
import { itemIconSource } from "../../item/itemIcons.js";
import { createEnglishLanguage, formatLanguage, LANGUAGE_KEYS, type LanguageCatalog } from "../../i18n/language.js";
import { AssetList, assetKeySource } from "../../assetManager/assets/assetRegistry.js";

export interface KoreHudCommandPort { handle(command: KoreHudCommandMessage): boolean | void; }
export interface KoreGameHudCapabilities { canSkipItemPhase?: boolean; canPause?: boolean; canReport?: boolean; }
export type KoreHudItemTargetResolver = (itemId: string, point: { x: number; y: number }) => ItemTarget | undefined;

/** SDK HUD adapter: projection in, typed semantic commands/audio out. */
export class KoreGameHudSurface implements IMouse, IDrawer, ISoundEmitter {
	private readonly runtime: UiRuntime;
	private readonly sounds = new AudioEmitter(KoreHudId.SoundSource);
	private projection: KoreHudProjection | undefined;
	private selectedItemId: string | undefined;
	private mouse = { x: 0, y: 0 }; private paused = false; private reportOpen = false; private reportCategory: KoreReportCategory = "technical"; private rejection: string | undefined;
	public readonly soundSourceId = this.sounds.soundSourceId;
	public readonly acceptsUiInputWhileLocked = true;
	public constructor(private readonly port: KoreHudCommandPort, private readonly gameplayInput?: IMouse, private readonly initialSettings: KoreGameHudSettings = createGameHudComposition().build(), private readonly capabilities: Required<KoreGameHudCapabilities> = { canSkipItemPhase: true, canPause: true, canReport: false }, private readonly language: LanguageCatalog = createEnglishLanguage(), private readonly resolveItemTarget?: KoreHudItemTargetResolver) { validateKoreGameHudSettings(initialSettings); this.runtime = UiRuntime.fromSettings(initialSettings.ui); }
	public getRuntime(): UiRuntime { return this.runtime; }
	public getGameplayInput(): IMouse | undefined { return this.gameplayInput; }
	public isVisible(): boolean { return !!this.projection?.match.result; }
	public toSettings(): KoreGameHudSettings { return { ...structuredClone(this.initialSettings), ui: this.runtime.toSettings() }; }
	public drainSoundCommands(): AudioCommand[] { return this.sounds.drainSoundCommands(); }
	public applyProjection(projection: KoreHudProjection): void {
		this.projection = structuredClone(projection); const turn = projection.turn;
		if (turn.phase !== RulePhase.Item || !projection.inventory.some(item => item.itemId === this.selectedItemId)) this.selectedItemId = undefined;
		this.setText(KoreHudElement.Turn, formatLanguage(this.language, LANGUAGE_KEYS.HudTurn, { team: turn.activeTeam + 1, phase: turn.phase, turn: turn.number + 1 }));
		this.setText(KoreHudElement.State, projection.aiThinking ? this.language.strings[LANGUAGE_KEYS.HudAiThinking] : projection.match.waiting ? this.language.strings[LANGUAGE_KEYS.HudWaiting] : hudStateText(turn.engineState, this.language));
		this.setText(KoreHudElement.Aim, `${formatLanguage(this.language, LANGUAGE_KEYS.HudActor, { actor: turn.selectedActorId ?? this.language.strings[LANGUAGE_KEYS.HudNone] })} | ${formatLanguage(this.language, LANGUAGE_KEYS.HudAim, { aim: turn.aimAngle === null ? this.language.strings[LANGUAGE_KEYS.HudNone] : `${turn.aimAngle.toFixed(1)}°` })} | ${formatLanguage(this.language, LANGUAGE_KEYS.HudPower, { power: Math.round(turn.power * 10) / 10 })}`);
		this.runtime.setElementVisible(KoreHudElement.Tutorial, projection.tutorial === true);
		const itemsVisible = turn.phase === RulePhase.Item && !projection.match.result;
		this.runtime.setElementVisible(KoreHudElement.ItemsTitle, itemsVisible);
		const selectedItem = projection.inventory.find(item => item.itemId === this.selectedItemId);
		const hoveredItemId = this.hoveredItemId();
		const hoveredItem = projection.inventory.find(item => item.itemId === hoveredItemId);
		const inventorySummary = projection.inventory.map(item => `${item.name ?? item.itemId} (${item.remainingUses})`).join(", ");
		const titleItem = hoveredItem ?? selectedItem;
		this.setText(KoreHudElement.ItemsTitle, titleItem ? `${titleItem.name ?? titleItem.itemId}${titleItem.description ? `: ${titleItem.description}` : ""}${titleItem.timing ? ` (${titleItem.timing})` : ""}` : `${this.language.strings[LANGUAGE_KEYS.HudItems]}: ${inventorySummary || "none"}. Hover an icon for details or skip`); this.runtime.setElementVisible(KoreHudElement.SkipItem, itemsVisible && this.capabilities.canSkipItemPhase); this.runtime.setElementEnabled(KoreHudElement.SkipItem, itemsVisible && this.capabilities.canSkipItemPhase);
		for (const slot of KORE_HUD_ITEM_SLOTS) {
			const item = projection.inventory[slot]; const id = koreHudItemElementId(slot); this.runtime.setElementVisible(id, !!item && itemsVisible); this.runtime.setElementEnabled(id, !!item?.enabled);
			// Item controls are deliberately icon-only so they never cover the arena.
			this.setText(id, "");
			this.runtime.setElementComponent(id, item ? (item.component ?? { type: "image", source: itemIconSource(item.itemId) ?? assetKeySource(AssetList.itemsPlaceholderSVG) }) : undefined);
			this.runtime.setElementAction(id, item ? { type: "emit", command: KoreHudCommand.UseItem, payload: { itemId: item.itemId, target: { type: "self" } } } : undefined);
		}
		const resultVisible = !!projection.match.result;
		this.runtime.setElementVisible(KoreHudElement.Report, this.capabilities.canReport && !resultVisible && !this.reportOpen);
		for (const id of [KoreHudElement.ReportPanel, KoreHudElement.ReportTitle, KoreHudElement.ReportCategoryConduct, KoreHudElement.ReportCategoryTechnical, KoreHudElement.ReportText, KoreHudElement.ReportSubmit, KoreHudElement.ReportCancel]) this.runtime.setElementVisible(id, this.reportOpen);
		this.paused = projection.match.paused;
		for (const id of [KoreHudElement.ResultPanel, KoreHudElement.Result, KoreHudElement.Rematch, KoreHudElement.ReplayShare]) this.runtime.setElementVisible(id, resultVisible);
		this.runtime.setElementVisible(KoreHudElement.Menu, resultVisible || this.paused);
		this.setText(KoreHudElement.Result, hudResultText(projection.match.result, this.language));
		const previousRejection = this.rejection;
		this.rejection = projection.rejection;
		if (this.rejection && this.rejection !== previousRejection) this.sounds.emit(koreAudio.command.uiReject(this.soundSourceId));
		this.runtime.setElementVisible(KoreHudElement.Rejection, !!this.rejection); this.setText(KoreHudElement.Rejection, this.rejection ? formatLanguage(this.language, LANGUAGE_KEYS.HudActionRejected, { reason: this.rejection }) : "");
		this.setPauseControls(this.paused, resultVisible);
	}
	public tick(deltaTime: number = 1, _friction: number = 0): void { this.runtime.tick({}, deltaTime); this.route(this.runtime.drainCommands()); }
	public handleKeyPressed(event: KeyboardEvent): void {
		this.runtime.tick({ keyboard: { pressedKeys: [event.key], textInput: this.reportOpen && event.key.length === 1 ? event.key : undefined } });
		this.route(this.runtime.drainCommands());
	}
	public draw(renderer: RenderContext): void { this.drawWorldGuidance(renderer); this.runtime.draw(new KoreHudRenderer(renderer)); }
	public updateMouse(x: number, y: number): void {
		this.mouse = { x, y };
		this.runtime.tick({ pointer: { x, y } });
		this.route(this.runtime.drainCommands());
		this.gameplayInput?.updateMouse(x, y);
	}
	public handleMousePressed(): void {
		this.runtime.tick({ pointer: { ...this.mouse, pressed: true, justPressed: true } }); const hit = this.runtime.getPressedTargetId(); this.route(this.runtime.drainCommands());
		if (!hit && this.selectedItemId && this.projection?.turn.phase === RulePhase.Item && this.resolveItemTarget) {
			const target = this.resolveItemTarget(this.selectedItemId, this.mouse);
			if (!target) { this.rejection = "Wrong position: choose a valid target in the arena"; return; }
			try {
				this.dispatch({ type: KoreHudCommand.UseItem, payload: { itemId: this.selectedItemId, target } });
				this.selectedItemId = undefined;
				this.applyProjection(this.projection);
			} catch (error) {
				this.rejection = error instanceof Error ? error.message : "Item use rejected";
			}
			return;
		}
		if (!hit && !this.paused && !this.projection?.match.result) this.gameplayInput?.handleMousePressed();
	}
	public handleMouseReleased(): void { this.runtime.tick({ pointer: { ...this.mouse, justReleased: true } }); this.route(this.runtime.drainCommands()); if (!this.paused && !this.projection?.match.result) this.gameplayInput?.handleMouseReleased(); }
	public handleMouseCancelled(): void { (this.gameplayInput as (IMouse & { cancelInput?: () => void }) | undefined)?.cancelInput?.(); }
	public handleMouseWheel(event: WheelEvent): void { if (!this.paused && !this.projection?.match.result) this.gameplayInput?.handleMouseWheel(event); }
	public reset(): void { this.gameplayInput?.reset?.(); }
	private hoveredItemId(): string | undefined {
		const hovered = this.runtime.getHoveredElementId();
		const prefix = "hud-item-";
		if (!hovered?.startsWith(prefix)) return undefined;
		const slot = Number(hovered.slice(prefix.length));
		return Number.isInteger(slot) ? this.projection?.inventory[slot]?.itemId : undefined;
	}

	private route(commands: UiCommand[]): void {
		for (const raw of commands) {
			const command = raw.command === KoreHudCommand.SubmitReport && raw.payload === undefined
				? { type: KoreHudCommand.SubmitReport as const, payload: { category: this.reportCategory, text: this.runtime.getElementValue(KoreHudElement.ReportText) ?? "" } }
				: parseKoreHudCommand(raw.command, raw.payload);
			if (!command) { this.rejection = `Unknown HUD command '${raw.command}'`; continue; }
			try { this.handle(command); } catch (error) {
				this.rejection = error instanceof Error ? error.message : "HUD action rejected";
				if (command.type === KoreHudCommand.UseItem) this.portMessage(this.rejection);
			}
		}
	}
	private handle(command: KoreHudCommandMessage): void {
		switch (command.type) {
			case KoreHudCommand.UseItem: {
				const item = this.projection?.inventory.find(candidate => candidate.itemId === command.payload.itemId);
				if (item?.targetType && item.targetType !== "self" && command.payload.target.type === "self") { this.selectedItemId = command.payload.itemId; this.applyProjection(this.projection!); return; }
				this.dispatch(command); return;
			}
			case KoreHudCommand.SkipItemPhase: this.dispatch(command); return;
			case KoreHudCommand.Pause: this.dispatch(command); this.setPauseControls(true); return;
			case KoreHudCommand.Resume: this.dispatch(command); this.setPauseControls(false); return;
			case KoreHudCommand.Report: this.reportOpen = true; this.applyProjection(this.projection!); return;
			case KoreHudCommand.ReportCategory: this.reportCategory = command.payload.category; return;
			case KoreHudCommand.SubmitReport: this.dispatch(command); this.reportOpen = false; this.applyProjection(this.projection!); return;
			case KoreHudCommand.CancelReport: this.reportOpen = false; this.applyProjection(this.projection!); return;
			case KoreHudCommand.Rematch: case KoreHudCommand.Replay: case KoreHudCommand.Share: case KoreHudCommand.ReplayShare: case KoreHudCommand.ReturnToMenu: this.dispatch(command); return;
			default: return assertNeverHudCommand(command);
		}
	}
	private portMessage(message: string): void {
		const handler = this.port as KoreHudCommandPort & { recordPlayerMessage?: (message: string) => void };
		handler.recordPlayerMessage?.(message.replace(/[\r\n]+/g, " ").slice(0, 160));
	}
	private dispatch(command: KoreHudCommandMessage): void { if (this.port.handle(command) !== false) this.confirm(); }
	private setPauseControls(paused: boolean, resultVisible = !!this.projection?.match.result): void {
		this.paused = paused;
		this.runtime.setElementVisible(KoreHudElement.Paused, paused && this.capabilities.canPause);
		this.runtime.setElementVisible(KoreHudElement.Resume, paused && this.capabilities.canPause);
		this.runtime.setElementVisible(KoreHudElement.Pause, !paused && !resultVisible && this.capabilities.canPause);
		this.runtime.setElementVisible(KoreHudElement.Report, this.capabilities.canReport && !paused && !resultVisible && !this.reportOpen);
		this.runtime.setElementVisible(KoreHudElement.Menu, resultVisible || paused);
	}
	private confirm(): void { this.sounds.emit(koreAudio.command.uiConfirm(this.soundSourceId)); }
	private setText(id: KoreHudElement | string, text: string): void { this.runtime.dispatch({ type: "setText", target: id, text }); }
	/** Renders only immutable projection geometry; gameplay input and state stay outside the surface. */
	private drawWorldGuidance(renderer: RenderContext): void {
		const projection = this.projection;
		if (!projection || projection.match.result) return;
		const color = projection.turn.activeTeam === 0 ? KoreHudColor.TeamOne : KoreHudColor.TeamTwo;
		renderer.push(); renderer.setFillColor(color);
		for (const marker of projection.guidance.activeMarkers) renderer.drawCircle(marker.x, marker.y - marker.radius - 8, 4);
		const preview = projection.guidance.aimPreview;
		if (preview) {
			renderer.setStrokeColor(color); renderer.setStroke(2);
			renderer.line(preview.from.x, preview.from.y, preview.to.x, preview.to.y);
			renderer.line(preview.to.x, preview.to.y, preview.left.x, preview.left.y);
			renderer.line(preview.to.x, preview.to.y, preview.right.x, preview.right.y);
		}
		renderer.pop();
	}
}

class KoreHudRenderer implements UiRenderer {
	public constructor(private readonly renderer: RenderContext) { }
	public drawText(element: Parameters<UiRenderer["drawText"]>[0]): void { if (!element.text) return; this.renderer.setFillColor(element.style === KoreHudStyle.Rejection ? KoreHudColor.Danger : KoreHudColor.Ink); this.renderer.drawText(element.text, element.rect.x, element.rect.y + (element.style === KoreHudStyle.ResultTitle ? 32 : 16), element.style === KoreHudStyle.Status ? 16 : element.style === KoreHudStyle.ResultTitle ? 28 : 14); }
	public drawButton(element: Parameters<UiRenderer["drawButton"]>[0]): void { const style = element.style; const imageSize = Math.min(30, element.rect.height); if (element.component && typeof this.renderer.drawImage === "function") { this.renderer.drawImage(element.component.source, element.rect.x, element.rect.y, imageSize, imageSize); if (element.text) { this.renderer.setFillColor(KoreHudColor.Text); this.renderer.drawText(element.text, element.rect.x + imageSize + 8, element.rect.y + Math.min(23, element.rect.height - 8), 14); } return; } this.renderer.setFillColor(style === KoreHudStyle.ResultPanel ? KoreHudColor.Panel : style === KoreHudStyle.ResultAction || style === KoreHudStyle.ResultSecondary || style === KoreHudStyle.Skip ? KoreHudColor.Action : style === KoreHudStyle.Pause ? KoreHudColor.Pause : KoreHudColor.DefaultButton); this.renderer.drawRect(element.rect.x, element.rect.y, element.rect.width, element.rect.height); if (element.focused) { this.renderer.setNoFill(); this.renderer.setStrokeColor("#fbbf24"); this.renderer.setStroke(3); this.renderer.drawRect(element.rect.x, element.rect.y, element.rect.width, element.rect.height); this.renderer.setStroke(0); } if (element.text) { this.renderer.setFillColor(KoreHudColor.Text); this.renderer.drawText(element.text, element.rect.x + 10, element.rect.y + Math.min(23, element.rect.height - 8), 14); } }
  public drawTextInput(element: Parameters<UiRenderer["drawTextInput"]>[0]): void { this.drawButton(element); }
  public drawImage(element: Parameters<UiRenderer["drawImage"]>[0]): void { if (element.source) this.renderer.drawImage(element.source, element.rect.x, element.rect.y, element.rect.width, element.rect.height); }
}

export function createKoreGameHudSurface(port: KoreHudCommandPort, gameplayInput?: IMouse, settings: KoreGameHudSettings | undefined = undefined, capabilities: KoreGameHudCapabilities = {}, language: LanguageCatalog = createEnglishLanguage(), resolveItemTarget?: KoreHudItemTargetResolver): KoreGameHudSurface {
	return new KoreGameHudSurface(port, gameplayInput, settings ?? createGameHudComposition(language).build(), { canSkipItemPhase: capabilities.canSkipItemPhase ?? true, canPause: capabilities.canPause ?? true, canReport: capabilities.canReport ?? false }, language, resolveItemTarget);
}

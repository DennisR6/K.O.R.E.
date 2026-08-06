import { AudioEmitter, type AudioCommand, type ISoundEmitter } from "../../engine/audio-sdk/index.js";
import type { IMouse } from "../../engine/types.js";
import type { RenderContext } from "../../engine/RenderContext.js";
import { UiRuntime, type UiCommand, type UiRenderer } from "../../engine/ui-sdk/index.js";
import { AssetList } from "../../assetManager/assets/assetRegistry.js";
import type { AiDifficulty } from "../../ai/types.js";
import { koreAudio } from "../audio.js";
import { createMainMenuComposition, mapScreenId, validateKoreMainMenuSettings, type KoreMainMenuSettings, type KoreMenuMapIntent } from "./mainMenu.js";
import { KoreMenuCommand, parseKoreMenuCommand } from "./menuVocabulary.js";
import { Canvas2DUiRenderer, type UiElementState } from "./koreUiTheme.js";

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
    private readonly sounds = new AudioEmitter("kore.menu");
    private mouse = { x: 0, y: 0 };
    private landingTicks = 0;
    public readonly soundSourceId = this.sounds.soundSourceId;

    public constructor(
        private readonly callbacks: KoreMainMenuCallbacks = {}, 
        private readonly initialSettings: KoreMainMenuSettings = createMainMenuComposition().build()
    ) {
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
        if (this.runtime.getActiveScreen() === "landing" && this.landingTicks++ > 300) this.runtime.setElementVisible("landing-prompt", true);
        this.handleCommands(this.runtime.drainCommands());
    }

    public draw(ctx: RenderContext): void {
        ctx.push(); 
        ctx.drawImage(AssetList.slipstrikeTitelbildschirmPNG);
        
        // Nutzt den modernisierten Theme-Renderer für das Canvas-Viewport
        this.runtime.draw(new KoreMenuRenderer(ctx));
        
        const error = this.callbacks.getStartError?.(); 
        if (error) { 
            ctx.setFillColor("#b91c1c"); 
            ctx.drawText(error, 80, 390, 18); 
        }
        ctx.pop();
    }

    private handleCommands(commands: UiCommand[]): void {
        for (const command of commands) {
            const parsed = parseKoreMenuCommand(command.command, command.payload);
            if (!parsed) continue;
            if (parsed.type === KoreMenuCommand.OpenAi) { this.confirm(parsed.type); this.runtime.dispatch({ type: "navigate", target: "difficulty" }); continue; }
            if (parsed.type === KoreMenuCommand.OpenBattle) { this.confirm(parsed.type); this.runtime.dispatch({ type: "navigate", target: "map-battle" }); continue; }
            if (parsed.type === KoreMenuCommand.OpenLocalMaps) { this.confirm(parsed.type); this.runtime.dispatch({ type: "navigate", target: "map-local" }); continue; }
            if (parsed.type === KoreMenuCommand.OpenOnline) { this.confirm(parsed.type); this.runtime.dispatch({ type: "navigate", target: "map-online" }); continue; }
            if (parsed.type === KoreMenuCommand.StartLocal) { this.confirm(parsed.type); this.callbacks.onPlayLocal?.(); continue; }
            if (parsed.type === KoreMenuCommand.OpenAiMaps) { this.runtime.dispatch({ type: "navigate", target: mapScreenId("ai", parsed.payload.difficulty) }); continue; }
            if (parsed.type === KoreMenuCommand.SelectMap) this.selectMap(parsed.payload);
        }
    }

    private selectMap(payload: UiCommand["payload"]): void {
        if (!payload || typeof payload !== "object") return;
        const value = payload as { intent?: KoreMenuMapIntent; mapId?: string; difficulty?: AiDifficulty };
        if (typeof value.mapId !== "string") return;
        if (value.intent === "battle") this.callbacks.onPlayAiBattle?.(value.mapId);
        else if (value.intent === "online") this.callbacks.onPlayOnline?.(value.mapId);
        else if (value.intent === "ai" && value.difficulty) this.callbacks.onPlayAiOpponent?.(value.difficulty, value.mapId);
        else if (value.intent === "local") this.callbacks.onSelectMap?.(value.mapId);
    }

    private confirm(command: string): void { if (this.initialSettings.metadata.confirmationCommands.includes(command)) this.sounds.emit(koreAudio.command.uiConfirm(this.soundSourceId, this.initialSettings.metadata.confirmationSoundId)); }
}

/** KORE visual projection of generic UI elements using Theme Tokens; owns no state or input. */
class KoreMenuRenderer implements UiRenderer {
    private readonly themeRenderer: Canvas2DUiRenderer;

    public constructor(private readonly ctx: RenderContext) {
        this.themeRenderer = new Canvas2DUiRenderer(ctx);
    }

    public drawText(element: Parameters<UiRenderer["drawText"]>[0]): void {
        if (element.style === "kore.menu.landing-prompt") { 
            this.ctx.setFillColor("#3b82f6"); 
            this.ctx.drawText(element.text ?? "", element.rect.x, element.rect.y + 20, 48); 
            return; 
        }
        
        this.ctx.setFillColor("#f8fafc"); 
        const fontSize = element.style === "kore.menu.map-title" ? 34 
                       : element.style === "kore.menu.difficulty-title" ? 28 
                       : element.style === "kore.menu.map-note" ? 16 : 20;
        const yOffset = element.style === "kore.menu.map-title" ? 30 : 16;
        
        this.ctx.drawText(element.text ?? "", element.rect.x, element.rect.y + yOffset, fontSize);
    }

    public drawButton(element: Parameters<UiRenderer["drawButton"]>[0]): void {
        // Unsichtbare Interaktions-Hitboxen werden übersprungen
        if (element.style === "kore.menu.landing-hitbox") return;

        // Bestimme das Theme (Standard: "kore.button.blue", für Back-Buttons: "kore.button.blue-back")
        const themeKey = (element.style === "kore.menu.difficulty-back" || element.style === "kore.menu.back") 
            ? "kore.button.blue-back" 
            : "kore.button.blue";

        // Ermittle den aktiven Interaktions-Zustand aus dem SDK-Element
        const state = this.resolveElementState(element);

        // Rendere den Button über das neue Theme-System
        this.themeRenderer.drawButton(element.rect, element.text ?? "", themeKey, state);
    }

    public drawTextInput(element: Parameters<UiRenderer["drawTextInput"]>[0]): void { 
        this.drawButton(element); 
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

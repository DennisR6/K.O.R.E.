import { GameHandler } from "../engine/Handler.js";
import { GameState } from "../engine/types.js";
import type { AiDifficulty } from "../ai/types.js";
import { createKoreMainMenuSurface } from "../kore/ui/KoreMainMenuSurface.js";
import { createMainMenuComposition } from "../kore/ui/mainMenu.js";
import { CANONICAL_PLAYABLE_MATCH } from "../settings/canonicalPlayableMatch.js";
import { UiSystem } from "../systems/UiSystem.js";
import { audio, type AudioCommand, type ISoundEmitter } from "../engine/audio-sdk/index.js";
import { koreAudio } from "../kore/audio.js";
import { createKoreHudProjection } from "../kore/ui/gameHudProjection.js";
import { installGameplayHud } from "./gameplayHud.js";
import { createMatchHandler, type MatchMode } from "./matchPipeline.js";
import { installOfflineMatchReport, reportOfflineMatch } from "../net/offlineMatchReport.js";
import { createEnglishLanguage, type LanguageCatalog } from "../i18n/language.js";

export type LocalHandlerFactory = (mapId: string) => GameHandler;
type MatchResultAction = "rematch" | "menu" | "replay" | "share";

/** Owns the menu/local-match scene boundary without retaining stale handlers. */
export class LocalMatchSceneRouter implements ISoundEmitter {
	private handler: GameHandler;
	private starting = false;
	private error: string | undefined;
	private mapId: string | null = null;
	private mode: MatchMode | undefined;
	private aiBattle = false;
	private battleSeed: number | undefined;
	private hud: ReturnType<typeof installGameplayHud> | undefined;
	private pendingSoundCommands: AudioCommand[] = [];
	public readonly soundSourceId = "kore.scene-router";

	public constructor(
		private readonly createLocalHandler: LocalHandlerFactory = createLocalGameplayHandler,
		private readonly battleSeedSource: () => number = () => Math.floor(Math.random() * 0x7fffffff),
		private readonly onPlayOnline?: (mapId?: string) => void,
		private readonly language: LanguageCatalog = createEnglishLanguage(),
	) {
		this.handler = new GameHandler();
		this.handler.setLanguage(this.language);
		const menu = this.createMenuSurface();
		this.handler.setMouseHandler(menu);
		this.handler.addPreTickAndDraw(menu);
	}

	public getHandler(): GameHandler { return this.handler; }
	public getError(): string | undefined { return this.error; }
	public getMapId(): string | null { return this.mapId; }
	public isLocalMatch(): boolean { return this.handler.getSettings()?.gameMode?.id === CANONICAL_PLAYABLE_MATCH.id; }
	public isResultVisible(): boolean {
		this.syncResultUi();
		if (this.handler.getState() === GameState.Game_over && this.handler.getMatchResult() !== undefined) this.hud?.applyProjection(createKoreHudProjection(this.handler, this.handler.getSystems().find(system => system instanceof UiSystem) as UiSystem | undefined));
		return this.handler.getState() === GameState.Game_over && this.handler.getMatchResult() !== undefined;
	}
	/** Installs the result controls only after a spectator battle has ended. */
	public syncResultUi(): void {
		if (this.mode === "ai-battle" && this.handler.getState() === GameState.Game_over && !this.hud) this.installResultOverlay(this.handler);
	}
	/** The seed of the currently running KI battle, or undefined in the menu. */
	public getBattleSeed(): number | undefined { return this.battleSeed; }
	/** Carries semantic menu cues across an immediate menu -> scene replacement. */
	public drainSoundCommands(): AudioCommand[] { const commands = this.pendingSoundCommands.map(command => structuredClone(command)); this.pendingSoundCommands = []; return commands; }

	/** Starts exactly one canonical hotseat match on the given map; failures leave the menu handler usable. */
	public startLocalMatch(mapId: string = "ice-map-v1"): boolean {
		if (this.starting || this.isLocalMatch()) return false;
		this.mode = "hotseat";
		return this.startScene(() => this.createLocalHandler(mapId), mapId);
	}

	/**
	 * Starts one autonomous KI-vs-KI battle on the canonical arena. Every
	 * start draws a fresh battle seed so the AI plays a new game.
	 */
	public startAiBattle(mapId: string = "ice-map-v1"): boolean {
		if (this.starting || this.isLocalMatch()) return false;
		const seed = this.battleSeedSource();
		this.mode = "ai-battle";
		const started = this.startScene(() => createAiBattleHandler(mapId, seed), mapId);
		if (started) {
			this.aiBattle = true;
			this.battleSeed = seed;
		} else {
			this.mode = undefined;
		}
		return started;
	}

	/** Starts one human-controlled team against a computer-controlled team. */
	public startAiOpponent(difficulty: AiDifficulty, mapId: string = "ice-map-v1"): boolean {
		if (this.starting || this.isLocalMatch()) return false;
		const seed = this.battleSeedSource();
		this.mode = "human-vs-ai";
		const started = this.startScene(() => createHumanVsAiHandler(mapId, difficulty, seed), mapId);
		if (started) {
			this.aiBattle = false;
			this.battleSeed = seed;
		} else {
			this.mode = undefined;
		}
		return started;
	}

	private startScene(factory: () => GameHandler, mapId: string | null): boolean {
		this.starting = true;
		try {
			const next = factory();
			next.setLanguage(this.language);
			this.captureSoundCommands(this.handler.getMouseHandler());
			this.handler.dispose();
			this.handler = next;
			this.mapId = mapId;
			if (this.mode) installOfflineMatchReport(next, this.mode, mapId ?? "ice-map-v1", record => { void reportOfflineMatch(record); });
			this.installResultOverlay(next);
			this.error = undefined;
			return true;
		} catch (error) {
			this.error = error instanceof Error ? error.message : "Unable to start match";
			return false;
		} finally {
			this.starting = false;
		}
	}
	private captureSoundCommands(value: unknown): void {
		if (!value || typeof value !== "object" || typeof (value as Partial<ISoundEmitter>).drainSoundCommands !== "function") return;
		this.pendingSoundCommands.push(...(value as ISoundEmitter).drainSoundCommands());
	}

	private installResultOverlay(handler: GameHandler): void {
		// KI-vs-KI is a spectator engine. Keep its passive mouse handler and do
		// not attach the player HUD or its input/draw callbacks to the battle.
		if (this.mode === "ai-battle" && handler.getState() !== GameState.Game_over) {
			this.hud = undefined;
			return;
		}
		this.hud = installGameplayHud(handler, {
			language: this.language,
			onRematch: () => this.handleResultAction("rematch"),
			onReturnToMenu: () => this.handleResultAction("menu"),
			onReplay: () => this.handleResultAction("replay"),
			onShare: () => this.handleResultAction("share"),
		});
	}

	private handleResultAction(action: MatchResultAction): void {
		if (action === "replay" || action === "share") return;
		if (action === "rematch") {
			if (this.aiBattle) {
				// A battle rematch must be a fresh game: re-draw the battle
				// seed instead of replaying the same seeded decisions.
				const seed = this.battleSeedSource();
				const restarted = this.startScene(() => createAiBattleHandler(this.mapId ?? "ice-map-v1", seed), this.mapId);
				if (restarted) this.battleSeed = seed;
				return;
			}
			this.handler.rematch();
			return;
		}
		this.handler.dispose();
		// The application mixer owns the global music slot. Explicitly release the
		// local match source before the fresh menu requests lower-priority music.
		this.pendingSoundCommands.push(audio.command.stopSource({ sourceId: "kore.game.local", fadeOutMs: 150 }));
		this.pendingSoundCommands.push(koreAudio.command.menuMusic("kore.menu"));
		this.mapId = null;
		this.mode = undefined;
		this.hud = undefined;
		this.aiBattle = false;
		this.battleSeed = undefined;
		this.handler = this.createMenuHandler();
	}

	private createMenuHandler(): GameHandler {
		const handler = new GameHandler();
		handler.setLanguage(this.language);
		const menu = this.createMenuSurface();
		handler.setMouseHandler(menu);
		handler.addPreTickAndDraw(menu);
		return handler;
	}

	private createMenuSurface() {
		return createKoreMainMenuSurface({ onPlayLocal: () => this.startLocalMatch(), onSelectMap: (mapId: string) => this.startLocalMatch(mapId), getStartError: () => this.error, onPlayOnline: mapId => this.onPlayOnline?.(mapId), onPlayAiBattle: (mapId: string) => this.startAiBattle(mapId), onPlayAiOpponent: (difficulty, mapId) => this.startAiOpponent(difficulty, mapId) }, createMainMenuComposition(this.language).build());
	}
}

/** Builds a local hotseat match handler on any browser-available catalog map. */
export function createLocalGameplayHandler(mapId: string = "ice-map-v1"): GameHandler {
	return createMatchHandler({ mode: "hotseat", mapId });
}

/**
 * Builds an autonomous KI-vs-KI battle on the canonical arena through the
 * same pipeline as every other offline match, replacing human input with an
 * `AiBattleSystem` that drives both teams. The battle seed defaults to a fresh
 * random draw and varies the hard-AI decisions deterministically; pass an
 * explicit seed for reproducible games.
 */
export function createAiBattleHandler(mapId: string = "ice-map-v1", seed: number = Math.floor(Math.random() * 0x7fffffff)): GameHandler {
	return createMatchHandler({ mode: "ai-battle", mapId, seed });
}

/** Builds a local human team (team 0) against one selectable AI opponent (team 1). */
export function createHumanVsAiHandler(mapId: string = "ice-map-v1", difficulty: AiDifficulty = "medium", seed: number = Math.floor(Math.random() * 0x7fffffff)): GameHandler {
	return createMatchHandler({ mode: "human-vs-ai", mapId, difficulty, seed });
}

import { GameHandler } from "../engine/Handler.js";
import { GameState } from "../engine/types.js";
import type { AiDifficulty } from "../ai/types.js";
import { createKoreMainMenuSurface } from "../kore/ui/KoreMainMenuSurface.js";
import type { KoreMainMenuSurface } from "../kore/ui/KoreMainMenuSurface.js";
import { createMainMenuComposition } from "../kore/ui/mainMenu.js";
import { UiSystem } from "../systems/UiSystem.js";
import { audio, type AudioCommand, type ISoundEmitter } from "../engine/audio-sdk/index.js";
import { koreAudio } from "../kore/audio.js";
import { createKoreHudProjection } from "../kore/ui/gameHudProjection.js";
import { installGameplayHud } from "./gameplayHud.js";
import { createMatchHandler, type MatchMode } from "./matchPipeline.js";
import { flushOfflineMatchReports, installOfflineMatchReport, reportOfflineMatch } from "../net/offlineMatchReport.js";
import { buildFeedbackEndpoint, installFeedbackPrompt } from "../net/feedback.js";
import { createEnglishLanguage, type LanguageCatalog } from "../i18n/language.js";
import type { RenderContext } from "../engine/RenderContext.js";
import { readClipboardText } from "../mods/browserClipboard.js";
import { createModFileInput } from "../mods/browserFileInput.js";
import type { LoadedContentPackage } from "../content/package.js";
import { HardAiWorkerHost } from "../ai/worker/host.js";
import type { HardAiWorkerMetrics } from "../ai/worker/host.js";
import { startupMark } from "../engine/startupTelemetry.js";
import { AssetPreloader } from "../assetManager/preloader.js";

export type LocalHandlerFactory = (mapId: string, modeId?: string) => GameHandler;
type MatchResultAction = "rematch" | "menu" | "replay" | "share";
type MenuPreviewFrame = { players: Array<{ x: number; y: number; rotation: number }> };
type MenuPreviewAsset = { schemaVersion: 1; frameIntervalMs: number; frames: MenuPreviewFrame[] };

/** Owns the menu/local-match scene boundary without retaining stale handlers. */
export class LocalMatchSceneRouter implements ISoundEmitter {
	private handler: GameHandler;
	private starting = false;
	private error: string | undefined;
	private mapId: string | null = null;
	private mode: MatchMode | undefined;
	private aiBattle = false;
	private battleSeed: number | undefined;
	private menuPreview: MenuBattlePreview | undefined;
	private hud: ReturnType<typeof installGameplayHud> | undefined;
	private modFileInput: ReturnType<typeof createModFileInput> | undefined;
	private pendingSoundCommands: AudioCommand[] = [];
	private aiWorkerHost: HardAiWorkerHost | undefined;
	private prewarmedWorkerHost: HardAiWorkerHost | undefined;
	public readonly soundSourceId = "kore.scene-router";

	public constructor(
		private readonly createLocalHandler: LocalHandlerFactory = createLocalGameplayHandler,
		private readonly battleSeedSource: () => number = () => Math.floor(Math.random() * 0x7fffffff),
		private readonly onPlayOnline?: (mapId?: string, modeId?: string) => void,
		private readonly language: LanguageCatalog = createEnglishLanguage(),
		private readonly autoRestartAiBattle = false,
	) {
		this.handler = new GameHandler();
		this.handler.setLanguage(this.language);
		const menu = this.createMenuSurface();
		this.handler.setMouseHandler(menu);
		this.handler.addPreTicker({ tick: (dt) => this.menuPreview?.tick(menu.getRuntime().getActiveScreen() !== "landing", dt * 16.666) });
		this.handler.addPreTickAndDraw(menu);
	}

	public getHandler(): GameHandler { return this.handler; }
	public getError(): string | undefined { return this.error; }
	public getMapId(): string | null { return this.mapId; }
	public isLocalMatch(): boolean { return this.handler.getSettings()?.gameMode !== undefined; }
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
	public getAiWorkerMetrics(): HardAiWorkerMetrics | undefined { return this.aiWorkerHost?.getMetrics(); }
	/** Carries semantic menu cues across an immediate menu -> scene replacement. */
	public drainSoundCommands(): AudioCommand[] { const commands = this.pendingSoundCommands.map(command => structuredClone(command)); this.pendingSoundCommands = []; return commands; }

	/** Starts exactly one canonical hotseat match on the given map; failures leave the menu handler usable. */
	public startLocalMatch(mapId: string = "ice-map-v1", modeId?: string): boolean {
		if (this.starting || this.isLocalMatch()) return false;
		this.mode = "hotseat";
		return this.startScene(() => this.createLocalHandler(mapId, modeId), mapId);
	}
	public startModMatch(mod: LoadedContentPackage): boolean {
		if (this.starting || this.isLocalMatch()) return false;
		this.mode = "hotseat";
		const mapId = mod.package.maps?.[0]?.metadata.id ?? "mod-map";
		return this.startScene(() => createLocalGameplayHandler(mapId, undefined, mod), mapId);
	}

	/**
	 * Starts one autonomous KI-vs-KI battle on the canonical arena. Every
	 * start draws a fresh battle seed so the AI plays a new game.
	 */
	public startAiBattle(mapId: string = "ice-map-v1"): boolean {
		if (this.starting || this.isLocalMatch()) return false;
		const seed = this.battleSeedSource();
		const workerHost = this.takePrewarmedWorkerHost();
		this.mode = "ai-battle";
		const started = this.startScene(() => createAiBattleHandler(mapId, seed, undefined, workerHost), mapId, workerHost);
		if (started) {
			this.aiBattle = true;
			this.battleSeed = seed;
		} else {
			this.mode = undefined;
		}
		return started;
	}
	public startModAiBattle(mod: LoadedContentPackage): boolean {
		if (this.starting || this.isLocalMatch()) return false;
		const seed = this.battleSeedSource();
		const workerHost = this.takePrewarmedWorkerHost();
		this.mode = "ai-battle";
		const mapId = mod.package.maps?.[0]?.metadata.id ?? "mod-map";
		const started = this.startScene(() => createAiBattleHandler(mapId, seed, mod, workerHost), mapId, workerHost);
		if (started) {
			this.aiBattle = true;
			this.battleSeed = seed;
		} else this.mode = undefined;
		return started;
	}

	/** Starts one human-controlled team against a computer-controlled team. */
	public startAiOpponent(difficulty: AiDifficulty, mapId: string = "ice-map-v1"): boolean {
		if (this.starting || this.isLocalMatch()) return false;
		const seed = this.battleSeedSource();
		const workerHost = this.takePrewarmedWorkerHost();
		this.mode = "human-vs-ai";
		const started = this.startScene(() => createHumanVsAiHandler(mapId, difficulty, seed, workerHost), mapId, workerHost);
		if (started) {
			this.aiBattle = false;
			this.battleSeed = seed;
		} else {
			this.mode = undefined;
		}
		return started;
	}

	private startScene(factory: () => GameHandler, mapId: string | null, workerHost?: HardAiWorkerHost): boolean {
		void flushOfflineMatchReports();
		this.starting = true;
		try {
			startupMark("game.build.started", { mode: this.mode, mapId });
			const next = factory();
			startupMark("game.build.completed", { mode: this.mode, mapId });
			void new AssetPreloader().warm(next.toSettings());
			startupMark("game.scene.init.started", { scene: this.mode ?? "game" });
			next.setLanguage(this.language);
			this.captureSoundCommands(this.handler.getMouseHandler());
			this.menuPreview?.dispose();
			this.menuPreview = undefined;
			this.aiWorkerHost?.dispose();
			this.handler.dispose();
			this.handler = next;
			this.aiWorkerHost = workerHost;
			this.mapId = mapId;
			if (this.mode) installOfflineMatchReport(next, this.mode, mapId ?? "ice-map-v1", record => reportOfflineMatch(record), this.autoRestartAiBattle && this.mode === "ai-battle" ? () => {
				if (this.aiBattle && this.handler === next) this.restartAiBattle();
			} : undefined);
			if (this.mode === "hotseat" || this.mode === "human-vs-ai") installFeedbackPrompt(next, { mode: this.mode, mapId: mapId ?? "ice-map-v1" }, buildFeedbackEndpoint(window.location.href));
			this.installResultOverlay(next);
			startupMark("game.scene.init.completed", { scene: this.mode ?? "game" });
			startupMark("game.ready", { mode: this.mode, mapId });
			this.error = undefined;
			return true;
		} catch (error) {
			workerHost?.dispose();
			this.error = error instanceof Error ? error.message : "Unable to start match";
			return false;
		} finally {
			this.starting = false;
		}
	}
	private takePrewarmedWorkerHost(): HardAiWorkerHost {
		const host = this.prewarmedWorkerHost;
		this.prewarmedWorkerHost = undefined;
		return host ?? new HardAiWorkerHost();
	}
	private restartAiBattle(): void {
		const seed = this.battleSeedSource();
		const workerHost = new HardAiWorkerHost();
		const restarted = this.startScene(() => createAiBattleHandler(this.mapId ?? "ice-map-v1", seed, undefined, workerHost), this.mapId, workerHost);
		if (restarted) this.battleSeed = seed;
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
			onReplayShare: () => this.handleResultAction("replay"),
		});
	}

	private handleResultAction(action: MatchResultAction): void {
		if (action === "replay" || action === "share") return;
		if (action === "rematch") {
			if (this.aiBattle) {
				// A battle rematch must be a fresh game: re-draw the battle
				// seed instead of replaying the same seeded decisions.
				const seed = this.battleSeedSource();
				const workerHost = new HardAiWorkerHost();
				const restarted = this.startScene(() => createAiBattleHandler(this.mapId ?? "ice-map-v1", seed, undefined, workerHost), this.mapId, workerHost);
				if (restarted) this.battleSeed = seed;
				return;
			}
			this.handler.rematch();
			return;
		}
		this.handler.dispose();
		this.aiWorkerHost?.dispose();
		this.aiWorkerHost = undefined;
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
		void flushOfflineMatchReports();
		const handler = new GameHandler();
		handler.setLanguage(this.language);
		const menu = this.createMenuSurface();
		handler.setMouseHandler(menu);
		handler.addPreTicker({ tick: (dt) => this.menuPreview?.tick(menu.getRuntime().getActiveScreen() !== "landing", dt * 16.666) });
		handler.addPreTickAndDraw(menu);
		return handler;
	}

	private createMenuSurface() {
		this.menuPreview?.dispose();
		const preview = new MenuBattlePreview();
		this.menuPreview = preview;
		return createKoreMainMenuSurface({
			onPlayLocal: () => this.startLocalMatch(),
			onSelectMap: (mapId, modeId) => this.startLocalMatch(mapId, modeId),
			getStartError: () => this.error,
			onPlayOnline: (mapId, modeId) => this.onPlayOnline?.(mapId, modeId),
			onPlayAiBattle: (mapId: string) => this.startAiBattle(mapId),
			onPlayAiOpponent: (difficulty, mapId) => this.startAiOpponent(difficulty, mapId),
			drawBackground: renderer => preview.draw(renderer),
			onImportModFile: () => this.pickModFile(),
			onReadModClipboard: () => readClipboardText(),
			onLaunchMod1v1: mod => this.startModMatch(mod),
			onLaunchModAiBattle: mod => this.startModAiBattle(mod),
		}, createMainMenuComposition(this.language).build(), this.language);
	}

	/** Opens the hidden mod file picker; the picked text enters the menu surface import. */
	private pickModFile(): void {
		this.modFileInput?.dispose();
		this.modFileInput = createModFileInput({
			onText: (text, fileName) => {
				const surface = this.menuSurface();
				surface?.importModText(text, { kind: "file", fileName });
			},
			onError: error => {
				const surface = this.menuSurface();
				surface?.importModError(error, { kind: "file", fileName: "unknown" });
			},
		});
		this.modFileInput.open();
	}

	private menuSurface(): KoreMainMenuSurface | undefined {
		const mouse = this.handler.getMouseHandler();
		if (!mouse || !("getRuntime" in mouse)) return undefined;
		return mouse as KoreMainMenuSurface;
	}
}

/** Renders precomputed spectator snapshots behind the menu without simulation. */
class MenuBattlePreview {
	private handler = createLocalGameplayHandler("ice-map-v1");
	private frames: MenuPreviewFrame[] = [];
	private frameIndex = 0;
	private elapsedMs = 0;
	private visible = false;
	private loaded = false;

	public constructor() { void this.load(); }

	public tick(visible: boolean, deltaMs = 16.666): void {
		this.visible = visible;
		if (!visible || !this.loaded || this.frames.length === 0) return;
		this.elapsedMs += deltaMs;
		const interval = this.asset?.frameIntervalMs ?? 80;
		while (this.elapsedMs >= interval) {
			this.elapsedMs -= interval;
			this.frameIndex = (this.frameIndex + 1) % this.frames.length;
		}
		this.applyFrame(this.frames[this.frameIndex]!);
	}

	public draw(renderer: RenderContext): boolean {
		if (!this.visible) return false;
		this.handler.drawWorld(renderer);
		return true;
	}

	public dispose(): void {
		this.handler.dispose();
	}

	private asset: MenuPreviewAsset | undefined;
	private async load(): Promise<void> {
		if (typeof window === "undefined" || typeof fetch !== "function") return;
		try {
			const response = await fetch(new URL("./public/menu-preview.json", window.location.href), { cache: "force-cache" });
			if (!response.ok) return;
			const value = await response.json() as Partial<MenuPreviewAsset>;
			if (value.schemaVersion !== 1 || typeof value.frameIntervalMs !== "number" || !Number.isFinite(value.frameIntervalMs) || value.frameIntervalMs <= 0 || !Array.isArray(value.frames) || value.frames.length === 0) return;
			const frames = value.frames.filter(frame => Array.isArray(frame.players) && frame.players.every(player => Number.isFinite(player.x) && Number.isFinite(player.y) && Number.isFinite(player.rotation)));
			if (frames.length === 0) return;
			const frameIntervalMs = value.frameIntervalMs;
			if (typeof frameIntervalMs !== "number") return;
			this.asset = { schemaVersion: 1, frameIntervalMs, frames };
			this.frames = frames;
			this.loaded = true;
			this.applyFrame(this.frames[0]!);
		} catch {
			// The menu remains usable if the optional preview asset is unavailable.
		}
	}

	private applyFrame(frame: MenuPreviewFrame): void {
		const entities = this.handler.getEntityManager().getEntities();
		for (let index = 0; index < Math.min(entities.length, frame.players.length); index++) {
			const entity = entities[index];
			const player = frame.players[index]!;
			entity.setPos({ x: player.x, y: player.y });
			entity.setRotation(player.rotation);
		}
	}
}

/** Builds a local hotseat match handler on any browser-available catalog map. */
export function createLocalGameplayHandler(mapId: string = "ice-map-v1", gameModeId?: string, mod?: LoadedContentPackage): GameHandler {
	return createMatchHandler({ mode: "hotseat", mapId, gameModeId, mod });
}

/**
 * Builds an autonomous KI-vs-KI battle on the canonical arena through the
 * same pipeline as every other offline match, replacing human input with an
 * `AiBattleSystem` that drives both teams. The battle seed defaults to a fresh
 * random draw and varies the hard-AI decisions deterministically; pass an
 * explicit seed for reproducible games.
 */
export function createAiBattleHandler(mapId: string = "ice-map-v1", seed: number = Math.floor(Math.random() * 0x7fffffff), mod?: LoadedContentPackage, aiWorkerHost?: HardAiWorkerHost): GameHandler {
	return createMatchHandler({ mode: "ai-battle", mapId, seed, mod, aiWorkerHost });
}

/** Builds a local human team (team 0) against one selectable AI opponent (team 1). */
export function createHumanVsAiHandler(mapId: string = "ice-map-v1", difficulty: AiDifficulty = "medium", seed: number = Math.floor(Math.random() * 0x7fffffff), aiWorkerHost?: HardAiWorkerHost): GameHandler {
	return createMatchHandler({ mode: "human-vs-ai", mapId, difficulty, seed, aiWorkerHost });
}

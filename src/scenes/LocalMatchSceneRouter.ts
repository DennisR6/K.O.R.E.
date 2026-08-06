import { CombiEmitter } from "../emitter/InputEmitter.js";
import { GameEmitter } from "../emitter/EngineEmitter.js";
import { AiBattleSystem } from "../ai/AiBattleSystem.js";
import { AiOpponentSystem } from "../ai/AiOpponentSystem.js";
import type { AiDifficulty, AiSettings } from "../ai/types.js";
import { GameHandler, GameHandlerBuilder } from "../engine/Handler.js";
import { GameState } from "../engine/types.js";
import { createKoreMainMenuSurface } from "../kore/ui/KoreMainMenuSurface.js";
import { CANONICAL_PLAYABLE_MATCH, createCanonicalPlayableMatchSettings } from "../settings/canonicalPlayableMatch.js";
import { validateGameSettings } from "../settings/settings.js";
import { WinningSystem } from "../systems/WinningSystem.js";
import { EmitterSystem } from "../systems/Emitter.js";
import { UiSystem } from "../systems/UiSystem.js";
import { ItemPhaseUI } from "../ui/ItemPhaseUI.js";
import { buildMapSettings } from "../content/mapCatalog.js";
import { audio, type AudioCommand, type ISoundEmitter } from "../engine/audio-sdk/index.js";
import { koreAudio } from "../kore/audio.js";
import { createKoreGameHudSurface } from "../kore/ui/KoreGameHudSurface.js";
import { KoreHudCommand } from "../kore/ui/hudCommands.js";
import { createKoreHudProjection } from "../kore/ui/gameHudProjection.js";

export type LocalHandlerFactory = (mapId: string) => GameHandler;
type MatchResultAction = "rematch" | "menu" | "replay" | "share";

/** Bounded hard-AI search for browser-responsible KI-vs-KI decisions. */
const AI_BATTLE_LIMITS = { maxSimulations: 30, maxAngleSamples: 10, maxForceSamples: 3 };

/** Owns the menu/local-match scene boundary without retaining stale handlers. */
export class LocalMatchSceneRouter implements ISoundEmitter {
	private handler: GameHandler;
	private starting = false;
	private error: string | undefined;
	private mapId: string | null = null;
	private aiBattle = false;
	private battleSeed: number | undefined;
	private hud: ReturnType<typeof createKoreGameHudSurface> | undefined;
	private pendingSoundCommands: AudioCommand[] = [];
	public readonly soundSourceId = "kore.scene-router";

	public constructor(
		private readonly createLocalHandler: LocalHandlerFactory = createLocalGameplayHandler,
		private readonly battleSeedSource: () => number = () => Math.floor(Math.random() * 0x7fffffff),
		private readonly onPlayOnline?: (mapId?: string) => void,
	) {
		this.handler = new GameHandler();
		const menu = createKoreMainMenuSurface({ onPlayLocal: () => this.startLocalMatch(), onSelectMap: (mapId: string) => this.startLocalMatch(mapId), getStartError: () => this.error, onPlayOnline: mapId => this.onPlayOnline?.(mapId), onPlayAiBattle: (mapId: string) => this.startAiBattle(mapId), onPlayAiOpponent: (difficulty, mapId) => this.startAiOpponent(difficulty, mapId) });
		this.handler.setMouseHandler(menu);
		this.handler.addPreTickAndDraw(menu);
	}

	public getHandler(): GameHandler { return this.handler; }
	public getError(): string | undefined { return this.error; }
	public getMapId(): string | null { return this.mapId; }
	public isLocalMatch(): boolean { return this.handler.getSettings()?.gameMode?.id === "local-ice-duel-v1"; }
	public isResultVisible(): boolean {
		if (this.handler.getState() === GameState.Game_over && this.handler.getMatchResult() !== undefined) this.hud?.applyProjection(createKoreHudProjection(this.handler, this.handler.getSystems().find(system => system instanceof UiSystem) as UiSystem | undefined));
		return this.handler.getState() === GameState.Game_over && this.handler.getMatchResult() !== undefined;
	}
	/** The seed of the currently running KI battle, or undefined in the menu. */
	public getBattleSeed(): number | undefined { return this.battleSeed; }
	/** Carries semantic menu cues across an immediate menu -> scene replacement. */
	public drainSoundCommands(): AudioCommand[] { const commands = this.pendingSoundCommands.map(command => structuredClone(command)); this.pendingSoundCommands = []; return commands; }

	/** Starts exactly one canonical match on the given map; failures leave the menu handler usable. */
	public startLocalMatch(mapId: string = "ice-map-v1"): boolean {
		if (this.starting || this.isLocalMatch()) return false;
		return this.startScene(() => this.createLocalHandler(mapId), mapId);
	}

	/**
	 * Starts one autonomous KI-vs-KI battle on the canonical arena. Every
	 * start draws a fresh battle seed so the AI plays a new game.
	 */
	public startAiBattle(mapId: string = "ice-map-v1"): boolean {
		if (this.starting || this.isLocalMatch()) return false;
		const seed = this.battleSeedSource();
		const started = this.startScene(() => createAiBattleHandler(mapId, seed), mapId);
		if (started) {
			this.aiBattle = true;
			this.battleSeed = seed;
		}
		return started;
	}

	/** Starts one human-controlled team against a computer-controlled team. */
	public startAiOpponent(difficulty: AiDifficulty, mapId: string = "ice-map-v1"): boolean {
		if (this.starting || this.isLocalMatch()) return false;
		const seed = this.battleSeedSource();
		const started = this.startScene(() => createHumanVsAiHandler(mapId, difficulty, seed), mapId);
		if (started) {
			this.aiBattle = false;
			this.battleSeed = seed;
		}
		return started;
	}

	private startScene(factory: () => GameHandler, mapId: string | null): boolean {
		this.starting = true;
		try {
			const next = factory();
			this.captureSoundCommands(this.handler.getMouseHandler());
			this.handler.dispose();
			this.handler = next;
			this.mapId = mapId;
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
		const gameplayInput = handler.getMouseHandler();
		const emitter = handler.getSystems().find(system => (system as { systemId?: string }).systemId === "core.emitter") as EmitterSystem | undefined;
		const itemUi = emitter ? new ItemPhaseUI(handler, emitter.emitter) : undefined;
		let rejection: string | undefined;
		emitter?.setErrorHandler(error => { rejection = hudRejection(error); });
		const hud = createKoreGameHudSurface({ handle: command => {
			switch (command.type) {
				case KoreHudCommand.UseItem: {
					const actor = handler.getEntityManager().getEntities().find(entity => !entity.isDead() && entity.getTeam().includes(handler.getActiveTeam()));
					if (!actor || !itemUi) throw new Error("Items are unavailable"); itemUi.use(actor.getId(), command.payload.itemId, command.payload.target); return;
				}
				case KoreHudCommand.SkipItemPhase: if (!itemUi) throw new Error("Item phase is unavailable"); itemUi.skip(); return;
				case KoreHudCommand.Rematch: this.handleResultAction("rematch"); return;
				case KoreHudCommand.ReturnToMenu: this.handleResultAction("menu"); return;
				case KoreHudCommand.Replay: this.handleResultAction("replay"); return;
				case KoreHudCommand.Share: this.handleResultAction("share"); return;
				case KoreHudCommand.Pause: handler.setPaused(true); return;
				case KoreHudCommand.Resume: handler.setPaused(false); return;
			}
		} }, gameplayInput);
		this.hud = hud;
		handler.setMouseHandler(hud);
		const sync = () => createKoreHudProjection(handler, handler.getSystems().find(system => system instanceof UiSystem) as UiSystem | undefined, rejection);
		hud.applyProjection(sync());
		handler.addPostTicker({ tick: (_ctx, dt) => { hud.applyProjection(sync()); hud.tick(dt); } });
		handler.addPostDrawer({ draw: renderer => { hud.applyProjection(sync()); hud.draw(renderer); } });
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
		this.hud = undefined;
		this.aiBattle = false;
		this.battleSeed = undefined;
		this.handler = this.createMenuHandler();
	}

	private createMenuHandler(): GameHandler {
		const menu = createKoreMainMenuSurface({ onPlayLocal: () => this.startLocalMatch(), onSelectMap: (mapId: string) => this.startLocalMatch(mapId), getStartError: () => this.error, onPlayOnline: mapId => this.onPlayOnline?.(mapId), onPlayAiBattle: (mapId: string) => this.startAiBattle(mapId), onPlayAiOpponent: (difficulty, mapId) => this.startAiOpponent(difficulty, mapId) });
		const handler = new GameHandler();
		handler.setMouseHandler(menu);
		handler.addPreTickAndDraw(menu);
		return handler;
	}
}

function hudRejection(error: unknown): string {
	return (error instanceof Error ? error.message : "Action rejected").replace(/[\r\n]+/g, " ").replace(/^Error:\s*/, "").slice(0, 160);
}

/** Builds a local-match handler on any browser-available catalog map. */
export function createLocalGameplayHandler(mapId: string = "ice-map-v1"): GameHandler {
	const settings = buildMapSettings(mapId, createCanonicalPlayableMatchSettings());
	validateGameSettings(settings);
	const handler = new GameHandlerBuilder()
		.defaultSystems()
		.addSystem(new WinningSystem(CANONICAL_PLAYABLE_MATCH.teamCount))
		.fromSettings(settings)
		.build();
	const ui = new UiSystem();
	const emitters = new CombiEmitter();
	emitters.addEmitter(new GameEmitter(handler, handler.getSettings()?.gameMode, 2));
	handler.addSystem(ui);
	handler.setMouseHandler(ui);
	handler.addSystem(new EmitterSystem(emitters));
	return handler;
}

/**
 * Builds an autonomous KI-vs-KI battle on the canonical arena. The battle uses
 * the same validated settings and winning evaluator as the local match, but
 * replaces all human input with an `AiBattleSystem` that drives both teams
 * through the shared `AiTurnEmitter` boundary. The battle seed defaults to a
 * fresh random draw and varies the hard-AI decisions deterministically, so
 * every battle is a new game; pass an explicit seed for reproducible games.
 */
export function createAiBattleHandler(mapId: string = "ice-map-v1", seed: number = Math.floor(Math.random() * 0x7fffffff)): GameHandler {
	const settings = buildMapSettings(mapId, createCanonicalPlayableMatchSettings());
	validateGameSettings(settings);
	const handler = new GameHandlerBuilder()
		.defaultSystems()
		.addSystem(new WinningSystem(CANONICAL_PLAYABLE_MATCH.teamCount))
		.fromSettings(settings)
		.build();
	// One seed per battle, derived seeds per team so the battle is fully
	// reproducible from its recorder.
	const emitters = new CombiEmitter();
	emitters.addEmitter(new GameEmitter(handler, handler.getSettings()?.gameMode, 2, seed));
	const aiTeam0: AiSettings = { difficulty: "hard", seed: seed * 2, team: 0, decisionLimits: AI_BATTLE_LIMITS };
	const aiTeam1: AiSettings = { difficulty: "hard", seed: seed * 2 + 1, team: 1, decisionLimits: AI_BATTLE_LIMITS };
	const aiBattle = new AiBattleSystem(handler, emitters, aiTeam0, aiTeam1);
	handler.addSystem(aiBattle);
	// The passive battle input becomes the wrapped gameplay input of the
	// result overlay; clicks are ignored while the battle plays.
	handler.setMouseHandler(aiBattle);
	return handler;
}

/** Builds a local human team (team 0) against one selectable AI opponent (team 1). */
export function createHumanVsAiHandler(mapId: string = "ice-map-v1", difficulty: AiDifficulty = "medium", seed: number = Math.floor(Math.random() * 0x7fffffff)): GameHandler {
	const settings = buildMapSettings(mapId, createCanonicalPlayableMatchSettings());
	settings.myTeam = [0];
	settings.allTeams = ["Human", `${difficulty} KI`];
	const aiSettings: AiSettings = { difficulty, seed, team: 1, ...(difficulty === "hard" ? { decisionLimits: AI_BATTLE_LIMITS } : {}) };
	settings.ai = aiSettings;
	validateGameSettings(settings);
	const handler = new GameHandlerBuilder()
		.defaultSystems()
		.addSystem(new WinningSystem(CANONICAL_PLAYABLE_MATCH.teamCount))
		.fromSettings(settings)
		.build();
	const ui = new UiSystem();
	const emitters = new CombiEmitter();
	emitters.addEmitter(new GameEmitter(handler, handler.getSettings()?.gameMode, 2, seed));
	handler.addSystem(new AiOpponentSystem(handler, emitters, aiSettings));
	handler.addSystem(ui);
	handler.setMouseHandler(ui);
	handler.addSystem(new EmitterSystem(emitters));
	return handler;
}

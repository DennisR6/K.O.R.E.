import { CombiEmitter } from "../emitter/InputEmitter.js";
import { GameEmitter } from "../emitter/EngineEmitter.js";
import { AiBattleSystem } from "../ai/AiBattleSystem.js";
import type { AiSettings } from "../ai/types.js";
import { GameHandler, GameHandlerBuilder } from "../engine/Handler.js";
import { MainMenu } from "../menu/Menu.js";
import { CANONICAL_PLAYABLE_MATCH, createCanonicalPlayableMatchSettings } from "../settings/canonicalPlayableMatch.js";
import { validateGameSettings } from "../settings/settings.js";
import { WinningSystem } from "../systems/WinningSystem.js";
import { DirectionArrow } from "../systems/DirectionArrow.js";
import { EmitterSystem } from "../systems/Emitter.js";
import { UiSystem } from "../systems/UiSystem.js";
import { GameplayFeedback } from "../ui/GameplayFeedback.js";
import { ItemPhaseControls } from "../ui/ItemPhaseControls.js";
import { MatchResultOverlay, type MatchResultAction } from "../ui/MatchResultOverlay.js";
import { buildMapSettings } from "../content/mapCatalog.js";

export type LocalHandlerFactory = (mapId: string) => GameHandler;

/** Bounded hard-AI search for browser-responsible KI-vs-KI decisions. */
const AI_BATTLE_LIMITS = { maxSimulations: 30, maxAngleSamples: 10, maxForceSamples: 3 };

/** Owns the menu/local-match scene boundary without retaining stale handlers. */
export class LocalMatchSceneRouter {
	private handler: GameHandler;
	private overlay: MatchResultOverlay | undefined;
	private starting = false;
	private error: string | undefined;
	private mapId: string | null = null;

	public constructor(private readonly createLocalHandler: LocalHandlerFactory = createLocalGameplayHandler) {
		this.handler = new GameHandler();
		const menu = new MainMenu(() => this.startLocalMatch(), (mapId: string) => this.startLocalMatch(mapId), () => this.error, undefined, () => this.startAiBattle());
		this.handler.setMouseHandler(menu);
		this.handler.addPreTickAndDraw(menu);
	}

	public getHandler(): GameHandler { return this.handler; }
	public getError(): string | undefined { return this.error; }
	public getMapId(): string | null { return this.mapId; }
	public isLocalMatch(): boolean { return this.handler.getSettings()?.gameMode?.id === "local-ice-duel-v1"; }
	public isResultVisible(): boolean { return this.overlay?.isVisible() ?? false; }

	/** Starts exactly one canonical match on the given map; failures leave the menu handler usable. */
	public startLocalMatch(mapId: string = "ice-map-v1"): boolean {
		if (this.starting || this.isLocalMatch()) return false;
		return this.startScene(() => this.createLocalHandler(mapId), mapId);
	}

	/** Starts one autonomous KI-vs-KI battle on the canonical arena. */
	public startAiBattle(mapId: string = "ice-map-v1"): boolean {
		if (this.starting || this.isLocalMatch()) return false;
		return this.startScene(() => createAiBattleHandler(mapId), mapId);
	}

	private startScene(factory: () => GameHandler, mapId: string | null): boolean {
		this.starting = true;
		try {
			const next = factory();
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

	private installResultOverlay(handler: GameHandler): void {
		const gameplayInput = handler.getMouseHandler();
		const overlay = new MatchResultOverlay(handler, action => this.handleResultAction(action), gameplayInput);
		this.overlay = overlay;
		handler.setMouseHandler(overlay);
		handler.addPostDrawer(overlay);
	}

	private handleResultAction(action: MatchResultAction): void {
		if (!this.overlay?.isVisible()) return;
		if (action === "rematch") {
			this.handler.rematch();
			return;
		}
		this.handler.dispose();
		this.overlay = undefined;
		this.mapId = null;
		this.handler = this.createMenuHandler();
	}

	private createMenuHandler(): GameHandler {
		const menu = new MainMenu(() => this.startLocalMatch(), (mapId: string) => this.startLocalMatch(mapId), () => this.error, undefined, () => this.startAiBattle());
		const handler = new GameHandler();
		handler.setMouseHandler(menu);
		handler.addPreTickAndDraw(menu);
		return handler;
	}
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
	const arrow = new DirectionArrow(ui);
	const emitters = new CombiEmitter();
	emitters.addEmitter(new GameEmitter(handler, handler.getSettings()?.gameMode, 2));
	const feedback = new GameplayFeedback(handler, ui);
	// Browser-visible item-phase panel; delegates to UiSystem outside the item
	// phase and to shared validation inside it (ItemPhaseUI -> emitter -> rules).
	const itemControls = new ItemPhaseControls(handler, emitters, ui);
	handler.addSystem(ui);
	handler.setMouseHandler(itemControls);
	handler.addSystem(arrow);
	handler.addSystem(new EmitterSystem(emitters, error => feedback.setRejection(error)));
	handler.addPostDrawer(arrow);
	handler.addPostDrawer(feedback);
	handler.addPostDrawer(itemControls);
	return handler;
}

/**
 * Builds an autonomous KI-vs-KI battle on the canonical arena. The battle uses
 * the same validated settings and winning evaluator as the local match, but
 * replaces all human input with an `AiBattleSystem` that drives both teams
 * through the shared `AiTurnEmitter` boundary. The battle seed defaults to a
 * fresh random draw; pass an explicit seed for deterministic reproduction.
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

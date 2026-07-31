import { CombiEmitter } from "../emitter/InputEmitter.js";
import { GameEmitter } from "../emitter/EngineEmitter.js";
import { GameHandler } from "../engine/Handler.js";
import { MainMenu } from "../menu/Menu.js";
import { createCanonicalPlayableMatchHandler } from "../settings/canonicalPlayableMatch.js";
import { DirectionArrow } from "../systems/DirectionArrow.js";
import { EmitterSystem } from "../systems/Emitter.js";
import { UiSystem } from "../systems/UiSystem.js";
import { GameplayFeedback } from "../ui/GameplayFeedback.js";
import { MatchResultOverlay, type MatchResultAction } from "../ui/MatchResultOverlay.js";

export type LocalHandlerFactory = () => GameHandler;

/** Owns the menu/local-match scene boundary without retaining stale handlers. */
export class LocalMatchSceneRouter {
	private handler: GameHandler;
	private overlay: MatchResultOverlay | undefined;
	private starting = false;
	private error: string | undefined;

	public constructor(private readonly createLocalHandler: LocalHandlerFactory = createLocalGameplayHandler) {
		this.handler = new GameHandler();
		const menu = new MainMenu(() => this.startLocalMatch(), () => this.error);
		this.handler.setMouseHandler(menu);
		this.handler.addPreTickAndDraw(menu);
	}

	public getHandler(): GameHandler { return this.handler; }
	public getError(): string | undefined { return this.error; }
	public isLocalMatch(): boolean { return this.handler.getSettings()?.gameMode?.id === "local-ice-duel-v1"; }
	public isResultVisible(): boolean { return this.overlay?.isVisible() ?? false; }

	/** Starts exactly one canonical match; failures leave the menu handler usable. */
	public startLocalMatch(): boolean {
		if (this.starting || this.isLocalMatch()) return false;
		this.starting = true;
		try {
			const next = this.createLocalHandler();
			this.handler.dispose();
			this.handler = next;
			this.installResultOverlay(next);
			this.error = undefined;
			return true;
		} catch (error) {
			this.error = error instanceof Error ? error.message : "Unable to start local match";
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
		this.handler = this.createMenuHandler();
	}

	private createMenuHandler(): GameHandler {
		const menu = new MainMenu(() => this.startLocalMatch(), () => this.error);
		const handler = new GameHandler();
		handler.setMouseHandler(menu);
		handler.addPreTickAndDraw(menu);
		return handler;
	}
}

export function createLocalGameplayHandler(): GameHandler {
	const handler = createCanonicalPlayableMatchHandler();
	const ui = new UiSystem();
	const arrow = new DirectionArrow(ui);
	const emitters = new CombiEmitter();
	emitters.addEmitter(new GameEmitter(handler, handler.getSettings()?.gameMode, 2));
	const feedback = new GameplayFeedback(handler, ui);
	handler.addSystem(ui);
	handler.setMouseHandler(ui);
	handler.addSystem(arrow);
	handler.addSystem(new EmitterSystem(emitters, error => feedback.setRejection(error)));
	handler.addPostDrawer(arrow);
	handler.addPostDrawer(feedback);
	return handler;
}

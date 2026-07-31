import { CombiEmitter } from "../emitter/InputEmitter.js";
import { GameEmitter } from "../emitter/EngineEmitter.js";
import { GameHandler } from "../engine/Handler.js";
import { MainMenu } from "../menu/Menu.js";
import { createCanonicalPlayableMatchHandler } from "../settings/canonicalPlayableMatch.js";
import { DirectionArrow } from "../systems/DirectionArrow.js";
import { EmitterSystem } from "../systems/Emitter.js";
import { UiSystem } from "../systems/UiSystem.js";
import { GameplayFeedback } from "../ui/GameplayFeedback.js";

export type LocalHandlerFactory = () => GameHandler;

/** Owns the menu/local-match scene boundary without retaining stale handlers. */
export class LocalMatchSceneRouter {
	private handler: GameHandler;
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

	/** Starts exactly one canonical match; failures leave the menu handler usable. */
	public startLocalMatch(): boolean {
		if (this.starting || this.isLocalMatch()) return false;
		this.starting = true;
		try {
			const next = this.createLocalHandler();
			this.handler = next;
			this.error = undefined;
			return true;
		} catch (error) {
			this.error = error instanceof Error ? error.message : "Unable to start local match";
			return false;
		} finally {
			this.starting = false;
		}
	}
}

export function createLocalGameplayHandler(): GameHandler {
	const handler = createCanonicalPlayableMatchHandler();
	const ui = new UiSystem();
	const arrow = new DirectionArrow(ui);
	const emitters = new CombiEmitter();
	emitters.addEmitter(new GameEmitter(handler));
	const feedback = new GameplayFeedback(handler, ui);
	handler.addSystem(ui);
	handler.setMouseHandler(ui);
	handler.addSystem(arrow);
	handler.addSystem(new EmitterSystem(emitters, error => feedback.setRejection(error)));
	handler.addPostDrawer(arrow);
	handler.addPostDrawer(feedback);
	return handler;
}

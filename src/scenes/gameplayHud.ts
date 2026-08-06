import type { GameHandler } from "../engine/Handler.js";
import { EmitterSystem } from "../systems/Emitter.js";
import { UiSystem } from "../systems/UiSystem.js";
import { ItemPhaseUI } from "../ui/ItemPhaseUI.js";
import { createKoreGameHudSurface, type KoreGameHudSurface } from "../kore/ui/KoreGameHudSurface.js";
import { KoreHudCommand, type KoreHudCommandMessage } from "../kore/ui/hudCommands.js";
import { createKoreHudProjection } from "../kore/ui/gameHudProjection.js";
import type { ItemTarget } from "../item/target.js";
import { createEnglishLanguage, type LanguageCatalog } from "../i18n/language.js";
import { KoreGameplayFeedbackSurface } from "../kore/gameplayFeedback.js";

/**
 * Semantic HUD actions. Callbacks that return `false` signal external handling
 * (e.g. a network round trip) so the surface skips its confirmation sound; the
 * callbacks are optional because every offline mode has a default local path.
 */
export type GameplayHudActions = {
	canSkipItemPhase?: boolean;
	canPause?: boolean;
	onUseItem?: (actorId: string, itemId: string, target: ItemTarget) => boolean | void;
	onSkipItemPhase?: () => boolean | void;
	onRematch?: () => boolean | void;
	onReturnToMenu?: () => boolean | void;
	onReplay?: () => boolean | void;
	onShare?: () => boolean | void;
	onPause?: () => boolean | void;
	onResume?: () => boolean | void;
	language?: LanguageCatalog;
};

/**
 * The single gameplay HUD install used by every online and offline match. It
 * wraps the handler's active mouse input with the shared KORE HUD surface and
 * routes the typed semantic commands (UseItem, SkipItemPhase, Rematch,
 * ReturnToMenu, Replay, Share, Pause, Resume) through one command port whose
 * offline defaults are shared by all local modes. Network matches supply the
 * same actions with emitter/socket callbacks and capability limits.
 */
export function installGameplayHud(handler: GameHandler, actions: GameplayHudActions = {}): KoreGameHudSurface {
	const gameplayInput = handler.getMouseHandler();
	const emitter = handler.getSystems().find(system => (system as { systemId?: string }).systemId === "core.emitter") as EmitterSystem | undefined;
	const uiSystem = handler.getSystems().find(system => system instanceof UiSystem) as UiSystem | undefined;
	const itemUi = emitter ? new ItemPhaseUI(handler, emitter.emitter) : undefined;
	let rejection: string | undefined;
	emitter?.setErrorHandler(error => { rejection = hudRejection(error); });
	const hud = createKoreGameHudSurface({
		handle: command => handleHudCommand(command, handler, { ...actions, itemUi }),
	}, gameplayInput, undefined, { canSkipItemPhase: actions.canSkipItemPhase ?? true, canPause: actions.canPause ?? true }, actions.language ?? createEnglishLanguage());
	const feedback = new KoreGameplayFeedbackSurface();
	let feedbackCursor = 0;
	handler.setMouseHandler(hud);
	const sync = () => createKoreHudProjection(handler, uiSystem, rejection);
	hud.applyProjection(sync());
	handler.addPostTicker({ tick: (_ctx, dt) => {
		const events = handler.getFeedbackTrace(feedbackCursor);
		for (const event of events) feedback.accept(event);
		feedbackCursor += events.length;
		hud.applyProjection(sync()); hud.tick(dt); feedback.tick(dt);
	} });
	handler.addPostDrawer({ draw: renderer => { hud.applyProjection(sync()); hud.draw(renderer); feedback.draw(renderer); } });
	return hud;
}

type HudCommandDeps = GameplayHudActions & { itemUi?: ItemPhaseUI };

function handleHudCommand(command: KoreHudCommandMessage, handler: GameHandler, deps: HudCommandDeps): boolean | void {
	switch (command.type) {
		case KoreHudCommand.UseItem: {
			const actor = handler.getEntityManager().getEntities().find(entity => !entity.isDead() && entity.getTeam().includes(handler.getActiveTeam()));
			if (!actor || !deps.itemUi) throw new Error("Items are unavailable");
			if (deps.onUseItem) return deps.onUseItem(actor.getId(), command.payload.itemId, command.payload.target);
			deps.itemUi.use(actor.getId(), command.payload.itemId, command.payload.target);
			return;
		}
		case KoreHudCommand.SkipItemPhase:
			if (deps.onSkipItemPhase) return deps.onSkipItemPhase();
			if (!deps.itemUi) throw new Error("Item phase is unavailable");
			deps.itemUi.skip();
			return;
		case KoreHudCommand.Rematch:
			if (deps.onRematch) return deps.onRematch();
			handler.rematch();
			return;
		case KoreHudCommand.ReturnToMenu:
			if (deps.onReturnToMenu) return deps.onReturnToMenu();
			throw new Error("Return to menu is unavailable");
		case KoreHudCommand.Replay:
			if (deps.onReplay) return deps.onReplay();
			return;
		case KoreHudCommand.Share:
			if (deps.onShare) return deps.onShare();
			return;
		case KoreHudCommand.Pause:
			if (deps.onPause) return deps.onPause();
			handler.setPaused(true);
			return;
		case KoreHudCommand.Resume:
			if (deps.onResume) return deps.onResume();
			handler.setPaused(false);
			return;
	}
}

function hudRejection(error: unknown): string {
	return (error instanceof Error ? error.message : "Action rejected").replace(/[\r\n]+/g, " ").replace(/^Error:\s*/, "").slice(0, 160);
}

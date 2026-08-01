import type { GameHandler } from "../engine/Handler.js";
import { GameState, type IMouse } from "../engine/types.js";
import type { RenderContext, IDrawer } from "../engine/RenderContext.js";
import type { IEntity } from "../entity/Entity.js";
import { RulePhase } from "../rules/types.js";
import type { IInputEmitter } from "../engine/types.js";
import { ItemPhaseUI } from "./ItemPhaseUI.js";

/** Browser-visible item-phase panel drawn in world coordinates (800x450). */
const panel = { x: 500, y: 30, width: 290, height: 150 };
const skipButton = { x: 560, y: 134, width: 200, height: 34 };
const itemButton = { x: 520, y: 66, width: 250, height: 30 };
const itemButtonGap = 38;

/**
 * Draws and owns input for the item phase without duplicating engine rules.
 *
 * Item availability, target validation, and use/skip actions all route
 * through the existing `ItemPhaseUI`/emitter path, so the browser controls
 * exercise the same authoritative rule transitions as every other input path.
 * Presses outside the panel (or after the phase) delegate to the underlying
 * gameplay input, so e.g. a drag-to-shoot attempt during the item phase still
 * reaches the shared action validation and its rejection path.
 */
export class ItemPhaseControls implements IDrawer, IMouse {
	private mouse = { x: 0, y: 0 };
	private readonly itemUI: ItemPhaseUI;

	public constructor(
		private readonly handler: GameHandler,
		emitter: IInputEmitter,
		private readonly gameplayInput?: IMouse,
	) {
		this.itemUI = new ItemPhaseUI(handler, emitter);
	}

	public isItemPhase(): boolean {
		return this.handler.getRuleState().phase === RulePhase.Item;
	}

	public getGameplayInput(): IMouse | undefined { return this.gameplayInput; }

	/**
	 * The wrapped gameplay input's current selection. Exposed so the scene
	 * input surface (menu -> match -> result overlay) keeps one contract for
	 * selection state regardless of which control layer owns it.
	 */
	public get selectedActorId(): string | null {
		const input = this.gameplayInput as { selectedActorId?: string | null } | undefined;
		return input?.selectedActorId ?? null;
	}

	/** Cascades input resets (rematch/dispose) to the wrapped gameplay input. */
	public reset(): void {
		this.gameplayInput?.reset?.();
	}

	public handleMousePressed(): void {
		if (this.handler.getState() === GameState.Game_over) return;
		if (this.isItemPhase()) {
			if (this.inside(this.mouse, skipButton)) {
				this.itemUI.skip();
				return;
			}
			const actor = this.getActiveActor();
			const items = actor ? this.itemUI.getItems(actor.getId()) : [];
			const index = items.findIndex((_, i) => this.inside(this.mouse, this.itemButtonRect(i)));
			if (index >= 0 && actor) {
				try {
					this.itemUI.use(actor.getId(), items[index]!.itemId);
				} catch {
					// An invalid use leaves the phase state unchanged.
				}
				return;
			}
		}
		this.gameplayInput?.handleMousePressed();
	}

	public updateMouse(x: number, y: number): void {
		this.mouse = { x, y };
		this.gameplayInput?.updateMouse(x, y);
	}

	public handleMouseReleased(): void {
		this.gameplayInput?.handleMouseReleased();
	}

	public handleMouseWheel(event: WheelEvent): void {
		this.gameplayInput?.handleMouseWheel(event);
	}

	public draw(renderer: RenderContext): void {
		if (!this.isItemPhase()) return;
		if (this.handler.getState() === GameState.Game_over) return;
		const ruleState = this.handler.getRuleState();
		const actor = this.getActiveActor();
		const items = actor ? this.itemUI.getItems(actor.getId()) : [];
		renderer.push();
		renderer.setFillColor("#1e293b");
		renderer.drawRect(panel.x, panel.y, panel.width, panel.height);
		renderer.setFillColor("white");
		renderer.drawText(`Item phase - Team ${ruleState.activeTeam + 1}`, panel.x + 12, panel.y + 22, 16);
		renderer.drawText(`Turn ${ruleState.turnNumber + 1}`, panel.x + 12, panel.y + 40, 13);
		items.forEach((item, index) => {
			const rect = this.itemButtonRect(index);
			renderer.setFillColor("#334155");
			renderer.drawRect(rect.x, rect.y, rect.width, rect.height);
			renderer.setFillColor("white");
			renderer.drawText(`${item.itemId} (${item.remainingUses})`, rect.x + 12, rect.y + 21, 14);
		});
		renderer.setFillColor("#2563eb");
		renderer.drawRect(skipButton.x, skipButton.y, skipButton.width, skipButton.height);
		renderer.setFillColor("white");
		renderer.drawText("Skip phase", skipButton.x + 52, skipButton.y + 23, 15);
		renderer.pop();
	}

	private getActiveActor(): IEntity | undefined {
		const activeTeam = this.handler.getActiveTeam();
		return this.handler.getEntityManager().getEntities().find(entity => !entity.isDead() && entity.getTeam().includes(activeTeam));
	}

	private itemButtonRect(index: number): typeof itemButton {
		return { x: itemButton.x, y: itemButton.y + index * itemButtonGap, width: itemButton.width, height: itemButton.height };
	}

	private inside(point: { x: number; y: number }, button: { x: number; y: number; width: number; height: number }): boolean {
		return point.x >= button.x && point.x <= button.x + button.width && point.y >= button.y && point.y <= button.y + button.height;
	}
}

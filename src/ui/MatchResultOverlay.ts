import type { GameHandler } from "../engine/Handler.js";
import type { RenderContext, IDrawer } from "../engine/RenderContext.js";
import { GameState, type IMouse } from "../engine/types.js";
import { MatchStatus } from "../rules/types.js";

export type MatchResultAction = "rematch" | "menu";

const rematchButton = { x: 245, y: 300, width: 145, height: 48 };
const menuButton = { x: 410, y: 300, width: 145, height: 48 };

/** Draws and owns input for the completed-match result screen. */
export class MatchResultOverlay implements IDrawer, IMouse {
	private mouse = { x: 0, y: 0 };

	public constructor(
		private readonly handler: GameHandler,
		private readonly onAction: (action: MatchResultAction) => void,
		private readonly gameplayInput?: IMouse,
	) { }

	public isVisible(): boolean {
		return this.handler.getState() === GameState.Game_over && this.handler.getMatchResult() !== undefined;
	}
	public getGameplayInput(): IMouse | undefined { return this.gameplayInput; }

	public handleMousePressed(): void {
		if (!this.isVisible()) return;
		if (this.inside(this.mouse, rematchButton)) this.onAction("rematch");
		else if (this.inside(this.mouse, menuButton)) this.onAction("menu");
	}

	public updateMouse(x: number, y: number): void {
		this.mouse = { x, y };
		if (!this.isVisible()) this.gameplayInput?.updateMouse(x, y);
	}

	public handleMouseReleased(): void {
		if (!this.isVisible()) this.gameplayInput?.handleMouseReleased();
	}

	public handleMouseWheel(event: WheelEvent): void {
		if (!this.isVisible()) this.gameplayInput?.handleMouseWheel(event);
	}

	public reset(): void {
		this.mouse = { x: 0, y: 0 };
		this.gameplayInput?.reset?.();
	}

	public draw(renderer: RenderContext): void {
		if (!this.isVisible()) return;
		const result = this.handler.getMatchResult()!;
		renderer.push();
		renderer.setFillColor("#f8fafc");
		renderer.drawRect(190, 125, 420, 260);
		renderer.setFillColor("#0f172a");
		const title = result.status === MatchStatus.Draw
			? "Draw"
			: `Team ${(result.winnerTeam ?? 0) + 1} wins`;
		renderer.drawText(title, 310, 205, 32);
		renderer.setFillColor("#2563eb");
		renderer.drawRect(rematchButton.x, rematchButton.y, rematchButton.width, rematchButton.height);
		renderer.drawRect(menuButton.x, menuButton.y, menuButton.width, menuButton.height);
		renderer.setFillColor("white");
		renderer.drawText("Rematch", rematchButton.x + 32, rematchButton.y + 30, 18);
		renderer.drawText("Menu", menuButton.x + 48, menuButton.y + 30, 18);
		renderer.pop();
	}

	private inside(point: { x: number; y: number }, button: typeof rematchButton): boolean {
		return point.x >= button.x && point.x <= button.x + button.width && point.y >= button.y && point.y <= button.y + button.height;
	}
}

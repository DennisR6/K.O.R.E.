import type { RenderContext } from "../engine/RenderContext.js";
import type { ReplayDocument } from "../replay/types.js";
import { validateReplayDocument } from "../replay/types.js";
import { ReplayPlayer } from "../replay/player.js";

export class ReplayViewer {
	private player: ReplayPlayer | undefined;
	private errorState: string | null = null;

	public loadReplay(rawReplay: unknown): boolean {
		this.errorState = null;
		try {
			validateReplayDocument(rawReplay);
			this.player = new ReplayPlayer(rawReplay as ReplayDocument);
			this.player.advance();
			console.log(`[replay] ReplayPlayer ready: actions=${this.player.getActionCount()} state=${this.player.getHandler().getState()}`);
			return true;
		} catch (error) {
			this.errorState = error instanceof Error ? error.message : "Malformed or incompatible replay";
			console.error(`[replay] replay document rejected: ${this.errorState}`, error);
			this.player = undefined;
			return false;
		}
	}

	public getErrorState(): string | null {
		return this.errorState;
	}

	public getPlayer(): ReplayPlayer | undefined {
		return this.player;
	}

	/** Advances to the next recorded action after the current visible turn settles. */
	public advance(): void { this.player?.advance(); }

	public draw(ctx: RenderContext): void {
		ctx.push();
		if (this.errorState) {
			ctx.setFillColor("red");
			ctx.drawText(`Replay Error: ${this.errorState}`, 100, 100, 20);
		} else if (this.player) {
			this.player.getHandler().drawWorld(ctx);
		} else {
			ctx.setFillColor("white");
			ctx.drawText("No replay loaded", 100, 100, 20);
		}
		ctx.pop();
	}
}

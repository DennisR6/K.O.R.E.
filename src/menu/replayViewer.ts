import type { RenderContext } from "../kore/runtime/RenderContext.js";
import type { ReplayDocument } from "../replay/types.js";
import { validateReplayDocument } from "../replay/types.js";
import { ReplayPlayer } from "../replay/player.js";
import { createEnglishLanguage, formatLanguage, LANGUAGE_KEYS, type LanguageCatalog } from "../i18n/language.js";

export class ReplayViewer {
	public constructor(private readonly language: LanguageCatalog = createEnglishLanguage()) { }
	private player: ReplayPlayer | undefined;
	private errorState: string | null = null;

	public loadReplay(rawReplay: unknown): boolean {
		this.errorState = null;
		try {
			validateReplayDocument(rawReplay);
			this.player = new ReplayPlayer(rawReplay as ReplayDocument);
			this.player.setPlaying(true);
			this.player.getHandler().setLanguage(this.language);
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
	public play(): void { this.player?.setPlaying(true); }
	public pause(): void { this.player?.setPlaying(false); }
	public seek(actionIndex: number): void {
		if (!this.player) return;
		this.player.seek(actionIndex);
		this.player.setPlaying(false);
	}
	public getPlaybackState(): { actionIndex: number; actionCount: number; playing: boolean; complete: boolean } | undefined {
		if (!this.player) return undefined;
		return {
			actionIndex: this.player.getActionIndex(),
			actionCount: this.player.getActionCount(),
			playing: this.player.isPlaying(),
			complete: this.player.isComplete(),
		};
	}

	public draw(ctx: RenderContext): void {
		ctx.push();
		if (this.errorState) {
			ctx.setFillColor("red");
			ctx.drawText(formatLanguage(this.language, LANGUAGE_KEYS.ReplayError, { error: this.errorState }), 100, 100, 20);
		} else if (this.player) {
			this.player.getHandler().drawWorld(ctx);
		} else {
			ctx.setFillColor("white");
			ctx.drawText(this.language.strings[LANGUAGE_KEYS.ReplayNoneLoaded], 100, 100, 20);
		}
		ctx.pop();
	}
}

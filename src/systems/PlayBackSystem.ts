import { GameState } from "../engine/types.js";
import type { EntityManager } from "../entity/EntityManager.js";
import type { PlayerSettings } from "../entity/types.js";
import type { IGameContext } from "./types.js";

/**
 * Das PlaybackSystem kontrolliert die zeitliche Wiedergabe von Spielzügen 
 * und stellt die Datenintegrität sicher.
 * 
 * Es fungiert als Brücke zwischen der flüssigen Animation und dem harten 
 * Endzustand einer Simulation. Nach Ablauf der Frames korrigiert es 
 * eventuelle Abweichungen (Drift), die durch physikalische Ungenauigkeiten 
 * entstanden sind.
 */
export class PlaybackSystem implements PlaybackSystem {
	/** Anzahl der verbleibenden Frames, bis der Endzustand erzwungen wird. */
	private remainingFrames = 0;
	/** Der Zielzustand (Snapshot), an den die Entities angeglichen werden. */
	private finalState: PlayerSettings[] | undefined;
	/** Ein optionaler Callback, der ausgeführt wird, wenn der Sync abgeschlossen ist. */
	private cb: (() => void) | undefined;

	/**
		 * Startet einen Wiedergabe-Countdown.
		 * @param frames - Dauer der Simulation in Frames.
		 * @param finalState - Die exakten Ziel-Daten (Position/Velocity) am Ende.
		 * @param cb - (Optional) Aktion nach Abschluss (z.B. UI einblenden).
		 */
	public start(frames: number, finalState: PlayerSettings[], cb?: () => void) {
		this.finalState = finalState
		this.remainingFrames = frames;
		this.cb = cb;
	}

	/**
		 * Reduziert den Frame-Counter in jedem Tick.
		 * Sobald 0 erreicht ist, wird der Hard-Sync ausgelöst.
		 */
	ticker(ctx: IGameContext) {
		if (ctx.state !== GameState.Playing) return
		if (this.remainingFrames > 0)
			this.remainingFrames--;
		else if (this.finalState) {
			this.applyHardSync(ctx.entities);
		}
	}

	/**
		 * Vergleicht den aktuellen Zustand der Entities mit dem `finalState`.
		 * Bei Abweichungen oberhalb des EPSILON-Werts werden die Werte hart überschrieben.
		 * 
		 * @important
		 * Dies verhindert "Desyncs", bei denen Spieler A denkt, der Puck sei im Aus, 
		 * während Spieler B ihn noch im Feld sieht.
		 */
	private applyHardSync(entities: EntityManager) {
		if (!this.finalState) return;

		// The server snapshot owns every mutable entity field, not just movement.
		entities.applySettings(this.finalState);

		this.finalState = undefined;
		if (this.cb) this.cb();
	}

	/**
		 * Gibt die Anzahl der Frames zurück, die bis zum Ende der aktuellen 
		 * Wiedergabe/Simulation noch verbleiben.
		 * 
		 * Nützlich für:
		 * 1. **UI/Progress-Bars**: Um dem Spieler anzuzeigen, wie lange der Spielzug noch dauert.
		 * 2. **Kamera-Steuerung**: Um sanft aus dem Fokus-Modus auszuzoomen, kurz bevor der Zug endet.
		 * 3. **Debugging**: Um zu prüfen, ob die Simulation im Zeitplan liegt.
		 * 
		 * @returns {number} Die Anzahl der noch ausstehenden Ticks.
		 */
	getRemainingFrames(): number {
		return this.remainingFrames;
	}
}

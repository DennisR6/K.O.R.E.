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
	/** True, sobald der Countdown abgelaufen ist und der Sync aussteht. */
	private syncPending = false;
	/** True, wenn der Sync angewendet wurde und der Callback noch aussteht. */
	private completionPending = false;
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
		this.syncPending = frames === 0;
		this.cb = cb;
	}

	/**
	 * Reduziert den Frame-Counter in jedem Tick. Sobald 0 erreicht ist, wird
	 * der Hard-Sync NICHT hier, sondern in `flush` ausgelöst - also erst in
	 * der finalen Mutations-Phase des Ticks, nachdem alle Gameplay-Systeme,
	 * Strukturen und Post-Ticker gelaufen sind. So kann kein späterer
	 * Physik-/Kollisionsschritt den autoritativen `finalState` verändern.
	 */
	ticker(ctx: IGameContext) {
		if (ctx.state !== GameState.Playing) return
		if (this.remainingFrames > 0) {
			this.remainingFrames--;
			if (this.remainingFrames === 0) this.syncPending = true;
		}
	}

	/**
	 * Finale Phase des Ticks: wendet den ausstehenden Hard-Sync an, falls die
	 * Wiedergabe abgelaufen ist. Läuft als letzter Mutations-Schritt, damit
	 * der `finalState` des TurnPackets nach dem Sync unverändert bleibt.
	 *
	 * Der Abschluss-Callback wird hier NICHT ausgelöst: `GameHandler.tick()`
	 * ruft nach allen `flush`-Hooks `drainCompletion()` auf, damit
	 * finalisierende Systeme (z.B. WinningSystem) zuerst den Turn-Endzustand
	 * abschließen können, bevor der Abschluss-Callback (Turn-Weiterleitung)
	 * entscheidet, ob der Zug noch fortgesetzt wird.
	 */
	flush(ctx: IGameContext) {
		if (!this.syncPending || this.finalState === undefined) return;
		this.applyHardSync(ctx.entities);
		this.completionPending = true;
		// The turn completed: transition to Playing_done here (final mutation
		// phase) so later flush hooks (e.g. WinningSystem) can finalize the
		// match against the authoritative final state before the completion
		// callback decides whether the next turn may start.
		if (ctx.state === GameState.Playing) ctx.state = GameState.Playing_done;
	}

	/**
	 * Feuert den Abschluss-Callback der Wiedergabe, nachdem ALLE
	 * `flush`-Hooks gelaufen sind (aufgerufen vom `GameHandler`).
	 */
	public drainCompletion(): void {
		if (!this.completionPending) return;
		this.completionPending = false;
		if (this.cb) this.cb();
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
		// NOTE: the completion callback is NOT fired here. `drainCompletion()`
		// fires it once after ALL flush hooks have run (called by the handler).
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

import { GameState } from "../engine/types";
import type { EntityManager } from "../entity/EntityManager";
import type { EntitySnapshot } from "../entity/types";
import type { IGameContext } from "./types";

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
	private finalState: EntitySnapshot[] | undefined;
	/** Ein optionaler Callback, der ausgeführt wird, wenn der Sync abgeschlossen ist. */
	private cb: (() => void) | undefined;

	/**
		 * Startet einen Wiedergabe-Countdown.
		 * @param frames - Dauer der Simulation in Frames.
		 * @param finalState - Die exakten Ziel-Daten (Position/Velocity) am Ende.
		 * @param cb - (Optional) Aktion nach Abschluss (z.B. UI einblenden).
		 */
	public start(frames: number, finalState: EntitySnapshot[], cb?: () => void) {
		this.finalState = finalState
		this.remainingFrames = frames;
		this.cb = cb;
	}

	/**
		 * Reduziert den Frame-Counter in jedem Tick.
		 * Sobald 0 erreicht ist, wird der Hard-Sync ausgelöst.
		 */
	tick(ctx: IGameContext) {
		if (ctx.state !== GameState.PLAYING) return
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

		const EPSILON = 0.01;

		this.finalState.forEach(saved => {
			const entity = entities.getEntityById(saved.id);
			if (!entity) return;

			const currentPos = entity.getPos();
			const dx = Math.abs(currentPos.x - saved.x);
			const dy = Math.abs(currentPos.y - saved.y);

			if (dx > EPSILON || dy > EPSILON) {
				console.log(`Sync Pos ${saved.id}: Δ${dx.toFixed(4)}`);
				entity.setPos({ x: saved.x, y: saved.y });
			}

			const currentVel = entity.getVel() ? entity.getVel() : { x: 0, y: 0 };

			const dvx = Math.abs(currentVel.x - saved.vx);
			const dvy = Math.abs(currentVel.y - saved.vy);

			if (dvx > EPSILON || dvy > EPSILON) {
				entity.setVel({ x: saved.vx, y: saved.vy });
			}
		});

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

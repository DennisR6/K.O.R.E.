import { GameState } from "../engine/types";
import type { EntityManager } from "../entity/EntityManager";
import type { EntitySnapshot } from "../entity/types";
import type { IGameContext } from "./types";

export class PlaybackSystem implements PlaybackSystem {
	private remainingFrames = 0;
	private finalState: EntitySnapshot[] | undefined
	private cb: (() => void) | undefined

	public start(frames: number, finalState: EntitySnapshot[], cb?: () => void) {
		this.finalState = finalState
		this.remainingFrames = frames;
		this.cb = cb;
	}


	update(ctx: IGameContext) {
		if (ctx.state !== GameState.SIMULATING && ctx.state !== GameState.PLAYING) return
		if (this.remainingFrames > 0)
			this.remainingFrames--;
		else if (this.finalState) {
			this.applyHardSync(ctx.entities);
		}
	}

	private applyHardSync(entities: EntityManager) {
		if (!this.finalState) return;

		const EPSILON = 0.01;

		this.finalState.forEach(saved => {
			const entity = entities.getEntityById(saved.id);
			if (!entity) return;

			// 1. Position Sync
			const currentPos = entity.getPos();
			const dx = Math.abs(currentPos.x - saved.x);
			const dy = Math.abs(currentPos.y - saved.y);

			if (dx > EPSILON || dy > EPSILON) {
				// Nur loggen, wenn wirklich gesynct wird
				console.log(`Sync Pos ${saved.id}: Δ${dx.toFixed(4)}`);
				entity.setPos({ x: saved.x, y: saved.y });
			}

			// 2. Velocity Sync
			// Prüfe, wie deine Methode genau heißt: getVel() 
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
	getRemainingFrames(): number {
		return this.remainingFrames
	}
}

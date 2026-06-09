import { LogEmitter } from "../emitter/InputEmitter.js";
import { GameState, type IInputEmitter } from "../engine/types.js";
import type { Vector2D } from "../physics/physics.js";
import type { IGameContext, ISystem } from "./types.js";

export class EmitterSystem implements ISystem {
	emitter: IInputEmitter
	constructor(em?: IInputEmitter) {
		if (em) this.emitter = em
		else this.emitter = new LogEmitter()

	}
	private getLocalInput(start: Vector2D, now: Vector2D): { angle: number, power: number } | undefined {
		const dx = now.x - start.x;
		const dy = now.y - start.y;
		const rawPower = Math.sqrt(dx * dx + dy * dy);

		if (rawPower < 5) return undefined;

		const DISTANCE_FOR_MAX_POWER = 100;

		const factor = Math.min(rawPower / DISTANCE_FOR_MAX_POWER, 1.0);

		const MAX_POWER_VALUE = 10;
		const power = factor * MAX_POWER_VALUE;

		let angleRad = Math.atan2(dy, dx);
		let angleDeg = angleRad * (180 / Math.PI);

		let finalAngle = angleDeg + 180;

		finalAngle = ((finalAngle % 360) + 360) % 360;

		return {
			angle: finalAngle,
			power: power
		};
	}


	ticker(ctx: IGameContext, _dt: number, _friction: number): void {
		if (ctx.state !== GameState.TURN_DONE) return
		const { start, end } = ctx.mouse
		const p = ctx.entities.getEntityAt(start.x, start.y)
		if (!p) throw new Error("SOMETHING WENT WRONG")
		const res = this.getLocalInput(start, end)
		if (!res) throw new Error("SOMETHING WENT WRONG")
		this.emitter.sendShot(p.getId(), res.angle, res.power)
		ctx.state = GameState.WAITING_FOR_SERVER
	}
}

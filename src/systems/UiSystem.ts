import type { IDrawer, RenderContext } from "../engine/RenderContext.js";
import { GameState, type IMouse } from "../engine/types.js";
import type { Vector2D } from "../physics/physics.js";
import type { IGameContext, ISystem } from "./types.js";

export interface IUiSystem extends ISystem, IDrawer, IMouse { }

export class UiSystem implements IUiSystem {
	start: Vector2D | null = null
	end: Vector2D | null = null
	currentMouse: Vector2D = { x: 0, y: 0 }
	constructor() { }

	private getLocalInput(start: Vector2D, now: Vector2D): { angle: number, power: number } | undefined {
		const dx = now.x - start.x;
		const dy = now.y - start.y;
		let rawPower = Math.sqrt(dx * dx + dy * dy);

		if (rawPower < 1) {
			console.trace("rawpower: ", rawPower, "is too low", dx, dy)
			return undefined
		}

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
		if (ctx.state !== GameState.Your_turn) return
		if (!this.start) return
		const actor = ctx.entities.getEntityAt(this.start.x, this.start.y)
		if (!actor) {
			this.start = null
			return
		}
		if (!this.end) return
		const e = this.getLocalInput(this.start, this.end)
		if (!e) {
			console.log("no input calculated")
			return
		}
		ctx.mouse.turn = { ...e, actorId: actor.getId() }
		ctx.state = GameState.Turn_done
		this.start = null
		this.end = null
	}
	draw(_ctx: RenderContext): void { }

	handleMouseWheel(event: WheelEvent): void {
		console.log(event)
	}

	handleMousePressed(): void {
		if (this.start) return
		this.start = { ...this.currentMouse }
	}

	handleMouseReleased(): void {
		if (this.end) return
		this.end = { ...this.currentMouse }
	}

	updateMouse(x: number, y: number): void {
		const pos = { x, y }
		this.currentMouse = { ...pos }
	}
}

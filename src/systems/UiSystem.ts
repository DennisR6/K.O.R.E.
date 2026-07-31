import type { IDrawer, RenderContext } from "../engine/RenderContext.js";
import { GameState, type IMouse } from "../engine/types.js";
import type { Vector2D } from "../physics/physics.js";
import type { IGameContext, ISystem } from "./types.js";

export interface IUiSystem extends ISystem, IDrawer, IMouse { }

export class UiSystem implements IUiSystem {
	private static readonly MIN_DRAG_DISTANCE = 8
	start: Vector2D | null = null
	end: Vector2D | null = null
	currentMouse: Vector2D = { x: 0, y: 0 }
	aimAngle: number | null = null
	chargePower: number | null = null
	selectedActorId: string | null = null

	constructor() { }

	private getLocalInput(start: Vector2D, now: Vector2D): { angle: number, power: number } | undefined {
		const dx = now.x - start.x;
		const dy = now.y - start.y;
		let rawPower = Math.sqrt(dx * dx + dy * dy);

		if (rawPower < UiSystem.MIN_DRAG_DISTANCE) {
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

	public setAimAngle(actorId: string, angle: number): void {
		if (!actorId || !Number.isFinite(angle)) throw new Error("Actor and aim angle must be valid");
		this.selectedActorId = actorId;
		this.aimAngle = ((angle % 360) + 360) % 360;
	}

	public setChargePower(power: number): void {
		if (!Number.isFinite(power) || power < 0) throw new Error("Power must be a non-negative finite number");
		this.chargePower = Math.min(power, 10);
	}

	ticker(ctx: IGameContext, _dt: number, _friction: number): void {
		if (ctx.state !== GameState.Your_turn) {
			this.clearInput()
			this.clearAimAndCharge()
			return
		}

		if (this.aimAngle !== null && this.chargePower !== null && this.selectedActorId !== null) {
			const actor = ctx.entities.getEntityById(this.selectedActorId);
			if (actor && !actor.isDead() && (actor.getTeam().length === 0 || actor.getTeam().includes(ctx.activeTeam))) {
				actor.setRotation(this.aimAngle);
				ctx.mouse.turn = { actorId: this.selectedActorId, angle: this.aimAngle, power: this.chargePower };
				ctx.state = GameState.Turn_done;
				this.clearAimAndCharge();
				this.clearInput();
				return;
			}
			this.clearAimAndCharge();
		}

		if (!this.start) return
		const actor = ctx.entities.getEntityAt(this.start.x, this.start.y)
		if (!actor || (actor.getTeam().length > 0 && !actor.getTeam().includes(ctx.activeTeam))) {
			this.clearInput()
			return
		}
		if (!this.end) return
		const e = this.getLocalInput(this.start, this.end)
		if (!e) {
			this.clearInput()
			return
		}
		actor.setRotation(e.angle);
		ctx.mouse.turn = { ...e, actorId: actor.getId() }
		ctx.state = GameState.Turn_done
		this.clearInput()
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
		if (!this.start || this.end) return
		this.end = { ...this.currentMouse }
	}

	updateMouse(x: number, y: number): void {
		const pos = { x, y }
		this.currentMouse = { ...pos }
	}

	private clearInput(): void {
		this.start = null
		this.end = null
	}

	private clearAimAndCharge(): void {
		this.aimAngle = null;
		this.chargePower = null;
		this.selectedActorId = null;
	}
}

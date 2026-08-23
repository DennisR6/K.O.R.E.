import type { IDrawer, RenderContext } from "../kore/runtime/RenderContext.js";
import { GameState, type IMouse } from "../kore/runtime/types.js";
import type { Vector2D } from "@coffeemakerstudio/bean";
import type { IGameContext, ISerializableSystem, SystemSettings } from "./types.js";
import { isValidInput } from "../input/validate.js";
import { KoreInputCommand, type KoreInputMessage, validateKoreInputMessage } from "../kore/sdk/input.js";

export interface IUiSystem extends ISerializableSystem, IDrawer, IMouse { }

export class UiSystem implements IUiSystem {
	public readonly systemId = "ui.pointer-input";
	private static readonly MIN_DRAG_DISTANCE = 8
	private static readonly DESKTOP_SELECTION_PADDING = 6
	private static readonly TOUCH_SELECTION_PADDING = 14
	private selectionPadding = UiSystem.DESKTOP_SELECTION_PADDING
	start: Vector2D | null = null
	end: Vector2D | null = null
	currentMouse: Vector2D = { x: 0, y: 0 }
	aimAngle: number | null = null
	chargePower: number | null = null
	selectedActorId: string | null = null
	private pointerActive = false

	constructor() { }
	public toSettings(): SystemSettings { return { systemId: this.systemId, schemaVersion: 1, state: { start: this.start, end: this.end, currentMouse: this.currentMouse, aimAngle: this.aimAngle, chargePower: this.chargePower, selectedActorId: this.selectedActorId } }; }

	private getLocalInput(start: Vector2D, now: Vector2D): { angle: number, power: number } | undefined {
		if (![start.x, start.y, now.x, now.y].every(Number.isFinite)) return undefined;
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

	/** Enlarges only the initial actor hit target for coarse touch input. */
	public setTouchMode(enabled: boolean): void {
		this.selectionPadding = enabled ? UiSystem.TOUCH_SELECTION_PADDING : UiSystem.DESKTOP_SELECTION_PADDING;
	}

	/** True only while the current pointer/touch drag is held. */
	public isPointerActive(): boolean { return this.pointerActive; }

	/** Consumes validated semantic pointer commands from browser/touch adapters. */
	public dispatchInput(message: KoreInputMessage): void {
		validateKoreInputMessage(message);
		if (message.command === KoreInputCommand.PointerDown) {
			this.updateMouse(message.payload.x, message.payload.y);
			this.handleMousePressed();
		} else if (message.command === KoreInputCommand.PointerMove) {
			this.updateMouse(message.payload.x, message.payload.y);
		} else if (message.command === KoreInputCommand.PointerUp) {
			this.updateMouse(message.payload.x, message.payload.y);
			this.handleMouseReleased();
		}
	}

	ticker(ctx: IGameContext, _dt: number, _friction: number): void {
		if (ctx.state !== GameState.Your_turn) {
			this.clearInput()
			this.clearAimAndCharge()
			return
		}

		if (this.aimAngle !== null && this.chargePower !== null && this.selectedActorId !== null) {
			const actor = ctx.entities.getEntityById(this.selectedActorId);
			if (actor && !actor.isDead() && actor.isActorEligible() && (actor.getTeam().length === 0 || actor.getTeam().includes(ctx.activeTeam))) {
				const input = { actorId: this.selectedActorId, angle: this.aimAngle, power: this.chargePower };
				if (!isValidInput(input)) {
					this.clearAimAndCharge();
					return;
				}
				actor.setRotation(input.angle);
				ctx.mouse.turn = input;
				ctx.state = GameState.Turn_done;
				this.clearAimAndCharge();
				this.clearInput();
				return;
			}
			this.clearAimAndCharge();
		}

		if (!this.start) return
		const actor = ctx.entities.getEntityAt(this.start.x, this.start.y, this.selectionPadding)
		if (!actor || actor.isDead() || !actor.isActorEligible() || (actor.getTeam().length > 0 && !actor.getTeam().includes(ctx.activeTeam))) {
			this.clearInput()
			return
		}
		if (!this.end) return
		const e = this.getLocalInput(this.start, this.end)
		if (!e) {
			this.clearInput()
			return
		}
		const input = { ...e, actorId: actor.getId() };
		if (!isValidInput(input)) {
			this.clearInput();
			return;
		}
		actor.setRotation(input.angle);
		ctx.mouse.turn = input
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
		this.pointerActive = true
	}

	handleMouseReleased(): void {
		if (!this.start || this.end) return
		this.end = { ...this.currentMouse }
		this.pointerActive = false
	}

	updateMouse(x: number, y: number): void {
		if (!Number.isFinite(x) || !Number.isFinite(y)) return;
		const pos = { x, y }
		this.currentMouse = { ...pos }
	}

	public cancelInput(): void {
		this.clearInput();
		this.clearAimAndCharge();
	}

	private clearInput(): void {
		this.start = null
		this.end = null
		this.pointerActive = false
	}

	private clearAimAndCharge(): void {
		this.aimAngle = null;
		this.chargePower = null;
		this.selectedActorId = null;
	}
}

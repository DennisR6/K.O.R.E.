import { ItemEffectType, type ItemEffectSettings } from "./types.js";

export interface TemporaryWallValue {
	wallId: string;
	x: number;
	y: number;
	w: number;
	h: number;
	color?: string;
	durationTurns: number;
	remainingTurns?: number;
	active?: boolean;
}

export interface TemporaryWallState {
	wallId: string;
	x: number;
	y: number;
	w: number;
	h: number;
	color?: string;
}

/** A serializable temporary rectangle wall with deterministic cleanup timing. */
export class EffectTemporaryWall {
	public readonly wallId: string;
	public readonly x: number;
	public readonly y: number;
	public readonly w: number;
	public readonly h: number;
	public readonly color: string | undefined;
	public readonly durationTurns: number;
	private remainingTurns: number;
	private active: boolean;

	public constructor(settings: { typeValue: TemporaryWallValue }) {
		const value = settings.typeValue;
		if (typeof value.wallId !== "string" || value.wallId.length === 0) throw new Error("temporaryWall requires a non-empty wallId");
		if (![value.x, value.y].every(Number.isFinite) || ![value.w, value.h].every(Number.isFinite) || value.w <= 0 || value.h <= 0) throw new Error("temporaryWall requires finite position and positive dimensions");
		if (!Number.isSafeInteger(value.durationTurns) || value.durationTurns < 1) throw new Error("temporaryWall durationTurns must be a positive integer");
		const remainingTurns = value.remainingTurns ?? value.durationTurns;
		if (!Number.isSafeInteger(remainingTurns) || remainingTurns < 0 || remainingTurns > value.durationTurns) throw new Error("temporaryWall remainingTurns must be between zero and durationTurns");
		if (typeof value.active !== "undefined" && typeof value.active !== "boolean") throw new Error("temporaryWall active must be boolean");
		this.wallId = value.wallId;
		this.x = value.x;
		this.y = value.y;
		this.w = value.w;
		this.h = value.h;
		this.color = value.color;
		this.durationTurns = value.durationTurns;
		this.remainingTurns = remainingTurns;
		this.active = value.active ?? false;
	}

	public spawn(): TemporaryWallState {
		this.active = true;
		this.remainingTurns = this.durationTurns;
		return this.toWallState();
	}

	/** Advances one turn; returns true exactly when the wall must be removed. */
	public advanceTurn(): boolean {
		if (!this.active) return false;
		if (this.remainingTurns > 0) this.remainingTurns--;
		if (this.remainingTurns !== 0) return false;
		this.active = false;
		return true;
	}

	public isActive(): boolean { return this.active; }
	public getRemainingTurns(): number { return this.remainingTurns; }
	public toWallState(): TemporaryWallState { return { wallId: this.wallId, x: this.x, y: this.y, w: this.w, h: this.h, ...(this.color === undefined ? {} : { color: this.color }) }; }

	public toSettings(): ItemEffectSettings {
		return { type: ItemEffectType.TemporaryWall, typeValue: { wallId: this.wallId, x: this.x, y: this.y, w: this.w, h: this.h, ...(this.color === undefined ? {} : { color: this.color }), durationTurns: this.durationTurns, remainingTurns: this.remainingTurns, active: this.active } };
	}
}

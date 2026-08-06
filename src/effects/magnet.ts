import { ItemEffectType, type ItemEffectSettings } from "./types.js";
import type { Vector2D } from "../physics/physics.js";

export type MagnetMode = "attract" | "repel";

export interface MagnetValue {
	mode: MagnetMode;
	force: number;
	range: number;
}

/** A serializable, range-limited attraction or repulsion effect. */
export class EffectMagnet {
	public readonly mode: MagnetMode;
	public readonly force: number;
	public readonly range: number;

	public constructor(settings: { typeValue: MagnetValue }) {
		const { mode, force, range } = settings.typeValue;
		if (mode !== "attract" && mode !== "repel") throw new Error("magnet mode must be attract or repel");
		if (!Number.isFinite(force) || force < 0) throw new Error("magnet force must be finite and non-negative");
		if (!Number.isFinite(range) || range <= 0) throw new Error("magnet range must be finite and positive");
		this.mode = mode;
		this.force = force;
		this.range = range;
	}

	public calculateDelta(source: Vector2D, target: Vector2D): Vector2D {
		validateVector(source);
		validateVector(target);
		const dx = target.x - source.x;
		const dy = target.y - source.y;
		const distance = Math.hypot(dx, dy);
		if (distance === 0 || distance > this.range) return { x: 0, y: 0 };
		const direction = this.mode === "attract" ? 1 : -1;
		return { x: normalizeZero((dx / distance) * this.force * direction), y: normalizeZero((dy / distance) * this.force * direction) };
	}

	public applyToVelocity(velocity: Vector2D, source: Vector2D, target: Vector2D): Vector2D {
		validateVector(velocity);
		const delta = this.calculateDelta(source, target);
		return { x: velocity.x + delta.x, y: velocity.y + delta.y };
	}

	public toSettings(): ItemEffectSettings {
		return { type: ItemEffectType.Magnet, typeValue: { mode: this.mode, force: this.force, range: this.range } };
	}
}

function validateVector(value: Vector2D): void {
	if (!Number.isFinite(value.x) || !Number.isFinite(value.y)) throw new Error("Magnet vectors must be finite");
}

function normalizeZero(value: number): number { return Object.is(value, -0) ? 0 : value; }

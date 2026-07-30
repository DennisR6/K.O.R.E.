import { ItemEffectType, type ItemEffectSettings } from "./types.js";
import type { Vector2D } from "../physics/physics.js";

export interface PositionTargetState {
	id: string;
	position: Vector2D;
	active: boolean;
}

/** Serializable, data-only teleport/swap primitive for validated entity targets. */
export class EffectSwapPosition {
	public toSettings(): ItemEffectSettings {
		return { type: ItemEffectType.SwapPosition, typeValue: {} };
	}

	public swap(first: PositionTargetState, second: PositionTargetState): [Vector2D, Vector2D] {
		validateTarget(first);
		validateTarget(second);
		if (first.id === second.id) throw new Error("Cannot swap an entity with itself");
		return [{ ...second.position }, { ...first.position }];
	}

	public teleport(target: PositionTargetState, destination: Vector2D): Vector2D {
		validateTarget(target);
		if (!isVector(destination)) throw new Error("Teleport destination must have finite coordinates");
		return { ...destination };
	}
}

function validateTarget(target: PositionTargetState): void {
	if (typeof target.id !== "string" || target.id.length === 0) throw new Error("Position target requires a non-empty id");
	if (!target.active) throw new Error("Position target must be active");
	if (!isVector(target.position)) throw new Error("Position target must have finite coordinates");
}

function isVector(value: unknown): value is Vector2D {
	return typeof value === "object" && value !== null &&
		typeof (value as Vector2D).x === "number" && Number.isFinite((value as Vector2D).x) &&
		typeof (value as Vector2D).y === "number" && Number.isFinite((value as Vector2D).y);
}

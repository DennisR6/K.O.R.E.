import { SeededRandom } from "../utils/random.js";
import { ItemEffectType, type ForceInput, type ItemEffectSettings } from "./types.js";

export interface AimVarianceValue {
	maxVarianceDegrees: number;
	seed?: number;
	randomState?: number;
}

/** A serializable effect that introduces seeded deterministic aim variance to shot forces. */
export class EffectAimVariance {
	public readonly maxVarianceDegrees: number;
	private random: SeededRandom;

	public constructor(settings: { typeValue: AimVarianceValue }) {
		const { maxVarianceDegrees, seed = 1337, randomState } = settings.typeValue;
		if (!Number.isFinite(maxVarianceDegrees) || maxVarianceDegrees < 0) {
			throw new Error("aimVariance maxVarianceDegrees must be a finite non-negative number");
		}
		this.maxVarianceDegrees = maxVarianceDegrees;
		this.random = randomState !== undefined ? SeededRandom.fromState(randomState) : new SeededRandom(seed);
	}

	public applyToForce(force: ForceInput): ForceInput {
		if (!Number.isFinite(force.angle) || !Number.isFinite(force.power) || force.power < 0) {
			throw new Error("Force input must have a finite angle and non-negative power");
		}
		const rnd = this.random.next();
		const offset = (rnd * 2 - 1) * this.maxVarianceDegrees;
		return {
			angle: normalizeAngle(force.angle + offset),
			power: force.power,
		};
	}

	public toSettings(): ItemEffectSettings {
		return {
			type: ItemEffectType.AimVariance,
			typeValue: {
				maxVarianceDegrees: this.maxVarianceDegrees,
				randomState: this.random.getState(),
			},
		};
	}
}

function normalizeAngle(angle: number): number {
	return ((angle % 360) + 360) % 360;
}

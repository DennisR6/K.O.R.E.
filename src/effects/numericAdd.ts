import type { IPhysics, SHAPE } from "@coffeemakerstudio/bean";
import { EffectType, type Effect, type EffectSettings } from "./types.js";

/** Trigger-relative numeric.add adapter; mutation and thresholds remain NumericSystem-owned. */
export class EffectNumericAdd implements Effect {
	private readonly stateId: string;
	private readonly amount: number;
	public constructor({ typeValue }: { typeValue: { stateId: string; amount: number } }) { this.stateId = typeValue.stateId; this.amount = typeValue.amount; }
	public apply(entity: IPhysics<SHAPE>): void {
		if (!("getNumericValue" in entity)) return;
		if (!("dispatchNumericAdd" in entity) || typeof entity.dispatchNumericAdd !== "function") throw new Error("numeric.add requires an attached numeric effect dispatcher");
		entity.dispatchNumericAdd(this.stateId, this.amount);
	}
	public getType(): EffectType { return EffectType.NumericAdd; }
	public toSettings(): EffectSettings { return { schemaVersion: 1, type: EffectType.NumericAdd, typeValue: { stateId: this.stateId, amount: this.amount } }; }
}

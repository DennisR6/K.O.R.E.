import { canonicalizeCounterStates, type CounterState } from "../engine/contracts/counterState.js";
import { validateCounterEffectSettings, type CounterEffectSettings } from "../engine/sdk/counterCapability.js";
import type { IGameContext, ISerializableSystem, SystemSettings } from "./types.js";

/** Trusted interpreter for declarative numeric counter mutations. */
export class CounterSystem implements ISerializableSystem<SystemSettings> {
	public readonly systemId = "core.counter";

	public toSettings(): SystemSettings {
		return { systemId: this.systemId, schemaVersion: 1, state: {} };
	}

	public ticker(_ctx: IGameContext, _dt: number, _friction: number): void { }

	/** Applies one validated command to the canonical world counter collection. */
	public apply(ctx: IGameContext, effect: CounterEffectSettings): void {
		validateCounterEffectSettings(effect);
		const counter = ctx.counters.find(candidate => candidate.id === effect.target.counterId);
		if (!counter) throw new Error(`Unknown counter target '${effect.target.counterId}'`);
		if (effect.type === "counter.set") counter.value = effect.typeValue.value;
		else if (effect.type === "counter.add") counter.value += effect.typeValue.amount;
		else counter.value = 0;
		if (!Number.isFinite(counter.value)) throw new Error("Counter mutation produced a non-finite value");
	}

	/** Returns detached canonical state for a stable counter identity. */
	public read(ctx: IGameContext, counterId: string): CounterState {
		const counter = ctx.counters.find(candidate => candidate.id === counterId);
		if (!counter) throw new Error(`Unknown counter target '${counterId}'`);
		return { ...counter };
	}

	/** Normalizes the context collection without retaining a parallel runtime store. */
	public normalize(ctx: IGameContext): void {
		const counters = canonicalizeCounterStates(ctx.counters);
		ctx.counters.splice(0, ctx.counters.length, ...counters);
	}
}

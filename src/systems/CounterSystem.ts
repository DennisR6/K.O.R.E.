import { canonicalizeCounterStates, type CounterState } from "@coffeemakerstudio/roast";
import { counterTriggerMatches, validateCounterEffectSettings, type CounterEffectSettings, type CounterTriggerBinding } from "@coffeemakerstudio/roast";
import type { EngineTriggerEvent } from "@coffeemakerstudio/roast";
import { EngineTriggerActivationQueue, createTriggerActivation } from "@coffeemakerstudio/roast";
import type { EngineEffectSettings } from "@coffeemakerstudio/roast";
import { COUNTER_EFFECT_IDS } from "@coffeemakerstudio/roast";
import type { IGameContext, IPredefinedEffectSystem, ResolvedPredefinedTarget, SystemSettings } from "./types.js";

/** Trusted interpreter for declarative numeric counter mutations. */
export class CounterSystem implements IPredefinedEffectSystem {
	public readonly systemId = "core.counter";

	public toSettings(): SystemSettings {
		return { systemId: this.systemId, schemaVersion: 1, state: {} };
	}

	public ticker(_ctx: IGameContext, _dt: number, _friction: number): void { }
	public acceptsEffect(effectId: string): boolean { return COUNTER_EFFECT_IDS.includes(effectId as typeof COUNTER_EFFECT_IDS[number]); }
	public applyEffect(ctx: IGameContext, effect: EngineEffectSettings, target: ResolvedPredefinedTarget): void {
		if (target.type !== "counter") throw new Error("Counter effect requires a counter target");
		this.apply(ctx, effect as unknown as CounterEffectSettings);
	}

	/** Applies one validated command to the canonical world counter collection. */
	public apply(ctx: IGameContext, effect: CounterEffectSettings): void {
		validateCounterEffectSettings(effect);
		const counter = ctx.counters.find(candidate => candidate.id === effect.target.counterId);
		if (!counter) throw new Error(`Unknown counter target '${effect.target.counterId}'`);
		const nextValue = effect.type === "counter.set"
			? effect.typeValue.value
			: effect.type === "counter.add"
				? counter.value + effect.typeValue.amount
				: 0;
		if (!Number.isFinite(nextValue)) throw new Error("Counter mutation produced a non-finite value");
		counter.value = nextValue;
	}

	/** Applies an ordered declarative family, equivalent to a generic MultiEffect. */
	public applyEffects(ctx: IGameContext, effects: readonly CounterEffectSettings[]): void {
		effects.forEach(effect => this.apply(ctx, effect));
	}

	/** Applies only bindings whose declarative trigger matches the validated event. */
	public applyTriggered(ctx: IGameContext, bindings: readonly CounterTriggerBinding[], event: EngineTriggerEvent): void {
		const queue = new EngineTriggerActivationQueue(Math.max(1, bindings.length));
		bindings.forEach((binding, index) => {
			if (counterTriggerMatches(binding, event)) queue.enqueue(createTriggerActivation({ effectId: `counter-binding-${index}`, event }));
		});
		queue.process(activation => {
			const index = Number(activation.effectId.slice("counter-binding-".length));
			const binding = bindings[index];
			if (!binding) throw new Error("Counter trigger activation binding is out of range");
			this.apply(ctx, binding.effect);
		});
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

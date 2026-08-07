import { EngineTriggerActivationQueue, createCollisionEnterTriggerEvent, createEnvironmentActivationTriggerEvent, createRoundStartTriggerEvent, createTickTriggerEvent, type EngineTriggerEvent } from "../engine/sdk/trigger.js";
import type { Effect } from "./types.js";

/** Internal bridge from legacy trigger lists to detached, bounded activations. */
export function dispatchTriggeredEffects(options: {
	effects: readonly Effect[];
	event: EngineTriggerEvent;
	apply: (effect: Effect, event: EngineTriggerEvent) => void;
}): void {
	if (options.effects.length === 0) return;
	const queue = new TrustedTriggerActivationQueue(Math.max(1, options.effects.length));
	for (const [index, effect] of options.effects.entries()) {
		queue.enqueueTrusted({ schemaVersion: 1, effectId: `${effect.getType()}#${index}`, event: options.event });
	}
	let index = 0;
	queue.process(activation => {
		const effect = options.effects[index++];
		if (!effect) throw new Error("Trigger activation effect index is out of range");
		options.apply(effect, activation.event);
	});
}

class TrustedTriggerActivationQueue extends EngineTriggerActivationQueue {
	public enqueueTrusted(activation: Parameters<EngineTriggerActivationQueue["enqueue"]>[0]): void {
		this.enqueueValidated(activation);
	}
}

export function createTickEvent(sourceId: string, dt: number): EngineTriggerEvent {
	return createTickTriggerEvent({ sourceId, sequence: 0, dt });
}

export function createCollisionEnterEvent(sourceId: string, entityId: string, otherId: string, contactKey: string): EngineTriggerEvent {
	return createCollisionEnterTriggerEvent({ sourceId, sequence: 0, entityId, otherId, contactKey });
}

export function createRoundStartEvent(sourceId: string, turnNumber: number, activeTeam: number, phase: string): EngineTriggerEvent {
	return createRoundStartTriggerEvent({ sourceId, sequence: turnNumber, turnNumber, activeTeam, phase });
}

export function createEnvironmentActivationEvent(sourceId: string, sequence: number, mechanicId: string, mechanicIndex: number, tick: number, active: boolean): EngineTriggerEvent {
	return createEnvironmentActivationTriggerEvent({ sourceId, sequence, mechanicId, mechanicIndex, tick, active });
}

export function dispatchTriggerActivation(options: { effectId: string; event: EngineTriggerEvent; apply: (event: EngineTriggerEvent) => void }): void {
	const queue = new TrustedTriggerActivationQueue(1);
	queue.enqueueTrusted({ schemaVersion: 1, effectId: options.effectId, event: options.event });
	queue.process(activation => options.apply(activation.event));
}

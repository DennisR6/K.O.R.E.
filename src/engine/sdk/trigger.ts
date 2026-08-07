export const ENGINE_TRIGGER_SCHEMA_VERSION = 1 as const;

export type EngineTriggerType = "tick" | "collision.enter";

export interface EngineTickTriggerEvent {
	schemaVersion: 1;
	type: "tick";
	sourceId: string;
	sequence: number;
	payload: { dt: number };
}

export interface EngineCollisionEnterTriggerEvent {
	schemaVersion: 1;
	type: "collision.enter";
	sourceId: string;
	sequence: number;
	payload: { entityId: string; otherId: string; contactKey: string };
}

export type EngineTriggerEvent = EngineTickTriggerEvent | EngineCollisionEnterTriggerEvent;

export interface EngineTriggerActivation {
	schemaVersion: 1;
	effectId: string;
	event: EngineTriggerEvent;
}

export class EngineTriggerActivationQueue {
	private readonly pending: EngineTriggerActivation[] = [];
	private processed = 0;

	public constructor(private readonly maxActivations: number = 1024) {
		if (!Number.isSafeInteger(maxActivations) || maxActivations < 1) throw new Error("Trigger activation budget must be a positive safe integer");
	}

	public enqueue(activation: EngineTriggerActivation): void {
		validateTriggerActivation(activation);
		this.enqueueValidated(activation);
	}

	/** Internal fast path for activations already created by a validated event bridge. */
	protected enqueueValidated(activation: EngineTriggerActivation): void {
		if (this.pending.length + this.processed >= this.maxActivations) throw new Error("Trigger activation budget exceeded");
		this.pending.push(activation);
	}

	/** Processes FIFO activations through trusted host code, never content callbacks. */
	public process(dispatch: (activation: EngineTriggerActivation) => void): number {
		if (typeof dispatch !== "function") throw new Error("Trigger dispatcher must be a function");
		let processedNow = 0;
		while (this.pending.length > 0) {
			const activation = this.pending.shift()!;
			this.processed++;
			processedNow++;
			dispatch(structuredClone(activation));
		}
		return processedNow;
	}

	public pendingCount(): number { return this.pending.length; }
}

export function createTickTriggerEvent(input: { sourceId: string; sequence: number; dt: number }): EngineTickTriggerEvent {
	const event: EngineTickTriggerEvent = { schemaVersion: 1, type: "tick", sourceId: input.sourceId, sequence: input.sequence, payload: { dt: input.dt } };
	validateTriggerEvent(event);
	return structuredClone(event);
}

export function createCollisionEnterTriggerEvent(input: { sourceId: string; sequence: number; entityId: string; otherId: string; contactKey: string }): EngineCollisionEnterTriggerEvent {
	const event: EngineCollisionEnterTriggerEvent = {
		schemaVersion: 1,
		type: "collision.enter",
		sourceId: input.sourceId,
		sequence: input.sequence,
		payload: { entityId: input.entityId, otherId: input.otherId, contactKey: input.contactKey },
	};
	validateTriggerEvent(event);
	return structuredClone(event);
}

export function createTriggerActivation(input: { effectId: string; event: EngineTriggerEvent }): EngineTriggerActivation {
	const activation: EngineTriggerActivation = { schemaVersion: 1, effectId: input.effectId, event: structuredClone(input.event) };
	validateTriggerActivation(activation);
	return structuredClone(activation);
}

export function validateTriggerActivation(value: unknown): asserts value is EngineTriggerActivation {
	const activation = record(value, "Trigger activation");
	exactKeys(activation, ["schemaVersion", "effectId", "event"], "Trigger activation");
	if (activation.schemaVersion !== 1) throw new Error("Unsupported Trigger activation schema version");
	string(activation.effectId, "Trigger activation effectId");
	validateTriggerEvent(activation.event);
}

export function validateTriggerEvent(value: unknown): asserts value is EngineTriggerEvent {
	const event = record(value, "Trigger event");
	exactKeys(event, ["schemaVersion", "type", "sourceId", "sequence", "payload"], "Trigger event");
	if (event.schemaVersion !== 1) throw new Error("Unsupported Trigger event schema version");
	string(event.sourceId, "Trigger event sourceId");
	safeSequence(event.sequence, "Trigger event sequence");
	if (event.type === "tick") {
		const payload = record(event.payload, "Tick trigger payload");
		exactKeys(payload, ["dt"], "Tick trigger payload");
		finiteNonNegative(payload.dt, "Tick trigger dt");
		return;
	}
	if (event.type === "collision.enter") {
		const payload = record(event.payload, "Collision trigger payload");
		exactKeys(payload, ["entityId", "otherId", "contactKey"], "Collision trigger payload");
		string(payload.entityId, "Collision trigger entityId");
		string(payload.otherId, "Collision trigger otherId");
		string(payload.contactKey, "Collision trigger contactKey");
		return;
	}
	throw new Error(`Unknown Trigger event type '${String(event.type)}'`);
}

function record(value: unknown, label: string): Record<string, unknown> {
	if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error(`${label} must be an object`);
	return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[], label: string): void {
	const allowed = new Set(keys);
	for (const key of Object.keys(value)) if (!allowed.has(key)) throw new Error(`${label} contains unknown field '${key}'`);
	for (const key of keys) if (!(key in value)) throw new Error(`${label} is missing '${key}'`);
}

function string(value: unknown, label: string): asserts value is string {
	if (typeof value !== "string" || value.length === 0) throw new Error(`${label} must be a non-empty string`);
}

function safeSequence(value: unknown, label: string): asserts value is number {
	if (!Number.isSafeInteger(value) || (value as number) < 0) throw new Error(`${label} must be a non-negative safe integer`);
}

function finiteNonNegative(value: unknown, label: string): asserts value is number {
	if (typeof value !== "number" || !Number.isFinite(value) || value < 0) throw new Error(`${label} must be a finite non-negative number`);
}

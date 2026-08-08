import { assertJsonValue, type JsonValue } from "./systemSettings.js";

export const ACTION_MODIFIER_SCHEMA_VERSION = 1 as const;

export interface AcceptedForceInput {
	angle: number;
	power: number;
}

/** Generic entity-owned modifier applied to one or more accepted actions. */
export interface ActionModifierSettings {
	schemaVersion: typeof ACTION_MODIFIER_SCHEMA_VERSION;
	id: string;
	action: "force";
	operation: "scale";
	factor: number;
	remainingUses: number;
	sourceId?: string;
	sourceOrder?: number;
}

export interface ActionModifierTemplate {
	action: "force";
	operation: "scale";
	factor: number;
}

export function createActionModifierTemplate(input: ActionModifierTemplate): ActionModifierTemplate {
	const template = structuredClone(input);
	if (template.action !== "force" || template.operation !== "scale") throw new Error("Unsupported action modifier operation");
	validateFactor(template.factor);
	return template;
}

export function createActionModifier(input: Omit<ActionModifierSettings, "schemaVersion" | "remainingUses"> & { remainingUses?: number }): ActionModifierSettings {
	const modifier: ActionModifierSettings = {
		schemaVersion: ACTION_MODIFIER_SCHEMA_VERSION,
		id: input.id,
		action: input.action,
		operation: input.operation,
		factor: input.factor,
		remainingUses: input.remainingUses ?? 1,
		...(input.sourceId === undefined ? {} : { sourceId: input.sourceId }),
		...(input.sourceOrder === undefined ? {} : { sourceOrder: input.sourceOrder }),
	};
	validateActionModifier(modifier);
	return modifier;
}

export function applyActionModifiers(input: AcceptedForceInput, modifiers: readonly ActionModifierSettings[]): AcceptedForceInput {
	validateAcceptedForceInput(input);
	if (modifiers.length === 0) return { angle: normalizeAngle(input.angle), power: input.power };
	return [...modifiers]
		.sort(compareModifiers)
		.reduce((current, modifier) => {
			validateActionModifier(modifier);
			if (modifier.action !== "force" || modifier.operation !== "scale") return current;
			return { angle: current.angle, power: current.power * modifier.factor };
		}, { angle: normalizeAngle(input.angle), power: input.power });
}

export function consumeActionModifiers(modifiers: readonly ActionModifierSettings[]): ActionModifierSettings[] {
	return [...modifiers]
		.sort(compareModifiers)
		.flatMap(modifier => {
			validateActionModifier(modifier);
			if (modifier.remainingUses <= 1) return [];
			return [{ ...structuredClone(modifier), remainingUses: modifier.remainingUses - 1 }];
		});
}

export function validateActionModifier(value: unknown): asserts value is ActionModifierSettings {
	if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Action modifier must be an object");
	const modifier = value as Partial<ActionModifierSettings>;
	if (modifier.schemaVersion !== ACTION_MODIFIER_SCHEMA_VERSION) throw new Error("Unsupported action modifier schema version");
	if (typeof modifier.id !== "string" || modifier.id.length === 0) throw new Error("Action modifier requires a stable id");
	if (modifier.action !== "force" || modifier.operation !== "scale") throw new Error("Unsupported action modifier operation");
	validateFactor(modifier.factor);
	if (!Number.isSafeInteger(modifier.remainingUses) || (modifier.remainingUses as number) < 1) throw new Error("Action modifier remaining uses must be a positive integer");
	if (modifier.sourceId !== undefined && (typeof modifier.sourceId !== "string" || modifier.sourceId.length === 0)) throw new Error("Action modifier sourceId must be non-empty");
	if (modifier.sourceOrder !== undefined && !Number.isSafeInteger(modifier.sourceOrder)) throw new Error("Action modifier sourceOrder must be a safe integer");
	assertJsonValue(modifier as unknown as JsonValue);
}

function validateFactor(value: unknown): asserts value is number {
	if (typeof value !== "number" || !Number.isFinite(value) || value < 0) throw new Error("Action modifier factor must be a finite non-negative number");
}

function validateAcceptedForceInput(input: AcceptedForceInput): void {
	if (!Number.isFinite(input.angle) || !Number.isFinite(input.power) || input.power < 0) throw new Error("Accepted force input must have a finite angle and non-negative power");
}

function compareModifiers(first: ActionModifierSettings, second: ActionModifierSettings): number {
	return (first.sourceOrder ?? 0) - (second.sourceOrder ?? 0) || first.id.localeCompare(second.id);
}

function normalizeAngle(angle: number): number { return ((angle % 360) + 360) % 360; }

import type { JsonValue } from "@coffeemakerstudio/roast";

export enum KoreInputAction { Aim = "aim", Charge = "charge", Push = "push", ItemUse = "itemUse" }
export enum KoreInputCommand { PointerDown = "kore.input.pointer-down", PointerMove = "kore.input.pointer-move", PointerUp = "kore.input.pointer-up", ActionPressed = "kore.input.action-pressed", ItemUse = "kore.input.item-use", Menu = "kore.input.menu" }

export interface KoreInputBindingDetail { keys: string[]; mouseButtons?: number[]; gamepadButtons?: number[] }
export interface KoreInputBindings { schemaVersion: 1; bindings: Record<KoreInputAction, KoreInputBindingDetail> }
export type KoreInputMessage =
	| { command: KoreInputCommand.PointerDown; payload: { x: number; y: number } }
	| { command: KoreInputCommand.PointerMove; payload: { x: number; y: number } }
	| { command: KoreInputCommand.PointerUp; payload: { x: number; y: number } }
	| { command: KoreInputCommand.ActionPressed; payload: { action: KoreInputAction } }
	| { command: KoreInputCommand.ItemUse; payload: { actorId: string; itemId: string; target: JsonValue } }
	| { command: KoreInputCommand.Menu; payload: { action: string } };

export function createDefaultKoreInputBindings(): KoreInputBindings {
	return { schemaVersion: 1, bindings: {
		[KoreInputAction.Aim]: { keys: ["ArrowLeft", "ArrowRight", "KeyA", "KeyD"], mouseButtons: [0], gamepadButtons: [14, 15] },
		[KoreInputAction.Charge]: { keys: ["Space", "ArrowUp", "KeyW"], gamepadButtons: [0] },
		[KoreInputAction.Push]: { keys: ["Enter", "KeyP"], gamepadButtons: [1] },
		[KoreInputAction.ItemUse]: { keys: ["KeyI", "Digit1"], gamepadButtons: [2] },
	} };
}

export function validateKoreInputBindings(value: unknown): asserts value is KoreInputBindings {
	if (!isRecord(value) || value.schemaVersion !== 1 || !isRecord(value.bindings)) throw new Error("Invalid KORE input bindings");
	for (const action of Object.values(KoreInputAction)) {
		const binding = value.bindings[action];
		if (!isRecord(binding) || !Array.isArray(binding.keys) || !binding.keys.every(item => typeof item === "string" && item.length > 0)) throw new Error(`Invalid KORE binding for '${action}'`);
		for (const key of ["mouseButtons", "gamepadButtons"] as const) if (binding[key] !== undefined && (!Array.isArray(binding[key]) || !binding[key].every(item => Number.isSafeInteger(item) && item >= 0))) throw new Error(`Invalid KORE ${key} binding for '${action}'`);
	}
}

export function validateKoreInputMessage(value: unknown): asserts value is KoreInputMessage {
	if (!isRecord(value) || typeof value.command !== "string" || !isRecord(value.payload)) throw new Error("Invalid KORE input command");
	const payload = value.payload;
	if (value.command === KoreInputCommand.ActionPressed) {
		if (!Object.values(KoreInputAction).includes(payload.action as KoreInputAction)) throw new Error("Invalid KORE input action");
		return;
	}
	if (value.command === KoreInputCommand.PointerDown || value.command === KoreInputCommand.PointerMove || value.command === KoreInputCommand.PointerUp) {
		if (!Number.isFinite(payload.x) || !Number.isFinite(payload.y)) throw new Error("Pointer coordinates must be finite");
		return;
	}
	if (value.command === KoreInputCommand.ItemUse) {
		if (typeof payload.actorId !== "string" || payload.actorId.length === 0 || typeof payload.itemId !== "string" || payload.itemId.length === 0 || !isJsonValue(payload.target)) throw new Error("Invalid KORE item-use command");
		return;
	}
	if (value.command === KoreInputCommand.Menu) {
		if (typeof payload.action !== "string" || payload.action.length === 0) throw new Error("Invalid KORE menu command");
		return;
	}
	throw new Error(`Unknown KORE input command '${value.command}'`);
}

function isRecord(value: unknown): value is Record<string, any> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function isJsonValue(value: unknown): value is JsonValue {
	if (value === null || typeof value === "string" || typeof value === "boolean") return true;
	if (typeof value === "number") return Number.isFinite(value);
	if (Array.isArray(value)) return value.every(isJsonValue);
	return isRecord(value) && Object.values(value).every(isJsonValue);
}

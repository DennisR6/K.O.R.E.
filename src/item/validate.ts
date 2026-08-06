import { validateItemDocument } from "./types.js";
import type { ItemDocument } from "./types.js";

const ITEM_FIELDS = new Set([
	"schemaVersion",
	"id",
	"name",
	"description",
	"type",
	"effects",
	"targetType",
	"duration",
	"useLimit",
	"targetValidation",
	"cooldown",
]);
const EFFECT_FIELDS = new Set(["type", "value"]);
const DURATION_FIELDS = new Set(["type", "value"]);
const USE_LIMIT_FIELDS = new Set(["perTurn", "perGame"]);
const TARGET_VALIDATION_FIELDS = new Set([
	"allowSelf",
	"allowAlly",
	"allowEnemy",
	"maxRange",
]);

function isPlainObject(value: object): value is Record<string, unknown> {
	const prototype = Object.getPrototypeOf(value);
	return prototype === Object.prototype || prototype === null;
}

function formatPath(path: string, key: string): string {
	return path ? `${path}.${key}` : key;
}

function assertEnumerableDataProperties(object: object, path: string): string[] {
	const keys = Reflect.ownKeys(object);
	for (const key of keys) {
		if (typeof key !== "string") {
			throw new Error(`${path} must not contain symbol keys`);
		}
		const descriptor = Object.getOwnPropertyDescriptor(object, key);
		if (!descriptor?.enumerable || !("value" in descriptor)) {
			throw new Error(`${formatPath(path, key)} must be an enumerable data property`);
		}
	}
	return keys as string[];
}

function assertKnownObject(
	value: unknown,
	path: string,
	allowedFields: ReadonlySet<string>,
): Record<string, unknown> {
	if (typeof value !== "object" || value === null || !isPlainObject(value)) {
		throw new Error(`${path} must be a plain object`);
	}

	for (const key of assertEnumerableDataProperties(value, path)) {
		if (!allowedFields.has(key)) {
			throw new Error(`${formatPath(path, key)} is not allowed`);
		}
	}

	return value;
}

function isExecutableKey(key: string): boolean {
	return (
		key === "script" ||
		key === "code" ||
		key === "handler" ||
		key === "eval" ||
		key === "exec" ||
		key === "function" ||
		key === "__proto__" ||
		key === "constructor" ||
		key === "prototype" ||
		/^on[a-zA-Z]/i.test(key)
	);
}

function assertJsonValue(value: unknown, path: string, ancestors: Set<object>): void {
	if (value === null || typeof value === "string" || typeof value === "boolean") return;
	if (typeof value === "number") {
		if (!Number.isFinite(value)) throw new Error(`${path} must be a finite number`);
		return;
	}
	if (typeof value === "undefined" || typeof value === "function" || typeof value === "symbol" || typeof value === "bigint") {
		throw new Error(`${path} is not JSON data`);
	}
	if (typeof value !== "object") throw new Error(`${path} is not JSON data`);
	if (ancestors.has(value)) throw new Error(`${path} contains a cyclic reference`);

	ancestors.add(value);
	try {
		if (Array.isArray(value)) {
			for (const key of Reflect.ownKeys(value)) {
				if (key === "length") continue;
				if (typeof key !== "string") throw new Error(`${path} must not contain symbol keys`);
				if (isExecutableKey(key)) {
					throw new Error(`${formatPath(path, key)} is an executable field and is not allowed`);
				}
				const index = Number(key);
				const descriptor = Object.getOwnPropertyDescriptor(value, key);
				if (!Number.isSafeInteger(index) || index < 0 || String(index) !== key || !descriptor?.enumerable || !("value" in descriptor)) {
					throw new Error(`${formatPath(path, key)} is not JSON array data`);
				}
			}
			for (let index = 0; index < value.length; index += 1) {
				if (!(index in value)) throw new Error(`${path}[${index}] must not be sparse`);
				assertJsonValue(value[index], `${path}[${index}]`, ancestors);
			}
			return;
		}
		if (!isPlainObject(value)) throw new Error(`${path} must be a plain object`);

		for (const key of assertEnumerableDataProperties(value, path)) {
			const childPath = formatPath(path, key);
			if (isExecutableKey(key)) {
				throw new Error(`${childPath} is an executable field and is not allowed`);
			}
			assertJsonValue(value[key], childPath, ancestors);
		}
	} finally {
		ancestors.delete(value);
	}
}

/** Validates declarative item data against registered effect names. */
export class ItemValidator {
	private readonly effectTypes = new Set<string>();

	public registerEffectType(type: string): void {
		if (typeof type !== "string" || type.trim().length === 0) {
			throw new Error("Effect type must be a non-empty string");
		}
		if (this.effectTypes.has(type)) {
			throw new Error(`Effect type '${type}' is already registered`);
		}
		this.effectTypes.add(type);
	}

	public isRegisteredEffectType(type: string): boolean {
		return this.effectTypes.has(type);
	}

	public validate(document: unknown): ItemDocument {
		validateItemDocument(document);
		const item = assertKnownObject(document, "item", ITEM_FIELDS);

		if (item.description !== undefined && typeof item.description !== "string") {
			throw new Error("item.description must be a string");
		}

		const effects = item.effects as unknown[];
		for (let index = 0; index < effects.length; index += 1) {
			const effect = assertKnownObject(effects[index], `item.effects[${index}]`, EFFECT_FIELDS);
			const type = effect.type;
			if (typeof type !== "string" || !this.isRegisteredEffectType(type)) {
				throw new Error(`Effect type '${String(type)}' is not in the whitelist`);
			}
			if (effect.value !== undefined) {
				assertJsonValue(effect.value, `item.effects[${index}].value`, new Set<object>());
			}
		}

		assertKnownObject(item.duration, "item.duration", DURATION_FIELDS);
		assertKnownObject(item.useLimit, "item.useLimit", USE_LIMIT_FIELDS);
		if (item.targetValidation !== undefined) {
			assertKnownObject(item.targetValidation, "item.targetValidation", TARGET_VALIDATION_FIELDS);
		}

		return document;
	}
}

export function validateDeclarativeItem(document: unknown, validator: ItemValidator): ItemDocument {
	return validator.validate(document);
}

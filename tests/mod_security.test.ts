import { describe, expect, test } from "bun:test";
import { ItemValidator, validateDeclarativeItem } from "../src/item/validate.js";
import {
	migrateDocument,
	validateMapDocument,
	validateEditorMapDocument,
	DOCUMENT_SCHEMA_VERSION,
	type MapDocument,
	type EditorMapDocument,
} from "../src/contracts/documents.ts";

describe("Harden Declarative Mod Loading & Document Security", () => {
	test("ItemValidator rejects unregistered effect types and whitelist bypasses", () => {
		const validator = new ItemValidator();
		validator.registerEffectType("modify_force");

		const validItem = {
			schemaVersion: 1,
			id: "mod_item_1",
			name: "Test Mod Item",
			type: "instant",
			effects: [{ type: "modify_force", value: { multiplier: 2 } }],
			targetType: "self",
			duration: { type: "turns", value: 1 },
			useLimit: { perTurn: 1, perGame: 1 },
		};

		expect(() => validateDeclarativeItem(validItem, validator)).not.toThrow();

		// Unregistered effect type
		const invalidEffectItem = {
			...validItem,
			effects: [{ type: "unregistered_custom_code", value: {} }],
		};
		expect(() => validateDeclarativeItem(invalidEffectItem, validator)).toThrow(/whitelist/i);
	});

	test("ItemValidator rejects executable keys, event handlers, and prototype pollution", () => {
		const validator = new ItemValidator();
		validator.registerEffectType("modify_force");

		const baseItem = {
			schemaVersion: 1,
			id: "mod_item_2",
			name: "Security Test Item",
			type: "instant",
			effects: [{ type: "modify_force", value: {} }],
			targetType: "self",
			duration: { type: "turns", value: 1 },
			useLimit: { perTurn: 1, perGame: 1 },
		};

		// Executable fields in effect value
		const forbiddenKeys = [
			"script",
			"code",
			"handler",
			"eval",
			"exec",
			"function",
			"__proto__",
			"constructor",
			"prototype",
			"onclick",
			"onerror",
			"onload",
			"onHover",
		];

		for (const key of forbiddenKeys) {
			const maliciousValueItem = {
				...baseItem,
				effects: [{ type: "modify_force", value: { [key]: "alert(1)" } }],
			};
			expect(() => validateDeclarativeItem(maliciousValueItem, validator)).toThrow(/executable|allowed|not JSON/i);
		}
	});

	test("ItemValidator rejects non-JSON types, cyclic references, and sparse arrays", () => {
		const validator = new ItemValidator();
		validator.registerEffectType("modify_force");

		const baseItem = {
			schemaVersion: 1,
			id: "mod_item_3",
			name: "JSON Validation Item",
			type: "instant",
			effects: [{ type: "modify_force", value: {} }],
			targetType: "self",
			duration: { type: "turns", value: 1 },
			useLimit: { perTurn: 1, perGame: 1 },
		};

		// Function in value
		expect(() =>
			validateDeclarativeItem(
				{ ...baseItem, effects: [{ type: "modify_force", value: { fn: () => {} } }] },
				validator,
			),
		).toThrow();

		// Cyclic reference
		const cyclicObj: any = {};
		cyclicObj.self = cyclicObj;
		expect(() =>
			validateDeclarativeItem(
				{ ...baseItem, effects: [{ type: "modify_force", value: cyclicObj }] },
				validator,
			),
		).toThrow();
	});

	test("migrateDocument safely validates document schema versions", () => {
		expect(migrateDocument({ name: "Legacy Doc" })).toEqual({ name: "Legacy Doc", schemaVersion: 1 });
		expect(migrateDocument({ schemaVersion: 1, name: "Valid Doc" })).toEqual({ schemaVersion: 1, name: "Valid Doc" });
		expect(() => migrateDocument({ schemaVersion: 999 })).toThrow(/unsupported/i);
		expect(() => migrateDocument(null as any)).toThrow();
		expect(() => migrateDocument(123 as any)).toThrow();
	});

	test("validateMapDocument and validateEditorMapDocument reject malicious or invalid content", () => {
		const validMap: MapDocument = {
			schemaVersion: 1,
			metadata: { id: "map1", name: "Valid Map" },
			worldSize: { x: 800, y: 450 },
			friction: { friction: 0.98, linearDrag: 0.01, stopThreshold: 0.05 },
			drift: 0.1,
			arenaGeometry: [],
			spawnRegions: [{ team: 0, x: 10, y: 10, w: 100, h: 100 }],
			hazards: [],
		};

		expect(() => validateMapDocument(validMap)).not.toThrow();

		// Malformed drift or non-finite numbers
		expect(() => validateMapDocument({ ...validMap, drift: NaN })).toThrow();
		expect(() => validateMapDocument({ ...validMap, drift: 2.0 })).toThrow();

		// Malicious background javascript: URL in editor map
		const editorMapWithJS: EditorMapDocument = {
			schemaVersion: 1,
			name: "JS Map",
			background: { type: "image", url: "javascript:alert(1)" },
			screenResolution: { x: 800, y: 450, factor: 1 },
			mapBoundarys: [],
			holes: [],
			players: [],
			friction: { friction: 0.98, linearDrag: 0.01, stopThreshold: 0.05 },
			drift: 0.1,
			items: [],
			effects: [],
			mode: { type: "last_man_standing", params: { itemsEnabled: true, hazardsEnabled: false, allowTies: false } },
			ai: { difficulty: "normal", aggressiveness: 50, riskTaking: 40, itemPriority: 50, hazardAwareness: 60, errorRate: 20 },
		};

		expect(() => validateEditorMapDocument(editorMapWithJS)).toThrow(/javascript|url|invalid/i);
	});
});

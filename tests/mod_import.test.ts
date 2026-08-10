import { describe, expect, test } from "bun:test";
import { importModText, parseModJson, validateModJson } from "../src/mods/importMod.ts";
import { classifyModError } from "../src/mods/errors.ts";

const VALID_PACKAGE = {
	schemaVersion: 1,
	manifest: { id: "test-mod", name: "Test Mod", version: "1.0.0" },
	maps: [
		{
			schemaVersion: 1,
			metadata: { id: "mod-map", name: "Mod Map" },
			worldSize: { x: 800, y: 450 },
			friction: { friction: 0.02, linearDrag: 0.004, stopThreshold: 0.02 },
			drift: 0,
			arenaGeometry: [{ type: 2, x: 0, y: 0, w: 800, h: 450, role: "containment", effects: [] }],
			spawnRegions: [
				{ team: 0, x: 40, y: 150, w: 120, h: 140 },
				{ team: 1, x: 640, y: 150, w: 120, h: 140 },
			],
			hazards: [],
		},
	],
	items: [
		{
			schemaVersion: 1,
			id: "mod-item",
			name: "Mod Item",
			type: "defensive",
			effects: [{ type: "shield", value: { capacity: 10 } }],
			targetType: "self",
			duration: { type: "turns", value: 1 },
			useLimit: { perTurn: 1, perGame: 1 },
		},
	],
	modes: [
		{
			schemaVersion: 1,
			id: "mod-mode",
			phases: ["item", "aim", "charge", "push", "physics"],
			maxItemsPerTurn: 1,
			winCondition: "last-team-standing",
			itemEconomy: { fixedLoadouts: [], mapPickups: [] },
		},
	],
};

const VALID_TEXT = JSON.stringify(VALID_PACKAGE, null, 2);

describe("parseModJson", () => {
	test("parses valid JSON text", () => {
		const result = parseModJson(VALID_TEXT);
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.value).toEqual(VALID_PACKAGE);
	});

	test("reports malformed JSON with a position when available", () => {
		const result = parseModJson('{"schemaVersion": 1, "manifest": {');
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.category).toBe("parse");
			expect(result.error.message).toMatch(/not valid JSON/);
		}
	});

	test("rejects oversized documents", () => {
		const huge = JSON.stringify({ schemaVersion: 1, blob: "x".repeat(2 * 1024 * 1024 + 10) });
		const result = parseModJson(huge);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.category).toBe("size");
			expect(result.error.message).toMatch(/2 MB/);
		}
	});

	test("rejects non-string input", () => {
		const result = parseModJson(42 as never);
		expect(result.ok).toBe(false);
	});
});

describe("validateModJson", () => {
	test("validates a valid package through the public SDK", () => {
		const result = validateModJson(VALID_PACKAGE);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.package.package.manifest.id).toBe("test-mod");
			expect(result.package.hash).toMatch(/^[0-9a-f]{16}$/);
		}
	});

	test("rejects an unsupported schema version", () => {
		const result = validateModJson({ ...VALID_PACKAGE, schemaVersion: 2 });
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.category).toBe("schema");
			expect(result.error.message).toMatch(/schemaVersion 1/);
		}
	});

	test("rejects a missing manifest", () => {
		const result = validateModJson({ schemaVersion: 1 });
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.category).toBe("content");
			expect(result.error.message).toMatch(/manifest/);
		}
	});

	test("rejects duplicate map IDs", () => {
		const duplicate = {
			...VALID_PACKAGE,
			maps: [VALID_PACKAGE.maps[0], { ...VALID_PACKAGE.maps[0] }],
		};
		const result = validateModJson(duplicate);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.category).toBe("content");
			expect(result.error.message).toMatch(/duplicate|invalid/i);
		}
	});

	test("rejects unknown item references", () => {
		const badMode = {
			...VALID_PACKAGE,
			modes: [
				{
					schemaVersion: 1,
					id: "mod-mode",
					phases: ["physics"],
					maxItemsPerTurn: 1,
					winCondition: "last-team-standing",
					itemEconomy: { fixedLoadouts: [{ team: 0, items: [{ itemId: "missing-item", uses: 1 }] }], mapPickups: [] },
				},
			],
		};
		const result = validateModJson(badMode);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.category).toBe("reference");
			expect(result.error.message).toMatch(/not declared|unknown item/);
		}
	});

	test("rejects executable fields", () => {
		const result = validateModJson({ ...VALID_PACKAGE, code: "alert(1)" });
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.category).toBe("security");
			expect(result.error.message).toMatch(/not allowed|executable/i);
		}
	});

	test("never mutates the original document", () => {
		const frozen = structuredClone(VALID_PACKAGE);
		Object.freeze(frozen);
		const result = validateModJson(frozen);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.package.package).not.toBe(frozen);
			expect(result.package.package.maps).not.toBe(frozen.maps);
			expect(frozen).toEqual(VALID_PACKAGE);
		}
	});
});

describe("importModText", () => {
	test("produces a valid state from file text", () => {
		const state = importModText(VALID_TEXT, { kind: "file", fileName: "mod.json" });
		expect(state.status).toBe("valid");
		expect(state.source).toEqual({ kind: "file", fileName: "mod.json" });
		expect(state.package?.package.manifest.id).toBe("test-mod");
		expect(state.hash).toBeDefined();
		expect(state.error).toBeUndefined();
	});

	test("produces a valid state from pasted text", () => {
		const state = importModText(VALID_TEXT, { kind: "paste" });
		expect(state.status).toBe("valid");
		expect(state.source).toEqual({ kind: "paste" });
	});

	test("keeps raw text and exposes parse failures", () => {
		const state = importModText('{"broken":', { kind: "paste" });
		expect(state.status).toBe("invalid");
		expect(state.rawText).toBe('{"broken":');
		expect(state.error?.category).toBe("parse");
		expect(state.package).toBeUndefined();
	});

	test("invalid content never yields a package", () => {
		const state = importModText(JSON.stringify({ schemaVersion: 3 }), { kind: "file", fileName: "x.json" });
		expect(state.status).toBe("invalid");
		expect(state.package).toBeUndefined();
	});
});

describe("classifyModError", () => {
	test("maps known SDK messages and falls back to the raw detail", () => {
		const schema = classifyModError(new Error("Unsupported content package schema version: 2"));
		expect(schema.category).toBe("schema");
		expect(schema.detail).toContain("schema version");
		const unknown = classifyModError(new Error("Something novel happened"));
		expect(unknown.category).toBe("content");
		expect(unknown.message).toBe("Something novel happened");
	});
});

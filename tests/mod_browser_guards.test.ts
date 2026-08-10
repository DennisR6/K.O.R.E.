import { describe, expect, test } from "bun:test";
import { assertModFileSize } from "../src/mods/browserFileInput.ts";
import { clipboardErrorFor, readClipboardText } from "../src/mods/browserClipboard.ts";
import { MOD_JSON_MAX_BYTES } from "../src/mods/importMod.ts";

describe("mod browser adapters (pure guards)", () => {
	test("file size guard accepts small files and rejects oversized ones", () => {
		expect(assertModFileSize(1024)).toBeUndefined();
		expect(assertModFileSize(MOD_JSON_MAX_BYTES)).toBeUndefined();
		const error = assertModFileSize(MOD_JSON_MAX_BYTES + 1);
		expect(error?.category).toBe("size");
		expect(error?.message).toMatch(/2 MB/);
	});

	test("clipboard permission denial maps to an actionable error", () => {
		const denied = clipboardErrorFor(new DOMException("denied", "NotAllowedError"));
		expect(denied.category).toBe("io");
		expect(denied.message).toMatch(/permission/i);
		expect(denied.detail).toBe("NotAllowedError");
		expect(clipboardErrorFor(new Error("boom")).message).toMatch(/could not be read/);
	});

	test("clipboard read without a browser clipboard API reports unavailability", async () => {
		const original = globalThis.navigator;
		Object.defineProperty(globalThis, "navigator", { value: undefined, configurable: true });
		const result = await readClipboardText();
		Object.defineProperty(globalThis, "navigator", { value: original, configurable: true });
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error.message).toMatch(/not available/);
	});
});

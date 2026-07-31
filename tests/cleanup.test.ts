import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

describe("Remove Obsolete Game Prototypes (Cleanup Verification)", () => {
	test("obsolete prototype files src/start.ts and src/ui/Mouse.ts have been removed", () => {
		const startPath = resolve(process.cwd(), "src/start.ts");
		const mousePath = resolve(process.cwd(), "src/ui/Mouse.ts");

		expect(existsSync(startPath)).toBe(false);
		expect(existsSync(mousePath)).toBe(false);
	});
});

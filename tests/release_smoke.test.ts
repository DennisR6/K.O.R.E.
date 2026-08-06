import { describe, expect, test } from "bun:test";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

describe("Record Release Verification (Release Smoke Tests)", () => {
	test("docs/release-verification.md exists and documents release verification results", () => {
		const docPath = resolve(process.cwd(), "docs/release-verification.md");
		expect(existsSync(docPath)).toBe(true);

		const content = readFileSync(docPath, "utf-8");
		expect(content).toContain("Slipstrike (KORE) Release Verification Record");
		expect(content).toContain("bun install --frozen-lockfile");
		expect(content).toContain("bun test");
		expect(content).toContain("npx tsc --noEmit");
		expect(content).toContain("bun run build");
		expect(content).toContain("Authoritative Server & Matchmaking");
		expect(content).toContain("Desktop Target (Tauri)");
		expect(content).toContain("Mobile & Offline Target (PWA)");
	});

	test("package.json contains necessary build and start scripts", () => {
		const pkgPath = resolve(process.cwd(), "package.json");
		const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));

		expect(pkg.scripts).toBeDefined();
		expect(pkg.scripts.build).toBeDefined();
		expect(pkg.scripts.start).toBeDefined();
	});
});

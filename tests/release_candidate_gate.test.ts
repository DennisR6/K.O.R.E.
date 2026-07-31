import { describe, expect, test } from "bun:test";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { runFuzzSuite } from "./support/aiMatchFuzz.ts";

/**
 * Section 12.13 - release-candidate gate.
 *
 * Mirrors the Section 11 smoke pattern: the gate asserts that the Section 12
 * defect-hardening evidence exists, that the checklist is complete, that the
 * qualification commands are wired, and that a fuzz smoke run qualifies
 * cleanly. The authoritative record of the full gate (clean install, unit
 * suite, typecheck, build, RC fuzz run, soak fuzz run, desktop build) is the
 * 24-point report in `docs/release-verification.md`.
 */
const ROOT = process.cwd();

describe("Release Candidate Gate (Section 12.13)", () => {
	test("docs/release-verification.md records the 24-point qualification", () => {
		const docPath = resolve(ROOT, "docs/release-verification.md");
		expect(existsSync(docPath)).toBe(true);
		const content = readFileSync(docPath, "utf-8");
		expect(content).toContain("Slipstrike (KORE) Release Verification Record");
		expect(content).toContain("24-Point Release-Candidate Qualification");
		expect(content).toContain("bun install --frozen-lockfile");
		expect(content).toContain("bun test");
		expect(content).toContain("npx tsc --noEmit");
		expect(content).toContain("bun run build");
		expect(content).toContain("test:fuzz:rc");
		expect(content).toContain("test:fuzz:soak");
		expect(content).toContain("bun run desktop:build");
		// The record must state the current suite size, not a stale one.
		expect(content).toMatch(/425 pass, 0 fail \(2221 assertions across 157 files\)/);
	});

	test("Section 12 evidence files exist on disk", () => {
		const evidence = [
			"tests/effect_factory_roundtrip.test.ts",
			"tests/ai_match_fuzz.test.ts",
			"tests/support/aiMatchFuzz.ts",
			"tests/release_candidate_gate.test.ts",
			"docs/release-verification.md",
		];
		for (const file of evidence) {
			expect(existsSync(resolve(ROOT, file))).toBe(true);
		}
	});

	test("step-by-step.md marks tasks 12.1 through 12.13 complete", () => {
		const checklistPath = resolve(ROOT, "step-by-step.md");
		const content = readFileSync(checklistPath, "utf-8");
		for (let i = 1; i <= 13; i++) {
			const marker = `- [x] **Task [12.${i}]`;
			expect(content).toContain(marker);
		}
	});

	test("package.json wires the smoke/RC/soak fuzz qualification scripts", () => {
		const pkgPath = resolve(ROOT, "package.json");
		const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
		expect(pkg.scripts["test:fuzz"]).toBe("bun test tests/ai_match_fuzz.test.ts");
		expect(pkg.scripts["test:fuzz:rc"]).toContain("RC_GAME_COUNT=1000");
		expect(pkg.scripts["test:fuzz:soak"]).toContain("RC_GAME_COUNT=5000");
		expect(pkg.scripts.build).toBeDefined();
		expect(pkg.scripts.start).toBeDefined();
	});

	test("a fuzz smoke run qualifies cleanly", () => {
		const suite = runFuzzSuite({ gameCount: 5 });
		expect(suite.matches.length).toBe(5);
		expect(suite.matches.flatMap((m) => m.violations)).toEqual([]);
		expect(suite.determinismVerified).toBe(true);
		expect(suite.injections).toBeGreaterThan(0);
		for (const match of suite.matches) {
			expect(match.turns).toBeGreaterThan(0);
			expect(match.replayOk).toBe(true);
			expect(match.persistedOk).toBe(true);
			if (match.outcome !== "ongoing") expect(match.rematchOk).toBe(true);
		}
	}, { timeout: 600000 });
});

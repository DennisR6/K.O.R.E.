import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Section 16.6 - browser gameplay release gate.
 *
 * Mirrors the Section 12/15 gate pattern: the gate asserts that the browser
 * verification commands exist in package.json and CI, that the release record
 * in `docs/release-verification.md` contains the required Section 16 report,
 * that the Section 16 checklist is complete, and that the evidence files from
 * tasks 16.1-16.5 exist. The authoritative browser evidence is the record in
 * `docs/release-verification.md` plus the real `test:browser:smoke` and
 * `test:browser:full` runs (the latter runs inside the normal `bun test`
 * suite as part of the 640+ passing tests).
 */

const ROOT = process.cwd();
const read = (file: string) => readFileSync(resolve(ROOT, file), "utf8");

const evidenceFiles = [
	"tests/browser/browserHarness.ts",
	"tests/browser/browser_startup.e2e.test.ts",
	"tests/browser/local_turn.e2e.test.ts",
	"tests/browser/local_match_flow.e2e.test.ts",
	"tests/browser/browserDiagnostics.ts",
	"tests/browser/browser_diagnostics.test.ts",
	"tests/browser/map_catalog.e2e.test.ts",
	"tests/browser/browser_ai_battle.e2e.test.ts",
	"tests/browser/browser_release_gate.test.ts",
];

const reportItems = [
	"Browser engine and version",
	"Viewport",
	"Tested URL",
	"Build result",
	"Server readiness result",
	"Menu startup result",
	"Completed turns",
	"Completed matches",
	"Console errors",
	"Page exceptions",
	"Screenshots/traces on failure",
	"Command duration",
	"Final status",
];

describe("Section 16.6 browser gameplay release gate", () => {
	test("package.json and CI wire both required browser commands", () => {
		const pkg = read("package.json");
		expect(pkg).toContain('"test:browser:smoke"');
		expect(pkg).toContain('"test:browser:full"');
		expect(pkg).toContain('"test:browser"');
		const ci = read(".github/workflows/node.js.yml");
		expect(ci).toContain("bunx playwright install chromium --with-deps");
		expect(ci).toContain("bun run test:browser:smoke");
		expect(ci).toContain("bun run test:browser:full");
	});

	test("the release record reports every required Section 16 item", () => {
		const report = read("docs/release-verification.md");
		expect(report).toContain("Section 16 Browser Playable Verification");
		expect(report).toContain("bun run test:browser:smoke");
		expect(report).toContain("bun run test:browser:full");
		expect(report).toContain("FINAL STATUS: BLOCKED / NOT QUALIFIED"); // Section 15 status is preserved
		for (const item of reportItems) expect(report).toContain(item);
	});

	test("the browser gate commands both pass in the record", () => {
		const report = read("docs/release-verification.md");
		expect(report).toMatch(/bun run test:browser:smoke.*PASS: 10 pass \/ 0 fail/);
		expect(report).toMatch(/bun run test:browser:full.*PASS: 19 pass \/ 0 fail/);
		expect(report).toContain("PASS - browser-playable");
	});

	test("all Section 16 evidence files exist on disk", () => {
		for (const file of evidenceFiles) {
			expect(existsSync(resolve(ROOT, file))).toBe(true);
		}
	});

	test("step-by-step.md marks tasks 16.1 through 16.6 complete", () => {
		const checklist = read("step-by-step.md");
		for (const task of ["[16.1]", "[16.2]", "[16.3]", "[16.4]", "[16.5]", "[16.6]"]) {
			expect(checklist).toContain(`- [x] **Task ${task}`);
		}
		expect(checklist).toContain("browser-playable release");
		expect(checklist).toContain("smoke test and complete gameplay E2E both pass");
	});

	test("AGENTS.md documents the browser commands and headed/debug mode", () => {
		const agents = read("AGENTS.md");
		expect(agents).toContain("test:browser:smoke");
		expect(agents).toContain("test:browser:full");
		expect(agents).toContain(".browser-diagnostics");
	});

	test("requirements.md references the Section 16 browser gate", () => {
		const ledger = read("requirements.md");
		expect(ledger).toContain("R-18");
		expect(ledger).toContain("browser_release_gate.test.ts");
	});
});

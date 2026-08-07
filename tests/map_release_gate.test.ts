import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Section 17.10 - qualified map content release gate.
 *
 * Verifies that the map-release requirements are fully satisfied:
 * - The verification record in docs/release-verification.md reports the required metrics, warnings, and commands.
 * - Requirements, AGENTS.md, package.json, CI workflow, and step-by-step.md are aligned.
 * - Ledgers do not manufacture human evidence or mark unqualified maps as qualified.
 * - All Section 17 evidence files are present on disk.
 */

const ROOT = process.cwd();
const read = (file: string) => readFileSync(resolve(ROOT, file), "utf8");

const requiredEvidenceFiles = [
	"docs/map-design-contract.md",
	"docs/map-qualification-report.md",
	"src/content/mapCatalog.ts",
	"tests/support/mapQualification.ts",
	"src/settings/symmetricDuelMap.ts",
	"tests/symmetric_duel_map.test.ts",
	"src/settings/structureControlMap.ts",
	"tests/structure_control_map.test.ts",
	"src/settings/hazardControlMap.ts",
	"tests/hazard_control_map.test.ts",
	"tests/shipped_map_matrix.test.ts",
	"tests/browser/map_catalog.e2e.test.ts",
	"docs/map-playtest-protocol.md",
	".github/ISSUE_TEMPLATE/map-playtest-finding.md",
	"tests/map_playtest_readiness.test.ts",
	"tests/map_release_gate.test.ts",
];

const requiredCommands = [
	"bun run test:maps",
	"bun run test:maps:matrix",
	"bun run test:browser:full",
	"bun test",
	"npx tsc --noEmit",
	"bun run build",
	"git diff --check",
];

describe("Section 17.10 map release gate", () => {
	test("all Section 17 evidence files exist on disk", () => {
		for (const file of requiredEvidenceFiles) {
			expect(existsSync(resolve(ROOT, file))).toBe(true);
		}
	});

	test("the release record covers every required Section 17 metric, warning, and command", () => {
		const report = read("docs/release-verification.md");
		expect(report).toContain("## Section 17 Map Production And Verification");
		for (const command of requiredCommands) {
			expect(report).toContain(command);
		}
		for (const metric of [
			"Exact Commit",
			"Technically-qualified Map IDs",
			"Browser-qualified Map IDs",
			"Blocked Map IDs",
			"Rejected Map IDs",
			"Deterministic Seed Count",
			"Matrix Result",
			"Pacing and Fairness Warnings",
			"Browser Result",
			"Console/page-error Totals",
			"Diagnostic Artifact Paths",
			"Known Limitations",
			"Current Human-test Status",
		]) {
			expect(report).toContain(metric);
		}
	});

	test("package.json defines the map verification commands", () => {
		const pkg = read("package.json");
		expect(pkg).toContain('"test:maps"');
		expect(pkg).toContain('"test:maps:matrix"');
	});

	test("CI workflow wires map verification commands", () => {
		const ci = read(".github/workflows/node.js.yml");
		expect(ci).toContain("bun run test:maps");
		expect(ci).toContain("bun run test:maps:matrix");
	});

	test("AGENTS.md documents the map qualification commands and workflow", () => {
		const agents = read("AGENTS.md");
		expect(agents).toContain("bun run test:maps");
		expect(agents).toContain("bun run test:maps:matrix");
		expect(agents).toContain("map_release_gate.test.ts");
	});

	test("requirements.md references the Section 17 map release gate", () => {
		const requirements = read("requirements.md");
		expect(requirements).toContain("R-19");
		expect(requirements).toContain("map_release_gate.test.ts");
	});

	test("completed delivery record summarizes map qualification", () => {
		const checklist = read("step-by-step.md");
		expect(checklist).toContain("| 17 | `[x]`");
		expect(checklist).toContain("steps/17-qualified_map_production_and_verification.md");
		expect(checklist).toContain("Map catalog, qualification matrix");
	});

	test("map qualification rules are strictly followed", () => {
		const report = read("docs/map-qualification-report.md");
		// Technically-qualified or browser-qualified is allowed without human playtests
		expect(report).toContain("browser-qualified");
		// No map can be human-qualified (remains pending)
		expect(report).not.toContain("human-qualified |");
		expect(report).toContain("Human qualification remains `PENDING`");
	});
});

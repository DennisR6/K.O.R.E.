import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = process.cwd();
const read = (file: string) => readFileSync(resolve(ROOT, file), "utf8");

const requiredEvidence = [
	"gameplay_content_matrix.test.ts",
	"match_softlock_detection.test.ts",
	"match_length_distribution.test.ts",
	"gameplay_fairness_tournament.test.ts",
	"player_agency_validation.test.ts",
	"item_gameplay_qualification.test.ts",
	"local_match_lifecycle.integration.test.ts",
	"playtest_build_gate.test.ts",
	"playtest_evidence_gate.test.ts",
];

const requiredCommands = [
	"bun install --frozen-lockfile",
	"bun test",
	"npx tsc --noEmit",
	"bun run build",
	"bun run desktop:build",
	"bun run test:fuzz:rc",
	"bun run test:physics-fuzz:rc",
	"bun run test:gameplay-matrix",
	"bun run test:gameplay-tournament",
];

describe("Section 15.12 gameplay release candidate gate", () => {
	test("the release record gates every automated and packaged evidence source", () => {
		const report = read("docs/release-verification.md");
		expect(report).toContain("Section 15 Gameplay Release Candidate Gate");
		for (const command of requiredCommands) expect(report).toContain(command);
		for (const evidence of [
			"Matrix qualification", "Softlock detection", "Pacing", "Spawn-side fairness",
			"Meaningful agency", "Item-use findings", "Vertical-slice E2E", "Packaged build",
			"AI matches completed", "Winner distribution", "Draw distribution",
			"Match-length distribution", "Softlocks detected", "Replay mismatches",
			"Snapshot or persistence mismatches", "Spawn-side fairness warnings",
			"Human sessions completed", "Human blockers reported", "Human blockers fixed",
			"Remaining usability concerns", "Known balance limitations",
		]) expect(report).toContain(evidence);
		expect(report).toContain("FINAL STATUS: BLOCKED / NOT QUALIFIED");
		expect(report).toContain("production-human-session-2026-08.md");
	});

	test("all Section 15 evidence files are present and named in the gate", () => {
		const report = read("docs/release-verification.md");
		for (const file of requiredEvidence) {
			expect(existsSync(resolve(ROOT, "tests", file))).toBe(true);
			expect(report).toContain(file);
		}
		expect(report).toContain("docs/gameplay-matrix.md");
		expect(report).toContain("docs/playtest-results/pending-external-session.md");
	});

	test("the qualification boundary is explicit in every release document", () => {
		expect(read("docs/gameplay-balance-report.md")).toContain("Section 15.12 Final Gameplay Release Decision");
		expect(read("docs/gameplay-balance-report.md")).toContain("BLOCKED / NOT QUALIFIED");
		expect(read("step-by-step.md")).toContain("| 15 |");
		expect(read("step-by-step.md")).toContain("Gameplay Qualification And Human Playtest Validation");
		expect(read("step-by-step.md")).toContain("production-human-session-2026-08.md");
		expect(read("docs/playtest-results/production-human-session-2026-08.md")).toContain("COMPLETED / VERIFIED FROM PRODUCTION DATA");
		expect(read("requirements.md")).toContain("R-17");
		expect(read("requirements.md")).toContain("gameplay_release_gate.test.ts");
	});

	test("the gameplay tournament command remains wired", () => {
		const packageJson = JSON.parse(read("package.json"));
		expect(packageJson.scripts["test:gameplay-tournament"]).toBe("bun test tests/gameplay_fairness_tournament.test.ts");
		expect(packageJson.scripts["test:gameplay-matrix"]).toContain("GAMEPLAY_MATRIX=1");
	});
});

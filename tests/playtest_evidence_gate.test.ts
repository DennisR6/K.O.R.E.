import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = process.cwd();
const RESULTS = resolve(ROOT, "docs/playtest-results");
const read = (file: string) => readFileSync(resolve(ROOT, file), "utf8");

const requiredEvidence = [
	"Build commit:",
	"Platform:",
	"Controls used:",
	"Completed matches:",
	"Observed blockers:",
	"Tester-reported issues:",
	"Result and match length:",
	"Willingness to replay:",
];

describe("Section 15.10 human playtest evidence", () => {
	test("every evidence record has the required schema and privacy fields", () => {
		expect(existsSync(RESULTS)).toBe(true);
		const records = readdirSync(RESULTS).filter((file) => file.endsWith(".md"));
		expect(records.length).toBeGreaterThan(0);

		for (const file of records) {
			const content = readFileSync(resolve(RESULTS, file), "utf8");
			for (const field of requiredEvidence) expect(content).toContain(field);
			expect(content).toContain("Session ID:");
			expect(content).toContain("Tester identity:");
			expect(content).toContain("Record status:");
			expect(content).not.toMatch(/\b(?:[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|\+?\d[\d ()-]{7,}\d)\b/);
			expect(content.toLowerCase()).not.toContain("full name:");
		}
	});

	test("pending evidence is explicit and cannot be mistaken for a completed session", () => {
		const pending = read("docs/playtest-results/pending-external-session.md");
		expect(pending).toContain("Record status: **BLOCKED / PENDING**");
		expect(pending).toContain("no external tester session exists");
		expect(pending).toContain("Completed matches: `0`");
		expect(pending).toContain("Willingness to replay: `N/A`");
		expect(pending).toContain("This is an evidence-status record, not a completed playtest result");
	});

	test("checklist and release record report the pending human-evidence status", () => {
		const checklist = read("step-by-step.md");
		const task = checklist.slice(checklist.indexOf("- [x] **Task [15.10]"), checklist.indexOf("- [ ] **Task [15.11]"));
		expect(task).toContain("playtest_evidence_gate.test.ts");
		expect(task).toContain("BLOCKED / PENDING");
		expect(task.toLowerCase()).toContain("no external tester session");

		const release = read("docs/release-verification.md");
		expect(release).toContain("Section 15.10 Human Playtest Evidence");
		expect(release).toContain("BLOCKED / PENDING");
		expect(release).toContain("actual external tester evidence is not available");
	});
});

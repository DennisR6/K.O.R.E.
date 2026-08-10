import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = process.cwd();
const RESULTS = resolve(ROOT, "docs/playtest-results");
const read = (file: string) => readFileSync(resolve(ROOT, file), "utf8");

const completedRecord = "docs/playtest-results/production-human-session-2026-08.md";

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

	test("completed production evidence is explicit and the historical pending record is superseded", () => {
		const completed = read(completedRecord);
		expect(completed).toContain("Record status: **COMPLETED / VERIFIED FROM PRODUCTION DATA**");
		expect(completed).toContain("data/kore.db");
		expect(completed).toContain("Human-controlled matches completed: 7 unique replay records.");
		expect(completed).toContain("Human qualitative ratings: not available");
		const pending = read("docs/playtest-results/pending-external-session.md");
		expect(pending).toContain("Record status: **SUPERSEDED / PENDING AT RECORD CREATION**");
		expect(pending).toContain("superseded by `production-human-session-2026-08.md`");
	});

	test("delivery and release records report recovered human evidence", () => {
		const checklist = read("step-by-step.md");
		expect(checklist).toContain("| 15 |");
		expect(checklist).toContain("playtest_evidence_gate.test.ts");
		expect(checklist).toContain("production-human-session-2026-08.md");

		const release = read("docs/release-verification.md");
		expect(release).toContain("Section 15.10 Human Playtest Evidence");
		expect(release).toContain("COMPLETED / VERIFIED FROM PRODUCTION DATA");
		expect(release).toContain("data/kore.db");
		expect(release).not.toContain("actual external tester evidence is not available");
	});
});

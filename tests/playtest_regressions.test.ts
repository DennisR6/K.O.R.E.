import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const read = (file: string) => readFileSync(file, "utf8");

describe("Section 15.11 playtest regression contract", () => {
	test("records the empty confirmed-findings set when human evidence is pending", () => {
		const evidence = read("docs/playtest-results/pending-external-session.md");

		expect(evidence).toContain("Record status: **BLOCKED / PENDING**");
		expect(evidence).toContain("Confirmed technical findings: `0`");
		expect(evidence).toContain("Confirmed deterministic findings: `0`");
		expect(evidence).toContain("Regression tests added: none");
		expect(evidence).toContain("No confirmed playtest defect exists to reproduce");
	});

	test("does not promote subjective preferences into regression requirements", () => {
		const evidence = read("docs/playtest-results/pending-external-session.md");
		const task = read("step-by-step.md");

		expect(evidence).toContain("Preferences: not assessed");
		expect(evidence).toContain("Subjective preferences are excluded from regression\n  coverage");
		expect(task).toContain("subjective preference is not a technical invariant");
	});

	test("links the empty contract to this focused test", () => {
		const task = read("step-by-step.md");
		expect(task).toContain("tests/playtest_regressions.test.ts");
		expect(task).toContain("No confirmed technical or deterministic playtest defects");
	});
});

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const read = (file: string) => readFileSync(file, "utf8");
const evidencePath = "docs/playtest-results/production-human-session-2026-08.md";

describe("Section 15.11 playtest regression contract", () => {
	test("records the completed production evidence and empty confirmed findings", () => {
		const evidence = read(evidencePath);

		expect(evidence).toContain("Record status: **COMPLETED / VERIFIED FROM PRODUCTION DATA**");
		expect(evidence).toContain("Confirmed technical blockers in this record: none");
		expect(evidence).toContain("Confirmed deterministic blockers in this record: none");
		expect(evidence).toContain("Latest human-vs-AI feedback was rated **5/5**");
	});

	test("does not promote unavailable subjective preferences into regression requirements", () => {
		const evidence = read(evidencePath);
		const task = read("step-by-step.md");

		expect(evidence).toContain("questionnaire data remains unavailable");
		expect(evidence).toContain("Map-level human qualification: pending separate map-playtest evidence");
		expect(task).toContain("subjective preference is not a technical invariant");
	});

	test("links the empty contract to this focused test", () => {
		const task = read("step-by-step.md");
		expect(task).toContain("tests/playtest_regressions.test.ts");
		expect(task).toContain("production-human-session-2026-08.md");
	});
});

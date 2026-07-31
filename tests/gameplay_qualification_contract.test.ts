import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const read = (file: string) => readFileSync(file, "utf8");

describe("Section 15.1 gameplay qualification contract", () => {
	test("technical contract defines every required playability criterion", () => {
		const contract = read("docs/gameplay-qualification.md");
		for (const criterion of [
			"Valid spawn",
			"Legal first action",
			"Advancing rule phases",
			"Bounded playback",
			"No softlock",
			"Winner or explicit draw",
			"Stable replay",
			"Stable snapshot restore",
			"No post-completion mutation",
		]) expect(contract).toContain(criterion);
		for (const evidence of ["configuration identity", "seed", "phase trace", "maximum playback", "first\nfailure"])
			expect(contract.toLowerCase()).toContain(evidence.toLowerCase());
		expect(contract).toContain("1,200 frames");
		expect(contract).toContain("all nine criteria pass");
	});

	test("human protocol defines repeatable sessions and measurable criteria", () => {
		const protocol = read("docs/playtest-protocol.md");
		for (const criterion of [
			"Control comprehension",
			"Objective comprehension",
			"Phase comprehension",
			"Action feedback",
			"Camera usability",
			"Pacing",
			"Perceived fairness",
			"Willingness to replay",
		]) expect(protocol).toContain(criterion);
		for (const required of ["Match 1", "Match 2", "1 (strongly disagree) to 5", "developer interventions", "blockers", "build/commit"])
			expect(protocol).toContain(required);
		expect(protocol).toContain("no gameplay explanation");
		expect(protocol).toContain("Median >= 4");
	});

	test("the checklist links Task 15.1 to both documents and its focused test", () => {
		const plan = read("step-by-step.md");
		const task = plan.slice(plan.indexOf("- [x] **Task [15.1]"), plan.indexOf("Task [15.2]"));
		expect(task).toContain("[x]");
		expect(task).toContain("docs/gameplay-qualification.md");
		expect(task).toContain("docs/playtest-protocol.md");
		expect(task).toContain("tests/gameplay_qualification_contract.test.ts");
	});
});

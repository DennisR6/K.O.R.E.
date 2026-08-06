import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = process.cwd();
const read = (file: string) => readFileSync(resolve(ROOT, file), "utf8");

describe("Section 15.9 human playtest readiness", () => {
	test("points testers at the reproducible packaged build", () => {
		const packageJson = JSON.parse(read("package.json"));
		const build = read("docs/playtest-build.md");

		expect(packageJson.scripts["playtest:build"]).toBe("bun run build && bun run desktop:build");
		expect(build).toContain("bun run playtest:build");
		expect(build).toContain("src-tauri/target/release/slipstrike");
		expect(build).toContain("Slipstrike_0.0.1_amd64.deb");
		expect(build).toContain("Play Local Game");
		expect(build.toLowerCase()).toContain("reset");
	});

	test("protocol defines the two-match rules and observer evidence", () => {
		const protocol = read("docs/playtest-protocol.md");

		for (const required of [
			"Match 1",
			"no gameplay explanation",
			"first point of",
			"Match 2",
			"Clarification is allowed only after Match 1",
			"Observer Sheet",
			"screenshot/log",
			"crash",
			"reproduction steps",
			"blocker",
		]) expect(protocol).toContain(required);
	});

	test("questionnaire covers the required human observations", () => {
		const questionnaire = read("docs/playtest-questionnaire.md");

		for (const required of [
			"goal of the match",
			"active",
			"Aiming",
			"Power",
			"item phase",
			"Feedback",
			"camera",
			"unfair",
			"too short",
			"too long",
			"voluntarily play another match",
			"rating: <1-5>",
		]) expect(questionnaire.toLowerCase()).toContain(required.toLowerCase());
	});

	test("issue template requires actionable playtest context", () => {
		const template = read(".github/ISSUE_TEMPLATE/playtest-finding.md");

		for (const required of [
			"Classification",
			"Session ID",
			"Artifact",
			"Source commit",
			"Expected result",
			"Actual result",
			"Reproduction steps",
			"Screenshot",
			"Log",
		]) expect(template).toContain(required);
	});

	test("all human-playtest readiness artifacts exist and the delivery record links the focused test", () => {
		for (const file of [
			"docs/playtest-protocol.md",
			"docs/playtest-questionnaire.md",
			".github/ISSUE_TEMPLATE/playtest-finding.md",
			"tests/human_playtest_readiness.test.ts",
		]) expect(existsSync(resolve(ROOT, file))).toBe(true);

		const checklist = read("step-by-step.md");
		expect(checklist).toContain("## 15. Gameplay Qualification And Human Playtest Validation");
		expect(checklist).toContain("human_playtest_readiness.test.ts");
	});
});

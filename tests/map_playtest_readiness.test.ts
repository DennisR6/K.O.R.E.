import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Task 17.9 - map review and human-test readiness.
 *
 * Asserts that the external-tester packet exists and covers every required
 * session element (exact revision, menu play, map rotation, first confusion
 * and first meaningful strategy, the seven per-map ratings, and map ID/seed/
 * screenshot/log/severity evidence), that the report records the readiness
 * status, and that no artifact manufactures human ratings or merges map-level
 * human qualification with the Section 15 gameplay release blockers.
 */

const ROOT = process.cwd();
const read = (file: string) => readFileSync(resolve(ROOT, file), "utf8");

const protocolPath = "docs/map-playtest-protocol.md";
const templatePath = ".github/ISSUE_TEMPLATE/map-playtest-finding.md";
const reportPath = "docs/map-qualification-report.md";

describe("Task 17.9 map playtest readiness", () => {
	test("the review packet files exist", () => {
		for (const file of [protocolPath, templatePath, reportPath]) {
			expect(existsSync(resolve(ROOT, file))).toBe(true);
		}
	});

	test("the protocol covers every required session element", () => {
		const protocol = read(protocolPath);
		for (const point of [
			"exact build or deployed browser revision",
			"visible **Choose Map** page",
			"Randomize or rotate map order",
			"first confusion",
			"first meaningful strategy",
			"Readability",
			"Navigation",
			"Hazard clarity",
			"Agency",
			"Pacing",
			"Fairness",
			"Willingness to replay",
			"map ID",
			"seed",
			"screenshot",
			"blocker severity",
		]) expect(protocol).toContain(point);
	});

	test("the protocol names the six browser-qualified candidates and excludes the blocked map", () => {
		const protocol = read(protocolPath);
		for (const mapId of ["ice-map-v1", "cue-clash", "magma-cradle", "symmetric-duel", "structure-control", "hazard-control"]) {
			expect(protocol).toContain(`| ${mapId} |`);
		}
		expect(protocol).toContain("frostbite-arena is `blocked`");
	});

	test("the issue template collects map ID, seed, severity, and evidence", () => {
		const template = read(templatePath);
		for (const field of [
			"Map ID",
			"Match settings seed",
			"## Severity",
			"critical",
			"major",
			"minor",
			"Screenshot",
			"console log",
			"blocker",
		]) expect(template).toContain(field);
	});

	test("human evidence stays PENDING and ratings cannot be manufactured", () => {
		const protocol = read(protocolPath);
		const report = read(reportPath);
		expect(protocol).toContain("Human evidence remains `PENDING`");
		expect(protocol).toContain("manufacture human ratings");
		expect(report).toContain("Human qualification remains `PENDING`");
		// The ledger must not claim human qualification for any map.
		expect(report).not.toContain("human-qualified |");
	});

	test("map-level human qualification stays separate from Section 15 release blockers", () => {
		const protocol = read(protocolPath);
		const report = read(reportPath);
		expect(protocol).toContain("separate from the existing Section 15");
		expect(protocol).toContain("does not change the Section 15");
		expect(report).toContain("does not change the Section 15 release record");
		expect(report).toContain("17.9:");
	});
});

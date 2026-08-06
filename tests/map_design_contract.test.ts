import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Section 17.1 - qualified map design contract.
 *
 * Asserts that `docs/map-design-contract.md` defines every required contract
 * point, the exact classification vocabulary, and the constraint that existing
 * detectors must not be weakened. The contract is the gate for every later
 * Section 17 task, so the test also asserts the report ledger exists and does
 * not yet claim any qualification evidence.
 */

const ROOT = process.cwd();
const read = (file: string) => readFileSync(resolve(ROOT, file), "utf8");

const requiredContractPoints = [
	"schema and game-settings validators",
	"validateMapDocument",
	"validateGameSettings",
	"finite, non-overlapping, legal spawn",
	"not begin inside solid geometry",
	"not begin inside a lethal hazard region",
	"Containment geometry must enclose all legal spawn and gameplay regions",
	"first legal action must be reachable through the production rule path",
	"settle within the existing playback bound",
	"1,200 frames",
	"technically reachable terminal mechanism",
	"last-team-standing",
	"symmetric or intentionally asymmetric",
	"must not infer fairness from non-terminal samples",
	"sub-pixel or extremely narrow",
	"angle corridor",
	"be weakened to admit a map",
];

const classifications = [
	"candidate",
	"technically-qualified",
	"browser-qualified",
	"human-qualified",
	"blocked",
	"rejected",
];

describe("Section 17.1 qualified map design contract", () => {
	test("the contract document exists and defines every required contract point", () => {
		expect(existsSync(resolve(ROOT, "docs/map-design-contract.md"))).toBe(true);
		const contract = read("docs/map-design-contract.md");
		for (const point of requiredContractPoints) expect(contract).toContain(point);
	});

	test("the contract defines exactly the six required classifications", () => {
		const contract = read("docs/map-design-contract.md");
		const table = contract.slice(contract.indexOf("| Status | Meaning |"), contract.indexOf("Rules:"));
		for (const classification of classifications) expect(table).toContain(`| \`${classification}\``);
		expect(contract).toContain("it must not be marked `human-qualified`");
	});

	test("the contract names the existing detectors it must not weaken", () => {
		const contract = read("docs/map-design-contract.md");
		for (const detector of [
			"Section 13 physics qualification suite",
			"Section 15 gameplay content matrix and softlock detection",
			"mirrored fairness tournament",
			"Section 16 real-browser harness",
		]) expect(contract).toContain(detector);
	});

	test("the report ledger carries a status for every known map and no false evidence", () => {
		const report = read("docs/map-qualification-report.md");
		for (const mapId of ["ice-map-v1", "cue-clash", "frostbite-arena", "magma-cradle", "symmetric-duel", "structure-control", "hazard-control"]) {
			expect(report).toContain(`| ${mapId} |`);
		}
		expect(report).toContain("No map receives `technically-qualified` or higher before the Task 17.3");
		expect(report).toContain("Human qualification remains `PENDING`");
	});

	test("the report does not weaken the existing qualification boundary", () => {
		const report = read("docs/map-qualification-report.md");
		// 17.8 recorded the real-browser E2E evidence, so the ledger now
		// claims browser-qualified (and blocked for frostbite-arena) with
		// that evidence; human qualification remains unclaimed.
		expect(report).toContain("17.7: complete shipped-map matrix qualified and recorded");
		expect(report).not.toContain("human-qualified |");
	});
});

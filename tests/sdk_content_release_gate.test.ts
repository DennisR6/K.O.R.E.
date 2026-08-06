import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { CONTENT_ARTIFACT_INVENTORY, CONTENT_QUALIFICATION_BOUNDARIES, CONTENT_QUALIFICATION_MATRIX, canonicalContentJson, contentFingerprint } from "../src/content/qualification.js";
import { canonicalizeContentPackage, hashContentPackage } from "../src/content/package.js";

const ROOT = resolve(import.meta.dir, "..");
const read = (file: string) => readFileSync(resolve(ROOT, file), "utf8");

const requiredEvidence = [
	"tests/content_cross_system_qualification.test.ts",
	"tests/sdk_only_release_gate.test.ts",
	"tests/sdk_examples_ci.test.ts",
	"tests/presentation_sdk.test.ts",
	"tests/item_interaction_qualification.test.ts",
	"tests/item_inventory.test.ts",
	"tests/environmental_mechanics.test.ts",
	"tests/milestone47_game_modes.test.ts",
	"tests/content_package.test.ts",
	"tests/competitive_map_pack.test.ts",
	"tests/browser/browser_release_gate.test.ts",
	"tests/desktop_packaging.test.ts",
	"docs/content-qualification-report.md",
	"docs/sdk-authoring-guide.md",
	"docs/desktop-release.md",
	"docs/playtest-protocol.md",
	"steps/50-sdk_authored_content_release_gate.md",
] as const;

const requiredCommands = [
	"bun run content:release-gate",
	"bun run examples:typecheck",
	"bun run examples:verify",
	"bun run test:browser:full",
	"bun run desktop:build",
	"npx tsc --noEmit",
	"bun run build",
] as const;

type ReleaseStatus = "pass" | "skip" | "blocked" | "pending";
const aggregateStatuses: readonly { name: string; status: ReleaseStatus; evidence: string }[] = [
	{ name: "package validation and hashes", status: "pass", evidence: "tests/content_package.test.ts" },
	{ name: "presentation snapshots", status: "pass", evidence: "tests/presentation_sdk.test.ts" },
	{ name: "items and inventory interactions", status: "pass", evidence: "tests/item_interaction_qualification.test.ts" },
	{ name: "maps and fingerprints", status: "pass", evidence: "tests/competitive_map_pack.test.ts" },
	{ name: "environmental mechanics", status: "pass", evidence: "tests/environmental_mechanics.test.ts" },
	{ name: "game modes", status: "pass", evidence: "tests/milestone47_game_modes.test.ts" },
	{ name: "imports and authoring inventory", status: "pass", evidence: "tests/sdk_only_release_gate.test.ts" },
	{ name: "browser and production build", status: "pass", evidence: "tests/browser/browser_release_gate.test.ts" },
	{ name: "desktop package", status: "pass", evidence: "tests/desktop_packaging.test.ts" },
	{ name: "package execution", status: "skip", evidence: "src/content/qualification.ts" },
	{ name: "external human playtest", status: "blocked", evidence: "docs/playtest-protocol.md" },
	{ name: "platform-specific human evidence", status: "pending", evidence: "docs/sdk-content-release-verification.md" },
];

describe("Milestone 50 SDK-authored content release gate", () => {
	test("inventory is complete, evidence files exist, and every matrix cell is classified", () => {
		expect(CONTENT_ARTIFACT_INVENTORY.length).toBeGreaterThan(0);
		for (const artifact of CONTENT_ARTIFACT_INVENTORY) {
			expect(artifact.evidence.length, artifact.id).toBeGreaterThan(0);
			for (const file of artifact.evidence) expect(existsSync(resolve(ROOT, file)), `${artifact.id}: ${file}`).toBe(true);
		}
		expect(CONTENT_QUALIFICATION_MATRIX).toHaveLength(CONTENT_ARTIFACT_INVENTORY.length * CONTENT_QUALIFICATION_BOUNDARIES.length);
		for (const cell of CONTENT_QUALIFICATION_MATRIX) {
			expect(["pass", "skip", "blocked"], `${cell.artifactId}/${cell.boundary}`).toContain(cell.status);
			expect(existsSync(resolve(ROOT, cell.evidence)), `${cell.artifactId}/${cell.boundary}: ${cell.evidence}`).toBe(true);
		}
	});

	test("canonical content and package hashes remain stable after JSON round trips", () => {
		const value = { z: [{ b: 2, a: 1 }], a: true };
		expect(contentFingerprint(value)).toBe(contentFingerprint(JSON.parse(JSON.stringify(value))));
		expect(canonicalizeContentPackage({ schemaVersion: 1, manifest: { id: "fixture", name: "Fixture", version: "1.0.0" } })).toBe(canonicalizeContentPackage(JSON.parse(JSON.stringify({ schemaVersion: 1, manifest: { id: "fixture", name: "Fixture", version: "1.0.0" } }))));
		expect(hashContentPackage({ schemaVersion: 1, manifest: { id: "fixture", name: "Fixture", version: "1.0.0" } })).toBe(hashContentPackage(JSON.parse(JSON.stringify({ schemaVersion: 1, manifest: { id: "fixture", name: "Fixture", version: "1.0.0" } }))));
	});

	test("release record keeps pass, skip, blocked, and pending distinct", () => {
		expect(new Set(aggregateStatuses.map(entry => entry.status))).toEqual(new Set(["pass", "skip", "blocked", "pending"]));
		for (const entry of aggregateStatuses) expect(existsSync(resolve(ROOT, entry.evidence)), entry.name).toBe(true);
	});

	test("release command, documentation, and roadmap are linked", () => {
		const packageJson = JSON.parse(read("package.json")) as { scripts: Record<string, string> };
		expect(packageJson.scripts["content:release-gate"]).toBe("bun run scripts/contentReleaseGate.ts");
		const report = read("docs/sdk-content-release-verification.md");
		for (const command of requiredCommands) expect(report).toContain(command);
		for (const status of ["PASS", "SKIP", "BLOCKED", "PENDING"]) expect(report).toContain(status);
		for (const file of requiredEvidence) expect(report).toContain(file);
		expect(read("step-by-step.md")).toContain("| 50 | `BLOCKED`");
		expect(read("steps/50-sdk_authored_content_release_gate.md")).toContain("No claim that automation substitutes");
	});
});

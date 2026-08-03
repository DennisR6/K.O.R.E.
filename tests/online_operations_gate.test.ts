import { expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

test("Section 20 operational evidence and privacy boundaries are present", () => {
	for (const file of [
		"tests/server_dashboard.test.ts",
		"tests/online_map_preference.test.ts",
		"tests/match_pause_protocol.test.ts",
		"tests/match_report_protocol.test.ts",
		"tests/shared_match_replay.test.ts",
		"tests/replay_share_security.test.ts",
		"tests/browser/shared_replay_viewer.e2e.test.ts",
		"tests/browser/online_operations_journey.e2e.test.ts",
	]) expect(existsSync(resolve(root, file))).toBe(true);
	const checklist = read("step-by-step.md");
	expect(checklist).toContain("## 20. Online Match Operations, Sharing, And Player Support");
	expect(checklist).toContain("replay sharing");
	const replayRoute = read("src/server/replayShares.ts");
	const replayStore = read("src/server/db.ts");
	expect(replayStore).toContain("finalSettings");
	expect(replayRoute).toContain("Replay unavailable");
});

test("release record preserves the human-playtest blocker", () => {
	const report = read("docs/release-verification.md");
	expect(report).toContain("BLOCKED / NOT QUALIFIED");
	expect(report).toContain("Section 20 Online Operations Qualification");
	expect(report).toContain("PASS - automated online operations");
});

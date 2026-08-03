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
	]) expect(existsSync(resolve(root, file))).toBe(true);
	const checklist = read("step-by-step.md");
	for (const task of ["[20.1]", "[20.2]", "[20.3]", "[20.4]", "[20.5]", "[20.6.0]", "[20.6.1]", "[20.6.2]", "[20.6.3]", "[20.6.4]", "[20.6.5]"]) expect(checklist).toContain(`[x] **Task ${task}`);
	const replayRoute = read("src/server/replayShares.ts");
	const replayStore = read("src/server/db.ts");
	expect(replayStore).toContain("finalSettings");
	expect(replayRoute).toContain("Replay unavailable");
});

test("release record preserves the human-playtest blocker", () => {
	const report = read("docs/release-verification.md");
	expect(report).toContain("BLOCKED / NOT QUALIFIED");
});

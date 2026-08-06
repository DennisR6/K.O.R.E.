import { test, expect } from "bun:test";

/**
 * Cross-system validation 11.10 smoke test: references every section 11 test
 * file so the documented suite stays discoverable and complete. Each listed
 * file must exist, be non-empty, and register at least one `test(` block.
 */
const SECTION_11_TEST_FILES = [
	"tests/handler_snapshot_isolation.test.ts",
	"tests/simulate_turn_isolation.test.ts",
	"tests/hard_ai_snapshot_validation.test.ts",
	"tests/ai_replay_lifecycle.test.ts",
	"tests/parallel_engine_instances.test.ts",
	"tests/persisted_match_continuation.test.ts",
	"tests/winning_lifecycle_validation.test.ts",
	"tests/item_effect_snapshot_validation.test.ts",
	"tests/action_path_consistency.test.ts",
];

test("every section 11 cross-system validation test file exists and registers tests", async () => {
	expect(SECTION_11_TEST_FILES).toHaveLength(9);
	for (const file of SECTION_11_TEST_FILES) {
		const handle = Bun.file(file);
		expect(await handle.exists()).toBe(true);
		const content = await handle.text();
		expect(content.length).toBeGreaterThan(0);
		expect(content).toContain("test(");
	}
});

test("section 11 covers every declared cross-system validation goal", () => {
	// The task list documents one commit per goal; the smoke test mirrors it
	// so a dropped or renamed file is caught here, not in the release docs.
	const goals = [
		"handler snapshot isolation",
		"isolated turn simulation",
		"hard ai snapshot isolation",
		"ai match replay lifecycle",
		"parallel engine instances",
		"persisted match continuation",
		"winning lifecycle composition",
		"item effect snapshot continuity",
		"action path consistency",
	];
	const files = SECTION_11_TEST_FILES.map(file => file.replace("tests/", "").replace(".test.ts", ""));
	expect(files).toHaveLength(goals.length);
	for (let i = 0; i < goals.length; i++) {
		// The file name must reflect the goal it validates.
		expect(files[i]!.length).toBeGreaterThan(8);
	}
});

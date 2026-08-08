import { join } from "node:path";

type Lane = "unit" | "integration" | "qualification" | "soak";

const root = process.cwd();
const soakPatterns = [
	"tests/ai_battle_maps.test.ts",
	"tests/ai_battle_match.test.ts",
	"tests/ai_battle_seed_variation.test.ts",
	"tests/ai_match_fuzz.test.ts",
	"tests/gameplay_content_matrix.test.ts",
	"tests/gameplay_fairness_tournament.test.ts",
	"tests/input_fuzz.test.ts",
	"tests/match_length_distribution.test.ts",
	"tests/physics_fuzz.test.ts",
	"tests/physics_performance.test.ts",
	"tests/shipped_map_matrix.test.ts",
];

const integrationPatterns = [
	"tests/action_path_consistency.test.ts",
	"tests/ai_battle_*.test.ts",
	"tests/authoritative_*.test.ts",
	"tests/application_bootstrap.test.ts",
	"tests/canonical_playable_match.test.ts",
	"tests/database_*.test.ts",
	"tests/delayed_item_runtime.test.ts",
	"tests/e2e_network_match.test.ts",
	"tests/gameplay_input_integration.test.ts",
	"tests/gameplay_phase_integration.test.ts",
	"tests/gameplay_scene_*.test.ts",
	"tests/handler_snapshot_isolation.test.ts",
	"tests/handler.test.ts",
	"tests/human_vs_ai_menu.test.ts",
	"tests/local_*.test.ts",
	"tests/match_pipeline_unification.test.ts",
	"tests/match_sdk_migration.test.ts",
	"tests/menu_match_start.integration.test.ts",
	"tests/network*.test.ts",
	"tests/offline_match_report.test.ts",
	"tests/online_*.test.ts",
	"tests/parallel_engine_instances.test.ts",
	"tests/persisted_*.test.ts",
	"tests/playback_*.test.ts",
	"tests/replay_*.test.ts",
	"tests/restore_matches.test.ts",
	"tests/server_*.test.ts",
	"tests/shared_match_replay.test.ts",
	"tests/simulate_turn_isolation.test.ts",
	"tests/versus_ai.test.ts",
];

const qualificationPatterns = [
	"tests/ai_replay_lifecycle.test.ts",
	"tests/actor_eligibility_qualification.test.ts",
	"tests/anker_*.test.ts",
	"tests/content_cross_system_qualification.test.ts",
	"tests/cross_system_validation_smoke.test.ts",
	"tests/delayed_mine_*.test.ts",
	"tests/effect_sdk_migration.test.ts",
	"tests/falltuer_*.test.ts",
	"tests/freeze_shot_*.test.ts",
	"tests/gameplay_content_inventory.test.ts",
	"tests/gameplay_feedback*.test.ts",
	"tests/gameplay_qualification_contract.test.ts",
	"tests/gameplay_release_gate.test.ts",
	"tests/hard_ai_snapshot_validation.test.ts",
	"tests/hazard_control_map.test.ts",
	"tests/ghost_mode_*.test.ts",
	"tests/human_playtest_readiness.test.ts",
	"tests/item_gameplay_qualification.test.ts",
	"tests/item_interaction_qualification.test.ts",
	"tests/jaegermeister_elixier_item.test.ts",
	"tests/map_content_inventory.test.ts",
	"tests/map_design_contract.test.ts",
	"tests/map_playtest_readiness.test.ts",
	"tests/map_qualification_harness.test.ts",
	"tests/map_release_gate.test.ts",
	"tests/competitive_map_pack.test.ts",
	"tests/magnet_*.test.ts",
	"tests/match_completion_gate.test.ts",
	"tests/match_status_model.test.ts",
	"tests/mini_wall_*.test.ts",
	"tests/mystery_box_*.test.ts",
	"tests/online_map_mystery_box.test.ts",
	"tests/playtest_*.test.ts",
	"tests/playable_vertical_slice.e2e.test.ts",
	"tests/power_dash_*.test.ts",
	"tests/release_candidate_gate.test.ts",
	"tests/release_smoke.test.ts",
	"tests/remaining_items_characterization.test.ts",
	"tests/sdk_content_release_gate.test.ts",
	"tests/sdk_migration_cross_system_qualification.test.ts",
	"tests/sdk_migration_inventory.test.ts",
	"tests/sdk_only_release_gate.test.ts",
	"tests/selection_lock_qualification.test.ts",
	"tests/structure_identity_migration.test.ts",
	"tests/structure_lifecycle_characterization.test.ts",
	"tests/switch_*.test.ts",
	"tests/structure_control_map.test.ts",
	"tests/symmetric_duel_map.test.ts",
	"tests/temporary_wall.test.ts",
	"tests/vodka_zero_*.test.ts",
	"tests/winner_state_unification.test.ts",
	"tests/winning_*.test.ts",
	"tests/environmental_mechanics.test.ts",
	"tests/physics_qualification_gate.test.ts",
	"tests/physics_snapshot_continuity.test.ts",
];

const qualificationFastPatterns = [
	"tests/*_characterization.test.ts",
	"tests/*_item.test.ts",
	"tests/action_modifier.test.ts",
	"tests/actor_eligibility_qualification.test.ts",
	"tests/collision_filter.test.ts",
	"tests/environmental_mechanics.test.ts",
	"tests/lifetime.test.ts",
	"tests/physics_snapshot_continuity.test.ts",
	"tests/structure_identity_migration.test.ts",
	"tests/system_settings_roundtrip.test.ts",
	"tests/temporal_modifier.test.ts",
	"tests/gameplay_qualification_contract.test.ts",
];

const blockedQualificationPatterns = [
	"tests/hazard_control_map.test.ts",
	"tests/map_qualification_harness.test.ts",
	"tests/structure_control_map.test.ts",
	"tests/symmetric_duel_map.test.ts",
];

const integrationFastExcludedPatterns = [
	"tests/ai_battle_pause_control.test.ts",
	"tests/canonical_playable_match.test.ts",
	"tests/server_config.integration.test.ts",
	"tests/server_dashboard.integration.test.ts",
];

function matches(path: string, pattern: string): boolean {
	const regex = new RegExp(`^${pattern.replace(/[.+^${}()|[\\]\\]/g, "\\$&").replaceAll("*", ".*")}$`);
	return regex.test(path);
}

function inPatterns(path: string, patterns: readonly string[]): boolean { return patterns.some(pattern => matches(path, pattern)); }

function discover(): string[] {
	const files = [
		...Array.from(new Bun.Glob("tests/**/*.test.ts").scanSync(root)),
		...Array.from(new Bun.Glob("tests/**/*_test.ts").scanSync(root)),
	].map(path => path.replaceAll("\\", "/")).filter(path => !path.startsWith("tests/browser/")).sort();
	return [...new Set(files)];
}

function classify(path: string): Lane {
	if (inPatterns(path, soakPatterns)) return "soak";
	if (inPatterns(path, qualificationPatterns)) return "qualification";
	if (inPatterns(path, integrationPatterns)) return "integration";
	return "unit";
}

function filesFor(lane: Lane, profile: string): string[] {
	const files = discover().filter(path => classify(path) === lane);
	if (lane === "integration" && profile === "fast") return files.filter(path => !inPatterns(path, integrationFastExcludedPatterns));
	if (lane === "qualification" && profile === "blocked") return files.filter(path => inPatterns(path, blockedQualificationPatterns));
	if (lane === "qualification" && profile === "fast") return files.filter(path => inPatterns(path, qualificationFastPatterns));
	if (lane === "qualification" && profile !== "all") return files.filter(path => !inPatterns(path, blockedQualificationPatterns));
	return files;
}

function printManifest(): void {
	const files = discover();
	const browserFiles = Array.from(new Bun.Glob("tests/browser/**/*.test.ts").scanSync(root)).sort();
	const counts = new Map<Lane, number>();
	for (const file of files) counts.set(classify(file), (counts.get(classify(file)) ?? 0) + 1);
	console.log(JSON.stringify({ total: files.length, browser: browserFiles, counts: Object.fromEntries(counts), files: Object.fromEntries(files.map(file => [file, classify(file)])) }, null, 2));
}

const lane = process.env.TEST_LANE as Lane | undefined;
if (process.argv.includes("--list")) {
	printManifest();
	process.exit(0);
}
if (!lane || !["unit", "integration", "qualification", "soak"].includes(lane)) throw new Error("TEST_LANE must be unit, integration, qualification, or soak");

const files = filesFor(lane, process.env.TEST_PROFILE ?? "full");
if (files.length === 0) throw new Error(`No tests classified for ${lane}`);
console.log(`${lane} lane: ${files.length} files`);
	const timeoutArgs = lane === "integration" || lane === "qualification" ? ["--timeout", "120000"] : lane === "soak" ? ["--timeout", "600000"] : [];
	const result = Bun.spawnSync({ cmd: ["bun", "test", ...timeoutArgs, ...files.map(file => join(root, file))], cwd: root, stdout: "inherit", stderr: "inherit" });
process.exit(result.exitCode ?? 1);

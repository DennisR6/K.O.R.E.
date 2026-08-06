const FAST_TEST_BUDGET_MS = 60_000;
const SLOW_TEST_PATHS = [
	"tests/browser/**",
	"tests/ai_match_fuzz*",
	"tests/physics_fuzz*",
	"tests/physics_performance*",
	"tests/shipped_map_matrix*",
	"tests/gameplay_content_matrix*",
	"tests/gameplay_fairness_tournament*",
	"tests/match_length_distribution*",
	"tests/input_fuzz*",
	"tests/ai_*",
	"tests/*_ai*",
	"tests/*replay*",
	"tests/*map*",
	"tests/*integration*",
	"tests/*lifecycle*",
	"tests/*qualification*",
	"tests/*validation*",
	"tests/*snapshot*",
	"tests/*consistency*",
];

const startedAt = performance.now();
const result = Bun.spawnSync({
	cmd: ["bun", "test", ...SLOW_TEST_PATHS.flatMap(pattern => ["--path-ignore-patterns", pattern])],
	cwd: process.cwd(),
	stdout: "inherit",
	stderr: "inherit",
});
const elapsedMs = performance.now() - startedAt;

if (result.exitCode !== 0) process.exit(result.exitCode);
if (elapsedMs > FAST_TEST_BUDGET_MS) {
	console.error(`Fast test suite exceeded its ${FAST_TEST_BUDGET_MS / 1000}s budget (${Math.ceil(elapsedMs)}ms). Move slow coverage into a dedicated qualification command.`);
	process.exit(1);
}
console.log(`Fast test suite completed in ${Math.ceil(elapsedMs)}ms (budget: ${FAST_TEST_BUDGET_MS}ms).`);

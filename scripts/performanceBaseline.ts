import { comparePerformanceProfile, validatePerformanceBaseline, type PerformanceBaselineDocument, type PerformanceMetricComparison } from "../src/performance/baseline.js";

const BASELINE_PATH = "performance/baselines.json";
const PROFILE_ID = "hard-ai-ice-seed-1";

type ProfileOutput = {
	totalMs: number;
	decisionMs: number;
	decisions: number;
	candidateTimeTotalMs: number;
	candidateTickTotal: number;
	acceptedTickTotal: number;
	candidateCount: number;
	collisionChecks: number;
	physicsTicks: number;
	simulations: number;
};

async function runProfile(): Promise<ProfileOutput> {
	const process = Bun.spawn(["bun", "run", "scripts/profileAiBattle.ts"], { stdout: "pipe", stderr: "pipe" });
	const [stdout, stderr, exitCode] = await Promise.all([new Response(process.stdout).text(), new Response(process.stderr).text(), process.exited]);
	if (exitCode !== 0) throw new Error(`Performance profiler failed (${exitCode}): ${stderr.trim()}`);
	const line = stdout.split("\n").map(value => value.trim()).reverse().find(value => value.startsWith("{"));
	if (!line) throw new Error("Performance profiler did not emit a JSON profile");
	return JSON.parse(line) as ProfileOutput;
}

function currentMetrics(profile: ProfileOutput): Record<string, number> {
	return {
		matchTimeMs: Math.round(profile.totalMs),
		candidateSimulationMs: Math.round(profile.candidateTimeTotalMs),
		avgDecisionTimeMs: Math.round(profile.decisionMs / profile.decisions),
		speculativeTicks: profile.candidateTickTotal,
		acceptedTicks: profile.acceptedTickTotal,
		candidateCount: profile.candidateCount,
		collisionChecks: profile.collisionChecks,
		physicsTicks: profile.physicsTicks,
		simulationCount: profile.simulations,
	};
}

async function loadBaseline(): Promise<PerformanceBaselineDocument> {
	const baseline = await Bun.file(BASELINE_PATH).json();
	validatePerformanceBaseline(baseline);
	return baseline;
}

function formatNumber(value: number): string { return Number.isFinite(value) ? Math.round(value).toLocaleString("en-US") : "inf"; }
function formatPercent(value: number): string { return Number.isFinite(value) ? `${value >= 0 ? "+" : ""}${value.toFixed(1)}%` : "inf"; }

function printReport(result: ReturnType<typeof comparePerformanceProfile>): void {
	console.log(`Performance profile: ${result.profile}\n`);
	console.log("Metric                    Kind         Baseline      Current       Delta      Limit       Result");
	console.log("------------------------------------------------------------------------------------------------");
	for (const metric of result.metrics) {
		console.log(`${metric.metric.padEnd(25)} ${metric.kind.padEnd(12)} ${formatNumber(metric.baseline).padStart(12)} ${formatNumber(metric.current).padStart(12)} ${formatPercent(metric.deltaPercent).padStart(10)} ${(`+${metric.maxRegressionPercent}%`).padStart(10)} ${metric.passed ? "PASS" : "FAIL"}`);
	}
	for (const error of result.errors) console.error(`ERROR: ${error}`);
	if (!result.passed) {
		console.error("\nPERFORMANCE REGRESSION");
		for (const metric of result.metrics.filter(metric => !metric.passed)) printFailure(metric);
	}
	console.log(`\nResult: ${result.passed ? "PASS" : "FAIL"}`);
}

function printFailure(metric: PerformanceMetricComparison): void {
	console.error(`${metric.metric}: baseline ${formatNumber(metric.baseline)}, current ${formatNumber(metric.current)}, change ${formatPercent(metric.deltaPercent)}, allowed +${metric.maxRegressionPercent}%`);
}

async function main(): Promise<void> {
	const command = process.argv[2] ?? "check";
	if (command !== "check" && command !== "update") throw new Error("Usage: performanceBaseline.ts <check|update>");
	const baseline = await loadBaseline();
	const profile = await runProfile();
	const metrics = currentMetrics(profile);
	if (command === "update") {
		const target = baseline.profiles[PROFILE_ID];
		if (!target) throw new Error(`Missing performance profile '${PROFILE_ID}'`);
		for (const [metricId, definition] of Object.entries(target.metrics)) {
			const value = metrics[metricId];
			if (value === undefined) throw new Error(`Profiler does not emit baseline metric '${metricId}'`);
			definition.baseline = value;
		}
		await Bun.write(BASELINE_PATH, `${JSON.stringify(baseline, null, 2)}\n`);
		console.log(`Updated ${BASELINE_PATH} for ${PROFILE_ID}. Review the Git diff and explain intentional increases.`);
		return;
	}
	const result = comparePerformanceProfile(baseline, PROFILE_ID, metrics);
	printReport(result);
	if (!result.passed) process.exitCode = 1;
}

await main().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });

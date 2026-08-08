import { expect, test } from "bun:test";
import { comparePerformanceProfile, validatePerformanceBaseline, type PerformanceBaselineDocument } from "../src/performance/baseline.ts";

function baseline(maxRegressionPercent = 10): PerformanceBaselineDocument {
	return {
		schemaVersion: 1,
		profiles: {
			"test-profile": {
				metadata: { description: "comparator test" },
				metrics: {
					work: { kind: "work", baseline: 100, maxRegressionPercent },
					exact: { kind: "work", baseline: 480, maxRegressionPercent: 0 },
				},
			},
		},
	};
}

test("performance improvements pass without symmetric tolerance", () => {
	const result = comparePerformanceProfile(baseline(), "test-profile", { work: 80, exact: 480 });
	expect(result.passed).toBe(true);
	expect(result.metrics.find(metric => metric.metric === "work")!.deltaPercent).toBe(-20);
});

test("allowed wall-clock regression passes", () => {
	const result = comparePerformanceProfile(baseline(), "test-profile", { work: 109, exact: 480 });
	expect(result.passed).toBe(true);
});

test("excessive regression fails", () => {
	const result = comparePerformanceProfile(baseline(), "test-profile", { work: 111, exact: 480 });
	expect(result.passed).toBe(false);
	expect(result.metrics.find(metric => metric.metric === "work")!.passed).toBe(false);
});

test("exact invariant fails on any increase", () => {
	const result = comparePerformanceProfile(baseline(), "test-profile", { work: 100, exact: 481 });
	expect(result.passed).toBe(false);
	expect(result.errors).toEqual([]);
});

test("missing profiles and metrics fail clearly", () => {
	const missingProfile = comparePerformanceProfile(baseline(), "missing", { work: 1 });
	const missingMetric = comparePerformanceProfile(baseline(), "test-profile", { work: 1 });
	expect(missingProfile.passed).toBe(false);
	expect(missingProfile.errors[0]).toContain("Missing performance profile");
	expect(missingMetric.passed).toBe(false);
	expect(missingMetric.errors[0]).toContain("Missing current metric");
});

test("invalid baseline schema is rejected", () => {
	expect(() => validatePerformanceBaseline({ schemaVersion: 2, profiles: {} })).toThrow("Unsupported performance baseline schema version");
	expect(() => validatePerformanceBaseline({ schemaVersion: 1, profiles: {} })).toThrow("at least one profile");
});

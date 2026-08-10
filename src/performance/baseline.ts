export const PERFORMANCE_BASELINE_SCHEMA_VERSION = 1 as const;

export type PerformanceMetricKind = "work" | "wall-clock";

export interface PerformanceMetricBaseline {
	kind: PerformanceMetricKind;
	baseline: number;
	maxRegressionPercent: number;
}

export interface PerformanceProfileBaseline {
	metadata: Record<string, string | number | boolean>;
	metrics: Record<string, PerformanceMetricBaseline>;
}

export interface PerformanceBaselineDocument {
	schemaVersion: typeof PERFORMANCE_BASELINE_SCHEMA_VERSION;
	profiles: Record<string, PerformanceProfileBaseline>;
}

export interface PerformanceMetricComparison {
	metric: string;
	kind: PerformanceMetricKind;
	baseline: number;
	current: number;
	deltaPercent: number;
	maxRegressionPercent: number;
	passed: boolean;
}

export interface PerformanceProfileComparison {
	profile: string;
	passed: boolean;
	metrics: PerformanceMetricComparison[];
	errors: string[];
}

export function validatePerformanceBaseline(value: unknown): asserts value is PerformanceBaselineDocument {
	const document = record(value, "Performance baseline");
	if (document.schemaVersion !== PERFORMANCE_BASELINE_SCHEMA_VERSION) throw new Error("Unsupported performance baseline schema version");
	const profiles = record(document.profiles, "Performance baseline profiles");
	if (Object.keys(profiles).length === 0) throw new Error("Performance baseline requires at least one profile");
	for (const [profileId, rawProfile] of Object.entries(profiles)) {
		if (profileId.length === 0) throw new Error("Performance baseline profile IDs must be non-empty");
		const profile = record(rawProfile, `Performance profile '${profileId}'`);
		const metadata = record(profile.metadata, `Performance profile '${profileId}' metadata`);
		for (const [key, metadataValue] of Object.entries(metadata)) {
			if (!key || (typeof metadataValue !== "string" && typeof metadataValue !== "number" && typeof metadataValue !== "boolean") || typeof metadataValue === "number" && !Number.isFinite(metadataValue)) throw new Error(`Performance profile '${profileId}' has invalid metadata '${key}'`);
		}
		const metrics = record(profile.metrics, `Performance profile '${profileId}' metrics`);
		if (Object.keys(metrics).length === 0) throw new Error(`Performance profile '${profileId}' requires metrics`);
		for (const [metricId, rawMetric] of Object.entries(metrics)) {
			const metric = record(rawMetric, `Performance metric '${profileId}.${metricId}'`);
			if (metric.kind !== "work" && metric.kind !== "wall-clock") throw new Error(`Performance metric '${profileId}.${metricId}' has an invalid kind`);
			finiteNonNegative(metric.baseline, `Performance metric '${profileId}.${metricId}' baseline`);
			finiteNonNegative(metric.maxRegressionPercent, `Performance metric '${profileId}.${metricId}' maxRegressionPercent`);
		}
	}
}

export function comparePerformanceProfile(document: PerformanceBaselineDocument, profileId: string, current: Record<string, number>): PerformanceProfileComparison {
	validatePerformanceBaseline(document);
	const profile = document.profiles[profileId];
	if (!profile) return { profile: profileId, passed: false, metrics: [], errors: [`Missing performance profile '${profileId}'`] };
	const errors: string[] = [];
	const metrics: PerformanceMetricComparison[] = [];
	for (const [metricId, definition] of Object.entries(profile.metrics)) {
		const currentValue = current[metricId];
		if (currentValue === undefined) {
			errors.push(`Missing current metric '${profileId}.${metricId}'`);
			continue;
		}
		if (typeof currentValue !== "number" || !Number.isFinite(currentValue) || currentValue < 0) {
			errors.push(`Current metric '${profileId}.${metricId}' must be a finite non-negative number`);
			continue;
		}
		const deltaPercent = definition.baseline === 0
			? currentValue === 0 ? 0 : Number.POSITIVE_INFINITY
			: ((currentValue - definition.baseline) / definition.baseline) * 100;
		metrics.push({ metric: metricId, kind: definition.kind, baseline: definition.baseline, current: currentValue, deltaPercent, maxRegressionPercent: definition.maxRegressionPercent, passed: currentValue <= definition.baseline * (1 + definition.maxRegressionPercent / 100) });
	}
	return { profile: profileId, passed: errors.length === 0 && metrics.every(metric => metric.passed), metrics, errors };
}

function record(value: unknown, label: string): Record<string, any> {
	if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error(`${label} must be an object`);
	return value as Record<string, any>;
}

function finiteNonNegative(value: unknown, label: string): asserts value is number {
	if (typeof value !== "number" || !Number.isFinite(value) || value < 0) throw new Error(`${label} must be a finite non-negative number`);
}

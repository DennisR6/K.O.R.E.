import { collectAssetReferences, type RenderAssetReference } from "@coffeemakerstudio/roast";
import { assetManager, type AssetLoadState } from "./loader.js";
import { startupMark } from "../kore/runtime/startupTelemetry.js";

export type AssetPreloadSummary = {
	references: number;
	uniqueAssets: number;
	alreadyReady: number;
	alreadyLoading: number;
	started: number;
	completed: number;
	failed: number;
	durationMs: number;
};

export type AssetPreloadSource = {
	preload(reference: RenderAssetReference): Promise<unknown>;
	getState(reference: RenderAssetReference): AssetLoadState;
};

export class AssetPreloader {
	private warming: Promise<AssetPreloadSummary> | undefined;
	public warm(settings: unknown, source: AssetPreloadSource = browserAssetSource): Promise<AssetPreloadSummary> {
		this.warming ??= preloadRenderableAssets(settings, source);
		return this.warming;
	}
}

const browserAssetSource: AssetPreloadSource = {
	preload: reference => assetManager.preload(reference as Parameters<typeof assetManager.preload>[0]),
	getState: reference => assetManager.getState(reference as Parameters<typeof assetManager.getState>[0]),
};

/** Starts one best-effort warmup through the authoritative rendering cache. */
export async function preloadRenderableAssets(settings: unknown, source: AssetPreloadSource = browserAssetSource): Promise<AssetPreloadSummary> {
	const references = collectAssetReferences(settings);
	const startedAt = performance.now();
	const summary: AssetPreloadSummary = { references: references.length, uniqueAssets: references.length, alreadyReady: 0, alreadyLoading: 0, started: 0, completed: 0, failed: 0, durationMs: 0 };
	startupMark("assets.preload.started", { references: references.length, uniqueAssets: references.length });
	const loads = references.map(reference => {
		const state = source.getState(reference);
		if (state === "ready") { summary.alreadyReady++; return Promise.resolve(true); }
		if (state === "loading") summary.alreadyLoading++;
		else if (state === "missing") summary.started++;
		return source.preload(reference).then(() => {
			if (source.getState(reference) === "ready") { summary.completed++; return true; }
			summary.failed++;
			return false;
		}).catch(() => { summary.failed++; return false; });
	});
	await Promise.all(loads);
	summary.durationMs = performance.now() - startedAt;
	startupMark("assets.preload.completed", summary);
	return summary;
}

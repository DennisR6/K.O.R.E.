import { AssetList, AssetPaths, type AssetKey } from './assets/assetRegistry.js';
import { recordStartupAsset } from '../engine/startupTelemetry.js';

type ImageKey = AssetKey | string;
type LoadedImage = HTMLImageElement | ImageBitmap;
type FetchImplementation = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
export type AssetLoadState = "missing" | "loading" | "ready" | "failed";

export class EngineAssetManager {
	private readonly fetchImpl: FetchImplementation;
	private readonly imageFactory: () => HTMLImageElement;
	private cache: Map<ImageKey, LoadedImage> = new Map();
	private errorCount: Map<ImageKey, number> = new Map();
	private MAX_RETRIES = 2;
	private inFlight: Map<ImageKey, Promise<LoadedImage | null>> = new Map();
	public constructor(options: { fetchImpl?: FetchImplementation; imageFactory?: () => HTMLImageElement } = {}) {
		this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
		this.imageFactory = options.imageFactory ?? (() => new Image());
	}

	get(key: ImageKey): LoadedImage | null {
		if (key === undefined) {
			console.log(`${key}:${typeof key === "number" ? AssetPaths[key] : key} is undefined`, key)
			return null
		}
		if (this.cache.has(key)) return this.cache.get(key)!;

		void this.preload(key);

		return null;
	}

	getState(key: ImageKey): AssetLoadState {
		if (this.cache.has(key)) return "ready";
		if (this.inFlight.has(key)) return "loading";
		if ((this.errorCount.get(key) ?? 0) > this.MAX_RETRIES) return "failed";
		return "missing";
	}

	preload(key: ImageKey): Promise<LoadedImage | null> {
		if (this.cache.has(key)) return Promise.resolve(this.cache.get(key)!);
		const existing = this.inFlight.get(key);
		if (existing) return existing;
		const promise = this.startAsyncLoad(key).finally(() => this.inFlight.delete(key));
		this.inFlight.set(key, promise);
		return promise;
	}

	private async startAsyncLoad(key: ImageKey): Promise<LoadedImage | null> {
		const currentRetries = this.errorCount.get(key) || 0;
		this.errorCount.set(key, currentRetries + 1);

		const startedAt = performance.now();
		try {
			const fetchUrl = typeof key === "string" ? key : `./public/${AssetPaths[key]}?t=${Date.now()}`;
			const response = await this.fetchImpl(fetchUrl);
			if (!response.ok) throw new Error("Netzwerkfehler");

			const blob = await response.blob();
			const image = await this.decodeImage(blob, key);

			this.cache.set(key, image);
			this.errorCount.delete(key);
			recordStartupAsset(assetCategory(key), { durationMs: performance.now() - startedAt, bytes: blob.size });
			return image;
		} catch (e) {
			console.debug(`Asset ${key} konnte nicht geladen werden (Versuch ${currentRetries + 1})`);
			recordStartupAsset(assetCategory(key), { durationMs: performance.now() - startedAt, failed: true });

			// Wenn Limit erreicht: JSON Fallback
			if (currentRetries >= this.MAX_RETRIES) {
				console.error(`Fallback auf JSON für: ${key}`);
				return this.loadJsonFallback(key);
			}
			return null;
		}
	}

	private async decodeImage(blob: Blob, key: ImageKey): Promise<LoadedImage> {
		// Rasterizing SVGs as ImageBitmaps gives the p5 canvas a concrete image
		// source and avoids browser-specific SVG drawImage behavior.
		if (isSvgAsset(key) && typeof createImageBitmap === "function") {
			try {
				return await createImageBitmap(blob);
			} catch {
				// Fall back to HTMLImageElement for browsers without SVG bitmap support.
			}
		}

		const objectUrl = URL.createObjectURL(blob);
		try {
			const img = this.imageFactory();
			img.src = objectUrl;
			await img.decode();
			return img;
		} finally {
			URL.revokeObjectURL(objectUrl);
		}
	}

	private async loadJsonFallback(key: ImageKey): Promise<LoadedImage | null> {
		if (key === undefined || key === null) return null;
		const assetName = typeof key === "number" ? AssetList[key] : key;
		if (!assetName) return null;

		try {
			let response = await this.fetchImpl(`./assets/json/${assetName}.json`);
			if (!response.ok) {
				response = await this.fetchImpl(`./public/assets/json/${assetName}.json`);
			}
			if (!response.ok) throw new Error("JSON Fallback fehlgeschlagen");

			const data = await response.json();

			const img = this.imageFactory();
			img.src = data.payload;

			await img.decode();
			this.cache.set(key, img);
			console.info(`Erfolgreich aus JSON-Fallback geladen: ${key}`);
			return img;
		} catch (e) {
			console.error(`Kritischer Fehler: Asset ${key} nicht ladbar!`, e);
			return null;
		}
	}
}

function assetCategory(key: ImageKey): "images" | "fonts" | "audio" | "json/config" | "other" {
	const path = typeof key === "string" ? key : AssetPaths[key];
	if (typeof path !== "string") return "other";
	if (/\.(?:png|jpe?g|webp|gif|svg)(?:$|[?#])/i.test(path)) return "images";
	if (/\.(?:woff2?|ttf|otf)(?:$|[?#])/i.test(path)) return "fonts";
	if (/\.(?:mp3|wav|ogg|m4a)(?:$|[?#])/i.test(path)) return "audio";
	if (/\.(?:json|map)(?:$|[?#])/i.test(path)) return "json/config";
	return "other";
}

function isSvgAsset(key: ImageKey): boolean {
	const path = typeof key === "string" ? key : AssetPaths[key];
	return typeof path === "string" && /\.svg(?:$|[?#])/i.test(path);
}

export const assetManager = new EngineAssetManager();

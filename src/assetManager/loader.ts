import { AssetList, AssetPaths, type AssetKey } from './assets/assetRegistry.js';

type ImageKey = AssetKey | string;
type LoadedImage = HTMLImageElement | ImageBitmap;

class EngineAssetManager {
	private cache: Map<ImageKey, LoadedImage> = new Map();
	private errorCount: Map<ImageKey, number> = new Map();
	private MAX_RETRIES = 2;
	private isLoading: Set<ImageKey> = new Set();

	get(key: ImageKey): LoadedImage | null {
		if (key === undefined) {
			console.log(`${key}:${typeof key === "number" ? AssetPaths[key] : key} is undefined`, key)
			return null
		}
		if (this.cache.has(key)) return this.cache.get(key)!;

		const retries = this.errorCount.get(key) || 0;
		if (retries <= this.MAX_RETRIES) {
			this.startAsyncLoad(key);
		}

		return null;
	}

	private async startAsyncLoad(key: ImageKey) {
		if (this.isLoading.has(key)) return
		this.isLoading.add(key)

		const currentRetries = this.errorCount.get(key) || 0;
		this.errorCount.set(key, currentRetries + 1);

		try {
			const fetchUrl = typeof key === "string" ? key : `./public/${AssetPaths[key]}?t=${Date.now()}`;
			const response = await fetch(fetchUrl);
			if (!response.ok) throw new Error("Netzwerkfehler");

			const blob = await response.blob();
			const image = await this.decodeImage(blob, key);

			this.cache.set(key, image);
			this.errorCount.delete(key);
			this.isLoading.delete(key)
		} catch (e) {
			console.debug(`Asset ${key} konnte nicht geladen werden (Versuch ${currentRetries + 1})`);
			this.isLoading.delete(key)

			// Wenn Limit erreicht: JSON Fallback
			if (currentRetries >= this.MAX_RETRIES) {
				console.error(`Fallback auf JSON für: ${key}`);
				await this.loadJsonFallback(key);
			}
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
			const img = new Image();
			img.src = objectUrl;
			await img.decode();
			return img;
		} finally {
			URL.revokeObjectURL(objectUrl);
		}
	}

	private async loadJsonFallback(key: ImageKey) {
		if (key === undefined || key === null) return;
		const assetName = typeof key === "number" ? AssetList[key] : key;
		if (!assetName) return;

		try {
			let response = await fetch(`./assets/json/${assetName}.json`);
			if (!response.ok) {
				response = await fetch(`./public/assets/json/${assetName}.json`);
			}
			if (!response.ok) throw new Error("JSON Fallback fehlgeschlagen");

			const data = await response.json();

			const img = new Image();
			img.src = data.payload;

			await img.decode();
			this.cache.set(key, img);
			console.info(`Erfolgreich aus JSON-Fallback geladen: ${key}`);
		} catch (e) {
			console.error(`Kritischer Fehler: Asset ${key} nicht ladbar!`, e);
		}
	}
}

function isSvgAsset(key: ImageKey): boolean {
	const path = typeof key === "string" ? key : AssetPaths[key];
	return typeof path === "string" && /\.svg(?:$|[?#])/i.test(path);
}

export const assetManager = new EngineAssetManager();

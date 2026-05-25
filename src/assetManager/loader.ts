import { AssetList, AssetPaths, type AssetKey } from './assets/assetRegistry.js';

class EngineAssetManager {
	private cache: Map<AssetKey, HTMLImageElement> = new Map();
	private loadingSet: Set<AssetKey> = new Set();

	get(key: AssetList): HTMLImageElement | null {
		if (!key) return null
		if (this.cache.has(key)) return this.cache.get(key)!;

		if (!this.loadingSet.has(key)) {
			this.startAsyncLoad(key);
		}

		return null;
	}

	private async startAsyncLoad(key: AssetKey) {
		this.loadingSet.add(key);
		try {
			const path = AssetPaths[key]; // Pfad aus dem Manifest
			const response = await fetch(`./public/${path}`);
			const blob = await response.blob();

			const url = URL.createObjectURL(blob)
			const img = new Image();
			img.src = url;
			img.onload = () => {
				URL.revokeObjectURL(url)
			}

			await img.decode();

			this.cache.set(key, img);
		} catch (e) {
			console.error(`Fehler beim Laden von Asset: ${key}`, e);
		} finally {
			this.loadingSet.delete(key);
		}
	}
}

export const assetManager = new EngineAssetManager();

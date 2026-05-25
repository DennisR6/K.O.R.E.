import { AssetList, AssetPaths, type AssetKey } from './assets/assetRegistry.js';

class EngineAssetManager {
	private cache: Map<AssetKey, HTMLImageElement> = new Map();
	private errorCount: Map<AssetKey, number> = new Map();
	private MAX_RETRIES = 2;

	get(key: AssetList): HTMLImageElement | null {
		if (!key) return null
		if (this.cache.has(key)) return this.cache.get(key)!;

		const retries = this.errorCount.get(key) || 0;
		if (retries <= this.MAX_RETRIES) {
			this.startAsyncLoad(key);
		}

		return null;
	}

	private async startAsyncLoad(key: AssetKey) {
		const currentRetries = this.errorCount.get(key) || 0;
		this.errorCount.set(key, currentRetries + 1);

		try {
			const path = AssetPaths[key];
			const response = await fetch(`./public/${path}?t=${Date.now()}`);
			if (!response.ok) throw new Error("Netzwerkfehler");

			const blob = await response.blob();
			const url = URL.createObjectURL(blob);
			const img = new Image();
			img.src = url;
			await img.decode();

			this.cache.set(key, img);
			this.errorCount.delete(key);
		} catch (e) {
			console.warn(`Asset ${key} konnte nicht geladen werden (Versuch ${currentRetries + 1})`);

			// Wenn Limit erreicht: JSON Fallback
			if (currentRetries >= this.MAX_RETRIES) {
				console.error(`Fallback auf JSON für: ${key}`);
				await this.loadJsonFallback(key);
			}
		}
	}

	private async loadJsonFallback(key: AssetKey) {
		try {
			const response = await fetch(`./src/assetManager/assets/json/${AssetList[key]}.json`);
			if (!response.ok) throw new Error("JSON Fallback fehlgeschlagen");

			const data = await response.json();

			const img = new Image();
			img.src = data.payload;

			await img.decode();
			this.cache.set(key, img);
			console.log(`Erfolgreich aus JSON-Fallback geladen: ${key}`);
		} catch (e) {
			console.error(`Kritischer Fehler: Asset ${key} nicht ladbar!`, e);
		}
	}
}

export const assetManager = new EngineAssetManager();

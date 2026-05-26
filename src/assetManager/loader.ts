import { GameLogger } from '../utils/log.js';
import { AssetList, AssetPaths, type AssetKey } from './assets/assetRegistry.js';

class EngineAssetManager {
	private cache: Map<AssetKey, HTMLImageElement> = new Map();
	private errorCount: Map<AssetKey, number> = new Map();
	private MAX_RETRIES = 2;
	private isLoading: Set<AssetKey> = new Set();

	get(key: AssetList): HTMLImageElement | null {
		if (key === undefined) {
			console.log(`${key}:${AssetPaths[key]} is undefined`, key)
			return null
		}
		if (this.cache.has(key)) return this.cache.get(key)!;

		const retries = this.errorCount.get(key) || 0;
		if (retries <= this.MAX_RETRIES) {
			this.startAsyncLoad(key);
		}

		return null;
	}

	private async startAsyncLoad(key: AssetKey) {
		if (this.isLoading.has(key)) return
		this.isLoading.add(key)
		console.log("downloading picture", AssetPaths[key])

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
			this.isLoading.delete(key)
		} catch (e) {
			GameLogger.debug(`Asset ${key} konnte nicht geladen werden (Versuch ${currentRetries + 1})`);
			this.isLoading.delete(key)

			// Wenn Limit erreicht: JSON Fallback
			if (currentRetries >= this.MAX_RETRIES) {
				GameLogger.error(`Fallback auf JSON für: ${key}`);
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
			GameLogger.info(`Erfolgreich aus JSON-Fallback geladen: ${key}`);
		} catch (e) {
			GameLogger.error(`Kritischer Fehler: Asset ${key} nicht ladbar!`, e);
		}
	}
}

export const assetManager = new EngineAssetManager();

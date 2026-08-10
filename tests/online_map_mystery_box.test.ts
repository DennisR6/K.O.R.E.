import { describe, expect, test } from "bun:test";
import { createCanonicalPlayableMatchSettings } from "../src/settings/canonicalPlayableMatch.js";
import { buildMapSettings, MAP_CATALOG } from "../src/content/mapCatalog.js";
import { mysteryBoxItem } from "../src/item/officialItems.js";

describe("Online Playable Maps Mystery Box Integration", () => {
	test("canonical playable match settings includes mysteryBoxItem in items array and item economy", () => {
		const settings = createCanonicalPlayableMatchSettings();
		expect(settings.items.some(item => item.id === "mystery-box")).toBe(true);

		const loadouts = settings.gameMode?.itemEconomy.fixedLoadouts ?? [];
		expect(loadouts[0]?.items.some(i => i.itemId === "mystery-box")).toBe(false);
		expect(settings.gameMode?.itemEconomy.mapPickups.some(pickup => pickup.itemId === "mystery-box")).toBe(true);
		expect(loadouts[1]?.items.some(i => i.itemId === "mystery-box")).toBe(false);

		const pickups = settings.gameMode?.itemEconomy.mapPickups ?? [];
		expect(pickups.some(p => p.itemId === "mystery-box")).toBe(true);
	});

	test("all browser-available maps build settings with mysteryBoxItem present", () => {
		const baseTemplate = createCanonicalPlayableMatchSettings();
		const browserAvailable = MAP_CATALOG.filter(entry => entry.browserAvailable);

		for (const entry of browserAvailable) {
			const mapSettings = buildMapSettings(entry.id, baseTemplate);
			expect(mapSettings.items.some(item => item.id === "mystery-box")).toBe(true);
			expect(mapSettings.gameMode?.itemEconomy.mapPickups.some(p => p.itemId === "mystery-box")).toBe(true);
		}
	});
});

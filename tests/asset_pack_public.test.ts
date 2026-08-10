import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { AssetList, AssetPaths } from "../src/assetManager/assets/assetRegistry.js";

describe("Asset Pack & JSON Fallback Verification", () => {
	const jsonDir = path.resolve(__dirname, "../public/assets/json");

	test("JSON assets directory exists and contains base64 payloads", () => {
		expect(existsSync(jsonDir)).toBe(true);
		const files = readdirSync(jsonDir).filter(f => f.endsWith(".json"));
		expect(files.length).toBeGreaterThan(0);

		for (const file of files) {
			const filePath = path.join(jsonDir, file);
			const content = JSON.parse(readFileSync(filePath, "utf-8"));

			expect(content).toHaveProperty("name");
			expect(content).toHaveProperty("type");
			expect(content).toHaveProperty("payload");
			expect(typeof content.payload).toBe("string");
			expect(content.payload.startsWith("data:image/")).toBe(true);
		}
	});

	test("MIME types in base64 data URIs match image formats", () => {
		const files = readdirSync(jsonDir).filter(f => f.endsWith(".json"));

		for (const file of files) {
			const filePath = path.join(jsonDir, file);
			const content = JSON.parse(readFileSync(filePath, "utf-8"));
			const ext = content.type.toLowerCase();

			if (ext === "svg") {
				expect(content.payload.startsWith("data:image/svg+xml;base64,")).toBe(true);
			} else if (ext === "jpg" || ext === "jpeg") {
				expect(content.payload.startsWith("data:image/jpeg;base64,")).toBe(true);
			} else if (ext === "png") {
				expect(content.payload.startsWith("data:image/png;base64,")).toBe(true);
			} else if (ext === "webp") {
				expect(content.payload.startsWith("data:image/webp;base64,")).toBe(true);
			}
		}
	});

	test("AssetList enum and AssetPaths match generated keys", () => {
		expect(Object.keys(AssetList).length).toBeGreaterThan(0);
		expect(Object.keys(AssetPaths).length).toBeGreaterThan(0);
	});
});

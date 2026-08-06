import { test, expect, describe } from "bun:test";
import fs from "fs";
import path from "path";

describe("Offline Mobile Web Shell", () => {
	test("manifest.json exists and is valid web app manifest", () => {
		const manifestPath = path.resolve(process.cwd(), "public/manifest.json");
		expect(fs.existsSync(manifestPath)).toBe(true);
		const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
		expect(manifest.name).toBe("KORE Slipstrike");
		expect(manifest.display).toBe("standalone");
	});

	test("sw.js exists and contains service worker lifecycle handlers", () => {
		const swPath = path.resolve(process.cwd(), "public/sw.js");
		expect(fs.existsSync(swPath)).toBe(true);
		const swCode = fs.readFileSync(swPath, "utf-8");
		expect(swCode).toContain("install");
		expect(swCode).toContain("fetch");
	});
});

import { test, expect, describe } from "bun:test";
import fs from "fs";
import path from "path";

describe("Tauri Desktop Shell", () => {
	test("tauri.conf.json exists and contains correct config", () => {
		const configPath = path.resolve(process.cwd(), "src-tauri/tauri.conf.json");
		expect(fs.existsSync(configPath)).toBe(true);

		const raw = fs.readFileSync(configPath, "utf-8");
		const config = JSON.parse(raw);
		expect(config.package.productName).toBe("Slipstrike");
		expect(config.build.distDir).toBe("../");
		expect(config.tauri.windows[0].title).toContain("Slipstrike");
	});

	test("package.json contains desktop launch script", () => {
		const pkgPath = path.resolve(process.cwd(), "package.json");
		const raw = fs.readFileSync(pkgPath, "utf-8");
		const pkg = JSON.parse(raw);
		expect(pkg.scripts.desktop).toBeDefined();
	});
});

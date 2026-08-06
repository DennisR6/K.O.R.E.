import { test, expect, describe } from "bun:test";
import fs from "fs";
import path from "path";

describe("Tauri Desktop Shell Configuration", () => {
	test("tauri.conf.json exists and contains correct v2 configuration", () => {
		const configPath = path.resolve(process.cwd(), "src-tauri/tauri.conf.json");
		expect(fs.existsSync(configPath)).toBe(true);

		const raw = fs.readFileSync(configPath, "utf-8");
		const config = JSON.parse(raw);
		expect(config.productName).toBe("Slipstrike");
		expect(config.build.frontendDist).toBe("../dist");
		expect(config.app.windows[0].title).toContain("Slipstrike");
	});

	test("package.json contains desktop and desktop:build scripts", () => {
		const pkgPath = path.resolve(process.cwd(), "package.json");
		const raw = fs.readFileSync(pkgPath, "utf-8");
		const pkg = JSON.parse(raw);
		expect(pkg.scripts.desktop).toBeDefined();
		expect(pkg.scripts["desktop:build"]).toBeDefined();
	});
});

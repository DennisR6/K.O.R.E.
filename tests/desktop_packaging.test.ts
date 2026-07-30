import { test, expect, describe } from "bun:test";
import fs from "fs";
import path from "path";

describe("Document Desktop Build", () => {
	test("docs/desktop-release.md exists and documents release build", () => {
		const docPath = path.resolve(process.cwd(), "docs/desktop-release.md");
		expect(fs.existsSync(docPath)).toBe(true);
		const content = fs.readFileSync(docPath, "utf-8");
		expect(content).toContain("tauri build");
		expect(content).toContain("bun run build");
	});

	test("package.json contains production build script", () => {
		const pkgPath = path.resolve(process.cwd(), "package.json");
		const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
		expect(pkg.scripts.build).toBeDefined();
	});
});

import { test, expect, describe } from "bun:test";
import fs from "fs";
import path from "path";

describe("Tauri Desktop Packaging & Scaffold Verification", () => {
	test("src-tauri contains full required Tauri project scaffold", () => {
		const root = process.cwd();
		expect(fs.existsSync(path.resolve(root, "src-tauri/Cargo.toml"))).toBe(true);
		expect(fs.existsSync(path.resolve(root, "src-tauri/build.rs"))).toBe(true);
		expect(fs.existsSync(path.resolve(root, "src-tauri/src/main.rs"))).toBe(true);
		expect(fs.existsSync(path.resolve(root, "src-tauri/tauri.conf.json"))).toBe(true);

		const cargoToml = fs.readFileSync(path.resolve(root, "src-tauri/Cargo.toml"), "utf-8");
		expect(cargoToml).toContain("tauri");
		expect(cargoToml).toContain("slipstrike");
	});

	test("package.json contains desktop:build script and @tauri-apps/cli dependency", () => {
		const pkgPath = path.resolve(process.cwd(), "package.json");
		const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
		expect(pkg.scripts["desktop:build"]).toBeDefined();
		expect(pkg.scripts["desktop"]).toBeDefined();
		expect(pkg.devDependencies["@tauri-apps/cli"]).toBeDefined();
	});

	test("docs/desktop-release.md exists and documents desktop:build and cargo check", () => {
		const docPath = path.resolve(process.cwd(), "docs/desktop-release.md");
		expect(fs.existsSync(docPath)).toBe(true);
		const content = fs.readFileSync(docPath, "utf-8");
		expect(content).toContain("desktop:build");
		expect(content).toContain("cargo check");
	});

	test("native Tauri build produces executable binary or bundle artifacts", () => {
		const binaryPath = path.resolve(process.cwd(), "src-tauri/target/release/slipstrike");
		const debPath = path.resolve(process.cwd(), "src-tauri/target/release/bundle/deb/Slipstrike_0.0.1_amd64.deb");
		expect(fs.existsSync(binaryPath) || fs.existsSync(debPath)).toBe(true);
	});
});

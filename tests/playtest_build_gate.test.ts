import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = process.cwd();
const read = (file: string) => readFileSync(resolve(ROOT, file), "utf8");

describe("Section 14.12 human-testable build gate", () => {
	test("the reproducible playtest build and Tauri frontend contract are wired", () => {
		const packageJson = JSON.parse(read("package.json"));
		const tauri = JSON.parse(read("src-tauri/tauri.conf.json"));

		expect(packageJson.scripts["playtest:build"]).toBe("bun run build && bun run desktop:build");
		expect(packageJson.scripts["desktop:build"]).toBeDefined();
		expect(tauri.build.frontendDist).toBe("../dist");
		expect(tauri.bundle.active).toBe(true);
		expect(tauri.bundle.targets).toContain("deb");
	});

	test("the playtest instructions contain the complete human evidence contract", () => {
		const content = read("docs/playtest-build.md");
		for (const required of [
			"Exact source commit",
			"src-tauri/target/release/slipstrike",
			"Slipstrike_0.0.1_amd64.deb",
			"bun run playtest:build",
			"Play Local Game",
			"drag",
			"Power-Dash",
			"known limitations",
			"reset",
			"log",
			"screenshot",
		]) expect(content.toLowerCase()).toContain(required.toLowerCase());
	});

	test("the required Linux release artifacts exist after the packaging gate", () => {
		const executable = resolve(ROOT, "src-tauri/target/release/slipstrike");
		const deb = resolve(ROOT, "src-tauri/target/release/bundle/deb/Slipstrike_0.0.1_amd64.deb");
		expect(existsSync(executable)).toBe(true);
		expect(statSync(executable).mode & 0o111).toBeGreaterThan(0);
		expect(existsSync(deb)).toBe(true);
	});
});

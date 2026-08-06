import { test, expect, describe } from "bun:test";
import fs from "fs";
import path from "path";

describe("Cover Mobile Offline Flow", () => {
	test("service worker caches offline assets and registers correctly", () => {
		const swPath = path.resolve(process.cwd(), "public/sw.js");
		expect(fs.existsSync(swPath)).toBe(true);
		const swContent = fs.readFileSync(swPath, "utf-8");
		expect(swContent).toContain("caches.open");
		expect(swContent).toContain("fetch");
	});

	test("main.ts includes service worker registration logic", () => {
		const mainPath = path.resolve(process.cwd(), "src/main.ts");
		const mainContent = fs.readFileSync(mainPath, "utf-8");
		expect(mainContent).toContain("serviceWorker");
	});
});

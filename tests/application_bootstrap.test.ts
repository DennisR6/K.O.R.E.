import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

test("browser bootstrap delegates local and online composition to KORE runtime entry points", () => {
	const source = readFileSync("src/main.ts", "utf8");
	expect(source).toContain("kore.createHandler(GameSettings)");
	expect(source).toContain("kore.restoreHandler(settings)");
	expect(source).not.toContain("GameHandlerBuilder");
});

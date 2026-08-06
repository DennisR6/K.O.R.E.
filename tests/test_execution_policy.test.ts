import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

test("fast suite excludes browser E2E while CI retains a separate browser gate", () => {
	const root = process.cwd();
	const packageJson = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
	const workflow = readFileSync(resolve(root, ".github/workflows/node.js.yml"), "utf8");
	expect(packageJson.scripts.test).toBe("bun run test:fast");
	expect(packageJson.scripts["test:fast"]).toBe("bun run scripts/testFast.ts");
	expect(packageJson.scripts["test:qualification"]).toContain("test:browser:full");
	const fastRunner = readFileSync(resolve(root, "scripts/testFast.ts"), "utf8");
	expect(fastRunner).toContain("FAST_TEST_BUDGET_MS = 60_000");
	expect(fastRunner).toContain("tests/browser");
	expect(fastRunner).toContain("tests/ai_match_fuzz");
	expect(workflow).toContain("bun run test:fast");
	expect(workflow).toContain("bun run test:browser:full");
});

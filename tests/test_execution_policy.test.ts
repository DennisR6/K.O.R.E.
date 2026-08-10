import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

test("explicit test lanes keep browser E2E and soak coverage outside fast feedback", () => {
	const root = process.cwd();
	const packageJson = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
	const workflow = readFileSync(resolve(root, ".github/workflows/node.js.yml"), "utf8");
	expect(packageJson.scripts.test).toBe("bun run test:fast");
	expect(packageJson.scripts["test:unit"]).toContain("TEST_LANE=unit");
	expect(packageJson.scripts["test:integration"]).toContain("TEST_LANE=integration");
	expect(packageJson.scripts["test:integration:fast"]).toContain("TEST_PROFILE=fast");
	expect(packageJson.scripts["test:qualification"]).toContain("TEST_LANE=qualification");
	expect(packageJson.scripts["test:e2e"]).toContain("E2E_WORKERS=1");
	expect(packageJson.scripts["test:soak"]).toContain("test:fuzz");
	expect(packageJson.scripts["test:fast"]).toContain("test:qualification:fast");
	expect(readFileSync(resolve(root, "docs/test-architecture.md"), "utf8")).toContain("Every Bun-discoverable test is assigned");
	expect(workflow).toContain("bun run test:fast");
	expect(workflow).toContain("bun run test:browser:full");
});

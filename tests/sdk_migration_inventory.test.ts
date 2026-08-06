import { expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { classifySourcePath, legacyAuthoringPaths, sourceClassificationRules, validateMigrationInventory } from "../src/sdkMigration/inventory.ts";

function sourceFiles(directory: string): string[] {
	return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
		const path = join(directory, entry.name).replaceAll("\\", "/");
		if (entry.isDirectory()) return sourceFiles(path);
		return entry.isFile() && path.endsWith(".ts") ? [path] : [];
	});
}

test("the migration inventory is structurally valid and classifies every production module", () => {
	expect(() => validateMigrationInventory()).not.toThrow();
	const files = sourceFiles("src");
	const unclassified = files.filter(path => !classifySourcePath(path));
	expect(unclassified).toEqual([]);
	const duplicatePrefixes = sourceClassificationRules.filter((entry, index, entries) => entries.findIndex(candidate => candidate.path === entry.path) !== index);
	expect(duplicatePrefixes).toEqual([]);
});

test("the frozen contract and direct legacy authoring audit are complete", () => {
	const contract = readFileSync("SDK_MIGRATION_CONTRACT.md", "utf8");
	for (const heading of ["Layer Model", "Frozen Rules", "Migration Queue"]) expect(contract).toContain(heading);
	const paths = new Set(legacyAuthoringPaths.map(entry => entry.path));
	for (const path of ["src/scenes/matchPipeline.ts", "src/settings/canonicalPlayableMatch.ts", "src/item/officialItems.ts", "src/engine/Handler.ts", "src/server/gameRegistry.ts", "src/replay/player.ts", "src/main.ts"]) expect(paths.has(path)).toBe(true);
});

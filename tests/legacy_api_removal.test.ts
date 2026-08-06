import { expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Files removed in milestone 37; production code must never reintroduce them. */
const REMOVED_LEGACY_FILES = [
	"src/kore_sdk.ts",
	"src/item/ItemAnker.ts",
	"src/item/ItemCollector.ts",
	"src/item/ItemWall.ts",
	"src/item/Items.ts",
	"src/item/minimalItem.ts",
	"src/emitter/ReplayEmitter.ts",
	"src/emitter/Emitter.ts",
	"src/ui/UiStrategy.ts",
	"src/engine/gameOptions.ts",
	"src/settings/billiardMap.ts",
	"src/settings/test.ts",
	"src/server/game.ts",
	"src/server/shoot.ts",
	"src/server/utils.ts",
] as const;

/** Production modules that may reference `GameHandlerBuilder` directly. */
const BUILDER_ALLOWLIST = new Set([
	"src/engine/Handler.ts",
	"src/engine/runtimeFactory.ts",
]);

function sourceFiles(directory: string): string[] {
	return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
		const path = join(directory, entry.name).replaceAll("\\", "/");
		if (entry.isDirectory()) return sourceFiles(path);
		return entry.isFile() && path.endsWith(".ts") ? [path] : [];
	});
}

test("milestone 37 removed legacy files stay removed", () => {
	for (const path of REMOVED_LEGACY_FILES) expect(existsSync(path)).toBe(false);
});

test("production code never imports the removed legacy modules", () => {
	const removedSpecifiers = new Set(
		REMOVED_LEGACY_FILES.map(path => path.replace(/^src\//, "").replace(/\.ts$/, "")),
	);
	for (const file of sourceFiles("src")) {
		const source = readFileSync(file, "utf8");
		for (const line of source.split("\n")) {
			const match = /from\s+["'](.+?)["']/.exec(line.trim());
			if (!match) continue;
			const specifier = match[1]!.replace(/\.ts$/, "").replace(/\.js$/, "");
			const segments = specifier.split("/");
			const imported = segments.slice(segments.indexOf("src") >= 0 ? segments.indexOf("src") : 0).join("/");
			const leaf = segments[segments.length - 1]!;
			if (removedSpecifiers.has(imported) || removedSpecifiers.has(leaf)) {
				throw new Error(`${file}: reintroduced removed legacy import '${match[1]}'`);
			}
		}
	}
});

test("legacy GameHandlerBuilder construction is confined to its designated boundary", () => {
	for (const file of sourceFiles("src")) {
		if (BUILDER_ALLOWLIST.has(file)) continue;
		const source = readFileSync(file, "utf8");
		expect(source).not.toMatch(/new\s+GameHandlerBuilder/);
		expect(source).not.toMatch(/import\s*\{[^}]*GameHandlerBuilder/);
	}
});

test("production code cannot import the deprecated compatibility entry", () => {
	for (const file of sourceFiles("src")) {
		const source = readFileSync(file, "utf8");
		expect(source).not.toMatch(/from\s+["'][^"']*kore_sdk[^"']*["']/);
	}
});

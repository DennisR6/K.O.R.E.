import { expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "..");
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

const BUILDER_RUNTIME_ALLOWLIST = new Set(["src/engine/Handler.ts", "src/engine/runtimeFactory.ts"]);
const CORE_SYSTEM_RUNTIME_ALLOWLIST = new Set([
	"src/engine/Handler.ts",
	"src/systems/systemSettings.ts",
	"src/replay/player.ts",
	"src/server/gameRegistry.ts",
]);
const PUBLISHED_EXAMPLES = [
	"01-engine-sdk-world.ts",
	"02-kore-map-mod.ts",
	"03-kore-item-mod.ts",
	"04-kore-match-lifecycle.ts",
	"05-kore-ui-menu.ts",
	"06-kore-audio.ts",
	"07-engine-presentation.ts",
] as const;
const ALLOWED_EXAMPLE_IMPORTS = new Set([
	"../src/engine/sdk/index.js",
	"../src/engine/ui-sdk/index.js",
	"../src/engine/audio-sdk/index.js",
	"../src/engine/presentation-sdk/index.js",
	"../src/kore/sdk/index.js",
]);

const APPLICATION_BOUNDARIES = new Map([
	["src/main.ts", ["kore.createHandler", "kore.restoreHandler"]],
	["src/scenes/matchPipeline.ts", ["kore.createRuntimeMatch"]],
	["src/server/gameRegistry.ts", ["kore.createHandler", "kore.restoreHandler"]],
	["src/replay/player.ts", ["kore.restoreHandler"]],
]);

function sourceFiles(directory: string): string[] {
	return readdirSync(resolve(ROOT, directory), { withFileTypes: true }).flatMap(entry => {
		const path = join(directory, entry.name).replaceAll("\\", "/");
		if (entry.isDirectory()) return sourceFiles(path);
		return entry.isFile() && path.endsWith(".ts") ? [path] : [];
	});
}

function read(path: string): string { return readFileSync(resolve(ROOT, path), "utf8"); }

test("final gate keeps Milestone 37 legacy files and compatibility imports removed", () => {
	for (const path of REMOVED_LEGACY_FILES) expect(existsSync(resolve(ROOT, path)), path).toBe(false);
	for (const file of sourceFiles("src")) {
		const source = read(file);
		expect(source, `${file}: deprecated compatibility import`).not.toMatch(/from\s+["'][^"']*kore_sdk[^"']*["']/);
		if (BUILDER_RUNTIME_ALLOWLIST.has(file)) continue;
		expect(source, `${file}: forbidden GameHandlerBuilder construction`).not.toMatch(/new\s+GameHandlerBuilder/);
		expect(source, `${file}: forbidden GameHandlerBuilder import`).not.toMatch(/import\s*\{[^}]*GameHandlerBuilder/);
	}
});

test("published examples are explicit, SDK-only, and all covered by their CI gate", () => {
	const actual = readdirSync(resolve(ROOT, "examples")).filter(file => file.endsWith(".ts")).sort();
	expect(actual).toEqual([...PUBLISHED_EXAMPLES].sort());
	const ci = read("tests/sdk_examples_ci.test.ts");
	for (const file of PUBLISHED_EXAMPLES) {
		expect(ci, `missing CI import for ${file}`).toContain(`../examples/${file}`);
		const source = read(`examples/${file}`);
		for (const match of source.matchAll(/(?:from\s+|import\s*\(\s*)["']([^"']+)["']/g)) {
			const importedPath = match[1]!;
			if (importedPath.startsWith("../src/")) expect(ALLOWED_EXAMPLE_IMPORTS.has(importedPath), `${file}: unsupported import ${importedPath}`).toBe(true);
		}
	}
});

test("production application boundaries use canonical SDK/runtime entry points", () => {
	for (const [file, requiredCalls] of APPLICATION_BOUNDARIES) {
		const source = read(file);
		for (const call of requiredCalls) expect(source, `${file}: missing ${call}`).toContain(call);
	}
	const compositionFiles = ["src/main.ts", "src/scenes/matchPipeline.ts", "src/server/gameRegistry.ts", "src/replay/player.ts"];
	for (const file of compositionFiles) {
		const source = read(file);
		expect(source, `${file}: manually composed core gameplay system`).not.toMatch(/new\s+(?:PhysicsSystem|PlaybackSystem|BoundarySystem|GameStateManager)\s*\(/);
	}
	const coreSystemConstruction = /new\s+(?:PlaybackSystem|PhysicsSystem|BoundarySystem|GameStateManager|WinningSystem)\s*\(/;
	for (const file of sourceFiles("src")) {
		if (CORE_SYSTEM_RUNTIME_ALLOWLIST.has(file)) continue;
		expect(read(file), `${file}: unclassified concrete core-system construction`).not.toMatch(coreSystemConstruction);
	}
	// Winning-system installation is a documented restoration boundary: replay
	// and authoritative server restoration add it only for older snapshots that
	// lack the serialized system profile.
	expect(read("src/replay/player.ts")).toContain("new WinningSystem(teamCount)");
	expect(read("src/server/gameRegistry.ts")).toContain("new WinningSystem(teamCount)");
});

test("final SDK-only documentation and release command are linked and coherent", () => {
	const guide = read("docs/sdk-authoring-guide.md");
	const architecture = read("SDK_ARCHITECTURE.md");
	const readme = read("README.md");
	const checklist = read("step-by-step.md");
	expect(guide).toContain("## Final SDK-Only Release Status");
	expect(guide).toContain("ItemLoader");
	expect(guide).toContain("Unsupported Internals");
	expect(architecture).toContain("docs/sdk-authoring-guide.md");
	expect(readme).toContain("sdk:release-gate");
	expect(checklist).toContain("| 37 | `[x]`");
	expect(checklist).toContain("| 38 | `[x]`");
	expect(checklist).toContain("| 39 | `[x]`");
	expect(checklist).toContain("| 40 | `[x]`");
	expect(read("steps/37-legacy_api_removal_and_dependency_enforcement.md")).toContain("legacy_api_removal");
	expect(read("steps/38-kore_sdk_documentation_examples_and_mod_authoring.md")).toContain("SDK Documentation");
	expect(read("steps/39-sdk_migration_cross_system_qualification.md")).toContain("cross-system");
});

import { expect, test } from "bun:test";
import ts from "typescript";
import { dirname, resolve } from "node:path";
import { readdirSync, readFileSync } from "node:fs";
import { run as runAudio } from "../examples/06-kore-audio.ts";
import { run as runEngineWorld } from "../examples/01-engine-sdk-world.ts";
import { run as runItemMod } from "../examples/03-kore-item-mod.ts";
import { run as runLifecycle } from "../examples/04-kore-match-lifecycle.ts";
import { run as runMapMod } from "../examples/02-kore-map-mod.ts";
import { run as runUi } from "../examples/05-kore-ui-menu.ts";

const root = resolve(import.meta.dir, "..");
const allowedExampleImports = new Set([
	"../src/engine/sdk/index.js",
	"../src/engine/ui-sdk/index.js",
	"../src/engine/audio-sdk/index.js",
	"../src/kore/sdk/index.js",
]);

function compileExamples(): readonly ts.Diagnostic[] {
	const configPath = resolve(root, "examples", "tsconfig.json");
	const config = ts.readConfigFile(configPath, ts.sys.readFile);
	if (config.error) return [config.error];
	const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, dirname(configPath));
	const program = ts.createProgram(parsed.fileNames, parsed.options);
	return ts.getPreEmitDiagnostics(program);
}

function diagnosticsText(diagnostics: readonly ts.Diagnostic[]): string {
	return ts.formatDiagnosticsWithColorAndContext(diagnostics, {
		getCanonicalFileName: fileName => fileName,
		getCurrentDirectory: () => root,
		getNewLine: () => "\n",
	});
}

test("SDK examples compile under the strict examples project", () => {
	const diagnostics = compileExamples();
	if (diagnostics.length > 0) throw new Error(diagnosticsText(diagnostics));
});

test("SDK authoring guide publishes the supported boundaries", () => {
	const guide = readFileSync(resolve(root, "docs", "sdk-authoring-guide.md"), "utf8");
	expect(guide).toContain("## Layering");
	expect(guide).toContain("## Mod Authoring");
	expect(guide).toContain("## Unsupported Internals");
	expect(guide).toContain("kore.createMatchDefinition");
	expect(guide).toContain("ItemLoader` and `ItemValidator` are internal");
	expect(guide).toContain("kore.audio");
});

test("published examples use only documented SDK imports", () => {
	for (const fileName of readdirSync(resolve(root, "examples"), { withFileTypes: true }).filter(entry => entry.isFile() && entry.name.endsWith(".ts"))) {
		const source = readFileSync(resolve(root, "examples", fileName.name), "utf8");
		for (const match of source.matchAll(/from\s+["']([^"']+)["']/g)) {
			const importedPath = match[1]!;
			if (importedPath.startsWith("../src/")) expect(allowedExampleImports.has(importedPath)).toBe(true);
		}
	}
});

test("SDK examples execute deterministically with semantic results", () => {
	const examples = [
		["engine world", runEngineWorld],
		["map mod", runMapMod],
		["item mod", runItemMod],
		["match lifecycle", runLifecycle],
		["UI menu", runUi],
		["audio", runAudio],
	] as const;
	for (const [name, run] of examples) {
		const first = run();
		const second = run();
		expect(second, name).toEqual(first);
		expect(JSON.parse(JSON.stringify(first)), name).toEqual(first);
	}
	expect(runEngineWorld()).toEqual({ id: "example-01-world", worldSize: { x: 320, y: 180 }, entityCount: 1, structureCount: 1, effectCount: 1, systemCount: 1, jsonRoundTripPreservedId: true });
	expect(runMapMod()).toEqual({ id: "example-02-arena", teamCount: 2, players: 4, boundaryCount: 2, worldSize: { x: 800, y: 450 } });
	expect(runItemMod()).toEqual({ id: "example.super-shield", effects: 1, duration: "instant" });
	const lifecycle = runLifecycle();
	expect(lifecycle).toMatchObject({ initialState: "GameState.Your_turn", startsOnYourTurn: true, aiDecided: true, aiShots: 1, restoredState: lifecycle.finalState, restoreEquivalent: true });
	expect(lifecycle.durationFrames).toBeGreaterThan(0);
	expect(runUi()).toEqual({ screen: "main", commands: [{ command: "menu.start" }], restoredScreen: "main" });
	expect(runAudio()).toEqual({ runtimeId: "example-06-audio", commands: 1, soundId: "kore.ui.confirm", bus: "ui" });
});

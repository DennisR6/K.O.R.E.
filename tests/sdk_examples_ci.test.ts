import { expect, test } from "bun:test";
import ts from "typescript";
import { dirname, resolve } from "node:path";
import { readFileSync } from "node:fs";
import { run as runAudio } from "../examples/06-kore-audio.ts";
import { run as runEngineWorld } from "../examples/01-engine-sdk-world.ts";
import { run as runItemMod } from "../examples/03-kore-item-mod.ts";
import { run as runLifecycle } from "../examples/04-kore-match-lifecycle.ts";
import { run as runMapMod } from "../examples/02-kore-map-mod.ts";
import { run as runUi } from "../examples/05-kore-ui-menu.ts";

const root = resolve(import.meta.dir, "..");

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
});

test("SDK examples execute deterministic authoring and runtime flows", () => {
	expect(runEngineWorld()).toEqual({ id: "example-01-world", worldSize: { x: 320, y: 180 }, entities: 1, structures: 1, effects: 1, systems: 1, jsonSafe: true });
	expect(runMapMod()).toEqual({ id: "example-02-arena", players: 4, structures: 2, worldSize: { x: 800, y: 450 } });
	expect(runItemMod()).toEqual({ id: "example.super-shield", source: "local-mod", effects: 1 });
	const lifecycle = runLifecycle();
	expect(lifecycle).toMatchObject({ initialState: "GameState.Your_turn", startsOnYourTurn: true, aiDecided: true, aiShots: 1, restoreEquivalent: true });
	expect(lifecycle.durationFrames).toBeGreaterThan(0);
	expect(runUi()).toEqual({ screen: "main", commands: [{ command: "menu.start" }], restoredScreen: "main" });
	expect(runAudio()).toEqual({ runtimeId: "example-06-audio", commands: 1, soundId: "kore.ui.confirm", bus: "ui" });
});

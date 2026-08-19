import { performance } from "node:perf_hooks";
import { createMagmaCradleMap } from "../src/settings/magmaCradleMap.ts";
import { createCanonicalPlayableMatchSettings } from "../src/settings/canonicalPlayableMatch.ts";
import { loadMapDocument } from "../src/contracts/documents.ts";
import { encodeKorePackedSnapshot, decodeKorePackedSnapshot, koreSettingsToRoastPacked } from "../src/net/roastPackedSnapshot.ts";
import { decodePackedSnapshot, encodeFrame, decodeSettings } from "@coffeemakerstudio/roast";
import { korePackedOptions } from "../src/net/koreBinary.ts";
import type { EngineSettings } from "../src/kore/runtime/types.ts";

const world = { x: 800, y: 450 };
const template = createCanonicalPlayableMatchSettings();
const settings = loadMapDocument(createMagmaCradleMap(world), template) as EngineSettings;
const rounds = 500;
function measure(fn: () => void): number { for (let i = 0; i < 50; i++) fn(); const start = performance.now(); for (let i = 0; i < rounds; i++) fn(); return (performance.now() - start) / rounds; }
const json = new TextEncoder().encode(JSON.stringify(settings));
const oldBinary = encodeFrame(new TextEncoder().encode(JSON.stringify(settings)));
const packed = encodeKorePackedSnapshot(settings);
const view = decodePackedSnapshot(packed, korePackedOptions()).view;
const report = {
	fixture: { map: "magma-cradle", mode: settings.gameMode?.id, teams: 2, figures: settings.players.length, jsonBytes: json.byteLength },
	plainJson: { bytes: json.byteLength, stringifyMs: measure(() => JSON.stringify(settings)), parseMs: measure(() => JSON.parse(new TextDecoder().decode(json))) },
	existingRoastJsonBinary: { bytes: oldBinary.byteLength, encodeMs: measure(() => encodeFrame(new TextEncoder().encode(JSON.stringify(settings)))), decodeMs: measure(() => decodeSettings(oldBinary)) },
	roastPacked: { bytes: packed.byteLength, encodeMs: measure(() => encodeKorePackedSnapshot(settings)), viewMs: measure(() => decodePackedSnapshot(packed, korePackedOptions()).view), fullRestoreMs: measure(() => decodeKorePackedSnapshot(packed)) },
	zeroCopyReads: { lookupAndReadMs: measure(() => { const entity = view.getEntities()[0]; entity?.getComponent("transform.state")?.x; entity?.getComponent("movement.state")?.velocityX; }) },
	coverage: { roastInputEntities: koreSettingsToRoastPacked(settings).entities.length, fixedComponents: settings.players.length * 2, fallbackComponentBytes: "not available: installed Roast diagnostics artifact rejects this Stage-2 payload" },
	turnBasedNote: "KORE sends initial/turn synchronization state, not this full snapshot at 60 Hz",
};
console.log(JSON.stringify(report, null, 2));

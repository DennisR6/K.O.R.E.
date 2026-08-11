import { expect, test } from "bun:test";
import { UiRuntime } from "@coffeemakerstudio/drip";
import { createReplayViewerComposition, KoreReplayCommand, KoreReplayElement, validateKoreReplayViewerSettings } from "../src/kore/ui/replayViewer.ts";

test("replay viewer controls are authored as validated KORE UI settings", () => {
	const composition = createReplayViewerComposition();
	validateKoreReplayViewerSettings(composition);
	const settings = JSON.parse(JSON.stringify(composition));
	expect(settings).toEqual(composition);
	expect(composition.ui.screens[0]?.elements.map(element => element.id)).toEqual([
		KoreReplayElement.Title,
		KoreReplayElement.Token,
		KoreReplayElement.Load,
		KoreReplayElement.Paste,
		KoreReplayElement.Status,
	]);
});

test("replay viewer load action emits the token through the generic UI runtime", () => {
	const composition = createReplayViewerComposition();
	const runtime = UiRuntime.fromSettings(composition.ui);
	runtime.dispatch({ type: "setValue", target: KoreReplayElement.Token, value: "0123456789abcdef0123456789abcdef" });
	runtime.dispatch({ type: "emitValues", command: KoreReplayCommand.Load, targets: [KoreReplayElement.Token] });
	expect(runtime.drainCommands()).toEqual([{ command: KoreReplayCommand.Load, payload: { [KoreReplayElement.Token]: "0123456789abcdef0123456789abcdef" } }]);
});

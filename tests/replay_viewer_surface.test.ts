import { expect, test } from "bun:test";
import { createEnglishLanguage } from "../src/i18n/language.ts";
import { createKoreReplayViewerSurface } from "../src/kore/ui/replayViewerSurface.ts";

test("replay viewer buttons accept input while replay playback is locked", () => {
	const loaded: string[] = [];
	const surface = createKoreReplayViewerSurface({
		onLoad: token => { loaded.push(token); },
		onPaste: () => undefined,
	}, createEnglishLanguage(), "replay-token");

	expect(surface.acceptsUiInputWhileLocked).toBe(true);
	surface.updateMouse(400, 130);
	surface.handleMousePressed();

	expect(loaded).toEqual(["replay-token"]);
});

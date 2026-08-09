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
	surface.updateMouse(100, 240);
	surface.handleMousePressed();
	surface.handleMouseReleased();

	expect(loaded).toEqual(["replay-token"]);
});

test("replay viewer hides its archive overlay after playback loads", () => {
	const surface = createKoreReplayViewerSurface({ onLoad: () => {}, onPaste: () => undefined }, createEnglishLanguage());

	surface.setPlaybackLoaded(true);

	expect(surface.isPlaybackLoaded()).toBe(true);
	expect(surface.getRuntime().getActiveElements().every(element => element.visible)).toBe(true);
});

import { expect, test } from "bun:test";
import { ui } from "@coffeemakerstudio/drip";

test("nested containers resolve declaration order, gaps, justification, and cross-axis alignment", () => {
	const runtime = ui.fromSettings(ui.createMenu({ id: "containers", size: { width: 400, height: 200 } }).addScreen(ui.screen({ id: "main", layout: ui.layout.horizontal({ gap: 10, justify: "start", align: "center" }), elements: [
		ui.container({ id: "group", rect: { x: 0, y: 0, width: 300, height: 100 }, layout: ui.layout.horizontal({ gap: 10, justify: "space-between", align: "center" }), elements: [
			ui.button({ id: "one", text: "One", rect: { x: 0, y: 0, width: 50, height: 20 } }),
			ui.button({ id: "two", text: "Two", rect: { x: 0, y: 0, width: 50, height: 40 } }),
		] }),
		ui.button({ id: "after", text: "After", rect: { x: 0, y: 0, width: 40, height: 20 } }),
	]})).build());
	const group = runtime.getActiveElements()[0]!;
	expect(group.rect).toEqual({ x: 0, y: 50, width: 300, height: 100 });
	if (group.kind !== "container") throw new Error("expected container");
	expect(group.elements[0]!.rect).toEqual({ x: 0, y: 90, width: 50, height: 20 });
		expect(group.elements[1]!.rect).toEqual({ x: 250, y: 80, width: 50, height: 40 });
	expect(runtime.getActiveElements()[1]!.rect).toEqual({ x: 310, y: 90, width: 40, height: 20 });
});

test("hidden flow children collapse while disabled children retain their space", () => {
	const settings = ui.createMenu({ id: "visibility", size: { width: 300, height: 100 } }).addScreen(ui.screen({ id: "main", layout: ui.layout.horizontal({ gap: 10 }), elements: [
		ui.button({ id: "hidden", text: "Hidden", rect: { x: 0, y: 0, width: 80, height: 20 }, visible: false }),
		ui.button({ id: "disabled", text: "Disabled", rect: { x: 0, y: 0, width: 80, height: 20 }, enabled: false }),
		ui.button({ id: "active", text: "Active", rect: { x: 0, y: 0, width: 80, height: 20 } }),
	]})).build();
	const runtime = ui.fromSettings(settings);
	expect(runtime.getActiveElements()[1]!.rect.x).toBe(0);
	expect(runtime.getActiveElements()[2]!.rect.x).toBe(90);
	runtime.setElementVisible("hidden", true);
	expect(runtime.getActiveElements()[1]!.rect.x).toBe(90);
});

test("container input participates in pointer, focus, mutation, and JSON restoration", () => {
	const settings = ui.createMenu({ id: "input", size: { width: 300, height: 120 } }).addScreen(ui.screen({ id: "main", layout: ui.layout.vertical({ gap: 8 }), elements: [
		ui.container({ id: "actions", rect: { x: 0, y: 0, width: 300, height: 50 }, layout: ui.layout.horizontal({ justify: "center" }), elements: [
			ui.button({ id: "play", text: "Play", rect: { x: 0, y: 0, width: 80, height: 30 }, action: ui.action.emit("play") }),
		] }),
	]})).build();
	const runtime = ui.fromSettings(settings);
	runtime.tick({ pointer: { x: 150, y: 10, justPressed: true } });
	expect(runtime.getPressedTargetId()).toBe("play");
	expect(runtime.drainCommands()).toEqual([{ command: "play" }]);
	expect(runtime.setElementEnabled("play", false)).toBe(true);
	const restored = ui.fromSettings(JSON.parse(JSON.stringify(runtime.toSettings())));
	expect(restored.toSettings()).toEqual(runtime.toSettings());
});

test("validation rejects duplicate IDs throughout a screen tree and invalid layouts", () => {
	const duplicate = ui.createMenu({ id: "bad", size: { width: 100, height: 100 } }).addScreen(ui.screen({ id: "main", elements: [
		ui.text({ id: "same", text: "a", rect: { x: 0, y: 0, width: 1, height: 1 } }),
		ui.container({ id: "box", rect: { x: 0, y: 0, width: 1, height: 1 }, elements: [ui.text({ id: "same", text: "b", rect: { x: 0, y: 0, width: 1, height: 1 } })] }),
	]}));
	expect(() => duplicate.build()).toThrow(/duplicate/i);
	expect(() => ui.createMenu({ id: "invalid", size: { width: 100, height: 100 } }).addScreen(ui.screen({ id: "main", layout: { type: "horizontal", justify: "bogus" } as never, elements: [] })).build()).toThrow();
});

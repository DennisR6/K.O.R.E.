import { ui, type UiRenderer } from "../src/engine/ui-sdk/index.js";

/** Build and drive a UI menu without browser listeners or a render loop. */
export function run(): Record<string, unknown> {
	const menu = ui.createMenu({ id: "example-05-menu", size: { width: 320, height: 180 } })
		.addScreen(ui.screen({
			id: "main",
			layout: ui.layout.absolute(),
			elements: [
				ui.text({ id: "title", text: "Example Menu", rect: { x: 20, y: 20, width: 160, height: 24 } }),
				ui.button({ id: "start", text: "Start", rect: { x: 50, y: 50, width: 100, height: 24 }, action: ui.action.emit("menu.start") }),
			],
		}))
		.build();
	const runtime = ui.fromSettings(menu);
	const renderer: UiRenderer = { drawText: () => {}, drawButton: () => {}, drawTextInput: () => {}, drawImage: () => {} };
	runtime.draw(renderer);
	runtime.tick({ pointer: { x: 75, y: 62, justPressed: true } });
	const commands = runtime.drainCommands();
	const restored = ui.fromSettings(JSON.parse(JSON.stringify(runtime.toSettings())));
	return { screen: runtime.getActiveScreen(), commands, restoredScreen: restored.getActiveScreen() };
}

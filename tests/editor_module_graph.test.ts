import { expect, test } from "bun:test";

class FakeElement {
	listeners = new Map<string, () => void>();
	style = { display: "" };
	value = "last_man_standing";
	checked = false;

	addEventListener(type: string, listener: () => void) {
		this.listeners.set(type, listener);
	}
}

test("editor ESM graph exposes item UI helpers and mode state binding", async () => {
	const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
	const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
	const elements = new Map<string, FakeElement>();
	const getElement = (id: string) => {
		let element = elements.get(id);
		if (!element) {
			element = new FakeElement();
			elements.set(id, element);
		}
		return element;
	};

	Object.defineProperty(globalThis, "document", {
		configurable: true,
		value: {
			addEventListener() {},
			getElementById: getElement,
		},
	});
	Object.defineProperty(globalThis, "window", {
		configurable: true,
		value: { addEventListener() {}, location: { origin: "http://editor.test" } },
	});

	try {
		await import("../src-website/js/main.js");
		const items = await import("../src-website/js/editor-items.js");
		const ui = await import("../src-website/js/ui.js");
		const modes = await import("../src-website/js/editor-modes.js");
		const { mapData } = await import("../src-website/js/state.js");

		expect(typeof ui.initImport).toBe("function");
		expect(typeof items.refreshItemsUI).toBe("function");
		expect(typeof items.renderItemSidebar).toBe("function");
		expect(typeof items.renderItemsOverview).toBe("function");
		expect(typeof items.openItemEditor).toBe("function");

		modes.initModesEditor();
		getElement("btn-save-mode").listeners.get("click")?.();
		expect(mapData.mode.type).toBe("last_man_standing");
	} finally {
		if (originalDocument) {
			Object.defineProperty(globalThis, "document", originalDocument);
		} else {
			delete (globalThis as { document?: unknown }).document;
		}
		if (originalWindow) {
			Object.defineProperty(globalThis, "window", originalWindow);
		} else {
			delete (globalThis as { window?: unknown }).window;
		}
	}
});

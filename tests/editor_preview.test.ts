import { expect, test } from "bun:test";
import { getPreviewUrl, PREVIEW_POPUP_FEATURES, PREVIEW_POPUP_NAME } from "../src-website/js/preview.js";

test("editor preview URL uses the supplied origin root", () => {
	expect(getPreviewUrl("https://editor.example.test:4001")).toBe("https://editor.example.test:4001/");
	expect(getPreviewUrl("http://localhost:5173/editor")).toBe("http://localhost:5173/");
});

test("editor preview URL defaults to the current origin", () => {
	const originalLocation = Object.getOwnPropertyDescriptor(globalThis, "location");
	Object.defineProperty(globalThis, "location", {
		configurable: true,
		value: { origin: "https://current.example.test" },
	});

	try {
		expect(getPreviewUrl()).toBe("https://current.example.test/");
	} finally {
		if (originalLocation) {
			Object.defineProperty(globalThis, "location", originalLocation);
		} else {
			delete (globalThis as { location?: unknown }).location;
		}
	}
});

test("editor preview popup keeps its stable name and dimensions", () => {
	expect(PREVIEW_POPUP_NAME).toBe("previewPopup");
	expect(PREVIEW_POPUP_FEATURES).toBe("width=1920,height=1080");
});

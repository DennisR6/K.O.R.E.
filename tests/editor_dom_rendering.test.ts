import { expect, test } from "bun:test";
import { createElement } from "../src-website/js/dom.js";

class FakeElement {
	children: FakeElement[] = [];
	className = "";
	textContent: string | null = null;
	value = "";
	type = "";

	constructor(readonly tagName: string) {}

	appendChild(child: FakeElement) {
		this.children.push(child);
		return child;
	}
}

test("editor DOM helper keeps imported strings out of markup and attributes", () => {
	const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
	const created: FakeElement[] = [];
	Object.defineProperty(globalThis, "document", {
		configurable: true,
		value: {
			createElement(tagName: string) {
				const element = new FakeElement(tagName);
				created.push(element);
				return element;
			},
		},
	});

	try {
		const malicious = '"><img src=x onerror="globalThis.injected=true">';
		const label = createElement("label", { text: malicious }) as FakeElement;
		const input = createElement("input", { type: "number", value: malicious }) as FakeElement;

		expect(label.textContent).toBe(malicious);
		expect(input.value).toBe(malicious);
		expect(created.map(element => element.tagName)).toEqual(["label", "input"]);
		expect(label.children).toHaveLength(0);
		expect(input.children).toHaveLength(0);
		expect("onerror" in label).toBe(false);
	} finally {
		if (originalDocument) {
			Object.defineProperty(globalThis, "document", originalDocument);
		} else {
			delete (globalThis as { document?: unknown }).document;
		}
	}
});

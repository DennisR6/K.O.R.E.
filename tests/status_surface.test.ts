import { expect, test } from "bun:test";
import { createEnglishLanguage } from "../src/i18n/language.ts";
import { createKoreStatusSurface } from "../src/kore/ui/statusSurface.ts";

test("connection failure actions are keyboard accessible", () => {
	let retry = 0;
	let back = 0;
	const surface = createKoreStatusSurface(createEnglishLanguage(), () => retry++, () => back++);
	surface.handleKeyPressed({ key: "Enter" } as KeyboardEvent);
	expect(retry).toBe(0);
	surface.fail("Connection failed");
	surface.handleKeyPressed({ key: "Enter" } as KeyboardEvent);
	surface.handleKeyPressed({ key: "Escape" } as KeyboardEvent);
	expect(retry).toBe(1);
	expect(back).toBe(1);
});

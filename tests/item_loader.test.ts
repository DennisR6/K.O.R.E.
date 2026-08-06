import { expect, test } from "bun:test";
import { ItemLoader } from "../src/item/loader.ts";
import { createItemDocument } from "../src/item/types.ts";
import { ItemValidator } from "../src/item/validate.ts";

function createLoader(): ItemLoader {
	const validator = new ItemValidator();
	validator.registerEffectType("modifyForce");
	return new ItemLoader(validator);
}

function item(id: string) {
	return createItemDocument({
		id,
		effects: [{ type: "modifyForce", value: { factor: 0.5 } }],
	});
}

test("registers built-in and local-mod items through one validated loader", () => {
	const loader = createLoader();
	expect(loader.registerBuiltIn(item("anker")).id).toBe("anker");
	expect(loader.registerLocalMod(item("mod-dash")).id).toBe("mod-dash");
	expect(loader.getAll().map(entry => entry.id)).toEqual(["anker", "mod-dash"]);
	expect(loader.getSource("anker")).toBe("built-in");
	expect(loader.getSource("mod-dash")).toBe("local-mod");
});

test("applies the effect whitelist to both item sources", () => {
	const loader = createLoader();
	const builtIn = item("unsafe-built-in");
	builtIn.effects[0].type = "unknown";
	const localMod = item("unsafe-local-mod");
	localMod.effects[0].value = { script: "run()" };

	expect(() => loader.registerBuiltIn(builtIn)).toThrow("not in the whitelist");
	expect(() => loader.registerLocalMod(localMod)).toThrow("executable field");
});

test("prevents duplicate ids from shadowing registered items", () => {
	const loader = createLoader();
	loader.registerBuiltIn(item("shared"));
	expect(() => loader.registerLocalMod(item("shared"))).toThrow("already registered");
	expect(loader.getSource("shared")).toBe("built-in");
});

test("stores and returns copies so callers cannot bypass prior validation", () => {
	const loader = createLoader();
	const source = item("copied");
	loader.registerLocalMod(source);
	source.effects[0].value = { script: "run()" };
	const loaded = loader.get("copied");
	if (!loaded) throw new Error("Expected registered item");
	loaded.effects[0].value = { script: "run()" };

	expect(loader.get("copied")?.effects[0].value).toEqual({ factor: 0.5 });
});

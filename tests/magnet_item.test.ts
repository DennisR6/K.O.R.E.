import { expect, test } from "bun:test";
import { EffectMagnet } from "../src/effects/magnet.ts";
import { magnetItem, applyMagnetForce, createOfficialItemLoader } from "../src/item/officialItems.ts";

test("Magnet is a validated built-in configurable attraction item", () => {
	const loader = createOfficialItemLoader();
	expect(loader.getSource("magnet")).toBe("built-in");
	expect(loader.get("magnet")).toEqual(magnetItem);
});

test("magnet attracts or repels within its configured range", () => {
	const attract = new EffectMagnet({ typeValue: { mode: "attract", force: 2, range: 100 } });
	const repel = new EffectMagnet({ typeValue: { mode: "repel", force: 2, range: 100 } });
	expect(attract.calculateDelta({ x: 0, y: 0 }, { x: 10, y: 0 })).toEqual({ x: 2, y: 0 });
	expect(repel.calculateDelta({ x: 0, y: 0 }, { x: 10, y: 0 })).toEqual({ x: -2, y: 0 });
	expect(attract.calculateDelta({ x: 0, y: 0 }, { x: 101, y: 0 })).toEqual({ x: 0, y: 0 });
	expect(applyMagnetForce({ x: 1, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toEqual({ x: 3, y: 0 });
});

test("magnet serializes and validates its configuration", () => {
	const magnet = new EffectMagnet({ typeValue: { mode: "repel", force: 1, range: 50 } });
	expect(new EffectMagnet(magnet.toSettings()).toSettings()).toEqual(magnet.toSettings());
	expect(() => new EffectMagnet({ typeValue: { mode: "sideways" as "attract", force: 1, range: 50 } })).toThrow("attract or repel");
});

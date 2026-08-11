import { expect, test } from "bun:test";
import { migrateStructureSettings } from "../src/migrations/structures.ts";
import { SHAPE } from "@coffeemakerstudio/bean";

test("structure migration assigns identity once and does not change it when geometry moves", () => {
	const migrated = migrateStructureSettings([{ type: SHAPE.CIRCLE, x: 10, y: 20, r: 5, effects: [] }]);
	const id = migrated[0]!.id;
	const moved = migrateStructureSettings([{ ...migrated[0]!, x: 100, y: 200 }]);

	expect(id).toMatch(/^structure-[0-9a-f]{8}$/);
	expect(moved[0]!.id).toBe(id);
});

test("canonical explicit structure identity is preserved by migration", () => {
	const migrated = migrateStructureSettings([{ id: "trap-1", type: SHAPE.RECTANGLE, x: 0, y: 0, w: 10, h: 20, effects: [] }]);

	expect(migrated[0]!.id).toBe("trap-1");
});

test("repeated legacy geometry receives deterministic unique IDs", () => {
	const migrated = migrateStructureSettings([
		{ type: SHAPE.CIRCLE, x: 10, y: 20, r: 5, effects: [] },
		{ type: SHAPE.CIRCLE, x: 10, y: 20, r: 5, effects: [] },
	]);

	expect(migrated[0]!.id).not.toBe(migrated[1]!.id);
	expect(migrated[1]!.id).toBe(`${migrated[0]!.id}-1`);
});

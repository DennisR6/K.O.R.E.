import { expect, test } from "bun:test";
import { Player } from "../src/entity/Player.ts";
import { createPlayerSettings } from "../src/entity/types.ts";

test("player settings reject non-positive mass", () => {
	expect(() => createPlayerSettings({ mass: 0 })).toThrow("Player mass must be a finite positive number");
	expect(() => createPlayerSettings({ mass: -1 })).toThrow("Player mass must be a finite positive number");
	expect(() => createPlayerSettings({ mass: Number.NaN })).toThrow("Player mass must be a finite positive number");
	expect(() => new Player({ ...createPlayerSettings(), mass: 0 })).toThrow("Player mass must be a finite positive number");
});

test("player mutations preserve positive mass", () => {
	const player = new Player(createPlayerSettings({ mass: 0.5 }));
	expect(player.getMass()).toBe(0.5);
	expect(() => player.setMass(-0.5)).toThrow("Player mass must be a finite positive number");
});

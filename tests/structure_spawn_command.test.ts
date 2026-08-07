import { expect, test } from "bun:test";
import { EffectTrigger, EffectType, SettingOperation } from "../src/effects/types.ts";
import { SHAPE } from "../src/physics/physics.ts";
import { createStructureSpawnCommand, resolveStructureSpawnPosition, validateStructureSpawnCommand } from "../src/structures/spawnCommand.ts";

const command = createStructureSpawnCommand({
	structureId: "trap-circle",
	placement: "resolved-position",
	durationTurns: 2,
	structure: {
		type: SHAPE.CIRCLE,
		x: 0,
		y: 0,
		r: 25,
		effects: [{ trigger: EffectTrigger.Collision, triggerValue: [], type: EffectType.ModifySetting, typeValue: { operation: SettingOperation.Set, key: "dead", value: true } }],
	},
});

test("structure spawn command is detached, validated, and resolves a persisted position", () => {
	const position = resolveStructureSpawnPosition(command, { x: 100, y: 120 });

	expect(position).toMatchObject({ type: SHAPE.CIRCLE, x: 100, y: 120, r: 25 });
	position.x = 999;
	expect(command.structure.x).toBe(0);
});

test("structure spawn command rejects executable data, invalid geometry, and unsupported placement", () => {
	expect(() => validateStructureSpawnCommand({ ...command, callback: () => undefined })).toThrow(/unknown field/);
	expect(() => validateStructureSpawnCommand({ ...command, placement: "cursor" })).toThrow(/placement/);
	expect(() => validateStructureSpawnCommand({ ...command, structure: { ...command.structure, r: 0 } })).toThrow(/radius/);
	expect(() => validateStructureSpawnCommand({ ...command, structure: { ...command.structure, type: SHAPE.LINE, x2: 2, y2: 2 } })).toThrow(/circles and rectangles/);
});

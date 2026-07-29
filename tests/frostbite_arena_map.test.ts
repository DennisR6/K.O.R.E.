import { expect, test } from "bun:test";
import { loadMapDocument, validateMapDocument } from "../src/contracts/documents.ts";
import { GameHandlerBuilder } from "../src/engine/Handler.ts";
import { createFrostbiteArenaMap } from "../src/settings/frostbiteArenaMap.ts";
import { createDefaultGameSettings, FRICTION_TABLE } from "../src/settings/settings.ts";

test("Frostbite Arena loads an arbitrary world and applies full drift on fixed frames", () => {
	const map = createFrostbiteArenaMap({ x: 1234, y: 789 });
	validateMapDocument(map);
	const settings = loadMapDocument(map, { ...createDefaultGameSettings(2, 1), screenResolution: { x: 800, y: 450 } });
	const handler = new GameHandlerBuilder().defaultSystems().fromSettings(settings).build();
	const actor = handler.getEntityManager().getEntities().find(entity => entity.getTeam().includes(0))!;
	actor.setPos({ x: 200, y: 200 });
	actor.setRotation(0);
	actor.setVel({ x: 0, y: 10 });

	for (let frame = 0; frame < 3; frame++) handler.tick();

	expect(map.friction).toEqual(FRICTION_TABLE.ice);
	expect(map.drift).toBe(1);
	expect(handler.getContext().worldSize).toEqual({ x: 1234, y: 789 });
	expect(settings.screenResolution).toEqual({ x: 800, y: 450 });
	expect({ position: actor.getPos(), velocity: actor.getVel() }).toEqual({
		position: { x: 229.8203, y: 200 },
		velocity: { x: 9.8208985, y: 0 },
	});
});

import { expect, test } from "bun:test";
import { loadMapDocument, validateMapDocument } from "../src/contracts/documents.ts";
import { GameHandlerBuilder } from "../src/engine/Handler.ts";
import { createMagmaCradleMap } from "../src/settings/magmaCradleMap.ts";
import { createDefaultGameSettings } from "../src/settings/settings.ts";

test("Magma Cradle scales validated force and kill hazards into active collision zones", () => {
	const map = createMagmaCradleMap({ x: 1200, y: 675 });
	validateMapDocument(map);
	const settings = loadMapDocument(map, { ...createDefaultGameSettings(2, 1), screenResolution: { x: 800, y: 450 } });
	const handler = new GameHandlerBuilder().defaultSystems().fromSettings(settings).build();
	const forceZone = map.hazards.find(hazard => hazard.type === "force")!;
	const killZone = map.hazards.find(hazard => hazard.type === "kill-zone")!;
	const [forceTarget, killTarget] = handler.getEntityManager().getEntities();

	forceTarget.setPos({ x: (forceZone.config.x as number) + 1, y: forceZone.config.y as number });
	forceTarget.setVel({ x: 0, y: 0 });
	handler.tick();
	expect(forceTarget.getVel()).toEqual({ x: 4, y: 0 });

	killTarget.setPos({ x: (killZone.config.x as number) + 1, y: killZone.config.y as number });
	handler.tick();

	expect(settings.mapBoundarys).toHaveLength(map.arenaGeometry.length + map.hazards.length);
	expect(killTarget.isDead()).toBe(true);
	expect(() => validateMapDocument({ ...map, hazards: [{ ...forceZone, config: { ...forceZone.config, power: 0 } }] })).toThrow("Invalid map hazard");
});

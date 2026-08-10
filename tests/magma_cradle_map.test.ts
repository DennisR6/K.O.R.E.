import { expect, test } from "bun:test";
import { loadMapDocument, validateMapDocument } from "../src/contracts/documents.ts";
import { GameHandlerBuilder } from "../src/engine/Handler.ts";
import { createMagmaCradleMap } from "../src/settings/magmaCradleMap.ts";
import { createDefaultGameSettings } from "../src/settings/settings.ts";
import { SHAPE } from "../src/physics/physics.ts";

test("Magma Cradle scales validated force and kill hazards into active collision zones", () => {
	const map = createMagmaCradleMap({ x: 1200, y: 675 });
	validateMapDocument(map);
	const settings = loadMapDocument(map, { ...createDefaultGameSettings(2, 1), screenResolution: { x: 800, y: 450 } });
	const handler = new GameHandlerBuilder().defaultSystems().fromSettings(settings).build();
	const forceZone = map.hazards.find(hazard => hazard.type === "force")!;
	const killZone = map.hazards.find(hazard => hazard.type === "kill-zone")!;
	const cornerKillZones = map.hazards.filter(hazard => hazard.id.endsWith("-corner-lava"));
	const [forceTarget, killTarget] = handler.getEntityManager().getEntities();

	forceTarget.setPos({ x: (forceZone.config.x as number) + 1, y: forceZone.config.y as number });
	forceTarget.setVel({ x: 0, y: 0 });
	handler.tick();
	expect(forceTarget.getVel()).toEqual({ x: 4, y: 0 });

	killTarget.setPos({ x: (killZone.config.x as number) + 1, y: killZone.config.y as number });
	handler.tick();

	expect(settings.mapBoundarys).toHaveLength(map.arenaGeometry.length + map.hazards.length);
	expect(cornerKillZones).toHaveLength(4);
	expect(cornerKillZones.map(hazard => hazard.config).sort((left, right) => Number(left.x) - Number(right.x) || Number(left.y) - Number(right.y))).toEqual([
		{ x: 60, y: 60, r: 27 },
		{ x: 60, y: 615, r: 27 },
		{ x: 1140, y: 60, r: 27 },
		{ x: 1140, y: 615, r: 27 },
	]);
	expect(map.arenaGeometry.filter(structure => structure.role !== "containment" && structure.type === SHAPE.RECTANGLE && (structure.x === 0 || structure.y === 0)).length).toBe(0);
	expect(killTarget.isDead()).toBe(true);
	expect(() => validateMapDocument({ ...map, hazards: [{ ...forceZone, config: { ...forceZone.config, power: 0 } }] })).toThrow("Invalid map hazard");
});

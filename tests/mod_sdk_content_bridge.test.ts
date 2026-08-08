import { describe, expect, test } from "bun:test";
import { kore } from "../src/kore/sdk/index.js";
import { createDefaultGameSettings } from "../src/settings/settings.ts";

/** Builds a deterministic two-team one-figure template through the public SDK. */
function buildTemplate(): ReturnType<typeof kore.createDefaultMap> extends infer T ? T extends { build(): infer S } ? S : never : never {
	return kore
		.createDefaultMap({ id: "mod-test-template", name: "Mod Test Template", worldSize: { x: 800, y: 450 } })
		.addTeam(kore.createTeam({ teamNr: 0, name: "Team A", playerCount: 1 }))
		.addTeam(kore.createTeam({ teamNr: 1, name: "Team B", playerCount: 1 }))
		.addPlayerSpawn({ x: 40, y: 150, w: 120, h: 140, teamNr: 0 })
		.addPlayerSpawn({ x: 640, y: 150, w: 120, h: 140, teamNr: 1 })
		.build();
}

/** Builds a mod map document with geometry plus kill and force hazards. */
function buildModMapDocument() {
	return kore
		.createDefaultMap({ id: "mod-simple-map", name: "Mod Simple Map", worldSize: { x: 800, y: 450 } })
		.addTeam(kore.createTeam({ teamNr: 0, playerCount: 1 }))
		.addTeam(kore.createTeam({ teamNr: 1, playerCount: 1 }))
		.addPlayerSpawn({ x: 30, y: 180, w: 100, h: 90, teamNr: 0 })
		.addPlayerSpawn({ x: 670, y: 180, w: 100, h: 90, teamNr: 1 })
		.addRectangle({ x: 300, y: 200, w: 60, h: 60 })
		.addKillZone({ id: "pit", x: 400, y: 410, r: 30 })
		.addForceZone({ id: "vent", x: 100, y: 100, r: 25, angle: 0, power: 50 })
		.buildMapDocument();
}

describe("kore.contentPackage.resolveMap", () => {
	test("resolves a packaged map document into validated engine settings", () => {
		const template = buildTemplate();
		const map = buildModMapDocument();
		const settings = kore.contentPackage.resolveMap(map, template);

		// The result is a fully valid engine settings object.
		expect(() => kore.validate(settings)).not.toThrow();
		expect(settings.worldSize).toEqual({ x: 800, y: 450 });
		expect(settings.friction).toEqual(map.friction);
		expect(settings.drift).toBe(map.drift);

		// Geometry: containment + authored rectangle from arenaGeometry, plus
		// one circle per declared hazard.
		const structures = settings.mapBoundarys;
		expect(structures.length).toBe(4);
		expect(structures.some(boundary => boundary.type === kore.types.shape.rectangle && boundary.x === 300 && boundary.y === 200 && boundary.w === 60 && boundary.h === 60)).toBe(true);
		const killZone = structures.find(boundary => boundary.type === kore.types.shape.circle && boundary.x === 400 && boundary.y === 410);
		expect(killZone).toBeDefined();
		expect(killZone!.effects).toEqual([]);
		expect(killZone!.collisionCommands?.[0]?.effect).toMatchObject({ type: "effect.composition", effects: [
			{ type: "participation.set-physics", typeValue: { enabled: false } },
			{ type: "participation.set-drawing", typeValue: { enabled: false } },
		] });
		expect(structures.some(boundary => boundary.type === kore.types.shape.circle && boundary.x === 100 && boundary.y === 100)).toBe(true);

		// The template roster is repositioned into the mod spawn regions.
		const players = settings.players;
		expect(players.length).toBe(2);
		const team0 = players.find(player => player.team.includes(0))!;
		const team1 = players.find(player => player.team.includes(1))!;
		expect(team0.position.x).toBeGreaterThanOrEqual(30);
		expect(team0.position.x).toBeLessThan(30 + 100);
		expect(team1.position.x).toBeGreaterThanOrEqual(670);
		expect(team1.position.x).toBeLessThan(670 + 100);
	});

	test("resolution is deterministic for identical inputs", () => {
		const template = buildTemplate();
		const map = buildModMapDocument();
		expect(kore.contentPackage.resolveMap(map, template)).toEqual(kore.contentPackage.resolveMap(map, template));
	});

	test("the template is never mutated and the result is detached", () => {
		const template = buildTemplate();
		const before = JSON.stringify(template);
		const map = buildModMapDocument();
		const settings = kore.contentPackage.resolveMap(map, template);
		expect(JSON.stringify(template)).toBe(before);

		settings.players[0]!.position.x = 999;
		settings.mapBoundarys.pop();
		expect(JSON.stringify(template)).toBe(before);
		expect(JSON.stringify(map)).toBe(JSON.stringify(buildModMapDocument()));
	});

	test("rejects maps missing a spawn region for a template team", () => {
		const template = buildTemplate();
		const map = buildModMapDocument();
		const oneSided = { ...map, spawnRegions: map.spawnRegions.filter(region => region.team === 0) };
		expect(() => kore.contentPackage.resolveMap(oneSided as never, template)).toThrow(/no spawn region for team 1/);
	});

	test("rejects invalid map documents and invalid templates", () => {
		const template = buildTemplate();
		expect(() => kore.contentPackage.resolveMap({ schemaVersion: 99 } as never, template)).toThrow(/schema version/);
		expect(() => kore.contentPackage.resolveMap({} as never, template)).toThrow(/schema version/);
		const map = buildModMapDocument();
		expect(() => kore.contentPackage.resolveMap(map, { ...template, players: "bad" as never })).toThrow();
	});

	test("the public bridge is the documented content-package member", () => {
		expect(typeof kore.contentPackage.resolveMap).toBe("function");
		// The template contract works with the canonical default settings too.
		const settings = kore.contentPackage.resolveMap(buildModMapDocument(), createDefaultGameSettings(2, 1));
		expect(() => kore.validate(settings)).not.toThrow();
	});
});

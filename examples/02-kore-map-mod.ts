import { kore } from "../src/kore/sdk/index.js";
import { validateGameSettings, type GameSettings } from "../src/settings/settings.js";

/** A validated map authored entirely through the KORE SDK. */
export function run(): Record<string, unknown> {
	const penguins = kore.createTeam({ teamNr: 0, name: "Penguins", playerCount: 2 });
	const map = kore.createDefaultMap({ id: "example-02-arena", name: "Example Arena", worldSize: { x: 800, y: 450 } })
		.addBackground({ type: "color", color: "#dff6ff" })
		.addTeam(penguins)
		.addPlayerSpawn({ team: penguins, x: 40, y: 120, w: 180, h: 180 })
		.addPlayerSpawn({ teamNr: 1, playerCount: 2, x: 580, y: 120, w: 180, h: 180 })
		.addRectangle({ x: 380, y: 150, w: 40, h: 150, effects: [kore.effects.damage(10)] })
		.build();

	const mapSettings: GameSettings = map;
	validateGameSettings(mapSettings);
	return {
		id: map.id,
		players: map.players.length,
		structures: map.mapBoundarys.length,
		worldSize: map.worldSize,
	};
}

import { GameState } from "../src/engine/types.js";
import { createAiBattleHandler } from "../src/scenes/LocalMatchSceneRouter.js";

type PreviewFrame = { players: Array<{ x: number; y: number; rotation: number; dead: boolean }> };

// Use the same real AI-vs-AI path as the menu's spectator launch. This keeps
// the preview on the lethal Magma Cradle map and records death participation.
const handler = createAiBattleHandler("magma-cradle", 202608);
const entities = handler.getEntityManager().getEntities();
const frames: PreviewFrame[] = [];
const sampleEvery = 8;

const capture = (): void => {
	frames.push({ players: entities.map(entity => {
		const position = entity.getPos();
		return { x: Number(position.x.toFixed(3)), y: Number(position.y.toFixed(3)), rotation: Number(entity.toSettings().rotation.toFixed(4)), dead: entity.isDead() };
	}) });
};

capture();
for (let tick = 0; tick < 24_000 && handler.getState() !== GameState.Game_over && frames.length < 900; tick++) {
	handler.tick();
	if (tick % sampleEvery === 0) capture();
}

await Bun.write("public/menu-preview.json", JSON.stringify({ schemaVersion: 1, mapId: "magma-cradle", frameIntervalMs: 50, frames }));
handler.dispose();
console.log(`Wrote ${frames.length} precomputed Magma Cradle menu preview frames`);

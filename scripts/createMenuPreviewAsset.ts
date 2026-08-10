import { GameState } from "../src/engine/types.js";
import { createLocalGameplayHandler } from "../src/scenes/LocalMatchSceneRouter.js";

type PreviewFrame = { players: Array<{ x: number; y: number; rotation: number }> };

const handler = createLocalGameplayHandler("ice-map-v1");
const entities = handler.getEntityManager().getEntities();
const frames: PreviewFrame[] = [];
const sampleEvery = 8;

const capture = (): void => {
	frames.push({ players: entities.map(entity => {
		const position = entity.getPos();
		return { x: Number(position.x.toFixed(3)), y: Number(position.y.toFixed(3)), rotation: Number(entity.toSettings().rotation.toFixed(4)) };
	}) });
};

capture();
for (let turn = 0; turn < 6; turn++) {
	const team = turn % 2;
	const actor = entities.find(entity => !entity.isDead() && entity.getTeam().includes(team));
	const target = entities.find(entity => !entity.isDead() && !entity.getTeam().includes(team));
	if (!actor || !target) break;
	const actorPosition = actor.getPos();
	const targetPosition = target.getPos();
	handler.applyRawTurn({ actorId: actor.getId(), angle: Math.atan2(targetPosition.y - actorPosition.y, targetPosition.x - actorPosition.x) * 180 / Math.PI, power: 8 });
	handler.setState(GameState.Playing);
	let ticks = 0;
	while (handler.getState() === GameState.Playing && ticks < 1_200) {
		handler.tick();
		ticks++;
		if (ticks % sampleEvery === 0) capture();
	}
	handler.setState(GameState.Your_turn);
}

await Bun.write("public/menu-preview.json", JSON.stringify({ schemaVersion: 1, frameIntervalMs: 50, frames }));
handler.dispose();
console.log(`Wrote ${frames.length} precomputed menu preview frames`);

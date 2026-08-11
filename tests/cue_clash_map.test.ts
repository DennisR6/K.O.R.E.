import { expect, test } from "bun:test";
import { loadMapDocument, validateMapDocument } from "../src/contracts/documents.ts";
import { GameHandlerBuilder } from "../src/kore/runtime/Handler.ts";
import { createCueClashMap } from "../src/settings/cueClashMap.ts";
import { createDefaultGameSettings } from "../src/settings/settings.ts";

test("Cue Clash scales its canonical layout and resolves a real-map shot", () => {
	const map = createCueClashMap({ x: 1000, y: 600 });
	validateMapDocument(map);
	const settings = loadMapDocument(map, { ...createDefaultGameSettings(2, 1), screenResolution: { x: 800, y: 450 } });
	const handler = new GameHandlerBuilder().defaultSystems().fromSettings(settings).build();
	const actor = handler.getEntityManager().getEntities().find(entity => entity.getTeam().includes(0))!;
	const turn = handler.resolveTurn({ actorId: actor.getId(), angle: 0, power: 1 });

	expect(handler.getContext().worldSize).toEqual({ x: 1000, y: 600 });
	expect(turn.durationFrames).toBeGreaterThan(0);
	expect(turn.finalState.every(player => Number.isFinite(player.position.x) && Number.isFinite(player.position.y))).toBe(true);
});

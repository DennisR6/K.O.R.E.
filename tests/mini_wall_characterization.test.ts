import { expect, test } from "bun:test";
import { GameHandlerBuilder } from "../src/engine/Handler.ts";
import { miniWallItem, MINI_WALL_DURATION_TURNS, MINI_WALL_HEIGHT, MINI_WALL_WIDTH } from "../src/item/officialItems.ts";
import { createDefaultGameSettings } from "../src/settings/settings.ts";
import { ReplayPlayer } from "../src/replay/player.ts";
import { ReplayRecorder } from "../src/replay/recorder.ts";
import { RulePhase, WinCondition } from "../src/rules/types.ts";

function miniWallHandler() {
	const settings = createDefaultGameSettings(2, 1);
	settings.items = [miniWallItem];
	const handler = new GameHandlerBuilder().defaultSystems().fromSettings(settings).build();
	const actor = handler.getEntityManager().getEntities()[0]!;
	actor.setInventory([{ itemId: miniWallItem.id, remainingUses: 1, usesThisTurn: 0 }]);
	return { handler, actor };
}

test("Mini-Wall records position targeting and activates one canonical rectangle", () => {
	const { handler, actor } = miniWallHandler();
	const beforeStructureCount = handler.getContext().structures.length;
	const position = { x: actor.getPos().x + 10, y: actor.getPos().y + 10 };

	handler.useItem(actor.getId(), miniWallItem.id, { type: "position", position });

	expect(actor.getInventory()).toEqual([{ itemId: miniWallItem.id, remainingUses: 0, usesThisTurn: 1 }]);
	expect(handler.getContext().structures).toHaveLength(beforeStructureCount + 1);
	const wall = handler.getContext().structures.at(-1)!;
	expect(wall.toSettings()).toMatchObject({ id: `${actor.getId()}:${miniWallItem.id}:0`, type: 2, x: position.x, y: position.y, w: MINI_WALL_WIDTH, h: MINI_WALL_HEIGHT, role: "solid", physicsEnabled: true, drawingEnabled: true });
	expect(handler.toSettings().structureLifecycles).toMatchObject([{ structureId: wall.getId(), durationUnit: "turns", duration: MINI_WALL_DURATION_TURNS, remaining: MINI_WALL_DURATION_TURNS, targetId: actor.getId() }]);
});

test("Mini-Wall disables the canonical structure at the first expired turn", () => {
	const { handler, actor } = miniWallHandler();
	const structureCount = handler.getContext().structures.length;
	handler.useItem(actor.getId(), miniWallItem.id, { type: "position", position: actor.getPos() });

	handler.setTurnNumber(1);
	handler.setTurnNumber(2);
	handler.setTurnNumber(3);

	expect(actor.getItemEffects()).toEqual([]);
	expect(handler.getContext().structures).toHaveLength(structureCount + 1);
	const wall = handler.getContext().structures.at(-1)!;
	expect(wall.toSettings()).toMatchObject({ physicsEnabled: false, drawingEnabled: false });
	expect(handler.toSettings().structureLifecycles).toBeUndefined();
});

test("Mini-Wall characterization preserves ordinary position validation and per-game limits", () => {
	const { handler, actor } = miniWallHandler();
	expect(() => handler.useItem(actor.getId(), miniWallItem.id, { type: "position", position: { x: -1, y: actor.getPos().y } })).toThrow("inside the world");
	handler.useItem(actor.getId(), miniWallItem.id, { type: "position", position: actor.getPos() });
	expect(() => handler.useItem(actor.getId(), miniWallItem.id, { type: "position", position: actor.getPos() })).toThrow("no remaining uses");
});

test("Mini-Wall supports one independent canonical instance per player", () => {
	const settings = createDefaultGameSettings(2, 1);
	settings.items = [miniWallItem];
	const handler = new GameHandlerBuilder().defaultSystems().fromSettings(settings).build();
	const [first, second] = handler.getEntityManager().getEntities();
	first!.setInventory([{ itemId: miniWallItem.id, remainingUses: 1, usesThisTurn: 0 }]);
	second!.setInventory([{ itemId: miniWallItem.id, remainingUses: 1, usesThisTurn: 0 }]);
	handler.useItem(first!.getId(), miniWallItem.id, { type: "position", position: first!.getPos() });
	handler.useItem(second!.getId(), miniWallItem.id, { type: "position", position: second!.getPos() });

	const lifecycles = handler.toSettings().structureLifecycles ?? [];
	expect(lifecycles).toHaveLength(2);
	expect(new Set(lifecycles.map(lifecycle => lifecycle.structureId)).size).toBe(2);
});

test("Mini-Wall active structure and remaining lifecycle restore symmetrically", () => {
	const { handler, actor } = miniWallHandler();
	handler.useItem(actor.getId(), miniWallItem.id, { type: "position", position: actor.getPos() });
	const snapshot = JSON.parse(JSON.stringify(handler.toSettings()));
	const restored = new GameHandlerBuilder().defaultSystems().fromSettings(snapshot).build();

	expect(restored.toSettings()).toEqual(snapshot);
	restored.setTurnNumber(1);
	restored.setTurnNumber(2);
	restored.setTurnNumber(3);
	const restoredWall = restored.getContext().structures.at(-1)!;
	expect(restoredWall.toSettings()).toMatchObject({ physicsEnabled: false, drawingEnabled: false });
	expect(restored.toSettings().structureLifecycles).toBeUndefined();
});

test("Mini-Wall replay reproduces canonical structure creation", () => {
	const settings = createDefaultGameSettings(2, 1);
	settings.items = [miniWallItem];
	settings.gameMode = { id: "mini-wall-replay", phases: [RulePhase.Item, RulePhase.Physics], maxItemsPerTurn: 1, winCondition: WinCondition.LastTeamStanding, itemEconomy: { fixedLoadouts: [{ team: 0, items: [{ itemId: miniWallItem.id, uses: 1 }] }], mapPickups: [] } };
	const actorSettings = settings.players[0]!;
	actorSettings.inventory = [{ itemId: miniWallItem.id, remainingUses: 1, usesThisTurn: 0 }];
	const actorId = actorSettings.id;
	const recorder = new ReplayRecorder(settings);
	recorder.recordItemUse(actorId, miniWallItem.id, { type: "position", position: actorSettings.position });
	const replay = new ReplayPlayer(recorder.getReplay());
	replay.playAll();

	expect(replay.getHandler().toSettings().structureLifecycles).toHaveLength(1);
	expect(replay.getHandler().getContext().structures.at(-1)!.toSettings()).toMatchObject({ id: `${actorId}:${miniWallItem.id}:0`, physicsEnabled: true, drawingEnabled: true });
});

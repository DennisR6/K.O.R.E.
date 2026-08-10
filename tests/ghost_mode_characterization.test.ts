import { expect, test } from "bun:test";
import { GameEmitter } from "../src/emitter/EngineEmitter.ts";
import { GameHandlerBuilder } from "../src/engine/Handler.ts";
import { GameState } from "../src/engine/types.ts";
import { durchlaessigkeitItem } from "../src/item/officialItems.ts";
import { RulePhase, WinCondition } from "../src/rules/types.ts";
import { createDefaultGameSettings } from "../src/settings/settings.ts";
import { Player } from "../src/entity/Player.ts";
import { createPlayerSettings } from "../src/entity/types.ts";
import { EntityManager } from "../src/entity/EntityManager.ts";
import { defaultPhysics } from "../src/physics/defaultPhysics.ts";
import { PhysicsSystem } from "../src/systems/PhysicsSystem.ts";
import { StructureCircle } from "../src/structures/structureCircle.ts";
import type { IGameContext } from "../src/systems/types.ts";
import { ReplayPlayer } from "../src/replay/player.ts";
import { AiTurnEmitter, type IAiTurnProducer } from "../src/ai/aiEmitter.ts";
import { GameDatabase } from "../src/server/db.ts";
import { GameRegistry } from "../src/server/gameRegistry.ts";
import { BoundarySystem } from "../src/systems/BoundarySystem.ts";
import { StructureRectangle } from "../src/structures/structureRectangle.ts";
import type { IStructure } from "../src/structures/types.ts";

const firstUser = "11111111-1111-4111-8111-111111111111";
const secondUser = "22222222-2222-4222-8222-222222222222";

function buildSettings() {
	const settings = createDefaultGameSettings(2, 1);
	settings.items = [durchlaessigkeitItem];
	settings.gameMode = {
		id: "ghost-mode-characterization",
		phases: [RulePhase.Item, RulePhase.Physics],
		maxItemsPerTurn: 1,
		winCondition: WinCondition.LastTeamStanding,
		itemEconomy: {
			fixedLoadouts: [{ team: 0, items: [{ itemId: durchlaessigkeitItem.id, uses: 1 }] }],
			mapPickups: [],
		},
	};
	return settings;
}

function context(entities: Player[], structures: IStructure[] = []): IGameContext {
	const manager = new EntityManager();
	manager.addEntity(entities);
	return {
		entities: manager,
		structures,
		state: GameState.Your_turn,
		dt: 1,
		mouse: { turn: null },
		worldSize: { x: 800, y: 450 },
		physics: new defaultPhysics(),
		currTurn: 0,
		activeTeam: 0,
		myTeamNumber: 0,
		counters: [],
		finishMatch: () => undefined,
	};
}

test("qualified Ghost Mode is accepted into canonical collision state", () => {
	const settings = buildSettings();
	const handler = new GameHandlerBuilder().defaultSystems().fromSettings(settings).build();
	const actor = handler.getEntityManager().getEntities()[0]!;
	const emitter = new GameEmitter(handler, settings.gameMode!, 2, 2201);

	emitter.sendItemUse(actor.getId(), durchlaessigkeitItem.id, { type: "self" });

	expect(actor.getInventory()[0]!.remainingUses).toBe(0);
	expect(actor.getItemEffects()).toEqual([]);
	expect(actor.getCollisionFilters()).toMatchObject([{ excludedCategories: ["entity", "structure"], sourceId: durchlaessigkeitItem.id }]);
	expect(actor.getCollisionFilterLifetimes()).toMatchObject([{ duration: 2, remaining: 2, sourceId: durchlaessigkeitItem.id }]);
	expect(actor.getPendingActionModifiers()).toEqual([]);
	emitter.skipPhase();
	const before = actor.getCollisionFilters();
	handler.applyRawTurn({ actorId: actor.getId(), angle: 0, power: 1 });

	expect(actor.getCollisionFilters()).toEqual(before);
});

test("active Ghost Mode filters player and structure pairs before resolution and entry events", () => {
	const ghost = new Player(createPlayerSettings({ id: "00000000-0000-4000-8000-000000000001", position: { x: 0, y: 0 }, size: 10, velocity: { x: 1, y: 0 } }));
	const other = new Player(createPlayerSettings({ id: "00000000-0000-4000-8000-000000000002", position: { x: 15, y: 0 }, size: 10 }));
	const wall = new StructureCircle(15, 0, 10, undefined, [], "solid");
	ghost.addCollisionFilter({ schemaVersion: 1, id: "ghost-filter", excludedCategories: ["entity", "structure"] }, { schemaVersion: 1, id: "ghost-filter:lifetime", filterId: "ghost-filter", durationUnit: "turns", duration: 2, remaining: 2 });
	let contacts = 0;
	ghost.onCollision = () => { contacts++; };
	const system = new PhysicsSystem(new defaultPhysics());
	const ctx = context([ghost, other], [wall]);

	system.ticker(ctx, 1, 1);

	expect(ghost.getPos().x).toBe(0);
	expect(ghost.getVel().x).toBe(1);
	expect(contacts).toBe(0);
});

test("Ghost Mode expires after two turn boundaries and snapshot restores its remainder", () => {
	const settings = buildSettings();
	const handler = new GameHandlerBuilder().defaultSystems().fromSettings(settings).build();
	const actor = handler.getEntityManager().getEntities()[0]!;
	handler.useItem(actor.getId(), durchlaessigkeitItem.id, { type: "self" });
	handler.setTurnNumber(1);
	expect(actor.getCollisionFilterLifetimes()[0]!.remaining).toBe(1);
	const restored = new GameHandlerBuilder().defaultSystems().fromSettings(JSON.parse(JSON.stringify(handler.toSettings()))).build();
	const restoredActor = restored.getEntityManager().getEntityById(actor.getId())!;
	expect(restoredActor.getCollisionFilterLifetimes()).toEqual(actor.getCollisionFilterLifetimes());
	handler.setTurnNumber(2);
	expect(actor.getCollisionFilters()).toEqual([]);
});

test("filtered structure collision events remain absent while normal structure events remain active", () => {
	let contacts = 0;
	const ghost = new Player(createPlayerSettings({ id: "00000000-0000-4000-8000-000000000003", position: { x: 0, y: 0 }, size: 10 }));
	ghost.addCollisionFilter({ schemaVersion: 1, id: "ghost-filter-events", excludedCategories: ["entity", "structure"], sourceId: "ghost-source" }, { schemaVersion: 1, id: "ghost-filter-events:lifetime", filterId: "ghost-filter-events", durationUnit: "turns", duration: 2, remaining: 2, sourceId: "ghost-source" });
	ghost.onCollision = () => { contacts++; };
	const wall = new StructureCircle(15, 0, 10, undefined, [], "solid");
	const system = new PhysicsSystem(new defaultPhysics());
	system.ticker(context([ghost], [wall]), 1, 1);

	expect(contacts).toBe(0);
	ghost.removeCollisionFilters(new Set(["ghost-source"]));
	ghost.setPos({ x: 100, y: 0 });
	system.ticker(context([ghost], [wall]), 1, 1);
	ghost.setPos({ x: 0, y: 0 });
	system.ticker(context([ghost], [wall]), 1, 1);
	expect(contacts).toBe(1);
});

test("Ghost Mode does not change independent boundary elimination", () => {
	const ghost = new Player(createPlayerSettings({ id: "00000000-0000-4000-8000-000000000004", position: { x: 110, y: 50 }, size: 10 }));
	ghost.addCollisionFilter({ schemaVersion: 1, id: "boundary-filter", excludedCategories: ["entity", "structure"] }, { schemaVersion: 1, id: "boundary-filter:lifetime", filterId: "boundary-filter", durationUnit: "turns", duration: 2, remaining: 2 });
	const boundary = new StructureRectangle(0, 0, 100, 100, undefined, [], "containment");
	const ctx = context([ghost], [boundary]);

	new BoundarySystem().ticker(ctx, 1, 1);

	expect(ghost.isDead()).toBe(true);
	expect(ghost.drawingEnabled()).toBe(false);
});

test("replay reconstructs Ghost Mode collision state from raw actions", () => {
	const settings = buildSettings();
	const handler = new GameHandlerBuilder().defaultSystems().fromSettings(settings).build();
	const actor = handler.getEntityManager().getEntities()[0]!;
	const emitter = new GameEmitter(handler, settings.gameMode!, 2, 2202);
	emitter.sendItemUse(actor.getId(), durchlaessigkeitItem.id, { type: "self" });
	emitter.skipPhase();
	emitter.sendShot(actor.getId(), 0, 1);
	while (handler.getState() === GameState.Playing) handler.tick();

	const replay = emitter.recorder.getReplay();
	expect(replay.actions.at(-1)).toMatchObject({ type: "shoot", input: { angle: 0, power: 1 } });
	expect(new ReplayPlayer(replay).playAll()).toEqual(handler.getEntityManager().serialize());
});

test("AI uses the same Ghost Mode world state without Item-specific logic", () => {
	const settings = buildSettings();
	const handler = new GameHandlerBuilder().defaultSystems().fromSettings(settings).build();
	const actor = handler.getEntityManager().getEntities()[0]!;
	const emitter = new GameEmitter(handler, settings.gameMode!, 2, 2203);
	emitter.sendItemUse(actor.getId(), durchlaessigkeitItem.id, { type: "self" });
	emitter.skipPhase();
	const producer: IAiTurnProducer = { computeTurn: () => ({ shot: { actorId: actor.getId(), angle: 0, power: 1 } }) };

	expect(new AiTurnEmitter(producer).executeTurn(handler, { difficulty: "easy", seed: 1, team: 0 }, emitter)).toBe(true);
	while (handler.getState() === GameState.Playing) handler.tick();

	expect(actor.getCollisionFilters()).toHaveLength(1);
});

test("authoritative server resolves Ghost Mode from canonical state", () => {
	const registry = new GameRegistry(new GameDatabase(":memory:"));
	const record = registry.create(buildSettings(), [firstUser, secondUser]);
	const actor = record.handler.getEntityManager().getEntities()[0]!;

	expect(registry.submitItemUse(firstUser, actor.getId(), durchlaessigkeitItem.id, { type: "self" }).ok).toBe(true);
	record.ruleState = record.rules.advancePhase(record.ruleState);
	record.handler.setRuleState(record.ruleState);
	const result = registry.submitTurn(firstUser, { actorId: actor.getId(), angle: 0, power: 1 });

	expect(result.ok).toBe(true);
	if (!result.ok) throw new Error(result.error);
	expect(result.packet.input).toEqual({ angle: 0, power: 1 });
	expect(actor.getCollisionFilters()).toHaveLength(1);
});

import { expect, test } from "bun:test";
import { GameHandlerBuilder } from "../src/engine/Handler.ts";
import { createDefaultGameSettings } from "../src/settings/settings.ts";

test("inactive residual velocity no longer blocks turn settlement", () => {
	const settings = createDefaultGameSettings(2, 1);
	const handler = new GameHandlerBuilder().defaultSystems().fromSettings(settings).build();
	const inactive = handler.getEntityManager().getEntities()[1]!;
	inactive.setPhysicsEnabled(false);
	inactive.setDrawingEnabled(false);
	inactive.setVel({ x: 1, y: 0 });

	const packet = handler.simulateTurn(settings.players[0]!.id, 0, 1);
	const diagnostic = handler.getLogs().find(log => log.type === "turn.simulation.max-ticks")?.data as { ticks: number; lastMeaningfulMotionTick: number; activeBodies: number; blockers: Array<{ entityId: string; velocity: { x: number; y: number }; velocityMagnitude: number; physicsEnabled: boolean; drawingEnabled: boolean }> } | undefined;

	expect(packet.durationFrames).toBeLessThan(1200);
	expect(diagnostic).toBeUndefined();
	expect(handler.getLogs().filter(log => log.type === "turn.simulation.long-running")).toHaveLength(0);
});

test("settlement participation matches physics participation", () => {
	const createHandler = () => new GameHandlerBuilder().defaultSystems().fromSettings(createDefaultGameSettings(2, 1)).build();
	const inactive = createHandler();
	const inactiveEntity = inactive.getEntityManager().getEntities()[1]!;
	inactiveEntity.setPhysicsEnabled(false);
	inactiveEntity.setVel({ x: 1, y: 0 });
	expect(inactive.getPhysics().isStatic(inactive.getEntityManager())).toBe(true);

	const dead = createHandler();
	const deadEntity = dead.getEntityManager().getEntities()[1]!;
	deadEntity.setDrawingEnabled(false);
	deadEntity.setVel({ x: 1, y: 0 });
	expect(dead.getPhysics().isStatic(dead.getEntityManager())).toBe(true);

	const moving = createHandler();
	moving.getEntityManager().getEntities()[0]!.setVel({ x: 1, y: 0 });
	expect(moving.getPhysics().isStatic(moving.getEntityManager())).toBe(false);

	const settled = createHandler();
	settled.getEntityManager().getEntities()[0]!.setVel({ x: 0.05, y: 0 });
	expect(settled.getPhysics().isStatic(settled.getEntityManager())).toBe(true);
});

test("long-running warning is emitted once and max-ticks remains distinct", () => {
	const settings = createDefaultGameSettings(2, 1);
	const handler = new GameHandlerBuilder().defaultSystems().fromSettings(settings).build();
	const physics = handler.getPhysics();
	physics.isStatic = () => false;
	handler.resolveTurn({ actorId: settings.players[0]!.id, angle: 0, power: 1 });
	const warnings = handler.getLogs().filter(log => log.type === "turn.simulation.long-running");
	const caps = handler.getLogs().filter(log => log.type === "turn.simulation.max-ticks");
	expect(warnings).toHaveLength(1);
	expect(warnings[0]?.data).toMatchObject({ ticks: 600, maxTicks: 1200 });
	expect(caps).toHaveLength(1);
	expect(caps[0]?.data).toMatchObject({ ticks: 1200 });
});

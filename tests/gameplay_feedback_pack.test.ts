import { expect, test } from "bun:test";
import { GameplayFeedbackTrace, KoreGameplayFeedbackSurface, KoreGameplayFeedbackType } from "../src/kore/gameplayFeedback.ts";
import { GameHandlerBuilder } from "../src/kore/runtime/Handler.ts";
import { createCanonicalPlayableMatchSettings } from "../src/settings/canonicalPlayableMatch.ts";

test("the KORE feedback pack declares every authoritative gameplay event", () => {
	const trace = new GameplayFeedbackTrace();
	for (const type of Object.values(KoreGameplayFeedbackType)) trace.record(type, 4, { data: { fixture: true } });
	const surface = new KoreGameplayFeedbackSurface();
	for (const event of trace.list()) surface.accept(event);
	surface.tick(1);
	expect(surface.getFrame().events.map(event => event.eventId)).toHaveLength(9);
	expect(surface.drainSoundCommands()).toHaveLength(9);
});

test("feedback trace and presentation restoration are deterministic and outside engine state", () => {
	const trace = new GameplayFeedbackTrace();
	trace.record(KoreGameplayFeedbackType.Shot, 0, { actorId: "actor", data: { power: 5 } });
	trace.record(KoreGameplayFeedbackType.Collision, 0, { targetIds: ["target"] });
	const first = new KoreGameplayFeedbackSurface(); trace.list().forEach(event => first.accept(event)); first.tick(1);
	const restored = new KoreGameplayFeedbackSurface(first.toPresentationSettings());
	expect(restored.getFrame().animations).toEqual(first.getFrame().animations);
	expect(trace.toSettings()).toEqual(new GameplayFeedbackTrace(trace.toSettings()).toSettings());
});

test("feedback output failure is safe", () => {
	const surface = new KoreGameplayFeedbackSurface({ schemaVersion: 1, runtimeId: "kore.feedback", tick: 0, sequence: 0, active: [], pending: [] }, { apply: () => { throw new Error("missing renderer"); } });
	surface.accept({ schemaVersion: 1, sequence: 0, turnNumber: 0, type: KoreGameplayFeedbackType.Result });
	expect(() => surface.tick(1)).not.toThrow();
});

test("feedback rendering applies animated opacity until the presentation expires", () => {
	const opacity: number[] = [];
	const labels: string[] = [];
	const renderer = {
		WORLD_SIZE_X: 800,
		push() {}, pop() {}, setOpacity(value: number) { opacity.push(value); },
		setFillColor() {}, drawText(value: string) { labels.push(value); },
	} as any;
	const surface = new KoreGameplayFeedbackSurface();
	surface.accept({ schemaVersion: 1, sequence: 0, turnNumber: 0, type: KoreGameplayFeedbackType.Shot });
	surface.tick(1);
	surface.draw(renderer);
	surface.tick(1);
	surface.tick(1);
	surface.tick(1);
	surface.draw(renderer);
	surface.tick(1);
	surface.tick(1);
	surface.tick(1);
	surface.draw(renderer);

	expect(opacity).toEqual([1, 0]);
	expect(labels).toEqual(["Shot", "Shot"]);
});

test("accepted authoritative turns produce feedback without changing the engine snapshot", () => {
	const handler = new GameHandlerBuilder().defaultSystems().fromSettings(createCanonicalPlayableMatchSettings()).build();
	const actor = handler.getEntityManager().getEntities().find(entity => entity.getTeam().includes(handler.getActiveTeam()))!;
	const before = JSON.stringify(handler.toSettings());
	handler.resolveTurn({ actorId: actor.getId(), angle: 0, power: 1 });
	const types = handler.getFeedbackTrace().map(event => event.type);
	expect(types).toContain(KoreGameplayFeedbackType.Shot);
	expect(types).toContain(KoreGameplayFeedbackType.Turn);
	expect(JSON.parse(before)).not.toHaveProperty("feedback");
});

import { describe, expect, test } from "bun:test";
import { GameHandlerBuilder } from "../src/kore/runtime/Handler.ts";
import { summarizeFrameWindow } from "../src/engine/runtimeLog.ts";
import { createDefaultGameSettings } from "../src/settings/settings.ts";
import { GameEmitter } from "../src/emitter/EngineEmitter.ts";
import { RulePhase } from "../src/rules/types.ts";
import { LoggerType } from "../src/engine/runtimeLog.ts";
import { HardAiWorkerHost } from "../src/ai/worker/host.ts";

describe("runtime logging", () => {
	test("appends structured entries and returns a detached view", () => {
		const handler = new GameHandlerBuilder().defaultSystems().fromSettings(createDefaultGameSettings(2, 1)).build();
		const data = { actionType: "shot", actorId: "actor" };
		const entry = handler.log("input.accepted", data);

		expect(entry).toMatchObject({ type: "input.accepted", data });
		expect(handler.getLogs()).toHaveLength(1);
		(handler.getLogs() as unknown as Array<unknown>).length = 0;
		expect(handler.getLogs()).toHaveLength(1);
	});

	test("runtime logs do not enter canonical settings or change their fingerprint", () => {
		const handler = new GameHandlerBuilder().defaultSystems().fromSettings(createDefaultGameSettings(2, 1)).build();
		const before = JSON.stringify(handler.toSettings());
		handler.log("diagnostic.timing", { durationMs: 12.5 });

		expect(JSON.stringify(handler.toSettings())).toBe(before);
		const restored = new GameHandlerBuilder().defaultSystems().fromSettings(handler.toSettings()).build();
		expect(restored.getLogs()).toHaveLength(0);
	});

	test("filters logs by one or multiple console-facing categories", () => {
		const handler = new GameHandlerBuilder().defaultSystems().fromSettings(createDefaultGameSettings(2, 1)).build();
		handler.log("performance.frame-window", { samples: 1 });
		handler.log("input.accepted", { actionType: "shot" });
		handler.log("turn.completed", { durationMs: 1 });
		handler.log("turnPacket.created", { frameCount: 1 });
		handler.log("ai.worker.completed", { computeMs: 1 });
		handler.log("diagnostic.only", { value: true });

		const types = handler.LoggerType;
		const performanceLogs = handler.getLogs(types.Performance);
		const turnLogs = handler.getLogs(types.Turn);
		const performanceAndWorker = handler.getLogs([types.Performance, types.Worker]);

		expect(performanceLogs.map(log => log.type)).toEqual(["performance.frame-window", "turn.completed", "ai.worker.completed"]);
		expect(turnLogs.map(log => log.type)).toEqual(["turn.completed", "turnPacket.created"]);
		expect(performanceAndWorker.map(log => log.type)).toEqual(["performance.frame-window", "turn.completed", "ai.worker.completed"]);
	});

	test("frame samples are summarized as one bounded observation", () => {
		const summary = summarizeFrameWindow([16, 17, 18, 40, 100]);
		expect(summary).toEqual({ samples: 5, medianMs: 18, p95Ms: 100, p99Ms: 100, maxMs: 100 });
	});

	test("turn simulation and packet lifecycle emit timing metadata", () => {
		const handler = new GameHandlerBuilder().defaultSystems().fromSettings(createDefaultGameSettings(2, 1)).build();
		const actor = handler.getEntityManager().getEntities()[0]!;
		const packet = handler.simulateTurn(actor.getId(), 0, 0);
		handler.playTurn(packet);
		for (let i = 0; i <= packet.durationFrames; i++) handler.tick();

		const types = handler.getLogs().map(log => log.type);
		expect(types).toContain("turn.simulation.completed");
		expect(types).toContain("turnPacket.created");
		expect(types).toContain("turn.playback.completed");
	});

	test("accepted local input is observable without changing replay state", () => {
		const handler = new GameHandlerBuilder().defaultSystems().fromSettings(createDefaultGameSettings(2, 1)).build();
		handler.setRuleState({ phase: RulePhase.Physics, activeTeam: 0, turnNumber: 0, itemUses: 0 });
		const emitter = new GameEmitter(handler, undefined, 2, 42);
		const replayBefore = JSON.stringify(emitter.recorder.getReplay());
		handler.log("diagnostic.only", { durationMs: 1 });
		expect(JSON.stringify(emitter.recorder.getReplay())).toBe(replayBefore);
		const actor = handler.getEntityManager().getEntities()[0]!;
		emitter.sendShot(actor.getId(), 0, 4);

		expect(handler.getLogs().map(log => log.type)).toContain("input.accepted");
	});

	test("fallback lifecycle logs expose reason and duration without canonical impact", () => {
		const handler = new GameHandlerBuilder().defaultSystems().fromSettings(createDefaultGameSettings(2, 1)).build();
		const worker = { onmessage: null, onerror: null, postMessage: () => {}, terminate: () => {} };
		const host = new HardAiWorkerHost(() => worker);
		host.attachHandler(handler);
		const before = JSON.stringify(handler.toSettings());
		const started = host.beginSynchronousFallback("worker-runtime-error", 1);
		host.completeSynchronousFallback("worker-runtime-error", 1, started);
		const logs = handler.getLogs(LoggerType.Performance);
		expect(logs.find(log => log.type === "ai.fallback.started")?.data).toEqual({ reason: "worker-runtime-error", team: 1 });
		expect(logs.find(log => log.type === "ai.fallback.completed")?.data).toMatchObject({ reason: "worker-runtime-error", team: 1 });
		expect(JSON.stringify(handler.toSettings())).toBe(before);
		host.dispose();
	});
});

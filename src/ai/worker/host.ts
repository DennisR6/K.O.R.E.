import type { GameHandler } from "../../kore/runtime/Handler.js";
import { fingerprintCanonicalSnapshot, fingerprintHardAiRequest, type HardAiWorkerRequest, type HardAiWorkerResponse } from "./protocol.js";
import type { AiSettings } from "../types.js";
import type { IInput } from "../../kore/runtime/types.js";
import type { RuleState } from "../../rules/types.js";
import { isValidInput } from "../../input/validate.js";
import { runtimeNow, summarizeFrameWindow } from "../../engine/runtimeLog.js";
import { startupMark } from "../../engine/startupTelemetry.js";

type WorkerLike = {
	onmessage: ((event: MessageEvent) => void) | null;
	onerror: ((event: ErrorEvent) => void) | null;
	postMessage(message: unknown): void;
	terminate(): void;
};

export type AiWorkerState = "starting" | "ready" | "failed";
type PreparedTurn = { request: HardAiWorkerRequest; initialDecision: boolean; response?: HardAiWorkerResponse; actualPostTurnHash?: string; startedAt: number; responseReceivedAt?: number; playbackEndedAt?: number; valid: boolean; metricsRecorded: boolean; waitingLogged: boolean };

export type HardAiWorkerTurnMetrics = {
	playerVisibleDurationMs: number;
	workerComputeMs: number;
	workerCompletionDurationMs: number;
	precomputeHeadroomMs: number;
	postTurnWaitMs: number;
	workerReadyBeforeTurnEnd: boolean;
};

export type HardAiWorkerDistribution = { min: number; median: number; p95: number; max: number };

export type HardAiWorkerMetrics = {
	workerPathAvailable: boolean;
	requestCount: number;
	validResponseCount: number;
	fallbackCount: number;
	failedCount: number;
	precomputeHitRate: number;
	workerComputeMs: number;
	playerVisibleDurationMs: number;
	precomputeHeadroomMs: number;
	postTurnWaitMs: number;
	maxEventLoopGapMs: number;
	eventLoopGapP50Ms: number;
	eventLoopGapP95Ms: number;
	workerComputeDistribution: HardAiWorkerDistribution;
	playerVisibleDistribution: HardAiWorkerDistribution;
	precomputeHeadroomDistribution: HardAiWorkerDistribution;
	postTurnWaitDistribution: HardAiWorkerDistribution;
	synchronousFallbackDistribution: HardAiWorkerDistribution;
	failureReason?: string;
	lastTurn?: HardAiWorkerTurnMetrics;
};

export class HardAiWorkerHost {
	private worker: WorkerLike | undefined;
	private state: AiWorkerState = "starting";
	private readonly readyPromise: Promise<void>;
	private resolveReady!: () => void;
	private rejectReady!: (error: Error) => void;
	private generation = 0;
	private sequence = 0;
	private pending: PreparedTurn | undefined;
	private failed = false;
	private disposed = false;
	private heartbeatTimer: ReturnType<typeof setInterval> | undefined;
	private heartbeatAt = 0;
	private eventLoopGaps: number[] = [];
	private eventLoopWindowGaps: number[] = [];
	private readonly turnMetrics: HardAiWorkerTurnMetrics[] = [];
	private requestCount = 0;
	private validResponseCount = 0;
	private fallbackCount = 0;
	private failedCount = 0;
	private failureReason: string | undefined;
	private readonly fallbackDurations: number[] = [];
	private handler: GameHandler | undefined;
	private fallbackReason: string | undefined;
	private failureCode: string | undefined;

	private readonly usesDefaultWorkerFactory: boolean;
	private readonly workerFactory: () => WorkerLike;

	public constructor(workerFactory?: () => WorkerLike) {
		this.readyPromise = new Promise<void>((resolve, reject) => { this.resolveReady = resolve; this.rejectReady = reject; });
		void this.readyPromise.catch(() => {});
		this.usesDefaultWorkerFactory = workerFactory === undefined;
		this.workerFactory = workerFactory ?? (() => new Worker(new URL("./browserWorker.js", import.meta.url), { type: "module" }));
		this.start();
	}

	public isAvailable(): boolean { return this.worker !== undefined && !this.failed; }
	public getState(): AiWorkerState { return this.state; }
	public ready(): Promise<void> {
		if (this.state === "ready") return Promise.resolve();
		if (this.state === "failed") return Promise.reject(new Error(this.failureReason ?? this.failureCode ?? "worker-failed"));
		startupMark("ai.worker.startup.wait.started");
		return this.readyPromise;
	}
	public isThinking(): boolean { return this.state === "starting" || (this.state !== "failed" && this.pending !== undefined && !this.pending.valid); }
	public attachHandler(handler: GameHandler): void {
		this.handler = handler;
		if (this.failed && this.failureCode && !this.failureReasonLogged) this.logFailure(this.failureCode);
	}
	public getMetrics(): HardAiWorkerMetrics {
		const gaps = [...this.eventLoopGaps].sort((a, b) => a - b);
		const percentile = (value: number): number => gaps.length === 0 ? 0 : gaps[Math.min(gaps.length - 1, Math.ceil(value * gaps.length) - 1)]!;
		const distribution = (values: readonly number[]): HardAiWorkerDistribution => {
			const sorted = [...values].sort((a, b) => a - b);
			if (sorted.length === 0) return { min: 0, median: 0, p95: 0, max: 0 };
			return { min: sorted[0]!, median: sorted[Math.floor((sorted.length - 1) * 0.5)]!, p95: sorted[Math.floor((sorted.length - 1) * 0.95)]!, max: sorted[sorted.length - 1]! };
		};
		const last = this.turnMetrics.at(-1);
		return {
			workerPathAvailable: this.isAvailable(), requestCount: this.requestCount,
			validResponseCount: this.validResponseCount, fallbackCount: this.fallbackCount,
			failedCount: this.failedCount, precomputeHitRate: this.requestCount === 0 ? 0 : this.turnMetrics.filter(turn => turn.workerReadyBeforeTurnEnd).length / this.requestCount,
			workerComputeMs: last?.workerComputeMs ?? 0, playerVisibleDurationMs: last?.playerVisibleDurationMs ?? 0,
			precomputeHeadroomMs: last?.precomputeHeadroomMs ?? 0, postTurnWaitMs: last?.postTurnWaitMs ?? 0,
			maxEventLoopGapMs: this.eventLoopGaps.length === 0 ? 0 : Math.max(...this.eventLoopGaps),
			eventLoopGapP50Ms: percentile(0.5), eventLoopGapP95Ms: percentile(0.95),
			workerComputeDistribution: distribution(this.turnMetrics.map(turn => turn.workerComputeMs)),
			playerVisibleDistribution: distribution(this.turnMetrics.map(turn => turn.playerVisibleDurationMs)),
			precomputeHeadroomDistribution: distribution(this.turnMetrics.map(turn => turn.precomputeHeadroomMs)),
			postTurnWaitDistribution: distribution(this.turnMetrics.map(turn => turn.postTurnWaitMs)),
			synchronousFallbackDistribution: distribution(this.fallbackDurations),
			...(this.failureReason ? { failureReason: this.failureReason } : {}),
			...(last ? { lastTurn: structuredClone(last) } : {}),
		};
	}
	public getFallbackReason(): string { return this.fallbackReason ?? this.failureCode ?? "no-prepared-request"; }
	public beginSynchronousFallback(reason: string, team: number): number {
		const started = runtimeNow();
		startupMark("ai.initial.started", { mode: "synchronous", reason, team });
		this.handler?.log("ai.fallback.started", { reason, team });
		return started;
	}
	public completeSynchronousFallback(reason: string, team: number, startedAt: number): void {
		const durationMs = runtimeNow() - startedAt;
		this.noteSynchronousFallback(durationMs, reason);
		startupMark("ai.initial.completed", { mode: "synchronous", reason, durationMs });
		this.handler?.log("ai.fallback.completed", { reason, team, durationMs });
	}
	public noteSynchronousFallback(durationMs = 0, reason = "unknown"): void { this.fallbackReason = reason; this.fallbackCount++; if (durationMs > 0) this.fallbackDurations.push(durationMs); }

	public prepareTurn(input: { snapshot: HardAiWorkerRequest["snapshot"]; acceptedAction: IInput; nextRuleState: RuleState; aiSettings: AiSettings }): string | undefined {
		if (this.state === "failed" || !this.worker) return undefined;
		const requestWithoutHash = {
			kind: "precompute" as const,
			snapshot: input.snapshot,
			acceptedAction: input.acceptedAction,
			expectedTurnNumber: input.snapshot.turnNumber,
			expectedNextTeam: input.nextRuleState.activeTeam,
			nextRuleState: input.nextRuleState,
			aiSettings: input.aiSettings,
		};
		const request: HardAiWorkerRequest = {
			schemaVersion: 1,
			requestId: `${input.snapshot.id}:ai-worker:${this.generation}:${this.sequence++}`,
			basedOnStateHash: fingerprintHardAiRequest(requestWithoutHash),
			...requestWithoutHash,
		};
		this.pending = { request, initialDecision: false, startedAt: runtimeNow(), valid: false, metricsRecorded: false, waitingLogged: false };
		this.fallbackReason = undefined;
		this.requestCount++;
		this.sendWhenReady(request.requestId);
		return request.requestId;
	}

	public prepareInitialDecision(input: { snapshot: HardAiWorkerRequest["snapshot"]; ruleState: RuleState; aiSettings: AiSettings }): string | undefined {
		if (this.state === "failed" || !this.worker) return undefined;
		const requestWithoutHash = {
			kind: "initial-decision" as const,
			snapshot: input.snapshot,
			expectedTurnNumber: input.snapshot.turnNumber,
			expectedNextTeam: input.ruleState.activeTeam,
			nextRuleState: input.ruleState,
			aiSettings: input.aiSettings,
		};
		const request: HardAiWorkerRequest = {
			schemaVersion: 1,
			requestId: `${input.snapshot.id}:ai-worker:${this.generation}:${this.sequence++}`,
			basedOnStateHash: fingerprintHardAiRequest(requestWithoutHash),
			...requestWithoutHash,
		};
		this.pending = { request, initialDecision: true, startedAt: runtimeNow(), valid: false, metricsRecorded: false, waitingLogged: false };
		this.fallbackReason = undefined;
		startupMark("ai.initial.started", { mode: "worker", team: input.aiSettings.team });
		this.sendWhenReady(request.requestId);
		return request.requestId;
	}

	private sendWhenReady(requestId: string): void {
		const send = () => {
			const prepared = this.pending;
			if (!prepared || prepared.request.requestId !== requestId || this.state !== "ready" || !this.worker) return;
			this.startHeartbeat();
			startupMark("worker.first-request.sent", { requestId });
			this.handler?.log("ai.worker.requested", { requestId, turnNumber: prepared.request.expectedTurnNumber, team: prepared.request.aiSettings.team });
			try { this.worker.postMessage(prepared.request); }
			catch (error) { this.fail(error); }
		};
		if (this.state === "ready") send();
		else if (this.state === "starting") void this.ready().then(send).catch(() => {});
	}

	/** Records the authoritative post-playback state; a response is usable only after this check. */
	public completeAuthoritativeTurn(handler: GameHandler): void {
		if (!this.pending) return;
		this.pending.actualPostTurnHash = fingerprintCanonicalSnapshot(handler.toSettings());
		this.pending.playbackEndedAt = runtimeNow();
		this.validatePending();
		if (this.pending && !this.pending.valid && !this.pending.waitingLogged) {
			this.pending.waitingLogged = true;
			this.handler?.log("ai.worker.waiting", { requestId: this.pending.request.requestId, turnNumber: this.pending.request.expectedTurnNumber, team: this.pending.request.aiSettings.team });
		}
	}

	public consumePreparedAction(): IInput | undefined {
		const prepared = this.pending;
		if (!prepared?.valid || !prepared.response?.action) return undefined;
		this.pending = undefined;
		this.stopHeartbeat();
		this.fallbackReason = undefined;
		return prepared.response.action;
	}

	/** Invalidates current work without affecting the authoritative handler. */
	public invalidate(reason = "game-over"): void {
		if (this.pending) this.logRejected(reason, this.pending.request.requestId);
		this.pending = undefined;
		this.stopHeartbeat();
	}

	public dispose(): void {
		this.disposed = true;
		this.generation++;
		if (this.state === "starting") { this.state = "failed"; this.rejectReady(new Error("worker-disposed")); }
		const pendingRequestId = this.pending?.request.requestId;
		this.pending = undefined;
		this.worker?.terminate();
		this.worker = undefined;
		this.stopHeartbeat();
		if (this.handler && pendingRequestId) this.handler.log("ai.worker.rejected", { requestId: pendingRequestId, reason: "disposed" });
	}

	private start(): void {
		// Bun exposes a Worker global too, but this entry point is a browser
		// module worker and must not be started by headless/server-side tests.
		if (this.usesDefaultWorkerFactory && (typeof window === "undefined" || typeof Worker === "undefined")) { this.fail(new Error("worker-unavailable"), "worker-unavailable"); return; }
		try {
			startupMark("worker.startup.started");
			const worker = this.workerFactory();
			worker.onmessage = event => this.receive(event.data);
			worker.onerror = event => this.fail(event.error ?? new Error(event.message));
			this.worker = worker;
		} catch (error) {
			this.fail(error, "worker-creation-failed");
		}
	}

	private receive(message: { type?: string; response?: HardAiWorkerResponse; message?: string }): void {
		if (message.type === "ready") { if (this.disposed) return; this.state = "ready"; this.resolveReady(); startupMark("worker.startup.completed"); startupMark("ai.worker.startup.wait.completed"); return; }
		if (message.type === "error") { this.fail(new Error(message.message ?? "AI worker computation failed")); return; }
		const prepared = this.pending;
		const response = message.type === "result" ? message.response : undefined;
		if (!prepared) { this.logRejected("stale-request", response?.requestId); return; }
		if (!response) { this.rejectPending("malformed-response"); return; }
		if (response.requestId !== prepared.request.requestId) { this.logRejected("stale-request", response.requestId); return; }
		if (response.basedOnStateHash !== prepared.request.basedOnStateHash) { this.rejectPending("fingerprint-mismatch"); return; }
		if (response.expectedTurnNumber !== prepared.request.expectedTurnNumber) { this.rejectPending("turn-mismatch"); return; }
		if (response.expectedNextTeam !== prepared.request.expectedNextTeam) { this.rejectPending("team-mismatch"); return; }
		if ((response.kind ?? "precompute") !== (prepared.request.kind ?? "precompute")) { this.rejectPending("request-kind-mismatch"); return; }
		if (response.schemaVersion !== 1 || !Number.isFinite(response.computeMs) || !response.action || !isValidInput(response.action)) { this.rejectPending("malformed-response"); return; }
		prepared.response = response;
		prepared.responseReceivedAt = runtimeNow();
		startupMark("worker.first-response.received", { requestId: response.requestId });
		if (prepared.request.expectedTurnNumber === 0) startupMark("ai.initial.completed", { mode: "worker", durationMs: response.computeMs });
		if (prepared.initialDecision) prepared.actualPostTurnHash = fingerprintCanonicalSnapshot(prepared.request.snapshot);
		this.validatePending();
	}

	private validatePending(): void {
		const prepared = this.pending;
		if (!prepared || !prepared.response || !prepared.actualPostTurnHash) return;
		prepared.valid = prepared.response.postTurnStateHash === prepared.actualPostTurnHash;
		if (!prepared.valid) { this.rejectPending("fingerprint-mismatch"); return; }
		this.validResponseCount++;
		if (prepared.initialDecision) {
			this.handler?.log("ai.worker.completed", { requestId: prepared.request.requestId, turnNumber: prepared.request.expectedTurnNumber, team: prepared.request.aiSettings.team, workerComputeMs: prepared.response.computeMs, executionMode: "worker", initialDecision: true });
			this.handler?.log("ai.decision.completed", { requestId: prepared.request.requestId, team: prepared.request.aiSettings.team, difficulty: prepared.request.aiSettings.difficulty, durationMs: prepared.response.computeMs, submitted: Boolean(prepared.response.action), executionMode: "worker" });
			return;
		}
		const metrics = this.recordTurnMetrics(prepared);
		if (metrics) {
			this.handler?.log("ai.worker.completed", { requestId: prepared.request.requestId, turnNumber: prepared.request.expectedTurnNumber, team: prepared.request.aiSettings.team, workerComputeMs: metrics.workerComputeMs, playerVisibleDurationMs: metrics.playerVisibleDurationMs, precomputeHeadroomMs: metrics.precomputeHeadroomMs, postTurnWaitMs: metrics.postTurnWaitMs, workerReadyBeforeTurnEnd: metrics.workerReadyBeforeTurnEnd });
			this.handler?.log("ai.decision.completed", { requestId: prepared.request.requestId, team: prepared.request.aiSettings.team, difficulty: prepared.request.aiSettings.difficulty, durationMs: metrics.workerComputeMs, submitted: Boolean(prepared.response.action), executionMode: "worker" });
		}
	}

	private fail(error: unknown, code = "worker-runtime-error"): void {
		if (this.disposed) return;
		this.failedCount++;
		this.failureReason = error instanceof Error ? error.message : String(error);
		this.failureCode = code;
		this.failed = true;
		this.state = "failed";
		this.rejectReady(error instanceof Error ? error : new Error(this.failureReason));
		this.pending = undefined;
		this.worker?.terminate();
		this.worker = undefined;
		this.stopHeartbeat();
		this.logFailure(this.failureCode);
	}

	private startHeartbeat(): void {
		if (this.heartbeatTimer !== undefined) return;
		this.heartbeatAt = performance.now();
		this.heartbeatTimer = setInterval(() => {
			const now = performance.now();
			const gap = Math.max(0, now - this.heartbeatAt - 25);
			this.eventLoopGaps.push(gap);
			this.eventLoopWindowGaps.push(gap);
			this.heartbeatAt = now;
		}, 25);
	}
	private stopHeartbeat(): void {
		if (this.heartbeatTimer === undefined) return;
		clearInterval(this.heartbeatTimer);
		this.heartbeatTimer = undefined;
		const summary = summarizeFrameWindow(this.eventLoopWindowGaps);
		if (summary) this.handler?.log("performance.event-loop-window", summary);
		this.eventLoopWindowGaps.length = 0;
	}
	private recordTurnMetrics(prepared: PreparedTurn): HardAiWorkerTurnMetrics | undefined {
		if (prepared.metricsRecorded || !prepared.response || prepared.responseReceivedAt === undefined || prepared.playbackEndedAt === undefined) return undefined;
		prepared.metricsRecorded = true;
		const playerVisibleDurationMs = prepared.playbackEndedAt - prepared.startedAt;
		const workerCompletionDurationMs = prepared.responseReceivedAt - prepared.startedAt;
		const metrics = { playerVisibleDurationMs, workerComputeMs: prepared.response.computeMs, workerCompletionDurationMs, precomputeHeadroomMs: playerVisibleDurationMs - workerCompletionDurationMs, postTurnWaitMs: Math.max(0, prepared.responseReceivedAt - prepared.playbackEndedAt), workerReadyBeforeTurnEnd: prepared.responseReceivedAt <= prepared.playbackEndedAt };
		this.turnMetrics.push(metrics);
		return metrics;
	}
	private failureReasonLogged = false;
	private logFailure(reason: string | undefined): void {
		if (this.failureReasonLogged || !reason) return;
		this.failureReasonLogged = true;
		this.handler?.log("ai.worker.failed", { reason, message: this.failureReason });
	}
	private logRejected(reason: string, requestId?: string): void { this.handler?.log("ai.worker.rejected", { ...(requestId ? { requestId } : {}), reason }); }
	private rejectPending(reason: string): void { this.fallbackReason = reason; const requestId = this.pending?.request.requestId; this.logRejected(reason, requestId); this.pending = undefined; this.stopHeartbeat(); }
}

import type { GameHandler } from "../../engine/Handler.js";
import { fingerprintCanonicalSnapshot, fingerprintHardAiRequest, type HardAiWorkerRequest, type HardAiWorkerResponse } from "./protocol.js";
import type { AiSettings } from "../types.js";
import type { IInput } from "../../engine/types.js";
import type { RuleState } from "../../rules/types.js";
import { isValidInput } from "../../input/validate.js";

type WorkerLike = {
	onmessage: ((event: MessageEvent) => void) | null;
	onerror: ((event: ErrorEvent) => void) | null;
	postMessage(message: unknown): void;
	terminate(): void;
};

type PreparedTurn = { request: HardAiWorkerRequest; response?: HardAiWorkerResponse; actualPostTurnHash?: string; startedAt: number; responseReceivedAt?: number; playbackEndedAt?: number; valid: boolean; metricsRecorded: boolean };

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
	private generation = 0;
	private sequence = 0;
	private pending: PreparedTurn | undefined;
	private failed = false;
	private disposed = false;
	private heartbeatTimer: ReturnType<typeof setInterval> | undefined;
	private heartbeatAt = 0;
	private eventLoopGaps: number[] = [];
	private readonly turnMetrics: HardAiWorkerTurnMetrics[] = [];
	private requestCount = 0;
	private validResponseCount = 0;
	private fallbackCount = 0;
	private failedCount = 0;
	private failureReason: string | undefined;
	private readonly fallbackDurations: number[] = [];

	private readonly usesDefaultWorkerFactory: boolean;
	private readonly workerFactory: () => WorkerLike;

	public constructor(workerFactory?: () => WorkerLike) {
		this.usesDefaultWorkerFactory = workerFactory === undefined;
		this.workerFactory = workerFactory ?? (() => new Worker(new URL("./browserWorker.js", import.meta.url), { type: "module" }));
		this.start();
	}

	public isAvailable(): boolean { return this.worker !== undefined && !this.failed; }
	public isThinking(): boolean { return this.isAvailable() && this.pending !== undefined && !this.pending.valid; }
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
	public noteSynchronousFallback(durationMs = 0): void { this.fallbackCount++; if (durationMs > 0) this.fallbackDurations.push(durationMs); }

	public prepareTurn(input: { snapshot: HardAiWorkerRequest["snapshot"]; acceptedAction: IInput; nextRuleState: RuleState; aiSettings: AiSettings }): string | undefined {
		if (!this.isAvailable()) return undefined;
		const requestWithoutHash = {
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
		this.pending = { request, startedAt: performance.now(), valid: false, metricsRecorded: false };
		this.requestCount++;
		this.startHeartbeat();
		try {
			this.worker!.postMessage(request);
		} catch (error) {
			this.fail(error);
			return undefined;
		}
		return request.requestId;
	}

	/** Records the authoritative post-playback state; a response is usable only after this check. */
	public completeAuthoritativeTurn(handler: GameHandler): void {
		if (!this.pending) return;
		this.pending.actualPostTurnHash = fingerprintCanonicalSnapshot(handler.toSettings());
		this.pending.playbackEndedAt = performance.now();
		this.validatePending();
	}

	public consumePreparedAction(): IInput | undefined {
		const prepared = this.pending;
		if (!prepared?.valid || !prepared.response?.action) return undefined;
		this.pending = undefined;
		this.stopHeartbeat();
		return prepared.response.action;
	}

	/** Invalidates current work without affecting the authoritative handler. */
	public invalidate(): void { this.pending = undefined; this.stopHeartbeat(); }

	public dispose(): void {
		this.disposed = true;
		this.generation++;
		this.pending = undefined;
		this.worker?.terminate();
		this.worker = undefined;
		this.stopHeartbeat();
	}

	private start(): void {
		// Bun exposes a Worker global too, but this entry point is a browser
		// module worker and must not be started by headless/server-side tests.
		if (this.usesDefaultWorkerFactory && (typeof window === "undefined" || typeof Worker === "undefined")) { this.failed = true; return; }
		try {
			const worker = this.workerFactory();
			worker.onmessage = event => this.receive(event.data);
			worker.onerror = event => this.fail(event.error ?? new Error(event.message));
			this.worker = worker;
		} catch (error) {
			this.failedCount++;
			this.failureReason = error instanceof Error ? error.message : String(error);
			this.failed = true;
		}
	}

	private receive(message: { type?: string; response?: HardAiWorkerResponse; message?: string }): void {
		if (message.type === "error") { this.fail(new Error(message.message ?? "AI worker computation failed")); return; }
		const prepared = this.pending;
		const response = message.type === "result" ? message.response : undefined;
		if (!prepared || !response || response.requestId !== prepared.request.requestId || response.basedOnStateHash !== prepared.request.basedOnStateHash || response.expectedTurnNumber !== prepared.request.expectedTurnNumber || response.expectedNextTeam !== prepared.request.expectedNextTeam) return;
		if (response.schemaVersion !== 1 || !Number.isFinite(response.computeMs) || !response.action || !isValidInput(response.action)) { this.pending = undefined; this.stopHeartbeat(); return; }
		prepared.response = response;
		prepared.responseReceivedAt = performance.now();
		this.validatePending();
	}

	private validatePending(): void {
		const prepared = this.pending;
		if (!prepared || !prepared.response || !prepared.actualPostTurnHash) return;
		prepared.valid = prepared.response.postTurnStateHash === prepared.actualPostTurnHash;
		if (!prepared.valid) { this.pending = undefined; this.stopHeartbeat(); return; }
		this.validResponseCount++;
		if (prepared.responseReceivedAt !== undefined && prepared.playbackEndedAt !== undefined) this.recordTurnMetrics(prepared);
	}

	private fail(error: unknown): void {
		if (this.disposed) return;
		this.failedCount++;
		this.failureReason = error instanceof Error ? error.message : String(error);
		this.failed = true;
		this.pending = undefined;
		this.worker?.terminate();
		this.worker = undefined;
		this.stopHeartbeat();
	}

	private startHeartbeat(): void {
		if (this.heartbeatTimer !== undefined) return;
		this.heartbeatAt = performance.now();
		this.heartbeatTimer = setInterval(() => {
			const now = performance.now();
			this.eventLoopGaps.push(Math.max(0, now - this.heartbeatAt - 25));
			this.heartbeatAt = now;
		}, 25);
	}
	private stopHeartbeat(): void {
		if (this.heartbeatTimer === undefined) return;
		clearInterval(this.heartbeatTimer);
		this.heartbeatTimer = undefined;
	}
	private recordTurnMetrics(prepared: PreparedTurn): void {
		if (prepared.metricsRecorded || !prepared.response || prepared.responseReceivedAt === undefined || prepared.playbackEndedAt === undefined) return;
		prepared.metricsRecorded = true;
		const playerVisibleDurationMs = prepared.playbackEndedAt - prepared.startedAt;
		const workerCompletionDurationMs = prepared.responseReceivedAt - prepared.startedAt;
		this.turnMetrics.push({ playerVisibleDurationMs, workerComputeMs: prepared.response.computeMs, workerCompletionDurationMs, precomputeHeadroomMs: playerVisibleDurationMs - workerCompletionDurationMs, postTurnWaitMs: Math.max(0, prepared.responseReceivedAt - prepared.playbackEndedAt), workerReadyBeforeTurnEnd: prepared.responseReceivedAt <= prepared.playbackEndedAt });
	}
}

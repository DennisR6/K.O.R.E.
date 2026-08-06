import { describe, expect, test } from "bun:test";
import { detectSoftlock, progressFingerprint, SOFTLOCK_LIMITS, type ProgressFingerprint, type SoftlockObservation } from "./support/gameplayQualification.js";

function fingerprint(overrides: Partial<ProgressFingerprint> = {}): ProgressFingerprint {
	return {
		turnNumber: 0,
		activeTeam: 0,
		phase: "physics",
		entityStateHash: "entities-0",
		playbackFramesRemaining: 0,
		matchStatus: "ongoing",
		...overrides,
	};
}

function repeated(count: number, observation: SoftlockObservation): SoftlockObservation[] {
	return Array.from({ length: count }, () => structuredClone(observation));
}

describe("Section 15.4 match softlock detection", () => {
	test("exposes the complete deterministic progress fingerprint", () => {
		const handler = {
			getTurnNumber: () => 7,
			getActiveTeam: () => 1,
			getRuleState: () => ({ phase: "physics" }),
			toSettings: () => ({ players: [{ id: "actor", position: { x: 1, y: 2 } }] }),
			getPlaybackFramesRemaining: () => 3,
			getMatchResult: () => undefined,
		};
		const result = progressFingerprint(handler as never);
		expect(Object.keys(result)).toEqual([
			"turnNumber", "activeTeam", "phase", "entityStateHash", "playbackFramesRemaining", "matchStatus",
		]);
		expect(result).toMatchObject({ turnNumber: 7, activeTeam: 1, phase: "physics", playbackFramesRemaining: 3, matchStatus: "ongoing" });
	});

	test("flags an identical full state repeating beyond the explicit limit", () => {
		const observations = repeated(SOFTLOCK_LIMITS.repeatedFingerprint + 1, { fingerprint: fingerprint() });
		const result = detectSoftlock(observations);
		expect(result.detected).toBe(true);
		expect(result.reason).toContain("identical progress fingerprint");
	});

	test("flags accepted actions that never advance the turn or rule phase", () => {
		const stalledTurn = Array.from({ length: SOFTLOCK_LIMITS.turnStalls + 1 }, (_, index) => ({
			fingerprint: fingerprint({ entityStateHash: `changing-entity-${index}` }), acceptedAction: true, stateChanged: true,
		}));
		const stalledPhase = Array.from({ length: SOFTLOCK_LIMITS.phaseStalls + 1 }, (_, index) => ({
			fingerprint: fingerprint({ turnNumber: index + 1, entityStateHash: `changing-entity-${index}` }), acceptedAction: true, stateChanged: true,
		}));
		expect(detectSoftlock(stalledTurn).reason).toContain("turn number");
		expect(detectSoftlock(stalledPhase).reason).toContain("rule phase");
	});

	test("flags no-action and accepted no-op loops without treating bounded progress as a softlock", () => {
		const noActions = repeated(SOFTLOCK_LIMITS.noActionObservations, { fingerprint: fingerprint(), aiActionAvailable: false });
		const noOpActions = repeated(SOFTLOCK_LIMITS.noOpActions, { fingerprint: fingerprint(), acceptedAction: true, stateChanged: false });
		expect(detectSoftlock(noActions).detected).toBe(true);
		expect(detectSoftlock(noOpActions).detected).toBe(true);

		const bounded = [0, 1, 2].map(turn => ({
			fingerprint: fingerprint({ turnNumber: turn, activeTeam: turn % 2, entityStateHash: `entities-${turn}` }),
			acceptedAction: true,
			stateChanged: true,
			aiActionAvailable: true,
		}));
		expect(detectSoftlock(bounded)).toEqual({ detected: false, repeatedFingerprintCount: 1, fingerprintCount: 3 });
	});

	test("flags playback countdown stalls but permits a valid countdown and an ongoing bounded match", () => {
		const stalled = [3, 3, 3, 3].map(playbackFramesRemaining => ({ fingerprint: fingerprint({ playbackFramesRemaining }) }));
		const progressing = [3, 2, 1, 0].map((playbackFramesRemaining, index) => ({
			fingerprint: fingerprint({ playbackFramesRemaining, entityStateHash: `entities-${index}` }),
		}));
		expect(detectSoftlock(stalled).detected).toBe(true);
		expect(detectSoftlock(progressing)).toEqual({ detected: false, repeatedFingerprintCount: 1, fingerprintCount: 4 });
	});
});

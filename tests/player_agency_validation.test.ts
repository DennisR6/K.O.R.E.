import { describe, expect, test } from "bun:test";
import { GameHandlerBuilder } from "../src/engine/Handler.ts";
import type { TurnPacket } from "../src/engine/types.ts";
import type { PlayerSettings } from "../src/entity/types.ts";
import { createPlayerSettings } from "../src/entity/types.ts";
import { createDefaultGameSettings } from "../src/settings/settings.ts";

type AgencyWarningCode =
	| "no-legal-actors"
	| "single-action-range"
	| "no-state-change"
	| "no-opponent-interaction"
	| "no-hazard-interaction"
	| "single-repeated-action"
	| "death-before-agency";

export interface AgencyActionTrace {
	actorId: string;
	input: { angle: number; power: number };
	result: TurnPacket;
	before: PlayerSettings[];
	opponentInteraction: boolean;
	hazardInteraction: boolean;
}

export interface PlayerAgencyReport {
	legalActors: number;
	distinctActionRanges: number;
	stateChanges: number;
	opponentInteractions: number;
	hazardInteractions: number;
	actionDiversity: number;
	warnings: AgencyWarningCode[];
	hardFailures: string[];
}

function changed(before: PlayerSettings, after: PlayerSettings): boolean {
	return before.position.x !== after.position.x
		|| before.position.y !== after.position.y
		|| before.velocity.x !== after.velocity.x
		|| before.velocity.y !== after.velocity.y
		|| before.hp !== after.hp
		|| before.isDead !== after.isDead;
}

/**
 * Analyzes accepted action results, rather than treating a legal input as
 * agency by itself. Balance findings are warnings; malformed authoritative
 * results are hard failures because the trace cannot be trusted.
 */
export function analyzePlayerAgency(trace: AgencyActionTrace[]): PlayerAgencyReport {
	const legalActors = new Set<string>();
	const actionRanges = new Set<string>();
	const actions = new Set<string>();
	const warnings = new Set<AgencyWarningCode>();
	const hardFailures: string[] = [];
	let stateChanges = 0;
	let opponentInteractions = 0;
	let hazardInteractions = 0;

	for (const [index, action] of trace.entries()) {
		const result = action.result;
		const beforeActor = action.before.find(player => player.id === action.actorId);
		const afterActor = result.finalState.find(player => player.id === action.actorId);
		if (!beforeActor || !afterActor) {
			hardFailures.push(`action ${index}: actor is missing from before or after state`);
			continue;
		}
		if (result.actorId !== action.actorId || result.input.angle !== action.input.angle || result.input.power !== action.input.power) {
			hardFailures.push(`action ${index}: result does not match submitted action`);
		}
		if (!Number.isFinite(result.durationFrames) || result.durationFrames < 0) {
			hardFailures.push(`action ${index}: invalid playback duration`);
		}
		legalActors.add(action.actorId);
		actionRanges.add(`${action.input.angle}:${action.input.power}`);
		actions.add(`${action.actorId}:${action.input.angle}:${action.input.power}`);
		if (changed(beforeActor, afterActor)) stateChanges++;
		if (action.opponentInteraction) opponentInteractions++;
		if (action.hazardInteraction) hazardInteractions++;
	}

	if (legalActors.size === 0) warnings.add("no-legal-actors");
	if (trace.length > 0 && actionRanges.size <= 1) warnings.add("single-action-range");
	if (trace.length > 0 && stateChanges === 0) warnings.add("no-state-change");
	if (trace.length > 0 && opponentInteractions === 0) warnings.add("no-opponent-interaction");
	if (trace.length > 0 && hazardInteractions === 0) warnings.add("no-hazard-interaction");
	if (trace.length > 1 && actions.size === 1) warnings.add("single-repeated-action");
	const actedActors = new Set(trace.map(action => action.actorId));
	for (const action of trace) {
		if (action.before.some(player => player.isDead && !actedActors.has(player.id))) warnings.add("death-before-agency");
	}

	return {
		legalActors: legalActors.size,
		distinctActionRanges: actionRanges.size,
		stateChanges,
		opponentInteractions,
		hazardInteractions,
		actionDiversity: actions.size,
		warnings: [...warnings].sort(),
		hardFailures,
	};
}

function makeAgencyHandler() {
	const settings = createDefaultGameSettings(2, 1);
	settings.players[0] = createPlayerSettings({ ...settings.players[0], id: "00000000-0000-4000-8000-000000000001", position: { x: 180, y: 225 }, team: [0] });
	settings.players[1] = createPlayerSettings({ ...settings.players[1], id: "00000000-0000-4000-8000-000000000002", position: { x: 380, y: 225 }, team: [1] });
	return new GameHandlerBuilder().defaultSystems().fromSettings(settings).build();
}

function resultTrace(): AgencyActionTrace[] {
	const handler = makeAgencyHandler();
	const actions = [
		{ actorId: "00000000-0000-4000-8000-000000000001", angle: 0, power: 10, opponentInteraction: true, hazardInteraction: false },
		{ actorId: "00000000-0000-4000-8000-000000000002", angle: 180, power: 5, opponentInteraction: true, hazardInteraction: false },
		{ actorId: "00000000-0000-4000-8000-000000000001", angle: 90, power: 4, opponentInteraction: false, hazardInteraction: true },
	];
	return actions.map(action => {
		const before = handler.getEntityManager().serialize();
		const result = handler.simulateTurn(action.actorId, action.angle, action.power);
		return { ...action, before, result, input: { angle: action.angle, power: action.power } };
	});
}

function syntheticTrace(overrides: Partial<AgencyActionTrace> = {}): AgencyActionTrace {
	const player = createPlayerSettings({ id: "00000000-0000-4000-8000-000000000001", team: [0] });
		const result: TurnPacket = { actorId: player.id, input: { angle: 0, power: 1 }, durationFrames: 1, finalState: [player] };
	return {
		actorId: player.id,
		input: { angle: 0, power: 1 },
		result,
		before: [player],
		opponentInteraction: false,
		hazardInteraction: false,
		...overrides,
	};
}

describe("Section 15.7 meaningful player agency", () => {
	test("analyzes deterministic action results and keeps the healthy trace clean", () => {
		const first = analyzePlayerAgency(resultTrace());
		const second = analyzePlayerAgency(resultTrace());
		expect(first).toEqual(second);
		expect(first.legalActors).toBe(2);
		expect(first.distinctActionRanges).toBe(3);
		expect(first.stateChanges).toBeGreaterThan(0);
		expect(first.opponentInteractions).toBeGreaterThan(0);
		expect(first.hazardInteractions).toBeGreaterThan(0);
		expect(first.actionDiversity).toBe(3);
		expect(first.warnings).toEqual([]);
		expect(first.hardFailures).toEqual([]);
	});

	test("reports agency deficits as warnings for required negative traces", () => {
		const one = syntheticTrace();
		const report = analyzePlayerAgency([one, { ...one, result: { ...one.result, input: { angle: 0, power: 1 } } }]);
		expect(report.warnings).toEqual(expect.arrayContaining(["single-action-range", "no-state-change", "no-opponent-interaction", "no-hazard-interaction", "single-repeated-action"]));
		expect(report.hardFailures).toEqual([]);

		// A shot can move a player while never leaving its own spawn area. The
		// result is real state change, but it still has no opponent agency.
		const ownArea = syntheticTrace({
			result: {
				...one.result,
				finalState: [createPlayerSettings({ ...one.before[0], position: { x: 1, y: 1 } })],
			},
		});
		const ownAreaReport = analyzePlayerAgency([ownArea]);
		expect(ownAreaReport.stateChanges).toBe(1);
		expect(ownAreaReport.warnings).toContain("no-opponent-interaction");
	});

	test("flags no legal actors and death before agency without promoting either to a hard failure", () => {
		const dead = createPlayerSettings({ id: "00000000-0000-4000-8000-000000000003", isDead: true, team: [1] });
		const live = createPlayerSettings({ id: "00000000-0000-4000-8000-000000000001", team: [0] });
		const report = analyzePlayerAgency([syntheticTrace({ before: [live, dead], result: { ...syntheticTrace().result, finalState: [live, dead] } })]);
		expect(report.warnings).toEqual(expect.arrayContaining(["death-before-agency"]));
		expect(report.hardFailures).toEqual([]);
		const empty = analyzePlayerAgency([]);
		expect(empty.warnings).toEqual(["no-legal-actors"]);
		expect(empty.hardFailures).toEqual([]);
	});

	test("keeps malformed action results as hard failures", () => {
		const action = syntheticTrace({ result: { ...syntheticTrace().result, actorId: "wrong-id", durationFrames: -1 } });
		const report = analyzePlayerAgency([action]);
		expect(report.hardFailures).toEqual(["action 0: result does not match submitted action", "action 0: invalid playback duration"]);
	});
});

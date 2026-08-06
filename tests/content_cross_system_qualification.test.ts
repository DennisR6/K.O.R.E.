import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { CONTENT_ARTIFACT_INVENTORY, CONTENT_QUALIFICATION_BOUNDARIES, CONTENT_QUALIFICATION_MATRIX, canonicalContentJson, compareContentActionTraces, contentFingerprint } from "../src/content/qualification.js";
import { kore } from "../src/kore/sdk/index.ts";
import { RuleInterpreter } from "../src/rules/RuleInterpreter.ts";
import { createMatchHandler } from "../src/scenes/matchPipeline.ts";
import { qualifyMap } from "./support/mapQualification.js";
import { GameplayFeedbackTrace, KoreGameplayFeedbackType } from "../src/kore/gameplayFeedback.js";

const root = process.cwd();

describe("Milestone 49 new-content qualification", () => {
	test("inventories every Milestone 41-48 artifact with existing evidence", () => {
		expect(CONTENT_ARTIFACT_INVENTORY.length).toBeGreaterThan(0);
		for (const artifact of CONTENT_ARTIFACT_INVENTORY) {
			expect(artifact.milestone).toBeGreaterThanOrEqual(41);
			expect(artifact.milestone).toBeLessThanOrEqual(48);
			expect(artifact.evidence.length).toBeGreaterThan(0);
			for (const evidence of artifact.evidence) expect(existsSync(`${root}/${evidence}`), `${artifact.id}: ${evidence}`).toBe(true);
		}
	});

	test("every artifact/boundary cell has explicit pass, skip, or blocked evidence", () => {
		const expected = CONTENT_ARTIFACT_INVENTORY.length * CONTENT_QUALIFICATION_BOUNDARIES.length;
		expect(CONTENT_QUALIFICATION_MATRIX).toHaveLength(expected);
		for (const cell of CONTENT_QUALIFICATION_MATRIX) {
			expect(["pass", "skip", "blocked"]).toContain(cell.status);
			expect(cell.evidence.length).toBeGreaterThan(0);
			expect(cell.note === undefined || cell.note.length > 0).toBe(true);
		}
		expect(CONTENT_QUALIFICATION_MATRIX.some(cell => cell.status === "skip")).toBe(true);
		expect(CONTENT_QUALIFICATION_MATRIX.some(cell => cell.status === "blocked")).toBe(true);
	});

	test("shared fingerprints and action traces are stable across independent runs", () => {
		const actions = [{ actorId: "a", action: "shoot", payload: { power: 4, angle: 90 } }, { actorId: "b", action: "shoot", payload: { power: 3, angle: 270 } }] as const;
		expect(contentFingerprint({ actions })).toBe(contentFingerprint(JSON.parse(JSON.stringify({ actions }))));
		expect(compareContentActionTraces(actions, JSON.parse(JSON.stringify(actions)))).toBe(true);
		expect(canonicalContentJson({ z: 1, a: 2 })).toBe('{"a":2,"z":1}');
	});

	test("competitive maps produce matching qualification fingerprints", () => {
		for (const id of ["aurora-basin", "lantern-gates", "ember-crossing"]) {
			const first = qualifyMap(id, { seed: 4901, maxTurns: 8 });
			const second = qualifyMap(id, { seed: 4901, maxTurns: 8 });
			expect(first.checks.snapshotRestore, id).toBe(true);
			expect(first.checks.replayEquality, id).toBe(true);
			expect(contentFingerprint(first), id).toBe(contentFingerprint(second));
		}
	}, 120_000);

	test("modes, feedback, and restored handlers retain deterministic traces", () => {
		for (const entry of kore.gameModes.list()) {
			const first = new RuleInterpreter(entry.mode);
			const second = new RuleInterpreter(structuredClone(entry.mode));
			let left = first.initialState(0, 2);
			let right = second.initialState(0, 2);
			const trace: unknown[] = [];
			while (left.phase !== "complete") {
				trace.push(left);
				left = first.advancePhase(left);
				right = second.advancePhase(right);
				expect(left).toEqual(right);
			}
			expect(contentFingerprint(trace)).toBe(contentFingerprint(trace));
			const handler = createMatchHandler({ mode: "ai-battle", mapId: "aurora-basin", gameModeId: entry.id, seed: 4902 });
			const snapshot = handler.toSettings();
			expect(createMatchHandler({ mode: "ai-battle", mapId: "aurora-basin", gameModeId: entry.id, seed: 4902 }).toSettings()).toEqual(snapshot);
			handler.dispose();
		}

		const feedback = new GameplayFeedbackTrace();
		for (const type of Object.values(KoreGameplayFeedbackType)) feedback.record(type, 0);
		expect(contentFingerprint(feedback.toSettings())).toBe(contentFingerprint(new GameplayFeedbackTrace(feedback.toSettings()).toSettings()));
	});

	test("matrix marks unsupported package execution and human evidence instead of implying qualification", () => {
		const packageCells = CONTENT_QUALIFICATION_MATRIX.filter(cell => cell.artifactId === "package:version-1-fixture");
		expect(packageCells.find(cell => cell.boundary === "package-validation")?.status).toBe("pass");
		expect(packageCells.find(cell => cell.boundary === "browser")?.status).toBe("skip");
		expect(packageCells.find(cell => cell.boundary === "human-playtest")?.status).toBe("blocked");
		expect(kore.gameModes.get("quick-slip-v1").selectable).toBe(true);
	});
});

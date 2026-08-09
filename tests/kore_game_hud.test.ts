import { expect, test } from "bun:test";
import { createGameHudComposition, validateKoreGameHudSettings } from "../src/kore/ui/gameHud.ts";
import { createKoreGameHudSurface } from "../src/kore/ui/KoreGameHudSurface.ts";
import { KoreHudCommand, parseKoreHudCommand } from "../src/kore/ui/hudCommands.ts";
import { KoreHudElement, KoreHudId } from "../src/kore/ui/hudVocabulary.ts";
import { GameState } from "../src/engine/types.ts";
import { RulePhase } from "../src/rules/types.ts";

const projection = (overrides: object = {}) => ({ revision: 1, turn: { number: 0, activeTeam: 0, phase: RulePhase.Item, engineState: GameState.Your_turn, selectedActorId: "actor", aimAngle: 30, power: 4 }, inventory: [{ itemId: "freeze-shot", remainingUses: 1, enabled: true }], match: { inputLocked: false, waiting: false, paused: false }, guidance: { activeMarkers: [] }, ...overrides });

test("KORE HUD composition builds JSON-safe enum-backed canonical settings", () => {
	const composition = createGameHudComposition(); const settings = composition.build();
	expect(() => validateKoreGameHudSettings(settings)).not.toThrow();
	expect(JSON.parse(composition.buildJson())).toEqual(settings);
	expect(settings.metadata.commandValues).toContain(KoreHudCommand.UseItem);
	expect(settings.id).toBe(KoreHudId.Composition);
	expect(settings.ui.screens[0]?.elements.find(element => element.id === KoreHudElement.SkipItem)?.action).toMatchObject({ command: KoreHudCommand.SkipItemPhase });
});

test("HUD projection is idempotent, draw is pure, and item command routes through typed payload", () => {
	const commands: unknown[] = []; const hud = createKoreGameHudSurface({ handle: command => commands.push(command) });
	hud.applyProjection(projection()); const before = hud.toSettings(); hud.applyProjection(projection());
	hud.getRuntime().draw({ drawText() {}, drawButton() {}, drawTextInput() {}, drawImage() {} });
	expect(hud.toSettings()).toEqual(before);
	hud.updateMouse(530, 85); hud.handleMousePressed();
	expect(commands).toEqual([{ type: KoreHudCommand.UseItem, payload: { itemId: "freeze-shot", target: { type: "self" } } }]);
	expect(hud.drainSoundCommands()).toMatchObject([{ type: "playSound", soundId: "kore.ui.confirm" }]);
});

test("item-phase skip button remains clickable while gameplay input is locked", () => {
	const commands: unknown[] = [];
	const hud = createKoreGameHudSurface({ handle: command => { commands.push(command); return false; } });
	hud.applyProjection(projection());
	hud.updateMouse(600, 320);
	hud.handleMousePressed();
	expect(commands).toEqual([{ type: KoreHudCommand.SkipItemPhase, payload: undefined }]);
});

test("HUD command parser rejects unknown and malformed generic UI commands", () => {
	expect(parseKoreHudCommand("kore.hud.unknown", undefined)).toBeUndefined();
	expect(parseKoreHudCommand(KoreHudCommand.UseItem, undefined)).toBeUndefined();
	expect(parseKoreHudCommand(KoreHudCommand.Pause, { unexpected: true })).toBeUndefined();
	expect(parseKoreHudCommand(KoreHudCommand.SkipItemPhase, undefined)).toEqual({ type: KoreHudCommand.SkipItemPhase, payload: undefined });
});

test("result projection exposes the SDK rematch action", () => {
	const commands: unknown[] = []; const hud = createKoreGameHudSurface({ handle: command => commands.push(command) });
	hud.applyProjection(projection({ match: { inputLocked: true, waiting: false, paused: false, result: { status: "winner", winnerTeam: 0, reason: "test", turnNumber: 1 } } }));
	hud.updateMouse(317, 324); hud.handleMousePressed();
	expect(commands).toEqual([{ type: KoreHudCommand.Rematch, payload: undefined }]);
});

test("host capabilities hide unavailable network controls and suppress unconfirmed async cues", () => {
	const commands: unknown[] = []; const hud = createKoreGameHudSurface({ handle: command => { commands.push(command); return false; } }, undefined, undefined, { canSkipItemPhase: false, canPause: false });
	hud.applyProjection(projection());
	const elements = hud.getRuntime().toSettings().screens[0]!.elements;
	expect(elements.find(element => element.id === KoreHudElement.SkipItem)?.visible).toBe(false);
	expect(elements.find(element => element.id === KoreHudElement.Pause)?.visible).toBe(false);
	hud.updateMouse(530, 85); hud.handleMousePressed();
	expect(commands).toEqual([{ type: KoreHudCommand.UseItem, payload: { itemId: "freeze-shot", target: { type: "self" } } }]);
	expect(hud.drainSoundCommands()).toEqual([]);
});

test("HUD renders projected active-player dots and three-line pull-arrow preview", () => {
	const circles: Array<[number, number, number]> = []; const lines: Array<[number, number, number, number]> = [];
	const hud = createKoreGameHudSurface({ handle() {} });
	hud.applyProjection(projection({ guidance: { activeMarkers: [{ x: 100, y: 100, radius: 20 }], aimPreview: { from: { x: 100, y: 100 }, to: { x: 60, y: 100 }, left: { x: 68, y: 108 }, right: { x: 68, y: 92 } } } }));
	hud.draw({ push() {}, pop() {}, setFillColor() {}, setStrokeColor() {}, setStroke() {}, drawCircle(x, y, radius) { circles.push([x, y, radius]); }, line(x, y, x1, y1) { lines.push([x, y, x1, y1]); }, drawRect() {}, drawText() {} } as any);
	expect(circles).toEqual([[100, 72, 4]]);
	expect(lines).toEqual([[100, 100, 60, 100], [60, 100, 68, 108], [60, 100, 68, 92]]);
});

import { expect, test } from "bun:test";
import { EffectType, EffectTrigger } from "../src/effects/types.ts";
import type { RenderContext } from "../src/kore/runtime/RenderContext.ts";
import { createCanonicalPlayableMatchHandler } from "../src/settings/canonicalPlayableMatch.ts";
import { AuthoritativeGameplayRenderer } from "../src/ui/AuthoritativeGameplayRenderer.ts";
import { createItemPickup } from "../src/item/types.ts";
import { mysteryBoxItem } from "../src/item/officialItems.ts";
import { GameState } from "../src/kore/runtime/types.ts";

type DrawCall = { type: string; values: unknown[] };

function createRenderer(calls: DrawCall[]): RenderContext {
	return {
		WORLD_SIZE_X: 800,
		WORLD_SIZE_Y: 450,
		drawCircle(...values: number[]) { calls.push({ type: "circle", values }); },
		drawRect(...values: number[]) { calls.push({ type: "rect", values }); },
		drawText(...values: unknown[]) { calls.push({ type: "text", values }); },
		setFillColor(...values: string[]) { calls.push({ type: "fill", values }); },
		setNoFill() { calls.push({ type: "noFill", values: [] }); },
		setStrokeColor(...values: string[]) { calls.push({ type: "stroke", values }); },
		setStroke(...values: number[]) { calls.push({ type: "strokeWeight", values }); },
		rotate() { }, scale() { }, translate() { },
		drawImage(...values: unknown[]) { calls.push({ type: "image", values }); },
		getScreenSize() { return { width: 800, height: 450 }; },
		clear(...values: unknown[]) { calls.push({ type: "clear", values }); },
		push() { }, pop() { },
		line(...values: number[]) { calls.push({ type: "line", values }); },
		resizeCanvas() { }, setScaleFactor() { }, getScaleFactor() { return 1; },
		toWorld(value: number) { return value; }, toPixel(value: number) { return value; }, windowScale() { return 1; },
		beginClip() { }, endClip() { }, mouseWheel() { },
	};
}

test("gameplay scene renders only current authoritative state, roles, effects, and death", () => {
	const handler = createCanonicalPlayableMatchHandler();
	const player = handler.getEntityManager().getEntities()[0]!;
	player.setPos({ x: 321, y: 123 });
	const playerSize = player.getBounds().x;
	player.addEffect(EffectTrigger.Always, {
		getType: () => EffectType.ModifyMass,
		apply() { },
		toSettings: () => ({ type: EffectType.ModifyMass, typeValue: { mass: 1 } }),
	});
	const before = handler.toSettings();
	const calls: DrawCall[] = [];
	handler.drawWorld(createRenderer(calls));

	expect(calls.some(call => call.type === "image" && call.values[1] === 321 - playerSize && call.values[2] === 123 - playerSize)).toBe(true);
	expect(calls.some(call => call.type === "image" && call.values[0] === "public/items/mystery_box.svg")).toBe(true);
	expect(calls.some(call => call.type === "text" && call.values[0] === "mystery-box")).toBe(false);
	expect(calls.some(call => call.type === "text" && call.values[0] === "ModifyMass")).toBe(true);
	// The explicit containment rectangle is an outline, never a filled obstacle.
	expect(calls.some(call => call.type === "noFill")).toBe(true);
	expect(handler.toSettings()).toEqual(before);

	player.setIsDead(true);
	const deadCalls: DrawCall[] = [];
	handler.drawWorld(createRenderer(deadCalls));
	expect(deadCalls.some(call => call.type === "text" && call.values[0] === "OUT")).toBe(true);
});

test("authoritative hard-sync and rematch are rendered without cached entities", () => {
	const handler = createCanonicalPlayableMatchHandler();
	const finalState = handler.getEntityManager().serialize();
	const playerSize = finalState[0]!.size;
	finalState[0]!.position = { x: 654, y: 210 };
	handler.playTurn({ actorId: finalState[0]!.id, input: { angle: 0, power: 0 }, durationFrames: 0, finalState });
	handler.tick();

	const syncedCalls: DrawCall[] = [];
	handler.drawWorld(createRenderer(syncedCalls));
	expect(syncedCalls.some(call => call.type === "image" && call.values[1] === 654 - playerSize && call.values[2] === 210 - playerSize)).toBe(true);

	handler.rematch();
	const rematchCalls: DrawCall[] = [];
	handler.drawWorld(createRenderer(rematchCalls));
	expect(rematchCalls.some(call => call.type === "image" && call.values[1] === 654 - playerSize && call.values[2] === 210 - playerSize)).toBe(false);
});

test("map pickups have a visible named circle marker even with an image component", () => {
	const renderer = new AuthoritativeGameplayRenderer({
		getAuthoritativeRenderState: () => ({
			gameState: GameState.Your_turn,
			ruleState: { phase: "item", activeTeam: 0, turnNumber: 0, itemUses: 0 } as any,
			matchResult: undefined,
			structures: [],
			players: [],
			items: [mysteryBoxItem],
			pickups: [createItemPickup({ itemId: mysteryBoxItem.id, spawnRegion: { x: 100, y: 100, w: 40, h: 40 }, activationType: "collision" })],
			pickupState: { turnNumber: 0, pickups: [{ collected: 0, occupants: [] }] },
		}),
	});
	const calls: DrawCall[] = [];
	renderer.draw(createRenderer(calls));
	expect(calls.some(call => call.type === "circle" && call.values[0] === 120 && call.values[1] === 120)).toBe(true);
	expect(calls.some(call => call.type === "text" && call.values[0] === "Wunderkiste")).toBe(true);
});

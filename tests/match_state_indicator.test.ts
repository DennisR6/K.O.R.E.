import { expect, test } from "bun:test";
import { GameHandlerBuilder } from "../src/kore/runtime/Handler.ts";
import type { RenderContext } from "../src/kore/runtime/RenderContext.ts";
import { MatchStateIndicator } from "../src/systems/MatchStateIndicator.ts";
import { UiSystem } from "../src/systems/UiSystem.ts";

test("MatchStateIndicator draws active-team, rule-phase, turn number, force, and selected-item indicators", () => {
	const ui = new UiSystem();
	ui.setChargePower(6.4);

	const handler = new GameHandlerBuilder().defaultSystems().build();
	handler.setActiveTeam(1);
	handler.setTurnNumber(2);
	handler.setRuleState({ phase: "item" as any, activeTeam: 1, turnNumber: 2, itemUses: 0 });

	const indicator = new MatchStateIndicator(
		ui,
		() => handler.getRuleState().phase,
		() => "anker",
	);

	const labels: string[] = [];
	const renderer = {
		push() { },
		pop() { },
		setFillColor() { },
		drawText(text: string) { labels.push(text); },
	} as unknown as RenderContext;

	indicator.ticker(handler.getContext(), 1, 1);
	indicator.draw(renderer);

	expect(labels).toContain("Team: 2");
	expect(labels).toContain("Phase: item");
	expect(labels).toContain("Turn: 3");
	expect(labels).toContain("Force: 6.4");
	expect(labels).toContain("Item: anker");
});

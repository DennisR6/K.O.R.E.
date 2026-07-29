import { expect, test } from "bun:test";
import { GameHandlerBuilder } from "../src/engine/Handler.ts";
import type { RenderContext } from "../src/engine/RenderContext.ts";
import { Player } from "../src/entity/Player.ts";
import { createPlayerSettings } from "../src/entity/types.ts";
import { DirectionArrow } from "../src/systems/DirectionArrow.ts";
import { UiSystem } from "../src/systems/UiSystem.ts";

test("direction overlay identifies the active team and draws the opposite drag direction", () => {
	const ui = new UiSystem()
	const player = new Player(createPlayerSettings({ position: { x: 100, y: 100 }, team: [0] }))
	const handler = new GameHandlerBuilder().defaultSystems().setPlayerTeam([0]).addPlayer(player).build()
	ui.start = { x: 100, y: 100 }
	ui.currentMouse = { x: 140, y: 100 }

	const labels: string[] = []
	const lines: Array<[number, number, number, number]> = []
	const renderer = {
		push() { },
		pop() { },
		setFillColor() { },
		setStrokeColor() { },
		drawText(text: string) { labels.push(text) },
		drawCircle() { },
		line(x: number, y: number, x1: number, y1: number) { lines.push([x, y, x1, y1]) },
	} as unknown as RenderContext

	const overlay = new DirectionArrow(ui)
	overlay.ticker(handler.getContext(), 1, 1)
	overlay.draw(renderer)

	expect(labels).toContain("Your turn: Team 1")
	expect(lines).toHaveLength(3)
	expect(lines[0][0]).toBe(100)
	expect(lines[0][2]).toBeLessThan(100)
})

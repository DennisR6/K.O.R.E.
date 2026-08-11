import { expect, test } from "bun:test";
import { GameHandlerBuilder } from "../src/kore/runtime/Handler.ts";
import { Player } from "../src/entity/Player.ts";
import { createPlayerSettings } from "../src/entity/types.ts";
import { UiSystem } from "../src/systems/UiSystem.ts";
import { createKoreHudProjection } from "../src/kore/ui/gameHudProjection.ts";

test("HUD projection restores active-player markers and the opposite pull-arrow geometry", () => {
	const ui = new UiSystem()
	const player = new Player(createPlayerSettings({ position: { x: 100, y: 100 }, team: [0] }))
	const handler = new GameHandlerBuilder().defaultSystems().setPlayerTeam([0]).addPlayer(player).build()
	ui.start = { x: 100, y: 100 }
	ui.currentMouse = { x: 140, y: 100 }

	const projection = createKoreHudProjection(handler, ui)
	expect(projection.turn.activeTeam).toBe(0)
	expect(projection.turn.selectedActorId).toBe(player.getId())
	expect(projection.turn.aimAngle).toBe(180)
	expect(projection.turn.power).toBe(4)
	expect(projection.guidance.activeMarkers).toEqual([{ x: 100, y: 100, radius: player.getBounds().x }])
	expect(projection.guidance.aimPreview).toMatchObject({ from: { x: 100, y: 100 }, to: { x: 60, y: 100 } })
})

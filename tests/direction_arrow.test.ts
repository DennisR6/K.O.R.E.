import { expect, test } from "bun:test";
import { GameHandlerBuilder } from "../src/engine/Handler.ts";
import { Player } from "../src/entity/Player.ts";
import { createPlayerSettings } from "../src/entity/types.ts";
import { UiSystem } from "../src/systems/UiSystem.ts";
import { createKoreHudProjection } from "../src/kore/ui/gameHudProjection.ts";

test("HUD projection identifies the active team and exposes the opposite drag direction", () => {
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
})

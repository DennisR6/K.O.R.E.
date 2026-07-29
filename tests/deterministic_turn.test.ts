import { expect, test } from "bun:test";
import { GameHandlerBuilder } from "../src/engine/Handler.ts";
import { GameSettings } from "../src/settings/settings.ts";

test("a real ice-map shot resolves to a deterministic final snapshot", () => {
	const handler = new GameHandlerBuilder().defaultSystems().fromSettings(GameSettings).build()
	const actor = handler.getEntityManager().getEntities().find(entity => entity.getTeam().includes(0))!
	const turn = handler.resolveTurn({ actorId: actor.getId(), angle: 0, power: 1 })
	const finalActor = turn.finalState.find(player => player.id === actor.getId())!

	expect({
		durationFrames: turn.durationFrames,
		position: finalActor.position,
		velocity: finalActor.velocity,
		dead: finalActor.isDead,
	}).toEqual({
		durationFrames: 72,
		position: { x: 169.77203949870284, y: 132 },
		velocity: { x: 0, y: 0 },
		dead: false,
	})
})

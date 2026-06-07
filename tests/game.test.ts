import test from "node:test"
import { GameHandlerBuilder } from "../src/engine/Handler.js"
import { GameSettings } from "../src/settings/settings.js"
import assert from "node:assert"



test("the serialzier of the GameEngine", () => {
	const handler = new GameHandlerBuilder().defaultSystems().fromSettings(GameSettings).build().start()
	const settings = handler.toSettings()
	const handler2 = new GameHandlerBuilder().defaultSystems().fromSettings(settings).build().start()
	// handler2.getEntityManager().getEntities().forEach(x => x.setPos({ x: 1, y: 1 }))
	const settings2 = handler2.toSettings()


	for (const key of Object.keys(GameSettings)) {
		if (key === "id") continue
		assert.deepStrictEqual(JSON.stringify(settings2[key]), JSON.stringify(settings[key]))
	}
	console.log(settings)

})

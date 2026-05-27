import { GameSettings } from "./settings/settings"

GameSettings.effects?.forEach(effect => {
	const i = new Item()
		.addWall()
		.addDeadly()
		.addFrictionReducer()
		.build()


})

new DeatlyFrictionItem(settings)

import { expect, test } from "bun:test";
import { GameHandlerBuilder } from "../src/engine/Handler.ts";
import { ObjectEmitter } from "../src/emitter/ObjectEmitter.ts";
import { Player } from "../src/entity/Player.ts";
import { createPlayerSettings } from "../src/entity/types.ts";
import { EmitterSystem } from "../src/systems/Emitter.ts";
import { UiSystem } from "../src/systems/UiSystem.ts";

test("UiSystem supports separate aim rotation and charge power inputs", () => {
	const ui = new UiSystem();
	const emitter = new ObjectEmitter();
	const player = new Player(createPlayerSettings({ position: { x: 100, y: 100 } }));
	const handler = new GameHandlerBuilder()
		.defaultSystems()
		.addPlayer(player)
		.addSystem(ui)
		.addUIMouse(ui)
		.addSystem(new EmitterSystem(emitter))
		.build();

	// Set aim rotation and charge power separately
	ui.setAimAngle(player.getId(), 45);
	ui.setChargePower(7.5);

	handler.tick();

	expect(emitter.getLastShot()).toEqual({
		actorId: player.getId(),
		angle: 45,
		power: 7.5,
	});
	expect(player.getRotation()).toBe(45);
});

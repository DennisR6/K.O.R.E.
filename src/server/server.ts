import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createTestHandler } from '../engine/Handler';
import { defaultPhysics } from '../physics/defaultPhysics';
import { FRICTION_TABLE, GameSettings } from '../settings/settings';
import { Simulator } from '../engine/Simulator';
import { CombiEmitter, LogEmitter } from '../emitter/InputEmitter';
import { PhysicsSystem } from '../systems/PhysicsSystem';
import { PlaybackSystem } from '../systems/PlayBackSystem';
import { NoRoundSystem } from '../systems/RoundSystem';
import { StructureRectangle } from '../structures/structureRectangle';
import { StructureCircle } from '../structures/structureCircle';
import type { IInput } from '../engine/types';


const TickRate = 1
const physics = new defaultPhysics(FRICTION_TABLE.wood)
let handler = createTestHandler({ systems: [], physicsStrategy: physics, dt: TickRate });
handler.setSimulator(new Simulator())
const em = new CombiEmitter([new LogEmitter()])
handler.setEmitter(em)
handler.addSystem(new PhysicsSystem(physics, TickRate))
handler.addSystem(new PlaybackSystem())
handler.addSystem(new NoRoundSystem())
GameSettings.mapBoundarys?.forEach(str => {
	if (str.type === "rectangle") handler.addStructure(new StructureRectangle(str.x, str.y, str.w, str.h, str.color))
	if (str.type === "circle") handler.addStructure(new StructureCircle(str.x, str.y, str.r, str.color))
})
// GameSettings.players?.forEach((player) => handler.getEntityManager().addEntity(new Player().new({ ...player })));
handler.start()


const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
	cors: { origin: "*" }
});



io.on("connection", (socket) => {
	console.log(`User connected: ${socket.id}`, socket.handshake.auth.token);

	socket.on("shoot", (input: IInput) => {
		const { actorId, angle, power } = input
		const res = handler.simulateTurn(actorId, angle, power)
		console.log(input, res)
		socket.emit("turn", () => res)
	})
	socket.on("disconnect", () => {
		console.log("User disconnected");
	});
});



httpServer.listen(3000, () => {
	console.log("Socket-Server läuft auf Port 3000");
});

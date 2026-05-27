// import { Database } from "bun:sqlite";
// const db = new Database(":memory:")

import { randomUUID } from "node:crypto"
import { GameHandlerBuilder } from "./src/engine/Handler.ts"
import { GameSettings } from "./src/settings/settings.ts"
const PORT = process.env.PORT || 3000


// import { ServerHandler } from "./src/server/server.ts"

const handler = new GameHandlerBuilder()
	.defaultSystems()
	.fromSettings(GameSettings)
	.build()
	.start()
// const sim = handler.simulateTurn(0, 0, 5) // Sim wird dann an jeden spieler im Raum geschickt.
// handler.tickTurn(sim) // Apply State internally
// handler.finalizeTurnManual() // skip to final state
class RoomManager {
	private id: string
	constructor() { this.id = randomUUID() }
	getId(): string { return this.id }
	addUser() { }
	rmUser() { }
}


// class User {
// 	private id: number | string
// }
// const rooms: Room = []
const rm = new RoomManager()
Bun.serve({
	port: 3000,

	async fetch(req, server) {
		if (server.upgrade(req)) {
			return;
		}

		const url = new URL(req.url);
		if (url.pathname === "/") {
			return new Response(Bun.file("./index.html"));
		}

		if (url.pathname.includes(".json")) console.log(url.pathname)

		return new Response(Bun.file(`./${url.pathname}`));
	},

	websocket: {
		open(ws) {
			rm.addUser()
			console.log("Neuer Client verbunden!");
			ws.subscribe(`game`);
			ws.send(JSON.stringify({ type: "init", settings: handler.getSettings() }))
		},
		message(ws, message) {
			//@ts-ignore
			const output = JSON.parse(message)
			switch (output.type) {
				case "shoot": {
					const { actorId, angle, power } = output
					const sim = handler.simulateTurn(actorId, angle, power)
					handler.tickTurn(sim)
					handler.finalizeTurnManual()
					try {
						//@ts-ignore
						// ws.send(JSON.stringify({ type: "turn2", sim }));
						ws.publish("game", JSON.stringify({ type: "turn", sim }));
						ws.send(JSON.stringify({ type: "turn", sim }))
					} catch (e) {
						console.log(e)
					}
					console.log("daten erfolgreich geschickt")
					break
				}
				default:
					//@ts-ignore
					console.log("TODO:", output.type)
			}
		},
		close(_ws) {
			rm.rmUser()
			console.log("Client getrennt");
		},
	},
});

console.log(`Server läuft auf http://localhost:${PORT}`);


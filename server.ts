import { unwrap, wrap } from "./src/utils/net.ts"
import { getNetworkPacketType, NetworkError, NetworkInit, NetworkMessageType, NetworkNewUser, NetworkPing, NetworkTurn, NetworkWaitingRoom, UnTypedNetworkMessage, WebSocketData } from "./src/server/types.ts";
import { loginUser, loginUserFailed } from "./src/server/server.ts";
import { accesstokenSockets, userAccesstoken, USERID } from "./src/server/db.ts";
import { GameSettings } from "./src/settings/settings.ts";
import { UUID } from "crypto";
const PORT = process.env.PORT || 3000

const waitingRoom: USERID[] = []
Bun.serve<WebSocketData>({
	port: PORT,
	async fetch(req, server) {
		if (server.upgrade(req, { data: { accesstoken: crypto.randomUUID() } })) {
			return;
		}

		const url = new URL(req.url);
		if (url.pathname === "/") {
			return new Response(Bun.file("./index.html"));
		}

		return new Response(Bun.file(`./${url.pathname}`));
	},

	websocket: {
		open(ws: Bun.ServerWebSocket<WebSocketData>) {
			console.log("Neuer Client verbunden!");
			accesstokenSockets.set(ws.data.accesstoken, ws)
		},
		async message(ws: Bun.ServerWebSocket<WebSocketData>, message: string) {
			const output = unwrap(message) as UnTypedNetworkMessage
			if (!output.type) {
				ws.send(wrap<NetworkError>({ type: NetworkMessageType.ERROR, message: "Error with Network Package" }))
				return
			}
			console.log(getNetworkPacketType(output.type), output)
			switch (output.type) {
				case NetworkMessageType.LOGIN: {
					let token = output.userid
					if (!loginUser(output.userid)) {
						token = loginUserFailed()
						ws.send(wrap<NetworkNewUser>({ type: NetworkMessageType.NEWUSER, userid: token }))
						return
					}
					if (!token) {
						console.log("ERROR RETURN")
						ws.send(wrap<NetworkError>({ type: NetworkMessageType.ERROR, message: "Could not create Account for you" }));
						return
					}
					userAccesstoken.set(token!, ws.data.accesstoken)
					console.log("waitingRoom push")
					waitingRoom.push(token)
					ws.send(wrap<NetworkWaitingRoom>({ type: NetworkMessageType.WAITINGROOM }))
					return
				}
				case NetworkMessageType.SHOOT: {
					ws.send(wrap<NetworkTurn>({
						type: NetworkMessageType.TURN, sim: {
							actorId: "",
							finalState: [],
							durationFrames: 200,
							input: {
								angle: 200,
								power: 10,
							}
						}
					}))

					// HANDLESHOOT(output)
					break
				}
				case NetworkMessageType.WAITINGROOM: {
					console.log("someone is waiting in the waitingroom", output)
					break
				}
				case NetworkMessageType.GAME: {
					// handleGame(output)

					// ws.send(wrap<NetworkInit>({
					// 	type: NetworkMessageType.INIT,
					// 	settings: { id, maxPlayers, minPlayers, players, background, effects, friction, items, mapBoundarys, screenResolution, myTeam, allTeamSize },
					// }))
					break
				}
				case NetworkMessageType.PONG: {
					ws.send(wrap<NetworkPing>({ type: NetworkMessageType.PING }))
					return
				}
				case NetworkMessageType.INIT: {
					ws.send(wrap<NetworkError>({ type: NetworkMessageType.ERROR, message: "You cannot Init a Game on the server" }))
					return
				}
				default:
					console.log("TODO:", getNetworkPacketType(output.type))
			}
		},
		close(ws: Bun.ServerWebSocket<WebSocketData>) {
			accesstokenSockets.delete(ws.data.accesstoken)
			console.log("Client getrennt");
		},
	},
});
console.log(`Server läuft auf http://localhost:${PORT}`);

setInterval(() => {
	if (waitingRoom.length >= 2) {
		const p1 = waitingRoom.shift()!
		const p2 = waitingRoom.shift()!
		console.log("Found a game", p1, p2)
		const newSettings = { ...GameSettings }
		newSettings.allTeams = [p1, p2]
		for (const p of newSettings.allTeams) {
			const at1 = userAccesstoken.get(p as UUID)!
			const sock1 = accesstokenSockets.get(at1)!
			sock1.send(wrap<NetworkInit>({ type: NetworkMessageType.INIT, settings: newSettings }))
		}
	}
}, 2000)

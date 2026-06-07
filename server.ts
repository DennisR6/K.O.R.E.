import { Database } from "bun:sqlite";
import { UUID } from "crypto"
import { GameHandlerBuilder } from "./src/engine/Handler.ts"
import { GameSettings } from "./src/settings/settings.ts"
import { NetworkMessageType, UnTypedNetworkMessage, NetworkTurn, getNetworkPacketType, NetworkInit, NetworkPing, NetworkError, NetworkGame, NetworkNewUser } from "./src/server/server.ts"
import { unwrap, wrap } from "./src/utils/net.ts"
import { SHA256 } from "bun";
import { GameState, getEngineStateName } from "./src/engine/types.ts";

const sql = new Database(":memory:")
const usersTable = sql.query(`CREATE TABLE IF NOT EXISTS users (
    userid BLOB NOT NULL,
    accesstoken BLOB,
    PRIMARY KEY (userid)
);`)
const gameTable = sql.query(`CREATE TABLE IF NOT EXISTS game (
    timestamp TIMESTAMP NOT NULL,
    id BLOB PRIMARY KEY,
    value TEXT NOT NULL,
	maxplayer INT,
	player INT,
    hash BLOB,
	won INT
);`)
gameTable.run()
usersTable.run()

const PORT = process.env.PORT || 3000

Bun.serve({
	port: PORT,
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
		open(_ws: Bun.ServerWebSocket) {
			console.log("Neuer Client verbunden!");
		},
		async message(ws: Bun.ServerWebSocket, message: string) {
			const output = unwrap(message) as UnTypedNetworkMessage
			if (!output.type) {
				ws.send(wrap<NetworkError>({ type: NetworkMessageType.ERROR, message: "Error with Network Package" }))
				return
			}
			console.log(getNetworkPacketType(output.type), output)
			switch (output.type) {
				case NetworkMessageType.LOGIN: {
					let accesstoken = login(output.userid)
					if (!accesstoken) {
						const userid = crypto.randomUUID()
						addNewUser(userid)
						accesstoken = crypto.randomUUID()
						updateUser(userid, accesstoken)
						ws.send(wrap<NetworkNewUser>({ type: NetworkMessageType.NEWUSER, userid: userid }))
						return
					}
					const game = getGame(accesstoken)
					let id
					if (!game) {
						console.log("game not found, creating new:", accesstoken)
						const settings = { ...GameSettings, id: accesstoken }
						insertNewGame(settings)
						id = settings.id
					} else {
						id = game.id
					}
					ws.send(wrap<NetworkGame>({ type: NetworkMessageType.GAME, id: id }));
					break
				}
				case NetworkMessageType.SHOOT: {
					const accesstoken = login(output.userid)
					if (accesstoken === null) {
						console.log("login failed", output.userid)
						ws.send(wrap<NetworkError>({ type: NetworkMessageType.ERROR, message: "WRONG Userid!" }));
						return
					}
					const res = getGame(accesstoken)
					if (!res) return
					const { actorId, angle, power } = output
					const game = new GameHandlerBuilder().defaultSystems().fromSettings(res).build()
					console.log("loaded game", getEngineStateName(game.getState()))
					game.applyRawTurn({ angle, actorId, power })
					let durationFrames = 0
					{
						for (; game.getPhysics().isMoving(); ++durationFrames) { game.tick(1) }
						game.setState(GameState.PLAYING_DONE)
						game.tick(1)
					}
					const settings = game.toSettings()
					console.log("storing: ", getEngineStateName(settings.state))
					updateGame(settings)
					try {
						const sim = {
							actorId,
							durationFrames,
							finalState: game.getEntityManager().serialize(),
							input: { angle, power }
						}
						ws.publish(`game-${settings.id}`, wrap<NetworkTurn>({ type: NetworkMessageType.TURN, sim }));
						ws.send(wrap<NetworkTurn>({ type: NetworkMessageType.TURN, sim }))
					} catch (e) {
						console.log(e)
					}
					break
				}
				case NetworkMessageType.WAITINGROOM: {
					console.log("someone is waiting in the waitingroom", output)
					break
				}
				case NetworkMessageType.GAME: {
					console.log("start joining game: ", output.id)
					const game = getGame(output.id)
					if (!game) return
					ws.subscribe(`game-${output.id}`)
					ws.send(wrap<NetworkInit>({ type: NetworkMessageType.INIT, settings: game }))
					break
				}
				case NetworkMessageType.PONG: {
					ws.send(wrap<NetworkPing>({ type: NetworkMessageType.PING }))
					break
				}
				case NetworkMessageType.INIT: {
					const game = getGame("79897a27-58aa-4537-bbe9-a052d3aa2df1")
					if (!game) return
					ws.send(wrap<NetworkInit>({ type: NetworkMessageType.INIT, settings: game }))
				}
				default:
					console.log("TODO:", getNetworkPacketType(output.type))
			}
		},
		close(_ws) {
			console.log("Client getrennt");
		},
	},
});

function login(userid: UUID | undefined): UUID | null {
	let user: UUID
	if (userid === undefined) user = crypto.randomUUID()
	else user = userid
	const query = sql.query(`select accesstoken from users where userid=?1`)
	const res = query.get(user) as { accesstoken: UUID } | null
	if (!res) return null
	return res.accesstoken
}
console.log(`Server läuft auf http://localhost:${PORT}`);


function getGame(gameid: UUID): GameSettings | null {
	const query = sql.query("select value from game where id=?1")
	const res = query.get(gameid) as { value: string }
	if (!res) return null
	const settings = JSON.parse(res.value) as GameSettings
	if (!settings) return null
	return settings
}
function insertNewGame(settings: GameSettings) {
	const query = sql.query(`insert into game(timestamp,id,value)values(?1,?2,?3)`)
	return query.run(Date.now(), settings.id, JSON.stringify(settings))
}
function updateGame(settings: GameSettings, winnerId: number = 0) {
	const settingsstring = JSON.stringify(settings)
	const query = sql.query(`update game set value=?2,won=?3,hash=?4 where id=?1`)
	const hash = SHA256.hash(settingsstring)
	const result = query.run(settings.id, settingsstring, winnerId, hash)
	console.log(result)
	return result
}
function addNewUser(userid: UUID) {
	const query = sql.query(`insert into users(userid)values(?1)`)
	return query.run(userid)
}
export function findEmptyGame() {
}
function updateUser(userid: UUID, accesstoken: UUID) {
	const query = sql.query("update users set accesstoken=?2 where userid=?1")
	return query.run(userid, accesstoken)
}

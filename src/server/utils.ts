// import type { UUID } from "crypto"
// import { DB } from "./db.js"
// import { GameSettings } from "../settings/settings.js"


// export function getGameIDFromUserUUID(_user: UUID): UUID | null {
// 	const res = DB.db.query("select * from game").run()
// 	console.log("games from ", res)
// 	return null
// }
// export function getGame(gameid: UUID): GameSettings | null {
// 	const query = DB.db.query("select value from game where id=?1")
// 	const res = query.get(gameid) as { value: string }
// 	if (!res) return null
// 	const settings = JSON.parse(res.value) as GameSettings
// 	if (!settings) return null
// 	return settings
// }

// export function startNewGame(playerId: Array<{ player_id: UUID }>): UUID {
// 	const gameid = crypto.randomUUID()
// 	const settings = GameSettings
// 	settings.id = gameid
// 	settings.allTeams = []
// 	playerId.forEach(({ player_id }) => settings.allTeams!.push(player_id))
// 	console.log(settings.allTeams)
// 	const res = DB.db.query("insert into game (id,value,current_players)values(?1,?2,?3)").run(gameid, JSON.stringify(settings), playerId.length)
// 	console.log(res)
// 	return gameid
// }
// export function updateGame(settings: GameSettings) {
// 	const settingsstring = JSON.stringify(settings)
// 	const query = DB.db.query(`update game set value=?2 where id=?1`)
// 	const result = query.run(settings.id, settingsstring)
// 	console.log(result)
// 	return result
// }
// export function addNewUser(userid: UUID) {
// 	const query = DB.db.query(`insert into users(userid)values(?1)`)
// 	return query.run(userid)
// }
// export function findEmptyGame() { }
// export function addToWaitingroom(userid: UUID) {
// 	const waitingquery = DB.db.query(`select * from lobby_queue where player_id=?1`)
// 	const res = waitingquery.get(userid)
// 	if (res) return
// 	const query = DB.db.query(`insert into lobby_queue(player_id)values(?1)`)
// 	return query.run(userid)
// }
// export function getWaitingPlayers(): Array<{ player_id: UUID }> {
// 	return DB.db.query("select * from lobby_queue limit 2").all() as Array<{ player_id: UUID }>
// }
//

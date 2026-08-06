import { type NetworkShoot } from "./types.js";
import { type TurnPacket } from "../engine/types.js";

export function HANDLESHOOT({ }: NetworkShoot): TurnPacket | null {
	return null
	// if (!loginUser(userid)) {
	// 	// ws.send(wrap<NetworkError>({ type: NetworkMessageType.ERROR, message: "WRONG Userid!" }));
	// 	return null
	// }
	// const res = getGame(gameid)
	// if (!res) { return null }// _ws.send(wrap<NetworkError>({ type: NetworkMessageType.ERROR, message: "Could not find your Game!" })); return; }
	// const game = new GameHandlerBuilder().defaultSystems().fromSettings(res).build()
	// game.applyRawTurn({ angle, actorId, power })
	// let durationFrames = 0
	// for (; game.getPhysics().isMoving(); ++durationFrames) game.tick(1)
	//
	// game.setState(GameState.YOUR_TURN)
	// const settings = game.toSettings()
	// settings.allTeams = res.allTeams
	// console.log("storing: ", settings.allTeams)
	// updateGame(settings)
	// try {
	// 	const sim = {
	// 		actorId,
	// 		durationFrames,
	// 		finalState: game.getEntityManager().serialize(),
	// 		input: { angle, power },
	// 	}
	// 	console.log(sim)
	// 	// settings.allTeams!.forEach(element => {
	// 	// const accesstoken = userAccesstoken.get(element)
	// 	// if (!accesstoken) {
	// 	// 	console.log("accesstoken not found")
	// 	// 	return null
	// 	// }
	// 	// const socket = accesstokenSockets.get(accesstoken)
	// 	// if (!socket) {
	// 	// 	console.log("socket not found")
	// 	// 	return null
	// 	// }
	// 	// socket.send(wrap<NetworkTurn>({ type: NetworkMessageType.TURN, sim }))
	// 	// });
	// } catch (e) {
	// 	console.log(e)
	// }
	// return null
}

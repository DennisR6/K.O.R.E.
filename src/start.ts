export class NetoworkStarter {
	// let gameid: UUID
	// let dirArrow = new DirectionArrow()
	// let playing = false
	// const protocol = `wss`;
	// const clientId = undefined;
	// const proxyDomain = 'discordsays.com';
	// const resourcePath = 'kore';
	// const url = new URL(`${protocol}://${clientId}.${proxyDomain}${resourcePath}`);
	// if (usersettings.url !== "local") server()
	// function server() {
	// 	console.log("Server URL", usersettings.url)
	// 	let socket = new WebSocket(usersettings.url === "" ? "wss://lupricht.net/kore/" : usersettings.url)
	// 	socket.onmessage = (event) => {
	// 		const output = unwrap<UnTypedNetworkMessage>(event.data)
	// 		console.log(getNetworkPacketType(output.type), output)
	// 		if (!output?.type) return
	// 		switch (output.type) {
	// 			case NetworkMessageType.NEWUSER: {
	// 				userid = setUserUUUID(output.userid)
	// 				socket.send(wrap<NetworkLogin>({ type: NetworkMessageType.LOGIN, userid }))
	// 				break
	// 			}
	// 			case NetworkMessageType.TURN: {
	// 				console.log("got Turn", output.sim)
	// 				handler.tickTurn(output.sim)
	// 				break
	// 			}
	// 			case NetworkMessageType.GAME: {
	// 				gameid = output.id
	// 				socket.send(wrap<NetworkGame>({ type: NetworkMessageType.GAME, id: output.id }))
	// 				break
	// 			}
	// 			case NetworkMessageType.ERROR: {
	// 				// console.log(output.message)
	// 				break
	// 			}
	// 			case NetworkMessageType.WAITINGROOM: {
	// 				console.log("We are waiting for a game")
	// 				break
	// 			}
	// 			case NetworkMessageType.LOGIN: {
	// 				setUserUUUID(output.userid)
	// 				socket.send(wrap<NetworkLogin>({ type: NetworkMessageType.LOGIN, userid: output.userid! }))
	// 				break
	// 			}
	// 			case NetworkMessageType.INIT: {
	// 				if (playing) return
	// 				playing = true
	// 				gameid = output.settings.id
	//
	// 				handler = new GameHandlerBuilder()
	// 					.defaultSystems()
	// 					.fromSettings(output.settings)
	// 					.build()
	// 				handler.addSystem(new EmitterSystem(new NetworkEmitter(socket, userid, gameid)))
	// 				startGame()
	// 				break
	// 			}
	// 			default:
	// 				console.log("TODO", getNetworkPacketType(output.type))
	// 		}
	// 	}
	//
	// 	socket.onopen = () => {
	// 		const msg: NetworkLogin = { type: NetworkMessageType.LOGIN, userid }
	// 		if (userid) msg.userid = userid
	// 		socket.send(wrap<NetworkLogin>(msg));
	// 	};
	// }
	// if (usersettings.url === "local") {
	// 	handler = new GameHandlerBuilder()
	// 		.defaultSystems()
	// 		.fromSettings(GameSettings)
	// 		.build()
	// 	const em = new CombiEmitter()
	// 	em.addEmitter(new LogEmitter(), new GameEmitter(handler))
	// 	handler.addSystem(new EmitterSystem(em))
	// 	startGame()
	// }


}

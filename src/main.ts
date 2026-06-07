import type p5Types from "p5";
import type { UUID } from "crypto";
import { P5Renderer } from "./engine/drawingEngine.js";
import type { RenderContext } from "./engine/RenderContext.js";
import { GameSettings } from "./settings/settings.js";
import { GameHandler, GameHandlerBuilder } from "./engine/Handler.js";
import { getUserUUUID, setUserUUUID } from "./utils/id.js"
import { CombiEmitter, LogEmitter } from "./emitter/InputEmitter.js";
import { NetworkEmitter } from "./emitter/NetworkEmitter.js";
import { getNetworkPacketType, NetworkMessageType, type NetworkGame, type NetworkLogin, type UnTypedNetworkMessage } from "./server/server.js";
import { unwrap, wrap } from "./utils/net.js"


const uri = new URL(window.location.href)
for (const [key, value] of uri.searchParams) {
	console.log(key, value)
}
let userid = getUserUUUID()
let handler: GameHandler
let gameid: UUID

const protocol = `wss`;
const clientId = undefined;
const proxyDomain = 'discordsays.com';
const resourcePath = 'kore';
const url = new URL(`${protocol}://${clientId}.${proxyDomain}${resourcePath}`);
let socket = new WebSocket(clientId ? url : "wss://lupricht.net/kore/")
socket.onmessage = (event) => {
	const output = unwrap<UnTypedNetworkMessage>(event.data)
	console.log(getNetworkPacketType(output.type), output)
	if (!output?.type) return
	switch (output.type) {
		case NetworkMessageType.NEWUSER: {
			userid = setUserUUUID(output.userid)
			socket.send(wrap<NetworkLogin>({ type: NetworkMessageType.LOGIN, userid }))
			break
		}
		case NetworkMessageType.TURN: {
			console.log("got Turn", output.sim)
			handler.tickTurn(output.sim)
			break
		}
		case NetworkMessageType.GAME: {
			console.log(output.id)
			gameid = output.id
			socket.send(wrap<NetworkGame>({ type: NetworkMessageType.GAME, id: output.id }))
			break
		}
		case NetworkMessageType.ERROR: {
			console.log(output.message)
			break
		}
		case NetworkMessageType.INIT: {
			gameid = output.settings.id
			console.log("gameid", gameid)
			handler = new GameHandlerBuilder()
				.defaultSystems()
				.fromSettings(output.settings)
				.build()

			const em = new CombiEmitter()
			em.addEmitter(
				new LogEmitter(),
				new NetworkEmitter(socket, userid ?? crypto.randomUUID(), gameid),
			)
			handler.setEmitter(em)
			startGame()
			break
		}
		default:
			console.log("TODO", getNetworkPacketType(output.type))
	}
}
socket.onopen = () => {
	const msg: NetworkLogin = { type: NetworkMessageType.LOGIN, userid: undefined }
	if (userid) msg.userid = userid
	console.log("SOCKET_OPEN", userid, msg)
	socket.send(wrap(msg));
};

function startGame() {
	const sketch = (p: p5Types) => {
		let ctx: RenderContext;
		const scale = (window.window.innerWidth * 0.9) / GameSettings.screenResolution.x
		p.setup = () => {
			p.createCanvas(scale * GameSettings.screenResolution.x, scale * GameSettings.screenResolution.y);
			ctx = new P5Renderer(p, scale, GameSettings.screenResolution.x)
			ctx.mouseWheel(handler.handleMouseWheel)
		};

		p.draw = () => {
			if (!ctx) return
			handler.tick()
			p.push()
			handler.drawWorld(ctx)
			p.pop()
		};

		// Input Events
		p.mousePressed = () => handler.handleMousePressed(ctx.toWorld(p.mouseX), ctx.toWorld(p.mouseY));
		p.mouseDragged = () => handler.updateMouse(ctx.toWorld(p.mouseX), ctx.toWorld(p.mouseY));
		p.mouseReleased = () => handler.handleMouseReleased();
		p.mouseWheel = handler.handleMouseWheel

		p.windowResized = () => ctx.resizeCanvas(window.window.innerWidth, window.window.innerHeight)

	};

	// new window.p5(sketch);
	//@ts-ignore
	new window.p5(sketch)
	window.game = { handler, logs: [] };

	window.addEventListener('keydown', (_e) => { });
}

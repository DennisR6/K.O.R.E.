import type p5Types from "p5";
import type { UUID } from "crypto";
import { P5Renderer } from "./engine/drawingEngine.js";
import type { RenderContext } from "./engine/RenderContext.js";
import { GameSettings } from "./settings/settings.js";
import { GameHandler, GameHandlerBuilder } from "./engine/Handler.js";
import { getUserUUUID, setUserUUUID } from "./utils/id.js"
import { unwrap, wrap } from "./utils/net.js"
import { DirectionArrow } from "./systems/DirectionArrow.js";
import { EmitterSystem } from "./systems/Emitter.js";
import type { Vector2D } from "./physics/physics.js";
import type { FullStructure } from "./structures/fullStructure.js";
import { NetworkEmitter } from "./emitter/NetworkEmitter.js";
import { getNetworkPacketType, NetworkMessageType, type NetworkGame, type NetworkLogin, type UnTypedNetworkMessage } from "./server/types.js";

let usersettings = {
	url: "",
	mapbuilder: false
}

const uri = new URL(window.location.href)
for (const [key, value] of uri.searchParams) {
	//@ts-ignore
	usersettings[key] = value
}
let userid = getUserUUUID()!
let handler: GameHandler
let gameid: UUID
let dirArrow = new DirectionArrow()
let playing = false
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
			gameid = output.id
			socket.send(wrap<NetworkGame>({ type: NetworkMessageType.GAME, id: output.id }))
			break
		}
		case NetworkMessageType.ERROR: {
			console.log(output.message)
			break
		}
		case NetworkMessageType.WAITINGROOM: {
			console.log("We are waiting for a game")
			break
		}
		case NetworkMessageType.LOGIN: {
			setUserUUUID(output.userid)
			socket.send(wrap<NetworkLogin>({ type: NetworkMessageType.LOGIN, userid: output.userid! }))
			break
		}
		case NetworkMessageType.INIT: {
			if (playing) return
			playing = true
			gameid = output.settings.id

			handler = new GameHandlerBuilder()
				.defaultSystems()
				.fromSettings(output.settings)
				.build()
			handler.addSystem(new EmitterSystem(new NetworkEmitter(socket, userid, gameid)))
			startGame()
			break
		}
		default:
			console.log("TODO", getNetworkPacketType(output.type))
	}
	socket.onopen = () => {
		const msg: NetworkLogin = { type: NetworkMessageType.LOGIN, userid }
		if (userid) msg.userid = userid
		console.log("SOCKET_OPEN", userid, msg)
		socket.send(wrap(msg));
	};
}
// if (usersettings.local) {
// 	handler = new GameHandlerBuilder()
// 		.defaultSystems()
// 		.fromSettings(GameSettings)
// 		.build()
// 	const em = new CombiEmitter()
// 	em.addEmitter(new LogEmitter(), new GameEmitter(handler))
// 	handler.addSystem(new EmitterSystem(em))
// 	startGame()
// }
let mouse: Vector2D = { x: 0, y: 0 }

function startGame() {
	handler.addSystem(dirArrow)
	handler.addPostDrawer(dirArrow)
	// handler.addSystem(new EmitterSystem())
	const sketch = (p: p5Types) => {
		let ctx: RenderContext;
		const scale = (window.window.innerWidth * 0.9) / GameSettings.screenResolution.x
		p.setup = () => {
			p.createCanvas(scale * GameSettings.screenResolution.x, scale * GameSettings.screenResolution.y);
			ctx = new P5Renderer(p, scale, GameSettings.screenResolution.x)
			ctx.resizeCanvas(window.window.innerWidth, window.window.innerHeight)
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
		p.mouseMoved = (e) => mouse = { x: e?.x ?? 0, y: e?.y ?? 0 }
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

const customCursor = document.getElementById('my-cursor')!;
window.addEventListener('mousemove', (e) => {
	customCursor.style.left = e.clientX + 'px';
	customCursor.style.top = e.clientY + 'px';
});

const padding = 50
let structurepicked: FullStructure | undefined

const scale = (window.window.innerWidth * 0.9) / GameSettings.screenResolution.x
console.log("scale", scale)
function pin(e: any, str: FullStructure) {
	if (!str) return
	//@ts-ignore
	const { x, y } = e
	str.setPos({ x: e.x, y: e.y })
}

window.addEventListener("keydown", e => {
	switch (e.code) {
		case "KeyX": {
			const { x: x1, y: y1 } = mouse
			const [x, y] = [x1 / scale, y1 / scale]
			const str = handler.getContext().structures.find(e => {
				const dist = Math.hypot(
					//@ts-ignore
					(e.getPos().x - x),
					//@ts-ignore
					(e.getPos().y - y),
				);
				return dist < padding;
			})
			console.log(mouse.x / scale, mouse.y / scale)
			if (!str) return
			//@ts-ignore
			structurepicked = str
			window.addEventListener("mousemove", e => {
				if (structurepicked) pin({ x: e.x / scale, y: e.y / scale }, structurepicked)
			})
			break
		}
		case "KeyZ": {
			window.removeEventListener("mousemove", e => { if (structurepicked) pin(e, structurepicked) })
			structurepicked = undefined
			console.log("paste", structurepicked)
			break
		}
		default:
			console.log(e.code)
	}
})

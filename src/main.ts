import type p5Types from "p5";
import { P5Renderer } from "./engine/drawingEngine.js";
import type { RenderContext } from "./engine/RenderContext.js";
import { GameSettings } from "./settings/settings.js";
import { GameHandler, GameHandlerBuilder } from "./engine/Handler.js";
import { MainMenu } from "./menu/Menu.js";
import { AudioManager } from "./menu/AudioManager.js";
import { DirectionArrow } from "./systems/DirectionArrow.js";
import { EmitterSystem } from "./systems/Emitter.js";
import { UiSystem } from "./systems/UiSystem.js";
import { CombiEmitter } from "./emitter/InputEmitter.js";
import { GameEmitter } from "./emitter/EngineEmitter.js";
import { NetworkEmitter, installTurnReceiver } from "./emitter/NetworkEmitter.js";
import { getUserUUUID, setUserUUUID } from "./utils/id.js";
import { wrap } from "./utils/net.js";
import { NetworkMessageType, type NetworkInit, type NetworkLogin, type NetworkNewUser, type UnTypedNetworkMessage } from "./server/types.js";

const uri = new URL(window.location.href)
const usersettings = {
	url: uri.searchParams.get("url") ?? "",
	mapbuilder: uri.searchParams.has("mapbuilder"),
	skipmenu: ["1", "true"].includes(uri.searchParams.get("skipmenu") ?? ""),
}

const ui = new UiSystem()
// setUserUUUID(undefined)
// let userid = getUserUUUID()!
let handler: GameHandler
const builder = new GameHandlerBuilder()
	.defaultSystems()
if (!usersettings.skipmenu) {
	handler = builder.build()
	const menu = new MainMenu()
	handler.setMouseHandler(menu)
	handler.addPreTickAndDraw(menu)
	startGame(handler)
	} else if (usersettings.url && usersettings.url !== "local") {
	startNetworkGame(usersettings.url)
} else {
	const arrow = new DirectionArrow(ui)
	const em = new CombiEmitter()
	const ems = new EmitterSystem(em);
	builder
		.fromSettings(GameSettings)
		.setPlayerTeam([0, 1])
		.addSystem(ui)
		.addUIMouse(ui)
		.addSystem(arrow)
		.addSystem(ems)
	handler = builder.build()
	em.addEmitter(new GameEmitter(handler))
	handler.addPostDrawer(arrow)
	startGame(handler)
}

// const landingengine = new GameHandlerBuilder().defaultSystems().setWorldSize(200, 200).addBackground(new BackgroundImageSystem(AssetList.arena2PNG)).build()
// landingengine.draw = landingengine.drawWorld
// handler.addPreDrawer(landingengine)
function startNetworkGame(serverUrl: string) {
	const socket = new WebSocket(serverUrl)
	let started = false
	socket.addEventListener("open", () => {
		socket.send(wrap<NetworkLogin>({ type: NetworkMessageType.LOGIN, userid: getUserUUUID() ?? undefined }))
	})
	socket.addEventListener("message", event => {
		let message: UnTypedNetworkMessage
		try {
			message = JSON.parse(String(event.data)) as UnTypedNetworkMessage
		} catch {
			console.warn("Ignoring malformed server packet")
			return
		}
		if (message.type === NetworkMessageType.NEWUSER) {
			setUserUUUID((message as NetworkNewUser).userid)
			return
		}
		if (message.type !== NetworkMessageType.INIT || started) return
		started = true
		const init = message as NetworkInit
		const settings = init.settings
		const ui = new UiSystem()
		const arrow = new DirectionArrow(ui)
		handler = new GameHandlerBuilder()
			.defaultSystems()
			.fromSettings(settings)
			.addSystem(ui)
			.addUIMouse(ui)
			.addSystem(arrow)
			.addSystem(new EmitterSystem(new NetworkEmitter(socket)))
			.build()
		handler.setRuleState(init.ruleState)
		handler.addPostDrawer(arrow)
		installTurnReceiver(socket, handler)
		startGame(handler)
	})
}

function startGame(h: GameHandler) {
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
			h.tick()
			p.push()
			h.drawWorld(ctx)
			p.pop()
		};

		window.addEventListener("mousemove", (e) => {
			//@ts-ignore
			if (typeof defaultCanvas0 === "undefined") return
			//@ts-ignore
			const { left, top, right, bottom } = (defaultCanvas0 as HTMLCanvasElement).getBoundingClientRect()
			if (e.clientX < left) return
			if (e.clientX > right) return
			if (e.clientY < top) return
			if (e.clientY > bottom) return
			h.updateMouse(ctx.toWorld(e.clientX - left), ctx.toWorld(e.clientY - top))
		})
		window.addEventListener("mousedown", (_e) => h.handleMousePressed())
		window.addEventListener("mouseup", (_e) => h.handleMouseReleased())

		// Input Events
		p.mouseWheel = h.handleMouseWheel
		p.windowResized = () => ctx.resizeCanvas(window.window.innerWidth, window.window.innerHeight)
	};

	//@ts-ignore
	new window.p5(sketch)
	window.game = { handler, logs: [], audio: new AudioManager() };
}

const customCursor = document.getElementById('my-cursor')!;
window.addEventListener('mousemove', (e) => {
	customCursor.style.left = e.clientX + 'px';
	customCursor.style.top = e.clientY + 'px';
});

document.addEventListener('keydown', (e) => {
	switch (e.key) {
		case "n": window.game.audio.nextTrack(); break
		case "p": window.game.audio.previousTrack(); break
		case "ArrowUp": window.game.audio.addVolume(0.05); break
		case "ArrowDown": window.game.audio.addVolume(-0.05); break
	}
});

document.addEventListener('click', () => { window.game.audio.start() }, { once: true });

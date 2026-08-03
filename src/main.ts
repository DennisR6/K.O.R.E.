import type p5Types from "p5";
import { P5Renderer } from "./engine/drawingEngine.js";
import type { RenderContext } from "./engine/RenderContext.js";
import { GameSettings } from "./settings/settings.js";
import { GameHandler, GameHandlerBuilder } from "./engine/Handler.js";
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
import { adaptCanvasSizeForViewport } from "./ui/layout.js";
import { ReplayViewer } from "./menu/replayViewer.js";
import { LocalMatchSceneRouter } from "./scenes/LocalMatchSceneRouter.js";

const uri = new URL(window.location.href)
const usersettings = {
	url: uri.searchParams.get("url") ?? "",
	mapbuilder: uri.searchParams.has("mapbuilder"),
	skipmenu: ["1", "true"].includes(uri.searchParams.get("skipmenu") ?? ""),
	replay: uri.searchParams.has("replay"),
	mapPreference: uri.searchParams.get("map") ?? undefined,
}

const ui = new UiSystem()
// setUserUUUID(undefined)
// let userid = getUserUUUID()!
let handler: GameHandler
let router: LocalMatchSceneRouter | undefined
const builder = new GameHandlerBuilder()
	.defaultSystems()
if (!usersettings.skipmenu) {
	router = new LocalMatchSceneRouter()
	handler = router.getHandler()
	startGame(handler, () => router?.getHandler() ?? handler)
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
	const loading = showNetworkLoading("Connecting to the match server…")
	const socket = new WebSocket(serverUrl)
	let started = false
	let failed = false
	const fail = (message: string) => {
		if (started || failed) return
		failed = true
		loading.fail(message, () => {
			socket.close()
			window.location.reload()
		}, () => {
			socket.close()
			const url = new URL(window.location.href)
			url.searchParams.delete("skipmenu")
			url.searchParams.delete("url")
			window.location.assign(url.toString())
		})
	}
	socket.addEventListener("open", () => {
		loading.setMessage("Finding an opponent…")
		socket.send(wrap<NetworkLogin>({ type: NetworkMessageType.LOGIN, userid: getUserUUUID() ?? undefined, mapPreference: usersettings.mapPreference }))
	})
	socket.addEventListener("error", () => fail("Could not connect to the match server."))
	socket.addEventListener("close", () => fail("The match connection closed before setup completed."))
	const timeout = window.setTimeout(() => fail("Matchmaking timed out. Please retry."), 20_000)
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
		if (message.type === NetworkMessageType.WAITINGROOM) {
			loading.setMessage("Waiting for an opponent…")
			return
		}
		if (message.type === NetworkMessageType.ERROR) {
			fail("The server could not start your match.")
			return
		}
		if (message.type !== NetworkMessageType.INIT || started) return
		started = true
		window.clearTimeout(timeout)
		loading.dispose()
		const init = message as NetworkInit
		if (init.mapId) loading.setMessage(`Starting ${init.mapId}…`)
		const settings = init.settings
const ui = new UiSystem()
if (usersettings.replay) {
	const viewer = new ReplayViewer();
	(window as any).replayViewer = viewer;
}

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

function showNetworkLoading(initialMessage: string) {
	const root = document.createElement("section")
	root.id = "network-loading"
	root.setAttribute("role", "status")
	root.setAttribute("aria-live", "polite")
	const heading = document.createElement("h1")
	heading.textContent = "Joining online game"
	const message = document.createElement("p")
	message.textContent = initialMessage
	root.append(heading, message)
	document.body.append(root)
	return {
		setMessage(value: string) { message.textContent = value },
		fail(value: string, retry: () => void, back: () => void) {
			root.setAttribute("role", "alert")
			message.textContent = value
			const retryButton = document.createElement("button")
			retryButton.type = "button"
			retryButton.textContent = "Retry"
			retryButton.addEventListener("click", retry, { once: true })
			const backButton = document.createElement("button")
			backButton.type = "button"
			backButton.textContent = "Back to menu"
			backButton.addEventListener("click", back, { once: true })
			root.append(retryButton, backButton)
		},
		dispose() { root.remove() },
	}
}

function startGame(h: GameHandler, getActiveHandler: () => GameHandler = () => h) {
	const sketch = (p: p5Types) => {
		let ctx: RenderContext;
		const adapted = adaptCanvasSizeForViewport(window.window.innerWidth, window.window.innerHeight, GameSettings.screenResolution.x, GameSettings.screenResolution.y);
		const scale = adapted.scale;
		p.setup = () => {
			p.createCanvas(adapted.width, adapted.height);
			ctx = new P5Renderer(p, scale, GameSettings.screenResolution.x)
			ctx.resizeCanvas(window.window.innerWidth, window.window.innerHeight)
			const canvasEl = (p as any).canvas as unknown as HTMLCanvasElement;
			if (canvasEl) {
				canvasEl.addEventListener("wheel", (e) => {
				const active = getActiveHandler();
				if (active.handleMouseWheel) {
					active.handleMouseWheel(e);
					}
				});
			}
		};

		p.draw = () => {
			if (!ctx) return
			const active = getActiveHandler()
			active.tick()
			p.push()
			active.drawWorld(ctx)
			p.pop()
		};

		window.addEventListener("mousemove", (e) => {
			const canvasEl = (p as any).canvas as unknown as HTMLCanvasElement;
			if (!canvasEl) return
			const { left, top, right, bottom } = canvasEl.getBoundingClientRect()
			if (e.clientX < left || e.clientX > right || e.clientY < top || e.clientY > bottom) return
			getActiveHandler().updateMouse(ctx.toWorld(e.clientX - left), ctx.toWorld(e.clientY - top))
		})
		window.addEventListener("mousedown", (e) => {
			const canvasEl = (p as any).canvas as unknown as HTMLCanvasElement;
			if (!canvasEl) return
			const { left, top, right, bottom } = canvasEl.getBoundingClientRect()
			if (e.clientX < left || e.clientX > right || e.clientY < top || e.clientY > bottom) return
			getActiveHandler().handleMousePressed()
		})
		window.addEventListener("mouseup", (e) => {
			const canvasEl = (p as any).canvas as unknown as HTMLCanvasElement;
			if (!canvasEl) return
			const { left, top, right, bottom } = canvasEl.getBoundingClientRect()
			if (e.clientX < left || e.clientX > right || e.clientY < top || e.clientY > bottom) return
			getActiveHandler().handleMouseReleased()
		})

		p.windowResized = () => ctx.resizeCanvas(window.window.innerWidth, window.window.innerHeight)
	};

	//@ts-ignore
	new window.p5(sketch)
	window.game = {
		// The documented debug surface must always expose the active
		// authoritative handler (menu -> match -> rematch -> menu switches).
		get handler() { return getActiveHandler(); },
		// The catalog map ID of the active local match, or null in the menu.
		get mapId() { return router?.getMapId() ?? null; },
		logs: [],
		audio: new AudioManager()
	};
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

if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
	window.addEventListener("load", () => {
		navigator.serviceWorker.register("./sw.js").catch(() => {});
	});
}

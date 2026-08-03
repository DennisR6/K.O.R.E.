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
import { MatchResultOverlay } from "./ui/MatchResultOverlay.js";
import { buildReplayShareEndpoint, buildReplayViewerUrl } from "./utils/replayUrls.js";

const uri = new URL(window.location.href)
const REPLAY_TOKEN = /^[a-f0-9]{32}$/;
const usersettings = {
	url: uri.searchParams.get("url") ?? "",
	mapbuilder: uri.searchParams.has("mapbuilder"),
	skipmenu: ["1", "true"].includes(uri.searchParams.get("skipmenu") ?? ""),
	replayToken: uri.searchParams.get("replay") ?? "",
	mapPreference: uri.searchParams.get("map") ?? undefined,
}

const ui = new UiSystem()
// setUserUUUID(undefined)
// let userid = getUserUUUID()!
let handler: GameHandler
let router: LocalMatchSceneRouter | undefined
const builder = new GameHandlerBuilder()
	.defaultSystems()
if (usersettings.replayToken) {
	handler = new GameHandler()
	const viewer = startReplayViewer(usersettings.replayToken)
	startGame(handler, () => handler, () => viewer.advance())
} else if (!usersettings.skipmenu) {
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

		const arrow = new DirectionArrow(ui)
		const emitter = new NetworkEmitter(socket)
		handler = new GameHandlerBuilder()
			.defaultSystems()
			.fromSettings(settings)
			.addSystem(ui)
			.addUIMouse(ui)
			.addSystem(arrow)
			.addSystem(new EmitterSystem(emitter))
			.build()
		handler.setRuleState(init.ruleState)
		handler.addPostDrawer(arrow)
		const overlay = new MatchResultOverlay(handler, action => {
			if (action === "share" || action === "replay") emitter.requestReplayShare()
			else if (action === "rematch") socket.send(wrap({ type: NetworkMessageType.REMATCH }))
			else window.location.assign(window.location.pathname)
		}, ui)
		handler.setMouseHandler(overlay)
		handler.addPostDrawer(overlay)
		installTurnReceiver(socket, handler)
		installPauseMenu(socket)
		installReplayShareControls(socket)
		startGame(handler)
	})
}

/** A no-socket, read-only replay entry surface. Clipboard reads require a click. */
function startReplayViewer(initialToken: string): ReplayViewer {
	const viewer = new ReplayViewer();
	(window as unknown as { replayViewer: ReplayViewer }).replayViewer = viewer;
	const panel = document.createElement("section");
	panel.id = "replay-viewer-controls";
	const heading = document.createElement("h1"); heading.textContent = "Replay viewer";
	const input = document.createElement("input"); input.setAttribute("aria-label", "Replay share ID"); input.value = initialToken;
	const load = document.createElement("button"); load.type = "button"; load.textContent = "Load replay";
	const paste = document.createElement("button"); paste.type = "button"; paste.textContent = "Paste from clipboard";
	const status = document.createElement("p"); status.setAttribute("role", "status");
	const loadToken = async () => {
		const token = input.value.trim();
		if (!REPLAY_TOKEN.test(token)) { status.textContent = "Enter a valid replay share ID."; return; }
		status.textContent = "Loading replay…";
		try {
			const response = await fetch(buildReplayShareEndpoint(window.location.href, token), { cache: "no-store" });
			if (!response.ok) throw new Error("Replay unavailable");
			const body = await response.json() as { replay?: unknown };
			if (!viewer.loadReplay(body.replay)) throw new Error(viewer.getErrorState() ?? "Replay unavailable");
			handler = viewer.getPlayer()!.getHandler();
			status.textContent = "Replay loaded. Playback is read-only.";
		} catch { status.textContent = "Replay unavailable. Check the share ID and try again."; }
	};
	load.addEventListener("click", () => { void loadToken(); });
	paste.addEventListener("click", async () => {
		try { input.value = await navigator.clipboard.readText(); status.textContent = "Pasted replay ID. Press Load replay."; }
		catch { status.textContent = "Clipboard access was denied. Paste the replay ID into the field manually."; input.focus(); }
	});
	panel.append(heading, input, load, paste, status);
	document.body.append(panel);
	if (initialToken) void loadToken();
	return viewer;
}

/** Share URLs are displayed first; clipboard access is an explicit second click. */
function installReplayShareControls(socket: WebSocket): void {
	const panel = document.createElement("aside")
	panel.id = "replay-share-controls"
	panel.hidden = true
	const status = document.createElement("p")
	const url = document.createElement("input")
	url.readOnly = true
	url.setAttribute("aria-label", "Replay share URL")
	const copy = document.createElement("button")
	copy.type = "button"
	copy.textContent = "Copy replay URL"
	copy.addEventListener("click", async () => {
		try { await navigator.clipboard.writeText(url.value); status.textContent = "Replay URL copied" }
		catch { status.textContent = "Copy unavailable. Select and copy the URL manually."; url.focus(); url.select() }
	})
	panel.append(status, url, copy)
	document.body.append(panel)
	socket.addEventListener("message", event => {
		try {
			const message = JSON.parse(String(event.data)) as UnTypedNetworkMessage
			if (message.type !== NetworkMessageType.REPLAY_SHARE_CREATED) return
			const token = (message as { token: string }).token
			url.value = buildReplayViewerUrl(window.location.href, token)
			status.textContent = "Replay link ready. Copy it or select it manually."
			panel.hidden = false
		} catch { /* ignore malformed protocol input */ }
	})
}

function installPauseMenu(socket: WebSocket): void {
	const menu = document.createElement("aside")
	menu.id = "network-pause-menu"
	const pause = document.createElement("button")
	pause.type = "button"
	pause.textContent = "Request pause"
	const report = document.createElement("button")
	report.type = "button"
	report.textContent = "Report match"
	const leave = document.createElement("button")
	leave.type = "button"
	leave.textContent = "Leave game"
	const status = document.createElement("p")
	status.textContent = ""
	let leaving = false
	const returnToMenu = () => {
		socket.close()
		const url = new URL(window.location.href)
		url.searchParams.delete("skipmenu")
		url.searchParams.delete("url")
		url.searchParams.delete("map")
		window.location.assign(url.toString())
	}
	pause.addEventListener("click", () => socket.send(wrap({ type: NetworkMessageType.PAUSE_REQUEST, action: pause.dataset.paused === "true" ? "resume" : "pause" })))
	report.addEventListener("click", () => {
		const text = window.prompt("Describe the issue (max 500 characters)")
		if (!text) return
		socket.send(wrap({ type: NetworkMessageType.REPORT_MATCH, category: "other", text }))
	})
	leave.addEventListener("click", () => {
		if (leaving) return
		if (socket.readyState !== WebSocket.OPEN) returnToMenu()
		else {
			leaving = true
			leave.disabled = true
			status.textContent = "Leaving game…"
			socket.send(wrap({ type: NetworkMessageType.LEAVE_GAME }))
		}
	})
	socket.addEventListener("message", event => {
		try {
			const message = JSON.parse(String(event.data)) as UnTypedNetworkMessage
			if (message.type === NetworkMessageType.PAUSE_STATE) {
				const state = message as any
				pause.dataset.paused = String(state.paused)
				pause.textContent = state.paused ? "Request resume" : "Request pause"
				status.textContent = state.waitingForOtherPlayer ? "Waiting for the other player…" : state.paused ? "Match paused" : "Match resumed"
			}
			if (message.type === NetworkMessageType.REPORT_SUBMITTED) status.textContent = "Report submitted"
			if (message.type === NetworkMessageType.GAME_ENDED) returnToMenu()
		} catch { /* protocol receiver handles malformed packets separately */ }
	})
	socket.addEventListener("close", () => { if (leaving) returnToMenu() })
	menu.append(pause, report, leave, status)
	document.body.append(menu)
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

function startGame(h: GameHandler, getActiveHandler: () => GameHandler = () => h, afterTick?: () => void) {
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
			afterTick?.()
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

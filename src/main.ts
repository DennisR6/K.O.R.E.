import type p5Types from "p5";
import { P5Renderer } from "./engine/drawingEngine.js";
import type { RenderContext } from "./engine/RenderContext.js";
import { GameSettings } from "./settings/settings.js";
import { GameHandler } from "./engine/Handler.js";
import { AudioManager } from "./menu/AudioManager.js";
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
import { installGameplayHud } from "./scenes/gameplayHud.js";
import { buildReplayShareEndpoint, buildReplayViewerUrl } from "./utils/replayUrls.js";
import { buildOnlineJoinUrl } from "./utils/onlineConfig.js";
import { isUiDebugSandboxUrl, startUiDebugSandbox } from "./debug/uiSandbox.js";
import { ApplicationAudioMixer, AudioRuntime } from "./engine/audio-sdk/index.js";
import { BrowserAudioOutput } from "./audio/BrowserAudioOutput.js";
import { KORE_AUDIO_BUSES, createKoreAudioSettings } from "./kore/audio.js";
import { createReplayViewerControls } from "./menu/replayViewerControls.js";
import { kore } from "./kore/sdk/index.js";

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
// One browser media owner receives batches from any active game/menu runtime.
// The runtime and mixer are explicit host lifecycle objects, never engine loops.
const browserAudioManager = new AudioManager()
const browserAudioOutput = new BrowserAudioOutput(browserAudioManager)
const browserAudioRuntime = new AudioRuntime(createKoreAudioSettings("kore.browser"))
const browserAudioMixer = new ApplicationAudioMixer("kore.browser.output", { buses: KORE_AUDIO_BUSES })
// setUserUUUID(undefined)
// let userid = getUserUUUID()!
let handler: GameHandler
let router: LocalMatchSceneRouter | undefined
if (isUiDebugSandboxUrl(uri)) {
	startUiDebugSandbox()
} else if (usersettings.replayToken) {
	// The read-only replay page has no server socket or in-game error channel;
	// every step of the load sequence is logged so failures are visible in the
	// browser console (`[replay]` prefix) instead of only in the status line.
	console.log(`[replay] replay mode with token ${usersettings.replayToken}`)
	handler = new GameHandler()
	const viewer = startReplayViewer(usersettings.replayToken)
	startGame(handler, () => handler, () => viewer.advance())
} else if (!usersettings.skipmenu) {
	router = new LocalMatchSceneRouter(undefined, undefined, mapId => {
		void buildOnlineJoinUrl(window.location.href, { ...(mapId ? { mapPreference: mapId } : {}) }).then(url => { window.location.assign(url) }).catch(error => console.warn("Online join failed", error))
	})
	handler = router.getHandler()
	startGame(handler, () => router?.getHandler() ?? handler)
	} else if (usersettings.url && usersettings.url !== "local") {
	startNetworkGame(usersettings.url)
} else {
	const em = new CombiEmitter()
	const ems = new EmitterSystem(em);
	handler = kore.createHandler(GameSettings)
	handler.setMyTeam([0, 1])
	handler.addSystem(ui)
	handler.setMouseHandler(ui)
	handler.addSystem(ems)
	em.addEmitter(new GameEmitter(handler))
	installGameplayHud(handler, { onReturnToMenu: () => window.location.assign(window.location.pathname) })
	startGame(handler)
}

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

		const emitter = new NetworkEmitter(socket)
		let replayShareAction: "view" | "share" | undefined
		handler = kore.restoreHandler(settings)
		handler.addSystem(ui)
		handler.setMouseHandler(ui)
		handler.addSystem(new EmitterSystem(emitter))
		handler.setRuleState(init.ruleState)
		// The online branch installs the same gameplay HUD as every offline mode;
		// only the semantic actions and capability limits differ.
		installGameplayHud(handler, {
			canSkipItemPhase: false,
			canPause: false,
			onUseItem: (actorId, itemId, target) => { emitter.sendItemUse(actorId, itemId, target); return false; },
			onRematch: () => { socket.send(wrap({ type: NetworkMessageType.REMATCH })); return false; },
			onReplay: () => { replayShareAction = "view"; emitter.requestReplayShare(); return false; },
			onShare: () => { replayShareAction = "share"; emitter.requestReplayShare(); return false; },
			onReturnToMenu: () => { window.location.assign(window.location.pathname); return false; },
		});
		installTurnReceiver(socket, handler)
		installReplayShareControls(socket, url => {
			if (replayShareAction !== "view") return false
			replayShareAction = undefined
			window.location.assign(url)
			return true
		})
		startGame(handler)
	})
}

/** A no-socket, read-only replay entry surface. Clipboard reads require a click. */
function startReplayViewer(initialToken: string): ReplayViewer {
	const viewer = new ReplayViewer();
	(window as unknown as { replayViewer: ReplayViewer }).replayViewer = viewer;
	const loadToken = async (rawToken: string) => {
		const token = rawToken.trim();
		if (!REPLAY_TOKEN.test(token)) { controls.setStatus("Enter a valid replay share ID."); console.error(`[replay] invalid replay share ID: ${JSON.stringify(token)}`); return; }
		controls.setStatus("Loading replay…");
		const endpoint = buildReplayShareEndpoint(window.location.href, token);
		console.log(`[replay] requesting replay from ${endpoint}`);
		try {
			const response = await fetch(endpoint, { cache: "no-store" });
			console.log(`[replay] ${endpoint} responded HTTP ${response.status}`);
			if (!response.ok) throw new Error(`Replay unavailable (HTTP ${response.status})`);
			const body = await response.json() as { replay?: unknown };
			console.log(`[replay] response payload keys: ${Object.keys(body).join(", ") || "(empty)"}${body.replay === undefined ? " — replay field MISSING" : ""}`);
			if (!viewer.loadReplay(body.replay)) throw new Error(viewer.getErrorState() ?? "Replay unavailable");
			handler = viewer.getPlayer()!.getHandler();
			const loadedPlayer = viewer.getPlayer()!;
			const world = handler.getSettings()?.worldSize;
			console.log(`[replay] loaded: state=${handler.getState()} entities=${handler.getEntityManager().getEntities().length} actions=${loadedPlayer.getActionCount()} world=${JSON.stringify(world)} rendererWorldWidth=${GameSettings.screenResolution.x}`);
			controls.setStatus(loadedPlayer.getActionCount() > 0
				? "Replay loaded. Playback is read-only."
				: "Replay loaded. No actions have been recorded yet.");
		} catch (error) {
			console.error("[replay] replay load failed:", error);
			controls.setStatus("Replay unavailable. Check the share ID and try again.");
		}
	};
	const controls = createReplayViewerControls(initialToken, {
		onLoad: loadToken,
		onPaste: async () => {
			try { const value = await navigator.clipboard.readText(); controls.setStatus("Pasted replay ID. Press Load replay."); return value; }
			catch { controls.setStatus("Clipboard access was denied. Paste the replay ID into the field manually."); return undefined; }
		},
	});
	document.body.append(controls.element);
	if (initialToken) void loadToken(initialToken);
	return viewer;
}

/** Share URLs are displayed first; clipboard access is an explicit second click. */
function installReplayShareControls(socket: WebSocket, onReplayLink?: (url: string) => boolean): void {
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
			if (onReplayLink?.(url.value)) return
			status.textContent = "Replay link ready. Copy it or select it manually."
			panel.hidden = false
		} catch { /* ignore malformed protocol input */ }
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

/** Throttled per-frame error surfacing for the read-only replay page. */
const recentReplayFrameErrors = new Map<string, number>();
function logReplayFrameError(error: unknown): void {
	const message = error instanceof Error ? error.message : String(error);
	const now = Date.now();
	const last = recentReplayFrameErrors.get(message);
	if (last !== undefined && now - last < 5_000) return;
	recentReplayFrameErrors.set(message, now);
	if (recentReplayFrameErrors.size > 100) recentReplayFrameErrors.clear();
	console.error(`[replay] frame error: ${message}`, error);
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
			try {
				const active = getActiveHandler()
				active.tick()
				afterTick?.()
				flushBrowserAudio(active)
				p.push()
				active.drawWorld(ctx)
				p.pop()
			} catch (error) {
				if (usersettings.replayToken) logReplayFrameError(error)
				else throw error
			}
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
			const active = getActiveHandler()
			active.updateMouse(ctx.toWorld(e.clientX - left), ctx.toWorld(e.clientY - top))
			active.handleMousePressed()
		})
		window.addEventListener("mouseup", (e) => {
			const canvasEl = (p as any).canvas as unknown as HTMLCanvasElement;
			if (!canvasEl) return
			const { left, top, right, bottom } = canvasEl.getBoundingClientRect()
			if (e.clientX < left || e.clientX > right || e.clientY < top || e.clientY > bottom) return
			const active = getActiveHandler()
			active.updateMouse(ctx.toWorld(e.clientX - left), ctx.toWorld(e.clientY - top))
			active.handleMouseReleased()
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
		audio: browserAudioManager
	};
}

/** Collects semantic cues structurally; unsupported systems/handlers are ignored. */
function flushBrowserAudio(active: GameHandler): void {
	const systemEmitters = active.getSystems().map(system => (system as { emitter?: unknown }).emitter)
	browserAudioRuntime.tick([active.getMouseHandler(), router, ...systemEmitters])
	browserAudioMixer.submit(browserAudioRuntime.drainOutput())
	browserAudioOutput.apply(browserAudioMixer.flush())
}

const customCursor = document.getElementById('my-cursor')!;
window.addEventListener('mousemove', (e) => {
	customCursor.style.left = e.clientX + 'px';
	customCursor.style.top = e.clientY + 'px';
});

document.addEventListener('keydown', (e) => {
	const audio = (window as unknown as { game?: { audio?: AudioManager } }).game?.audio
	if (!audio) return
	switch (e.key) {
		case "n": audio.nextTrack(); break
		case "p": audio.previousTrack(); break
		case "ArrowUp": audio.addVolume(0.05); break
		case "ArrowDown": audio.addVolume(-0.05); break
	}
});

document.addEventListener('click', () => { void browserAudioManager.unlock() }, { once: true });

if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
	window.addEventListener("load", () => {
		navigator.serviceWorker.register("./sw.js").catch(() => {});
	});
}

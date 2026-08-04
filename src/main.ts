import type p5Types from "p5";
import { P5Renderer } from "./engine/drawingEngine.js";
import type { RenderContext } from "./engine/RenderContext.js";
import { GameSettings } from "./settings/settings.js";
import { GameHandler, GameHandlerBuilder } from "./engine/Handler.js";
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
import { ItemPhaseUI } from "./ui/ItemPhaseUI.js";
import { buildReplayShareEndpoint, buildReplayViewerUrl } from "./utils/replayUrls.js";
import { buildOnlineJoinUrl } from "./utils/onlineConfig.js";
import { isUiDebugSandboxUrl, startUiDebugSandbox } from "./debug/uiSandbox.js";
import { ApplicationAudioMixer, AudioRuntime } from "./engine/audio-sdk/index.js";
import { BrowserAudioOutput } from "./audio/BrowserAudioOutput.js";
import { KORE_AUDIO_BUSES, createKoreAudioSettings } from "./kore/audio.js";
import { createKoreGameHudSurface } from "./kore/ui/KoreGameHudSurface.js";
import { KoreHudCommand } from "./kore/ui/hudCommands.js";
import { createKoreHudProjection } from "./kore/ui/gameHudProjection.js";

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
const builder = new GameHandlerBuilder()
	.defaultSystems()
if (isUiDebugSandboxUrl(uri)) {
	startUiDebugSandbox()
} else if (usersettings.replayToken) {
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
	builder
		.fromSettings(GameSettings)
		.setPlayerTeam([0, 1])
		.addSystem(ui)
		.addUIMouse(ui)
		.addSystem(ems)
	handler = builder.build()
	em.addEmitter(new GameEmitter(handler))
	installStandaloneHud(handler, ui, em, ems)
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

		const emitter = new NetworkEmitter(socket)
		let replayShareAction: "view" | "share" | undefined
		handler = new GameHandlerBuilder()
			.defaultSystems()
			.fromSettings(settings)
			.addSystem(ui)
			.addUIMouse(ui)
			.addSystem(new EmitterSystem(emitter))
			.build()
		handler.setRuleState(init.ruleState)
		const hud = createKoreGameHudSurface({ handle: command => {
			switch (command.type) {
				case KoreHudCommand.UseItem: { const actor = handler.getEntityManager().getEntities().find(entity => !entity.isDead() && entity.getTeam().includes(handler.getActiveTeam())); if (!actor) throw new Error("No active item actor"); emitter.sendItemUse(actor.getId(), command.payload.itemId, command.payload.target); return false; }
				case KoreHudCommand.Rematch: socket.send(wrap({ type: NetworkMessageType.REMATCH })); return false;
				case KoreHudCommand.Replay: replayShareAction = "view"; emitter.requestReplayShare(); return false;
				case KoreHudCommand.Share: replayShareAction = "share"; emitter.requestReplayShare(); return false;
				case KoreHudCommand.ReturnToMenu: window.location.assign(window.location.pathname); return false;
				case KoreHudCommand.SkipItemPhase: throw new Error("Network item skipping is unavailable");
				case KoreHudCommand.Pause: case KoreHudCommand.Resume: return false;
			}
		} }, ui, undefined, { canSkipItemPhase: false, canPause: false });
		handler.setMouseHandler(hud);
		const syncHud = () => createKoreHudProjection(handler, ui);
		handler.addPostTicker({ tick: (_ctx, dt) => { hud.applyProjection(syncHud()); hud.tick(dt); } });
		handler.addPostDrawer({ draw: renderer => { hud.applyProjection(syncHud()); hud.draw(renderer); } });
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
			status.textContent = viewer.getPlayer()!.getActionCount() > 0
				? "Replay loaded. Playback is read-only."
				: "Replay loaded. No actions have been recorded yet.";
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
			flushBrowserAudio(active)
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

/** KORE HUD/gameplay bridge for direct local diagnostics; browser listeners stay above this boundary. */
function installStandaloneHud(active: GameHandler, input: UiSystem, emitter: CombiEmitter, emitterSystem: EmitterSystem): void {
	const itemUi = new ItemPhaseUI(active, emitter);
	let rejection: string | undefined;
	emitterSystem.setErrorHandler(error => { rejection = hudRejection(error); });
	const hud = createKoreGameHudSurface({ handle: command => {
		switch (command.type) {
			case KoreHudCommand.UseItem: {
				const actor = active.getEntityManager().getEntities().find(entity => !entity.isDead() && entity.getTeam().includes(active.getActiveTeam()));
				if (!actor) throw new Error("No active item actor"); itemUi.use(actor.getId(), command.payload.itemId, command.payload.target); return;
			}
		case KoreHudCommand.SkipItemPhase: itemUi.skip(); return;
		case KoreHudCommand.Rematch: active.rematch(); return;
		case KoreHudCommand.ReturnToMenu: window.location.assign(window.location.pathname); return;
			case KoreHudCommand.Pause: active.setPaused(true); return;
			case KoreHudCommand.Resume: active.setPaused(false); return;
			case KoreHudCommand.Replay: case KoreHudCommand.Share: return;
		}
	} }, input);
	active.setMouseHandler(hud);
	const sync = () => createKoreHudProjection(active, input, rejection);
	active.addPostTicker({ tick: (_ctx, dt) => { hud.applyProjection(sync()); hud.tick(dt); } });
	active.addPostDrawer({ draw: renderer => { hud.applyProjection(sync()); hud.draw(renderer); } });
}

function hudRejection(error: unknown): string {
	return (error instanceof Error ? error.message : "Action rejected").replace(/[\r\n]+/g, " ").replace(/^Error:\s*/, "").slice(0, 160);
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

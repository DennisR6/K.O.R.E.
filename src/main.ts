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
import { createKoreReplayViewerSurface } from "./kore/ui/replayViewerSurface.js";
import { createKoreShareSurface } from "./kore/ui/shareSurface.js";
import type { IMouse } from "./engine/types.js";
import { runtimeNow, summarizeFrameWindow } from "./engine/runtimeLog.js";
import { kore } from "./kore/sdk/index.js";
import { formatLanguage, isLanguageCode, LANGUAGE_KEYS, loadLanguage, type LanguageCatalog } from "./i18n/language.js";
import { createKoreStatusSurface } from "./kore/ui/statusSurface.js";
import { buildPerformanceEndpoint, installMatchPerformanceReport } from "./net/performanceReport.js";
import { flushStartupTelemetry, getStartupTelemetry, startupMark } from "./engine/startupTelemetry.js";

const uri = new URL(window.location.href)
const REPLAY_TOKEN = /^[a-f0-9]{32}$/;
const usersettings = {
	url: uri.searchParams.get("url") ?? "",
	mapbuilder: uri.searchParams.has("mapbuilder"),
	skipmenu: ["1", "true"].includes(uri.searchParams.get("skipmenu") ?? ""),
	replayToken: uri.searchParams.get("replay") ?? "",
	mapPreference: uri.searchParams.get("map") ?? undefined,
	modePreference: uri.searchParams.get("mode") ?? undefined,
}

const requestedLanguage = uri.searchParams.get("lang");
startupMark("startup.bootstrap.started");
startupMark("assets.load.started", { category: "json/config" });
const activeLanguage: LanguageCatalog | undefined = !isUiDebugSandboxUrl(uri)
	? await loadLanguage(isLanguageCode(requestedLanguage) ? requestedLanguage : "en_en")
	: undefined;
startupMark("assets.load.completed", { category: "json/config" });

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
	handler = kore.createHandler(GameSettings)
	handler.setLanguage(activeLanguage!)
	const viewer = startReplayViewer(usersettings.replayToken, activeLanguage!)
	startGame(handler, () => handler, () => viewer.advance())
} else if (!usersettings.skipmenu) {
	 startupMark("scene.init.started", { scene: "menu" });
	 router = new LocalMatchSceneRouter(undefined, undefined, (mapId, modeId) => {
		 void buildOnlineJoinUrl(window.location.href, { ...(mapId ? { mapPreference: mapId } : {}), ...(modeId ? { modePreference: modeId } : {}) }).then(url => { window.location.assign(url) }).catch(error => console.warn("Online join failed", error))
	}, activeLanguage!)
	 handler = router.getHandler()
	 startupMark("scene.init.completed", { scene: "menu" });
	 startGame(handler, () => router?.getHandler() ?? handler, () => router?.syncResultUi())
	} else if (usersettings.url && usersettings.url !== "local") {
	startNetworkGame(usersettings.url, activeLanguage!)
} else {
	const em = new CombiEmitter()
	const ems = new EmitterSystem(em);
	handler = kore.createHandler(GameSettings)
	handler.setMyTeam([0, 1])
	handler.addSystem(ui)
	handler.setMouseHandler(ui)
	handler.addSystem(ems)
	em.addEmitter(new GameEmitter(handler))
	installGameplayHud(handler, { language: activeLanguage!, onReturnToMenu: () => window.location.assign(window.location.pathname) })
	startGame(handler)
}

function startNetworkGame(serverUrl: string, language: LanguageCatalog) {
	let socket: WebSocket;
	const loading = createKoreStatusSurface(language, () => { socket.close(); window.location.reload(); }, () => {
		socket.close();
		const url = new URL(window.location.href);
		url.searchParams.delete("skipmenu");
		url.searchParams.delete("url");
		window.location.assign(url.toString());
	});
	const loadingHandler = new (GameHandler)();
	loadingHandler.setLanguage(language);
	loadingHandler.setMouseHandler(loading);
	loadingHandler.addPreDrawer(loading);
	handler = loadingHandler;
	startGame(loadingHandler, () => handler);
	loading.setMessage(language.strings[LANGUAGE_KEYS.LoadingConnecting]);
	socket = new WebSocket(serverUrl)
	let started = false
	let failed = false
	const fail = (message: string) => {
		if (started || failed) return
		failed = true
		loading.fail(message)
	}
	socket.addEventListener("open", () => {
		loading.setMessage(language.strings[LANGUAGE_KEYS.LoadingFindingOpponent])
		socket.send(wrap<NetworkLogin>({ type: NetworkMessageType.LOGIN, userid: getUserUUUID() ?? undefined, mapPreference: usersettings.mapPreference, modePreference: usersettings.modePreference }))
	})
	socket.addEventListener("error", () => fail(language.strings[LANGUAGE_KEYS.LoadingConnectFailed]))
	socket.addEventListener("close", () => fail(language.strings[LANGUAGE_KEYS.LoadingConnectionClosed]))
	const timeout = window.setTimeout(() => fail(language.strings[LANGUAGE_KEYS.LoadingTimedOut]), 20_000)
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
		loading.setMessage(language.strings[LANGUAGE_KEYS.LoadingWaitingOpponent])
			return
		}
		if (message.type === NetworkMessageType.ERROR) {
			fail(language.strings[LANGUAGE_KEYS.LoadingServerFailed])
			return
		}
		if (message.type !== NetworkMessageType.INIT || started) return
		started = true
		window.clearTimeout(timeout)
		loadingHandler.dispose()
		const init = message as NetworkInit
		if (init.mapId) loading.setMessage(formatLanguage(language, LANGUAGE_KEYS.LoadingStarting, { map: init.mapId }))
		const settings = init.settings
		const ui = new UiSystem()

		const emitter = new NetworkEmitter(socket)
		let replayShareAction: "view" | "share" | undefined
		handler = kore.restoreHandler(settings)
		handler.setLanguage(language)
		handler.addSystem(ui)
		handler.setMouseHandler(ui)
		const restoredEmitter = handler.getSystems().find(system => (system as { systemId?: string }).systemId === "core.emitter") as EmitterSystem | undefined
		if (restoredEmitter) restoredEmitter.setEmitter(emitter)
		else handler.addSystem(new EmitterSystem(emitter))
		handler.setRuleState(init.ruleState)
		const performanceUserId = getUserUUUID();
		if (init.gameId && performanceUserId) installMatchPerformanceReport(handler, init.gameId, performanceUserId, undefined, buildPerformanceEndpoint(serverUrl, init.gameId))
		// The online branch installs the same gameplay HUD as every offline mode;
		// only the semantic actions and capability limits differ.
		installGameplayHud(handler, {
			language,
			canSkipItemPhase: true,
			canPause: false,
			onUseItem: (actorId, itemId, target) => { emitter.sendItemUse(actorId, itemId, target); return false; },
			onRematch: () => { socket.send(wrap({ type: NetworkMessageType.REMATCH })); return false; },
			onReplayShare: () => { replayShareAction = "view"; emitter.requestReplayShare(); return false; },
			onReturnToMenu: () => { window.location.assign(window.location.pathname); return false; },
		});
		installTurnReceiver(socket, handler)
		installReplayShareControls(socket, language, handler, url => {
			if (replayShareAction !== "view") return false
			replayShareAction = undefined
			window.location.assign(url)
			return true
		})
	})
}

/** A no-socket, read-only replay entry surface. Clipboard reads require a click. */
function startReplayViewer(initialToken: string, language: LanguageCatalog): ReplayViewer {
	const viewer = new ReplayViewer(language);
	(window as unknown as { replayViewer: ReplayViewer }).replayViewer = viewer;
	const loadToken = async (rawToken: string) => {
		const token = rawToken.trim();
		if (!REPLAY_TOKEN.test(token)) { surface.setStatus(language.strings[LANGUAGE_KEYS.ReplayValidId]); console.error(`[replay] invalid replay share ID: ${JSON.stringify(token)}`); return; }
		surface.setStatus(language.strings[LANGUAGE_KEYS.ReplayLoading]);
		const endpoint = buildReplayShareEndpoint(window.location.href, token);
		console.log(`[replay] requesting replay from ${endpoint}`);
		try {
			const response = await fetch(endpoint, { cache: "no-store" });
			console.log(`[replay] ${endpoint} responded HTTP ${response.status}`);
			if (!response.ok) throw new Error(`${language.strings[LANGUAGE_KEYS.ReplayUnavailable]} (HTTP ${response.status})`);
			const body = await response.json() as { replay?: unknown };
			console.log(`[replay] response payload keys: ${Object.keys(body).join(", ") || "(empty)"}${body.replay === undefined ? " — replay field MISSING" : ""}`);
			if (!viewer.loadReplay(body.replay)) throw new Error(viewer.getErrorState() ?? language.strings[LANGUAGE_KEYS.ReplayUnavailable]);
			handler = viewer.getPlayer()!.getHandler();
			handler.setLanguage(language);
			handler.setMouseHandler(surface);
			handler.addPostDrawer(surface);
			const loadedPlayer = viewer.getPlayer()!;
			const world = handler.getSettings()?.worldSize;
			console.log(`[replay] loaded: state=${handler.getState()} entities=${handler.getEntityManager().getEntities().length} actions=${loadedPlayer.getActionCount()} world=${JSON.stringify(world)} rendererWorldWidth=${GameSettings.screenResolution.x}`);
			surface.setStatus(loadedPlayer.getActionCount() > 0
				? language.strings[LANGUAGE_KEYS.ReplayLoaded]
				: language.strings[LANGUAGE_KEYS.ReplayLoadedEmpty]);
		} catch (error) {
			console.error("[replay] replay load failed:", error);
			surface.setStatus(language.strings[LANGUAGE_KEYS.ReplayUnavailable]);
		}
	};
	const surface = createKoreReplayViewerSurface({
		onLoad: loadToken,
		onPaste: async () => {
			try { const value = await navigator.clipboard.readText(); surface.setStatus(language.strings[LANGUAGE_KEYS.ReplayPasted]); return value; }
			catch { surface.setStatus(language.strings[LANGUAGE_KEYS.ReplayCopyUnavailable]); return undefined; }
		},
	}, language, initialToken);
	handler.setMouseHandler(surface);
	handler.addPostDrawer(surface);
	if (initialToken) void loadToken(initialToken);
	return viewer;
}

/** Share URLs are displayed first; clipboard access is an explicit second click. */
function installReplayShareControls(socket: WebSocket, language: LanguageCatalog, activeHandler: GameHandler, onReplayLink?: (url: string) => boolean): void {
	const share = createKoreShareSurface(language);
	activeHandler.addPostDrawer(share);
	const gameplayInput = activeHandler.getMouseHandler();
	const composite: IMouse = {
		updateMouse(x, y) { share.updateMouse(x, y); gameplayInput?.updateMouse(x, y); },
		handleMousePressed() { if (!share.handlesMousePress()) gameplayInput?.handleMousePressed(); else share.handleMousePressed(); },
		handleMouseReleased() { gameplayInput?.handleMouseReleased(); },
		handleMouseWheel(event) { gameplayInput?.handleMouseWheel(event); },
	};
	activeHandler.setMouseHandler(composite);
	socket.addEventListener("message", event => {
		try {
			const message = JSON.parse(String(event.data)) as UnTypedNetworkMessage
			if (message.type !== NetworkMessageType.REPLAY_SHARE_CREATED) return
			const token = (message as { token: string }).token
			const url = buildReplayViewerUrl(window.location.href, token)
			if (onReplayLink?.(url)) return
			share.setUrl(url)
		} catch { /* ignore malformed protocol input */ }
	})
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
		let previousFrameAt: number | undefined;
		let frameWindowStartedAt: number | undefined;
		const frameSamples: number[] = [];
		const adapted = adaptCanvasSizeForViewport(window.window.innerWidth, window.window.innerHeight, GameSettings.screenResolution.x, GameSettings.screenResolution.y);
		const scale = adapted.scale;
		p.setup = () => {
			startupMark("first-frame.requested");
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
				const frameStarted = runtimeNow();
				if (previousFrameAt !== undefined) frameSamples.push(frameStarted - previousFrameAt);
				previousFrameAt = frameStarted;
				frameWindowStartedAt ??= frameStarted;
				if (frameStarted - frameWindowStartedAt >= 1000) {
					const summary = summarizeFrameWindow(frameSamples);
					if (summary) active.log("performance.frame-window", summary);
					frameSamples.length = 0;
					frameWindowStartedAt = frameStarted;
				}
				active.tick()
				afterTick?.()
				flushBrowserAudio(active)
				p.push()
				active.drawWorld(ctx)
				p.pop()
				startupMark("first-frame.rendered", { scene: active.getSettings()?.gameMode?.id ? "game" : "menu" });
				if (active.getSettings()?.gameMode?.id) startupMark("first-game-frame.rendered", { mode: active.getSettings()?.gameMode?.id });
				flushStartupTelemetry(active, (type, data) => active.log(type, data));
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
		window.addEventListener("keydown", (e) => {
			const active = getActiveHandler() as GameHandler & { handleKeyPressed?: (event: KeyboardEvent) => void };
			active.handleKeyPressed?.(e);
		});

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
		get logs() { return [...getActiveHandler().getLogs()]; },
		get startup() { return getStartupTelemetry(); },
		get aiWorkerMetrics() { return router?.getAiWorkerMetrics(); },
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
	switch (e.key.toLowerCase()) {
		case "n": audio.nextTrack(); e.preventDefault(); e.stopPropagation(); break
		case "p": audio.previousTrack(); e.preventDefault(); e.stopPropagation(); break
		case "arrowup": audio.addVolume(0.05); e.preventDefault(); e.stopPropagation(); break
		case "arrowdown": audio.addVolume(-0.05); e.preventDefault(); e.stopPropagation(); break
	}
});

document.addEventListener('click', () => { void browserAudioManager.unlock() }, { once: true });

if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
	window.addEventListener("load", () => {
		navigator.serviceWorker.register("./sw.js").catch(() => {});
	});
}

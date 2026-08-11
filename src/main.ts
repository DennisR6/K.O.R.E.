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
import { GameState, type IMouse } from "./engine/types.js";
import { runtimeNow, summarizeFrameWindow } from "./engine/runtimeLog.js";
import { kore } from "./kore/sdk/index.js";
import { formatLanguage, isLanguageCode, LANGUAGE_KEYS, loadLanguage, type LanguageCatalog } from "./i18n/language.js";
import { createKoreStatusSurface } from "./kore/ui/statusSurface.js";
import { buildPerformanceEndpoint, installMatchPerformanceReport } from "./net/performanceReport.js";
import { buildMatchReportEndpoint, reportMatchHttp } from "./net/matchReport.js";
import { flushOfflineMatchReports } from "./net/offlineMatchReport.js";
import { flushStartupTelemetry, getStartupTelemetry, startupMark } from "./engine/startupTelemetry.js";
import { buildFeedbackEndpoint, installDesyncFeedbackReporter, installFeedbackPrompt } from "./net/feedback.js";
import { ActionManager, GameAction } from "./input/actions.js";
import { ControllerInput } from "./input/controller.js";

const uri = new URL(window.location.href)
const REPLAY_TOKEN = /^[a-f0-9]{32}$/;
const usersettings = {
	url: uri.searchParams.get("url") ?? "",
	mapbuilder: uri.searchParams.has("mapbuilder"),
	skipmenu: ["1", "true"].includes(uri.searchParams.get("skipmenu") ?? ""),
	replayToken: uri.searchParams.get("replay") ?? "",
	embedReplay: ["1", "true"].includes(uri.searchParams.get("embed") ?? ""),
	autoRestart: ["1", "true"].includes(uri.searchParams.get("autorestart") ?? ""),
	mapPreference: uri.searchParams.get("map") ?? undefined,
	modePreference: uri.searchParams.get("mode") ?? undefined,
	friendRole: uri.searchParams.get("friend") as "create" | "join" | null,
	friendCode: uri.searchParams.get("code") ?? undefined,
}

const requestedLanguage = uri.searchParams.get("lang");
startupMark("startup.bootstrap.started");
startupMark("assets.load.started", { category: "json/config" });
const activeLanguage: LanguageCatalog | undefined = !isUiDebugSandboxUrl(uri)
	? await loadLanguage(isLanguageCode(requestedLanguage) ? requestedLanguage : "en_en")
	: undefined;
startupMark("assets.load.completed", { category: "json/config" });
void flushOfflineMatchReports();
window.addEventListener("online", () => { void flushOfflineMatchReports(); });

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
	const viewer = startReplayViewer(usersettings.replayToken, activeLanguage!, usersettings.embedReplay)
	startGame(handler, () => viewer.getPlayer()?.getHandler() ?? handler, () => { viewer.advance(); notifyReplayEmbed(viewer); })
} else if (!usersettings.skipmenu) {
	 startupMark("scene.init.started", { scene: "menu" });
		router = new LocalMatchSceneRouter(undefined, undefined, (mapId, modeId) => {
		 void buildOnlineJoinUrl(window.location.href, { ...(mapId ? { mapPreference: mapId } : {}), ...(modeId ? { modePreference: modeId } : {}) }).then(url => { window.location.assign(url) }).catch(error => console.warn("Online join failed", error))
	}, activeLanguage!, usersettings.autoRestart, () => {
		const role = window.confirm("Create a friend room? OK = Create, Cancel = Join") ? "create" : "join";
		const code = role === "join" ? window.prompt("Enter the 6-digit friend code")?.trim() : undefined;
		if (role === "join" && (!code || !/^\d{6}$/.test(code))) return;
		void buildOnlineJoinUrl(window.location.href, { friendRole: role, ...(code ? { friendCode: code } : {}) }).then(url => { window.location.assign(url) }).catch(error => console.warn("Friend room failed", error));
	})
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
	installFeedbackPrompt(handler, { mode: "hotseat", mapId: "ice-map-v1" }, buildFeedbackEndpoint(window.location.href))
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
		// Two friend-room tabs can share origin localStorage. Do not reuse the
		// normal matchmaking identity for either side; the server assigns each
		// connection a distinct player identity for this room.
		socket.send(wrap<NetworkLogin>({ type: NetworkMessageType.LOGIN, userid: usersettings.friendRole ? undefined : (getUserUUUID() ?? undefined), mapPreference: usersettings.mapPreference, modePreference: usersettings.modePreference, friendRole: usersettings.friendRole ?? undefined, friendCode: usersettings.friendCode }))
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
		if (message.type === NetworkMessageType.FRIEND_ROOM_CREATED) {
			loading.setMessage(`Friend room code: ${(message as { code: string }).code}`)
			return
		}
		if (message.type === NetworkMessageType.WAITINGROOM) {
			if (usersettings.friendRole !== "create") loading.setMessage(language.strings[LANGUAGE_KEYS.LoadingWaitingOpponent])
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

		const emitter = new NetworkEmitter(socket)
		let replayShareAction: "view" | "share" | undefined
		let surrendering = false
		const returnToMenu = () => window.location.assign(window.location.pathname)
		socket.addEventListener("message", event => {
			try {
				if ((JSON.parse(String(event.data)) as { type?: unknown }).type === NetworkMessageType.SURRENDERED) returnToMenu()
			} catch { /* Ignore malformed packets; the normal receiver handles protocol errors. */ }
		})
		handler = kore.restoreHandler(settings)
		handler.setLanguage(language)
		const restoredUi = handler.getSystems().find(system => system instanceof UiSystem) as UiSystem | undefined
		const ui = restoredUi ?? new UiSystem()
		if (!restoredUi) handler.addSystem(ui)
		handler.setMouseHandler(ui)
		const restoredEmitter = handler.getSystems().find(system => (system as { systemId?: string }).systemId === "core.emitter") as EmitterSystem | undefined
		if (restoredEmitter) restoredEmitter.setEmitter(emitter)
		else handler.addSystem(new EmitterSystem(emitter))
		handler.setRuleState(init.ruleState)
		const performanceUserId = getUserUUUID();
		if (init.gameId && performanceUserId) installMatchPerformanceReport(handler, init.gameId, performanceUserId, undefined, buildPerformanceEndpoint(serverUrl, init.gameId))
		if (init.gameId) {
			const feedbackEndpoint = buildFeedbackEndpoint(serverUrl);
			const feedbackContext = { gameId: init.gameId, userId: performanceUserId ?? undefined, mode: "online" as const, mapId: init.mapId };
			installFeedbackPrompt(handler, feedbackContext, feedbackEndpoint);
			installDesyncFeedbackReporter(handler, feedbackContext, feedbackEndpoint);
		}
		// The online branch installs the same gameplay HUD as every offline mode;
		// only the semantic actions and capability limits differ.
		installGameplayHud(handler, {
			language,
			canSkipItemPhase: true,
			canPause: false,
			onUseItem: (actorId, itemId, target) => { emitter.sendItemUse(actorId, itemId, target); return false; },
			onReport: (category, text) => {
				const sent = emitter.sendReport(category, text);
				if (!sent && init.gameId && performanceUserId) void reportMatchHttp(buildMatchReportEndpoint(serverUrl, init.gameId), init.gameId, performanceUserId, category, text);
				return false;
			},
			onRematch: () => { socket.send(wrap({ type: NetworkMessageType.REMATCH })); return false; },
			onReplayShare: () => { replayShareAction = "view"; emitter.requestReplayShare(); return false; },
			onReturnToMenu: () => {
			if (surrendering) return false;
			surrendering = true;
			if (!emitter.surrender()) returnToMenu();
			else window.setTimeout(() => { if (surrendering) returnToMenu(); }, 1_000);
			return false;
		},
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
function startReplayViewer(initialToken: string, language: LanguageCatalog, embedded = false): ReplayViewer {
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
			surface.setPlaybackLoaded(true);
			const loadedPlayer = viewer.getPlayer()!;
			const world = handler.getSettings()?.worldSize;
			console.log(`[replay] loaded: state=${handler.getState()} entities=${handler.getEntityManager().getEntities().length} actions=${loadedPlayer.getActionCount()} world=${JSON.stringify(world)} rendererWorldWidth=${GameSettings.screenResolution.x}`);
			surface.setStatus(loadedPlayer.getActionCount() > 0
				? language.strings[LANGUAGE_KEYS.ReplayLoaded]
				: language.strings[LANGUAGE_KEYS.ReplayLoadedEmpty]);
			if (embedded) notifyReplayEmbed(viewer, "replay.ready");
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
	if (embedded) {
		window.addEventListener("message", event => {
			if (event.source !== window.parent || event.origin !== window.location.origin) return;
			const message = event.data as { source?: unknown; type?: unknown; actionIndex?: unknown };
			if (!message || message.source !== "kore-replay-host") return;
			try {
				switch (message.type) {
					case "replay.play": viewer.play(); break;
					case "replay.pause": viewer.pause(); break;
					case "replay.seek":
						if (!Number.isSafeInteger(message.actionIndex)) throw new Error("Replay seek index must be an integer");
						viewer.seek(message.actionIndex as number);
						if (viewer.getPlayer()) {
							handler = viewer.getPlayer()!.getHandler();
							handler.setLanguage(language);
							handler.setMouseHandler(surface);
							handler.addPostDrawer(surface);
							surface.setPlaybackLoaded(true);
						}
						break;
					default: return;
				}
				notifyReplayEmbed(viewer);
			} catch (error) {
				window.parent.postMessage({ source: "kore-replay", type: "replay.error", message: error instanceof Error ? error.message : "Replay command failed" }, window.location.origin);
			}
		});
	}
	handler.setMouseHandler(surface);
	handler.addPostDrawer(surface);
	if (initialToken) void loadToken(initialToken);
	return viewer;
}

function notifyReplayEmbed(viewer: ReplayViewer, type: "replay.state" | "replay.ready" = "replay.state"): void {
	if (!usersettings.embedReplay || window.parent === window) return;
	window.parent.postMessage({ source: "kore-replay", type, state: viewer.getPlaybackState() }, window.location.origin);
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
		const controller = new ControllerInput(new ActionManager());
		let controllerDragging = false;
		let controllerPushWasDown = false;
		let controllerOwner: GameHandler | undefined;
		const releaseControllerDrag = (active: GameHandler): void => {
			if (!controllerDragging) return;
			active.handleMouseReleased();
			controllerDragging = false;
		};
		const pollController = (active: GameHandler): void => {
			if (!controller.getActiveGamepad() || active !== controllerOwner) {
				if (controllerOwner) releaseControllerDrag(controllerOwner);
				controllerOwner = active;
				controllerPushWasDown = false;
			}
			if (active.getState() !== GameState.Your_turn || active.getRuleState().phase === "item") {
				releaseControllerDrag(active);
				controllerPushWasDown = false;
				return;
			}
			const aim = controller.getAimVector();
			const length = Math.hypot(aim.x, aim.y);
			const actor = active.getEntityManager().getEntities().find(entity => !entity.isDead() && entity.getTeam().includes(active.getActiveTeam()));
			if (!actor || length < 0.15) { controllerPushWasDown = controller.isActionPressed(GameAction.Push); return; }
			if (!controllerDragging) {
				active.updateMouse(actor.getPos().x, actor.getPos().y);
				active.handleMousePressed();
				controllerDragging = true;
			}
			const power = Math.max(1, controller.getChargePressure() * 10);
			const direction = { x: aim.x / length, y: aim.y / length };
			active.updateMouse(actor.getPos().x - direction.x * power * 10, actor.getPos().y - direction.y * power * 10);
			const pushDown = controller.isActionPressed(GameAction.Push);
			if (pushDown && !controllerPushWasDown) releaseControllerDrag(active);
			controllerPushWasDown = pushDown;
		};
		const adapted = adaptCanvasSizeForViewport(window.window.innerWidth, window.window.innerHeight, GameSettings.screenResolution.x, GameSettings.screenResolution.y);
		const scale = adapted.scale;
		p.setup = () => {
			startupMark("first-frame.requested");
			p.createCanvas(adapted.width, adapted.height);
			ctx = new P5Renderer(p, scale, GameSettings.screenResolution.x)
			ctx.resizeCanvas(window.window.innerWidth, window.window.innerHeight)
			const canvasEl = (p as any).canvas as unknown as HTMLCanvasElement;
			if (canvasEl) {
				canvasEl.tabIndex = 0;
				canvasEl.setAttribute("role", "application");
				canvasEl.setAttribute("aria-label", "KORE gameplay canvas");
				canvasEl.style.touchAction = "none";
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
				pollController(active)
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
			const { left, top } = canvasEl.getBoundingClientRect()
			// Continue updating an active drag after it leaves the canvas so the
			// aim preview and release position do not freeze at the edge.
			getActiveHandler().updateMouse(ctx.toWorld(e.clientX - left), ctx.toWorld(e.clientY - top))
		})
		window.addEventListener("mousedown", (e) => {
			const canvasEl = (p as any).canvas as unknown as HTMLCanvasElement;
			if (!canvasEl) return
			const { left, top, right, bottom } = canvasEl.getBoundingClientRect()
			if (e.clientX < left || e.clientX > right || e.clientY < top || e.clientY > bottom) return
			const active = getActiveHandler()
			canvasEl.focus();
			active.updateMouse(ctx.toWorld(e.clientX - left), ctx.toWorld(e.clientY - top))
			active.handleMousePressed()
		})
		window.addEventListener("mouseup", (e) => {
			const canvasEl = (p as any).canvas as unknown as HTMLCanvasElement;
			if (!canvasEl) return
			const { left, top } = canvasEl.getBoundingClientRect()
			// Release globally: a drag started on the canvas must still submit when
			// the pointer is released outside its bounds.
			const active = getActiveHandler()
			active.updateMouse(ctx.toWorld(e.clientX - left), ctx.toWorld(e.clientY - top))
			active.handleMouseReleased()
		})
		let activeTouchId: number | undefined;
		let latestTouch: { clientX: number; clientY: number } | undefined;
		const touchPoint = (event: TouchEvent): { clientX: number; clientY: number } | undefined => {
			if (activeTouchId === undefined) return event.changedTouches[0];
			for (let index = 0; index < event.changedTouches.length; index++) {
				const touch = event.changedTouches[index];
				if (touch?.identifier === activeTouchId) return touch;
			}
			return undefined;
		};
		const updateTouch = (touch: { clientX: number; clientY: number }): void => {
			const canvas = (p as any).canvas as unknown as HTMLCanvasElement;
			if (!canvas) return;
			const bounds = canvas.getBoundingClientRect();
			const active = getActiveHandler();
			active.updateMouse(ctx.toWorld(touch.clientX - bounds.left), ctx.toWorld(touch.clientY - bounds.top));
			latestTouch = touch;
		};
		window.addEventListener("touchstart", (event) => {
			if (activeTouchId !== undefined) return;
			const canvas = (p as any).canvas as unknown as HTMLCanvasElement;
			const touch = touchPoint(event);
			if (!canvas || !touch) return;
			const bounds = canvas.getBoundingClientRect();
			if (touch.clientX < bounds.left || touch.clientX > bounds.right || touch.clientY < bounds.top || touch.clientY > bounds.bottom) return;
			event.preventDefault();
			canvas.focus();
			activeTouchId = event.changedTouches[0]!.identifier;
			updateTouch(touch);
			getActiveHandler().handleMousePressed();
		}, { passive: false });
		window.addEventListener("touchmove", (event) => {
			if (activeTouchId === undefined) return;
			const touch = touchPoint(event);
			if (!touch) return;
			event.preventDefault();
			updateTouch(touch);
		}, { passive: false });
		const releaseTouch = (event: TouchEvent): void => {
			if (activeTouchId === undefined) return;
			const touch = touchPoint(event) ?? latestTouch;
			if (touch) updateTouch(touch);
			event.preventDefault();
			getActiveHandler().handleMouseReleased();
			activeTouchId = undefined;
			latestTouch = undefined;
		};
		window.addEventListener("touchend", releaseTouch, { passive: false });
		window.addEventListener("touchcancel", (event) => {
			if (activeTouchId === undefined) return;
			event.preventDefault();
			getActiveHandler().handleMouseCancelled();
			activeTouchId = undefined;
			latestTouch = undefined;
		}, { passive: false });
		window.addEventListener("keydown", (e) => {
			const active = getActiveHandler() as GameHandler & { handleKeyPressed?: (event: KeyboardEvent) => void };
			if (["Tab", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter", " "].includes(e.key)) e.preventDefault();
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

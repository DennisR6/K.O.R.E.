export const LANGUAGE_CODES = ["en_en", "de_de"] as const;
export type LanguageCode = (typeof LANGUAGE_CODES)[number];

export const LANGUAGE_KEYS = {
	MenuTitle: "kore.ui.menu.title",
	MenuLandingPrompt: "kore.ui.menu.landingPrompt",
	MenuAiButton: "kore.ui.menu.aiButton",
	MenuBattleButton: "kore.ui.menu.battleButton",
	MenuOnlineButton: "kore.ui.menu.onlineButton",
	MenuLocalButton: "kore.ui.menu.localButton",
	MenuChooseMapButton: "kore.ui.menu.chooseMapButton",
	MenuOnlineMapNote: "kore.ui.menu.onlineMapNote",
	MenuBackButton: "kore.ui.menu.backButton",
	MenuDifficultyTitle: "kore.ui.menu.difficultyTitle",
	MenuKiLabel: "kore.ui.menu.kiLabel",
	MenuMapTitle: "kore.ui.menu.mapTitle",
	MenuMatchmakingLabel: "kore.ui.menu.matchmakingLabel",
	ModsButton: "kore.ui.menu.modsButton",
	ModsTitle: "kore.ui.mods.title",
	ModsLoadFile: "kore.ui.mods.loadFile",
	ModsPasteJson: "kore.ui.mods.pasteJson",
	ModsStatusEmpty: "kore.ui.mods.statusEmpty",
	ModImportTitle: "kore.ui.mods.import.title",
	ModImportHint: "kore.ui.mods.import.hint",
	ModImportValidate: "kore.ui.mods.import.validate",
	ModResultTitle: "kore.ui.mods.result.title",
	ModResultName: "kore.ui.mods.result.name",
	ModResultId: "kore.ui.mods.result.id",
	ModResultMeta: "kore.ui.mods.result.meta",
	ModTest1v1: "kore.ui.mods.test1v1",
	ModTestBattle: "kore.ui.mods.testBattle",
	ModError: "kore.ui.mods.error",
	HudPause: "kore.ui.hud.pause",
	HudItems: "kore.ui.hud.items",
	HudSkipPhase: "kore.ui.hud.skipPhase",
	HudRematch: "kore.ui.hud.rematch",
	HudMenu: "kore.ui.hud.menu",
	HudReplay: "kore.ui.hud.replay",
	HudShare: "kore.ui.hud.share",
	HudReplayShare: "kore.ui.hud.replayShare",
	HudPaused: "kore.ui.hud.paused",
	HudResume: "kore.ui.hud.resume",
	HudReport: "kore.ui.hud.report",
	HudReportTitle: "kore.ui.hud.reportTitle",
	HudReportConduct: "kore.ui.hud.reportConduct",
	HudReportTechnical: "kore.ui.hud.reportTechnical",
	HudReportSubmit: "kore.ui.hud.reportSubmit",
	HudReportCancel: "kore.ui.hud.reportCancel",
	HudNone: "kore.ui.hud.none",
	HudWaiting: "kore.ui.hud.waiting",
	HudTutorial: "kore.ui.hud.tutorial",
	HudAiThinking: "kore.ui.hud.aiThinking",
	HudTurn: "kore.ui.hud.turn",
	HudActor: "kore.ui.hud.actor",
	HudAim: "kore.ui.hud.aim",
	HudPower: "kore.ui.hud.power",
	HudDraw: "kore.ui.hud.draw",
	HudTeamWins: "kore.ui.hud.teamWins",
	HudActionRejected: "kore.ui.hud.actionRejected",
	HudStateYourTurn: "kore.ui.hud.state.yourTurn",
	HudStateOpponentTurn: "kore.ui.hud.state.opponentTurn",
	HudStatePlaying: "kore.ui.hud.state.playing",
	HudStateWaiting: "kore.ui.hud.state.waiting",
	HudStateGameOver: "kore.ui.hud.state.gameOver",
	HudStateTurnDone: "kore.ui.hud.state.turnDone",
	HudStateUnknown: "kore.ui.hud.state.unknown",
	HudStateStarting: "kore.ui.hud.state.starting",
	HudStateWaitingPlayers: "kore.ui.hud.state.waitingPlayers",
	HudStateChooseTeam: "kore.ui.hud.state.chooseTeam",
	HudStateRoundDone: "kore.ui.hud.state.roundDone",
	HudStateSimulating: "kore.ui.hud.state.simulating",
	HudStateSimulatingDone: "kore.ui.hud.state.simulatingDone",
	HudStatePlayingDone: "kore.ui.hud.state.playingDone",
	HudStateGoalScored: "kore.ui.hud.state.goalScored",
	HudStateError: "kore.ui.hud.state.error",
	WorldOut: "kore.ui.world.out",
	LoadingJoining: "kore.ui.loading.joining",
	LoadingConnecting: "kore.ui.loading.connecting",
	LoadingFindingOpponent: "kore.ui.loading.findingOpponent",
	LoadingWaitingOpponent: "kore.ui.loading.waitingOpponent",
	LoadingWaitingTime: "kore.ui.loading.waitingTime",
	LoadingConnectFailed: "kore.ui.loading.connectFailed",
	LoadingConnectionClosed: "kore.ui.loading.connectionClosed",
	LoadingTimedOut: "kore.ui.loading.timedOut",
	LoadingServerFailed: "kore.ui.loading.serverFailed",
	LoadingStarting: "kore.ui.loading.starting",
	LoadingRetry: "kore.ui.loading.retry",
	LoadingBack: "kore.ui.loading.back",
	ReplayTitle: "kore.ui.replay.title",
	ReplayLoad: "kore.ui.replay.load",
	ReplayPaste: "kore.ui.replay.paste",
	ReplayCopy: "kore.ui.replay.copy",
	ReplayShareId: "kore.ui.replay.shareId",
	ReplayValidId: "kore.ui.replay.validId",
	ReplayLoading: "kore.ui.replay.loading",
	ReplayUnavailable: "kore.ui.replay.unavailable",
	ReplayPasted: "kore.ui.replay.pasted",
	ReplayCopied: "kore.ui.replay.copied",
	ReplayCopyUnavailable: "kore.ui.replay.copyUnavailable",
	ReplayLinkReady: "kore.ui.replay.linkReady",
	ReplayError: "kore.ui.replay.error",
	ReplayNoneLoaded: "kore.ui.replay.noneLoaded",
	ReplayLoaded: "kore.ui.replay.loaded",
	ReplayLoadedEmpty: "kore.ui.replay.loadedEmpty",
} as const;

export type LanguageKey = (typeof LANGUAGE_KEYS)[keyof typeof LANGUAGE_KEYS];
export type LanguageCatalog = {
	language: LanguageCode;
	fallback: "en_en";
	strings: Record<LanguageKey, string>;
};

const EN_EN_STRINGS: Record<LanguageKey, string> = {
	[LANGUAGE_KEYS.MenuTitle]: "KORE",
	[LANGUAGE_KEYS.MenuLandingPrompt]: "Press to start",
	[LANGUAGE_KEYS.MenuAiButton]: "1 vs AI",
	[LANGUAGE_KEYS.MenuBattleButton]: "AI vs AI",
	[LANGUAGE_KEYS.MenuOnlineButton]: "Play Online",
	[LANGUAGE_KEYS.MenuLocalButton]: "Play Offline",
	[LANGUAGE_KEYS.MenuChooseMapButton]: "Choose Map",
	[LANGUAGE_KEYS.MenuOnlineMapNote]: "Preference only - the server may choose Ice Map",
	[LANGUAGE_KEYS.MenuBackButton]: "Back",
	[LANGUAGE_KEYS.MenuDifficultyTitle]: "Choose AI difficulty",
	[LANGUAGE_KEYS.MenuKiLabel]: "AI",
	[LANGUAGE_KEYS.MenuMapTitle]: "Choose Map",
	[LANGUAGE_KEYS.MenuMatchmakingLabel]: "Matchmaking",
	[LANGUAGE_KEYS.ModsButton]: "Mods",
	[LANGUAGE_KEYS.ModsTitle]: "Mods",
	[LANGUAGE_KEYS.ModsLoadFile]: "Load JSON file",
	[LANGUAGE_KEYS.ModsPasteJson]: "Paste JSON",
	[LANGUAGE_KEYS.ModsStatusEmpty]: "No mod loaded",
	[LANGUAGE_KEYS.ModImportTitle]: "Import mod",
	[LANGUAGE_KEYS.ModImportHint]: "Paste a KORE mod JSON document below.",
	[LANGUAGE_KEYS.ModImportValidate]: "Validate",
	[LANGUAGE_KEYS.ModResultTitle]: "Mod summary",
	[LANGUAGE_KEYS.ModResultName]: "Name: {name}",
	[LANGUAGE_KEYS.ModResultId]: "ID: {id}",
	[LANGUAGE_KEYS.ModResultMeta]: "Version {version} · {items} item(s) · {effects} effect(s)",
	[LANGUAGE_KEYS.ModTest1v1]: "Test 1 vs AI",
	[LANGUAGE_KEYS.ModTestBattle]: "Test AI vs AI",
	[LANGUAGE_KEYS.ModError]: "Mod error: {error}",
	[LANGUAGE_KEYS.HudPause]: "Pause",
	[LANGUAGE_KEYS.HudItems]: "Items",
	[LANGUAGE_KEYS.HudSkipPhase]: "Skip phase",
	[LANGUAGE_KEYS.HudRematch]: "Rematch",
	[LANGUAGE_KEYS.HudMenu]: "Menu",
	[LANGUAGE_KEYS.HudReplay]: "Replay",
	[LANGUAGE_KEYS.HudShare]: "Share",
	[LANGUAGE_KEYS.HudReplayShare]: "Replay / Share",
	[LANGUAGE_KEYS.HudPaused]: "Paused",
	[LANGUAGE_KEYS.HudResume]: "Resume",
	[LANGUAGE_KEYS.HudReport]: "Report",
	[LANGUAGE_KEYS.HudReportTitle]: "Report a problem",
	[LANGUAGE_KEYS.HudReportConduct]: "Cheater / conduct",
	[LANGUAGE_KEYS.HudReportTechnical]: "Bug / technical",
	[LANGUAGE_KEYS.HudReportSubmit]: "Submit report",
	[LANGUAGE_KEYS.HudReportCancel]: "Cancel",
	[LANGUAGE_KEYS.HudNone]: "None",
	[LANGUAGE_KEYS.HudWaiting]: "Waiting for opponent/server",
	[LANGUAGE_KEYS.HudTutorial]: "Select a figure, drag to aim, then release to shoot.",
	[LANGUAGE_KEYS.HudAiThinking]: "This is a hard move - the AI is still thinking...",
	[LANGUAGE_KEYS.HudTurn]: "Team {team} | {phase} | Turn {turn}",
	[LANGUAGE_KEYS.HudActor]: "Actor: {actor}",
	[LANGUAGE_KEYS.HudAim]: "Aim: {aim}",
	[LANGUAGE_KEYS.HudPower]: "Power: {power}",
	[LANGUAGE_KEYS.HudDraw]: "Draw",
	[LANGUAGE_KEYS.HudTeamWins]: "Team {team} wins",
	[LANGUAGE_KEYS.HudActionRejected]: "Action rejected: {reason}",
	[LANGUAGE_KEYS.HudStateYourTurn]: "Your turn",
	[LANGUAGE_KEYS.HudStateOpponentTurn]: "Opponent's turn",
	[LANGUAGE_KEYS.HudStatePlaying]: "Playing",
	[LANGUAGE_KEYS.HudStateWaiting]: "Waiting",
	[LANGUAGE_KEYS.HudStateGameOver]: "Game over",
	[LANGUAGE_KEYS.HudStateTurnDone]: "Turn done",
	[LANGUAGE_KEYS.HudStateUnknown]: "Unknown",
	[LANGUAGE_KEYS.HudStateStarting]: "Starting",
	[LANGUAGE_KEYS.HudStateWaitingPlayers]: "Waiting for players",
	[LANGUAGE_KEYS.HudStateChooseTeam]: "Choose team",
	[LANGUAGE_KEYS.HudStateRoundDone]: "Round done",
	[LANGUAGE_KEYS.HudStateSimulating]: "Simulating",
	[LANGUAGE_KEYS.HudStateSimulatingDone]: "Simulation done",
	[LANGUAGE_KEYS.HudStatePlayingDone]: "Playing done",
	[LANGUAGE_KEYS.HudStateGoalScored]: "Goal scored",
	[LANGUAGE_KEYS.HudStateError]: "Engine error",
	[LANGUAGE_KEYS.WorldOut]: "OUT",
	[LANGUAGE_KEYS.LoadingJoining]: "Joining online game",
	[LANGUAGE_KEYS.LoadingConnecting]: "Connecting to the match server…",
	[LANGUAGE_KEYS.LoadingFindingOpponent]: "Finding an opponent…",
	[LANGUAGE_KEYS.LoadingWaitingOpponent]: "Waiting for an opponent…",
	[LANGUAGE_KEYS.LoadingWaitingTime]: "Waiting time: {elapsed}",
	[LANGUAGE_KEYS.LoadingConnectFailed]: "Could not connect to the match server.",
	[LANGUAGE_KEYS.LoadingConnectionClosed]: "The match connection closed before setup completed.",
	[LANGUAGE_KEYS.LoadingTimedOut]: "Matchmaking timed out. Please retry.",
	[LANGUAGE_KEYS.LoadingServerFailed]: "The server could not start your match.",
	[LANGUAGE_KEYS.LoadingStarting]: "Starting {map}…",
	[LANGUAGE_KEYS.LoadingRetry]: "Retry",
	[LANGUAGE_KEYS.LoadingBack]: "Back to menu",
	[LANGUAGE_KEYS.ReplayTitle]: "Replay viewer",
	[LANGUAGE_KEYS.ReplayLoad]: "Load replay",
	[LANGUAGE_KEYS.ReplayPaste]: "Paste from clipboard",
	[LANGUAGE_KEYS.ReplayCopy]: "Copy replay URL",
	[LANGUAGE_KEYS.ReplayShareId]: "Replay share ID",
	[LANGUAGE_KEYS.ReplayValidId]: "Enter a valid replay share ID.",
	[LANGUAGE_KEYS.ReplayLoading]: "Loading replay…",
	[LANGUAGE_KEYS.ReplayUnavailable]: "Replay unavailable. Check the share ID and try again.",
	[LANGUAGE_KEYS.ReplayPasted]: "Pasted replay ID. Press Load replay.",
	[LANGUAGE_KEYS.ReplayCopied]: "Replay URL copied",
	[LANGUAGE_KEYS.ReplayCopyUnavailable]: "Copy unavailable. Select and copy the URL manually.",
	[LANGUAGE_KEYS.ReplayLinkReady]: "Replay link ready. Copy it or select it manually.",
	[LANGUAGE_KEYS.ReplayError]: "Replay Error: {error}",
	[LANGUAGE_KEYS.ReplayNoneLoaded]: "No replay loaded",
	[LANGUAGE_KEYS.ReplayLoaded]: "Replay loaded. Playback is read-only.",
	[LANGUAGE_KEYS.ReplayLoadedEmpty]: "Replay loaded. No actions have been recorded yet.",
};

export function createEnglishLanguage(): LanguageCatalog {
	return { language: "en_en", fallback: "en_en", strings: { ...EN_EN_STRINGS } };
}

export function isLanguageCode(value: string | null | undefined): value is LanguageCode {
	return typeof value === "string" && (LANGUAGE_CODES as readonly string[]).includes(value);
}

/** Selects the best supported pack for the browser's ordered language list. */
export function resolveBrowserLanguage(languages: readonly string[]): LanguageCode {
	const supported = new Set<LanguageCode>(LANGUAGE_CODES);
	const normalized = languages.map(language => language.trim().toLowerCase().replace(/-/g, "_"));
	for (const language of normalized) if (supported.has(language as LanguageCode)) return language as LanguageCode;
	for (const language of normalized) {
		const base = language.split("_")[0];
		const match = LANGUAGE_CODES.find(code => code.split("_")[0] === base);
		if (match) return match;
	}
	return "en_en";
}

type LanguageDocument = { language?: unknown; strings?: unknown };
type JsonFetcher = (url: string) => Promise<Response>;

/** Loads a language document and fills every missing translation from en_en. */
export async function loadLanguage(language: LanguageCode, baseUrl = "./public/i18n", fetcher: JsonFetcher = fetch): Promise<LanguageCatalog> {
	const fallback = await loadDocument("en_en", baseUrl, fetcher, true);
	if (language === "en_en") return { language, fallback: "en_en", strings: completeStrings(fallback) };
	const selected = await loadDocument(language, baseUrl, fetcher, false);
	return { language, fallback: "en_en", strings: completeStrings({ ...fallback, ...selected }) };
}

export function translate(language: LanguageCatalog, key: LanguageKey): string {
	return language.strings[key];
}

export function formatLanguage(language: LanguageCatalog, key: LanguageKey, values: Record<string, string | number>): string {
	return translate(language, key).replace(/\{(\w+)\}/g, (_match, name: string) => String(values[name] ?? `{${name}}`));
}

async function loadDocument(code: LanguageCode, baseUrl: string, fetcher: JsonFetcher, requireComplete: boolean): Promise<Partial<Record<LanguageKey, string>>> {
	const root = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
	const response = await fetcher(`${root}${code}.json`);
	if (!response.ok) throw new Error(`Unable to load language '${code}' (HTTP ${response.status})`);
	const document = await response.json() as LanguageDocument;
	if (document.language !== code || !document.strings || typeof document.strings !== "object" || Array.isArray(document.strings)) throw new Error(`Malformed language document '${code}'`);
	const strings = document.strings as Record<string, unknown>;
	for (const key of Object.values(LANGUAGE_KEYS)) if (strings[key] !== undefined && typeof strings[key] !== "string") throw new Error(`Language '${code}' has a non-string value for '${key}'`);
	if (requireComplete) for (const key of Object.values(LANGUAGE_KEYS)) if (typeof strings[key] !== "string") throw new Error(`Language '${code}' is missing '${key}'`);
	return strings as Partial<Record<LanguageKey, string>>;
}

function completeStrings(value: Partial<Record<LanguageKey, string>>): Record<LanguageKey, string> {
	for (const key of Object.values(LANGUAGE_KEYS)) if (typeof value[key] !== "string") throw new Error(`Language catalog is missing '${key}'`);
	return value as Record<LanguageKey, string>;
}

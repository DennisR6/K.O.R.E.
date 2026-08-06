/** The frozen classification vocabulary for the incremental SDK migration. */
export type SdkMigrationClassification = "engine-sdk" | "kore-sdk" | "runtime-factory" | "adapter" | "removal-candidate";

export type SdkMigrationEntry = {
	path: string;
	classification: SdkMigrationClassification;
	owner: string;
	targetMilestone: number | null;
	note: string;
};

export type LegacyAuthoringPath = SdkMigrationEntry & {
	symbol: string;
	kind: "construction" | "configuration" | "deserialization";
};

export const SDK_MIGRATION_INVENTORY_VERSION = 1 as const;

/**
 * Prefix rules classify every production TypeScript module. A new module must
 * be assigned deliberately here before it can be considered part of the
 * supported application architecture.
 */
export const sourceClassificationRules: readonly SdkMigrationEntry[] = [
	{ path: "src/engine/sdk/", classification: "engine-sdk", owner: "Engine SDK", targetMilestone: null, note: "Generic JSON-safe engine authoring and framework metadata." },
	{ path: "src/engine/contracts/", classification: "engine-sdk", owner: "Engine SDK", targetMilestone: null, note: "Runtime-neutral engine contracts." },
	{ path: "src/engine/ui-sdk/", classification: "engine-sdk", owner: "Engine UI SDK", targetMilestone: null, note: "Generic renderer-neutral UI composition." },
	{ path: "src/engine/audio-sdk/", classification: "engine-sdk", owner: "Engine Audio SDK", targetMilestone: null, note: "Generic renderer/device-neutral audio capabilities." },
	{ path: "src/kore/sdk/", classification: "kore-sdk", owner: "KORE SDK", targetMilestone: null, note: "KORE authoring APIs composed from Engine SDK primitives." },
	{ path: "src/kore/ui/", classification: "kore-sdk", owner: "KORE UI SDK", targetMilestone: 31, note: "KORE vocabulary and UI projections." },
	{ path: "src/kore/audio.ts", classification: "kore-sdk", owner: "KORE Audio", targetMilestone: 33, note: "KORE semantic audio vocabulary." },
	{ path: "src/kore/ai.ts", classification: "kore-sdk", owner: "KORE AI", targetMilestone: 34, note: "KORE AI authoring entry points for difficulty, seed, team, and decision limits." },
	{ path: "src/kore_sdk.ts", classification: "kore-sdk", owner: "KORE SDK compatibility export", targetMilestone: 37, note: "Deprecated compatibility re-export removed in milestone 37; all callers import `src/kore/sdk/index.js`." },
	{ path: "src/entity/runtimeFactory.ts", classification: "runtime-factory", owner: "Player runtime factory", targetMilestone: null, note: "Only permitted Player runtime construction boundary." },
	{ path: "src/engine/runtimeFactory.ts", classification: "runtime-factory", owner: "Handler runtime factory", targetMilestone: null, note: "Only permitted GameHandler construction boundary for canonical match creation (milestone 28)." },
	{ path: "src/entity/", classification: "removal-candidate", owner: "Legacy entity runtime", targetMilestone: 28, note: "Player and entity implementation remains behind the runtime factory during migration." },
	{ path: "src/effects/runtimeFactory.ts", classification: "runtime-factory", owner: "Effect runtime factory", targetMilestone: null, note: "Only permitted effect runtime construction boundary." },
	{ path: "src/structures/", classification: "runtime-factory", owner: "Structure runtime/deserialization", targetMilestone: 29, note: "Settings-to-runtime geometry boundary." },
	{ path: "src/systems/systemSettings.ts", classification: "runtime-factory", owner: "System deserializer", targetMilestone: 28, note: "Allowlisted system restoration boundary." },
	{ path: "src/server/", classification: "adapter", owner: "Authoritative server adapter", targetMilestone: 35, note: "Persistence, transport, and server lifecycle integration." },
	{ path: "src/audio/", classification: "adapter", owner: "Browser audio adapter", targetMilestone: 33, note: "Device output only; semantic commands remain SDK-owned." },
	{ path: "src/assetManager/", classification: "adapter", owner: "Asset platform adapter", targetMilestone: 36, note: "Browser asset loading and generated registry integration." },
	{ path: "src/main.ts", classification: "adapter", owner: "Browser bootstrap adapter", targetMilestone: 36, note: "Browser IO and scene lifecycle; composition is a migration target." },
	{ path: "src/types/", classification: "adapter", owner: "Platform type declarations", targetMilestone: null, note: "Ambient platform declarations." },
	{ path: "src/discord/", classification: "adapter", owner: "Discord platform adapter", targetMilestone: 36, note: "Optional external platform integration." },
	{ path: "src/debug/", classification: "adapter", owner: "Debug platform adapter", targetMilestone: 36, note: "Diagnostic host outside production SDK authoring." },
	{ path: "src/sdkMigration/", classification: "adapter", owner: "Migration contract tooling", targetMilestone: null, note: "Machine-checkable architecture inventory and migration guardrails." },
	{ path: "src/engine/", classification: "removal-candidate", owner: "Legacy engine internals", targetMilestone: 28, note: "Non-SDK engine implementation is retained behind SDK/runtime boundaries during migration." },
	{ path: "src/ai/", classification: "removal-candidate", owner: "Legacy AI composition", targetMilestone: 34, note: "AI producers and systems need KORE SDK entry points." },
	{ path: "src/content/", classification: "removal-candidate", owner: "Legacy content composition", targetMilestone: 29, note: "Catalog composition must move to KORE map descriptors." },
	{ path: "src/contracts/", classification: "removal-candidate", owner: "KORE document contracts", targetMilestone: 35, note: "Canonical contracts remain valid but authoring ownership is not yet fully SDK-based." },
	{ path: "src/effects/", classification: "removal-candidate", owner: "Legacy effect runtime/configuration", targetMilestone: 30, note: "Direct effect authoring remains in legacy internals and official items." },
	{ path: "src/emitter/", classification: "removal-candidate", owner: "Legacy input emitters", targetMilestone: 32, note: "Turn commands need SDK-defined capabilities." },
	{ path: "src/hazards/", classification: "removal-candidate", owner: "Legacy hazard composition", targetMilestone: 29, note: "Hazard descriptors need KORE map authoring." },
	{ path: "src/input/", classification: "removal-candidate", owner: "Legacy input validation", targetMilestone: 32, note: "Validation remains authoritative but command ownership is not migrated." },
	{ path: "src/item/", classification: "removal-candidate", owner: "Legacy item composition", targetMilestone: 30, note: "Official item and inventory authoring still uses legacy modules." },
	{ path: "src/menu/", classification: "removal-candidate", owner: "Legacy browser menu adapter", targetMilestone: 31, note: "Audio/menu wiring remains application-owned." },
	{ path: "src/net/", classification: "removal-candidate", owner: "Legacy network helpers", targetMilestone: 35, note: "Network payload composition needs canonical SDK contracts." },
	{ path: "src/persistence/", classification: "removal-candidate", owner: "Legacy persistence helpers", targetMilestone: 35, note: "Persistence entry points need SDK contract ownership." },
	{ path: "src/physics/", classification: "removal-candidate", owner: "Legacy physics implementation", targetMilestone: 29, note: "Physics internals remain runtime-owned until map/structure migration is complete." },
	{ path: "src/replay/", classification: "removal-candidate", owner: "Legacy replay composition", targetMilestone: 35, note: "Replay construction must consume canonical SDK documents." },
	{ path: "src/rules/", classification: "removal-candidate", owner: "Legacy rule composition", targetMilestone: 28, note: "Mode and rule authoring needs KORE match composition APIs." },
	{ path: "src/scenes/", classification: "removal-candidate", owner: "Legacy scene composition", targetMilestone: 28, note: "Application scenes still construct canonical matches directly." },
	{ path: "src/settings/", classification: "removal-candidate", owner: "Legacy settings/map composition", targetMilestone: 28, note: "Canonical settings and maps remain direct authoring paths." },
	{ path: "src/systems/", classification: "removal-candidate", owner: "Legacy system composition", targetMilestone: 28, note: "Systems are directly composed outside the KORE match SDK." },
	{ path: "src/ui/", classification: "removal-candidate", owner: "Legacy UI adapters", targetMilestone: 31, note: "Remaining gameplay/replay UI wiring is not fully SDK-authored." },
	{ path: "src/utils/", classification: "adapter", owner: "Application utility adapters", targetMilestone: null, note: "IO-neutral helpers are retained unless a later milestone reclassifies them." },
	{ path: "src/i18n/", classification: "adapter", owner: "Language catalog loader", targetMilestone: null, note: "JSON language loading and English fallback are application boundary concerns." },
];

/** Direct legacy authoring paths found during the milestone 27 audit. */
export const legacyAuthoringPaths: readonly LegacyAuthoringPath[] = [
	{ path: "src/scenes/matchPipeline.ts", symbol: "createMatchHandler", kind: "construction", classification: "removal-candidate", owner: "Legacy match composition", targetMilestone: 28, note: "Canonical settings, mode, teams, systems, and seed now authored via kore.createMatchDefinition; handler built via kore.createRuntimeMatch. Remaining direct construction is transport adapters (UI/emitter/AI systems)." },
	{ path: "src/settings/canonicalPlayableMatch.ts", symbol: "createCanonicalPlayableMatchSettings", kind: "configuration", classification: "removal-candidate", owner: "Legacy match configuration", targetMilestone: 28, note: "Match id, teams, player ids, items, and game mode now authored via kore.authorMatchSettings/createGameMode; base ice-map layout remains legacy map authoring until milestone 29." },
	{ path: "src/settings/iceMap.ts", symbol: "defaultEffects/deadly", kind: "configuration", classification: "removal-candidate", owner: "Legacy map configuration", targetMilestone: 29, note: "Creates runtime effects while authoring the shipped map." },
	{ path: "src/item/officialItems.ts", symbol: "official item effect helpers", kind: "construction", classification: "removal-candidate", owner: "Legacy item configuration", targetMilestone: 30, note: "Constructs effect classes directly for official item behavior." },
	{ path: "src/engine/Handler.ts", symbol: "simulateTurn/fromSettings", kind: "deserialization", classification: "runtime-factory", owner: "Handler runtime boundary", targetMilestone: 28, note: "Restores isolated handlers from canonical snapshots; construction is internal runtime work." },
	{ path: "src/server/gameRegistry.ts", symbol: "restoreHandler", kind: "deserialization", classification: "adapter", owner: "Authoritative server restoration", targetMilestone: 35, note: "Restores persisted snapshots at the server boundary." },
	{ path: "src/replay/player.ts", symbol: "ReplayPlayer", kind: "deserialization", classification: "adapter", owner: "Replay platform boundary", targetMilestone: 35, note: "Builds a handler to play a validated replay document." },
	{ path: "src/main.ts", symbol: "browser startup handler construction", kind: "construction", classification: "adapter", owner: "Browser bootstrap", targetMilestone: 36, note: "Legacy startup path remains pending scene/bootstrap migration." },
];

export function classifySourcePath(path: string): SdkMigrationEntry | undefined {
	const normalized = path.replaceAll("\\", "/");
	return sourceClassificationRules.find(rule => normalized === rule.path || normalized.startsWith(rule.path))
}

export function validateMigrationInventory(): void {
	if (SDK_MIGRATION_INVENTORY_VERSION !== 1) throw new Error("Unsupported SDK migration inventory version");
	const classifications = new Set<SdkMigrationClassification>(["engine-sdk", "kore-sdk", "runtime-factory", "adapter", "removal-candidate"]);
	for (const entry of sourceClassificationRules) {
		if (!entry.path.startsWith("src/") || !entry.path.endsWith("/") && !entry.path.endsWith(".ts")) throw new Error(`Invalid inventory path '${entry.path}'`);
		if (!classifications.has(entry.classification) || entry.owner.trim() === "" || entry.note.trim() === "") throw new Error(`Malformed inventory entry '${entry.path}'`);
		if (entry.targetMilestone !== null && (!Number.isSafeInteger(entry.targetMilestone) || entry.targetMilestone < 27)) throw new Error(`Invalid target milestone for '${entry.path}'`);
	}
	for (const path of legacyAuthoringPaths) {
		if (!path.path.startsWith("src/") || path.symbol.trim() === "" || path.note.trim() === "") throw new Error(`Malformed legacy path '${path.path}'`);
		if (!classifications.has(path.classification)) throw new Error(`Unknown legacy path classification '${path.path}'`);
	}
}

import { DOCUMENT_SCHEMA_VERSION, loadMapDocument, type MapDocument } from "../contracts/documents.js";
import type { GameSettings } from "../settings/settings.js";
import { createCueClashMap } from "../settings/cueClashMap.js";
import { createFrostbiteArenaMap } from "../settings/frostbiteArenaMap.js";
import { createHazardControlMap } from "../settings/hazardControlMap.js";
import { createMagmaCradleMap } from "../settings/magmaCradleMap.js";
import { createStructureControlMap } from "../settings/structureControlMap.js";
import { createSymmetricDuelMap } from "../settings/symmetricDuelMap.js";
import { createAuroraBasinMap } from "./maps/aurora-basin.js";
import { createEmberCrossingMap } from "./maps/ember-crossing.js";
import { createLanternGatesMap } from "./maps/lantern-gates.js";

/**
 * Authoritative inventory of every shipped and Section 17 candidate map
 * (Task 17.2). The catalog is the single source for stable map IDs,
 * qualification status, and loading through the validated map loader.
 * Qualification statuses follow `docs/map-design-contract.md`.
 */

export const MAP_CATALOG_SCHEMA_VERSION = 1;

export type MapSymmetry = "symmetric" | "asymmetric";
export type MapQualificationStatus =
	| "candidate"
	| "technically-qualified"
	| "browser-qualified"
	| "human-qualified"
	| "blocked"
	| "rejected";

export interface MapCatalogEntry {
	/** Stable map ID used by the registry, qualification harness, and browser selection. */
	id: string;
	/** Display name. */
	name: string;
	/** Source file path that defines the map. */
	source: string;
	/** Map document schema version, or "template" for the engine-template map. */
	schemaVersion: number | "template";
	/** World dimensions, or "scalable" when the factory accepts any positive world size. */
	worldSize: { x: number; y: number } | "scalable";
	/** Explicit symmetry classification required by the design contract. */
	symmetry: MapSymmetry;
	/** Number of configured team spawn regions in the map data. */
	spawnRegionCount: number;
	/** Number of arena-geometry structures (excluding hazard zones). */
	structureCount: number;
	/** Number of hazard zones (document hazards or template deadly structures). */
	hazardCount: number;
	/** Declarative hazard types configured in the map data. */
	hazardTypes: string[];
	/** Friction preset name from `FRICTION_TABLE`, or the raw friction settings. */
	friction: string;
	/** Per-tick drift steering blend (0..1). */
	drift: number;
	/** Supported team layouts (team counts). */
	teamLayouts: number[];
	/** Supported figures-per-team layouts. */
	figuresPerTeam: number[];
	/** Whether the production browser selection path can currently expose the map. */
	browserAvailable: boolean;
	/**
	 * Whether an autonomous KI-vs-KI battle terminates on this map with the
	 * stock hard AI. Maps whose geometry blocks every AI kill route (e.g. a
	 * wall sealing all direct lines and no hazards) stay selectable for human
	 * local play but are hidden from the battle map selection.
	 */
	battleAvailable: boolean;
	/** Current qualification status; evidence lives in `docs/map-qualification-report.md`. */
	status: MapQualificationStatus;
	/** Set only for planned Section 17 candidates whose source file does not exist yet. */
	plannedSource?: string;
	/** Known limitations recorded alongside the status. */
	knownLimitations: string[];
}

const WORLD = { x: 800, y: 450 };

function countArenaGeometry(map: MapDocument): number { return map.arenaGeometry.length; }

const cueClash = createCueClashMap(WORLD);
const frostbite = createFrostbiteArenaMap(WORLD);
const magma = createMagmaCradleMap(WORLD);
const aurora = createAuroraBasinMap(WORLD);
const lantern = createLanternGatesMap(WORLD);
const ember = createEmberCrossingMap(WORLD);

export const MAP_CATALOG: readonly MapCatalogEntry[] = [
	{
		id: "ice-map-v1",
		name: "Ice Map",
		source: "src/settings/iceMap.ts (template) + src/settings/canonicalPlayableMatch.ts",
		schemaVersion: "template",
		worldSize: { x: 800, y: 450 },
		symmetry: "symmetric",
		spawnRegionCount: 2,
		structureCount: 7,
		hazardCount: 6,
		hazardTypes: ["deadly-obstacle-circles"],
		friction: "ice",
		drift: 0,
		teamLayouts: [2],
		figuresPerTeam: [1, 2, 6],
		browserAvailable: true,
	battleAvailable: true,
		status: "browser-qualified",
		knownLimitations: [
			"Shipped local-match arena; browser-qualified by the 17.8 E2E evidence",
			"Deadly obstacle circles sit at corners and top/bottom center",
			"Kill routes via obstacle or containment elimination; some corridors are narrow (Section 16.4)",
		],
	},
	{
		id: "cue-clash",
		name: "Cue Clash",
		source: "src/settings/cueClashMap.ts",
		schemaVersion: DOCUMENT_SCHEMA_VERSION,
		worldSize: "scalable",
		symmetry: "symmetric",
		spawnRegionCount: cueClash.spawnRegions.length,
		structureCount: countArenaGeometry(cueClash), // includes the containment rect and perimeter walls
		hazardCount: cueClash.hazards.length,
		hazardTypes: ["kill-zone"],
		friction: "billiards",
		drift: 0,
		teamLayouts: [2],
		figuresPerTeam: [1, 2, 6],
		browserAvailable: true,
	battleAvailable: true,
		status: "browser-qualified",
		knownLimitations: [
			"Browser-qualified by the 17.8 E2E evidence; selectable in the production menu",
			"The center kill zone and continuous perimeter walls create both hazard and rebound routes",
		],
	},
	{
		id: "frostbite-arena",
		name: "Frostbite Arena",
		source: "src/settings/frostbiteArenaMap.ts",
		schemaVersion: DOCUMENT_SCHEMA_VERSION,
		worldSize: "scalable",
		symmetry: "symmetric",
		spawnRegionCount: frostbite.spawnRegions.length,
		structureCount: countArenaGeometry(frostbite), // includes the containment rect and perimeter walls
		hazardCount: frostbite.hazards.length,
		hazardTypes: ["kill-zone"],
		friction: "ice",
		drift: 1,
		teamLayouts: [2],
		figuresPerTeam: [1, 2, 6],
		browserAvailable: false,
	battleAvailable: false,
		status: "blocked",
		knownLimitations: [
			"Blocked-from-selection in the gameplay content registry; expected blocked by the 17.7 matrix (Section 13 solver failure)",
			"Forced drift blend 1.0 makes steering fully speed-preserving; extreme low friction",
		],
	},
	{
		id: "magma-cradle",
		name: "Magma Cradle",
		source: "src/settings/magmaCradleMap.ts",
		schemaVersion: DOCUMENT_SCHEMA_VERSION,
		worldSize: "scalable",
		symmetry: "symmetric",
		spawnRegionCount: magma.spawnRegions.length,
		structureCount: countArenaGeometry(magma), // includes the containment rect and internal volcanic walls
		hazardCount: magma.hazards.length,
		hazardTypes: ["force", "kill-zone"],
		friction: "tiles",
		drift: 0,
		teamLayouts: [2],
		figuresPerTeam: [1, 2, 6],
		browserAvailable: true,
	battleAvailable: true,
		status: "browser-qualified",
		knownLimitations: [
			"Browser-qualified by the 17.8 E2E evidence; selectable in the production menu",
			"Force vents (west/east) and lethal lava kill zones (north/south)",
			"Stock hard AI may not seek lethal hazards; terminal-path evidence needs a hazard policy (17.6)",
		],
	},
	{
		id: "symmetric-duel",
		name: "Symmetric Duel",
		source: "src/settings/symmetricDuelMap.ts",
		schemaVersion: DOCUMENT_SCHEMA_VERSION,
		worldSize: "scalable",
		symmetry: "symmetric",
		spawnRegionCount: 2,
		structureCount: 6,
		hazardCount: 1,
		hazardTypes: ["kill-zone"],
		friction: "ice",
		drift: 0,
		teamLayouts: [2],
		figuresPerTeam: [1],
		browserAvailable: true,
	battleAvailable: false,
		status: "browser-qualified",
		knownLimitations: [
			"A continuous perimeter and central wall block every straight first-turn line; the center kill zone remains the direct terminal route.",
			"Not selectable for KI battles: the stock hard AI cannot terminate reliably on this map, so the battle map selection hides it.",
		],
	},
	{
		id: "structure-control",
		name: "Structure Control",
		source: "src/settings/structureControlMap.ts",
		schemaVersion: DOCUMENT_SCHEMA_VERSION,
		worldSize: "scalable",
		symmetry: "symmetric",
		spawnRegionCount: 2,
		structureCount: 10,
		hazardCount: 1,
		hazardTypes: ["kill-zone"],
		friction: "billiards",
		drift: 0,
		teamLayouts: [2],
		figuresPerTeam: [1],
		browserAvailable: true,
	battleAvailable: true,
		status: "browser-qualified",
		knownLimitations: ["The continuous perimeter, four mirrored columns, and central blocker seal the direct spawn corridor; the center kill zone provides the terminal route."],
	},
	{
		id: "hazard-control",
		name: "Hazard Control",
		source: "src/settings/hazardControlMap.ts",
		schemaVersion: DOCUMENT_SCHEMA_VERSION,
		worldSize: "scalable",
		symmetry: "symmetric",
		spawnRegionCount: 2,
		structureCount: 5,
		hazardCount: 5,
		hazardTypes: ["kill-zone"],
		friction: "tiles",
		drift: 0,
		teamLayouts: [2],
		figuresPerTeam: [1],
		browserAvailable: true,
	battleAvailable: true,
		status: "browser-qualified",
		knownLimitations: [
			"Two mirrored kill zones guard the center corridor: every straight crossing is self-eliminating, and the opponent is protected behind its own zone",
			"The continuous perimeter rebounds strong shots; lethal edge pockets preserve the verified wall-pressure terminal route",
			"Stock easy AI plays a random walk and terminates matches via wall contact; hazard terminal-path evidence comes from the deterministic fixtures (17.6)",
		],
	},
	{
		id: "aurora-basin",
		name: "Aurora Basin",
		source: "src/content/maps/aurora-basin.ts",
		schemaVersion: DOCUMENT_SCHEMA_VERSION,
		worldSize: { x: 800, y: 450 },
		symmetry: "symmetric",
		spawnRegionCount: aurora.spawnRegions.length,
		structureCount: aurora.arenaGeometry.length,
		hazardCount: aurora.hazards.length,
		hazardTypes: ["kill-zone"],
		friction: "ice",
		drift: 0,
		teamLayouts: [2],
		figuresPerTeam: [1],
		browserAvailable: true,
		battleAvailable: true,
		status: "browser-qualified",
		knownLimitations: ["Two central islands flank a lethal center circle; broad north and south lanes preserve alternate approaches."],
	},
	{
		id: "lantern-gates",
		name: "Lantern Gates",
		source: "src/content/maps/lantern-gates.ts",
		schemaVersion: DOCUMENT_SCHEMA_VERSION,
		worldSize: { x: 800, y: 450 },
		symmetry: "symmetric",
		spawnRegionCount: lantern.spawnRegions.length,
		structureCount: lantern.arenaGeometry.length,
		hazardCount: lantern.hazards.length,
		hazardTypes: ["kill-zone"],
		friction: "billiards",
		drift: 0,
		teamLayouts: [2],
		figuresPerTeam: [1],
		browserAvailable: true,
		battleAvailable: true,
		status: "browser-qualified",
		knownLimitations: ["The lethal center circle is enclosed by left, right, and top walls; its only entrance is from the bottom lane."],
	},
	{
		id: "ember-crossing",
		name: "Ember Crossing",
		source: "src/content/maps/ember-crossing.ts",
		schemaVersion: DOCUMENT_SCHEMA_VERSION,
		worldSize: { x: 800, y: 450 },
		symmetry: "symmetric",
		spawnRegionCount: ember.spawnRegions.length,
		structureCount: ember.arenaGeometry.length,
		hazardCount: ember.hazards.length,
		hazardTypes: ["kill-zone"],
		friction: "tiles",
		drift: 0,
		teamLayouts: [2],
		figuresPerTeam: [1],
		browserAvailable: true,
		battleAvailable: true,
		status: "browser-qualified",
		knownLimitations: ["Center hazards punish straight crossings; the outer lanes remain safe recovery routes."],
	},
];

/**
 * Deliberate final-release roster. Source-present maps that are not browser
 * qualified (currently Frostbite Arena) remain available to qualification and
 * diagnostics but cannot enter production map selection.
 */
// Keep the complete catalog available for qualification and future iteration,
// but expose only the currently polished map through production "store"
// surfaces. Adding the next map is an explicit release-roster change.
export const FINAL_RELEASE_MAP_IDS = ["magma-cradle"] as const;

export function getFinalReleaseMapEntries(forBattle = false): readonly MapCatalogEntry[] {
	return MAP_CATALOG.filter(entry => FINAL_RELEASE_MAP_IDS.includes(entry.id as typeof FINAL_RELEASE_MAP_IDS[number]) && (!forBattle || entry.battleAvailable));
}

/** Looks up a catalog entry by stable map ID; unknown IDs are rejected. */
export function getMapCatalogEntry(mapId: string): MapCatalogEntry {
	const entry = MAP_CATALOG.find(candidate => candidate.id === mapId);
	if (!entry) throw new Error(`Unknown map catalog ID: ${mapId}`);
	return entry;
}

/** True for entries whose source file exists and can be loaded today. */
export function isMapLoadable(mapId: string): boolean {
	const entry = getMapCatalogEntry(mapId);
	return entry.plannedSource === undefined;
}

const mapFactories: Record<string, (worldSize: { x: number; y: number }) => MapDocument> = {
	"cue-clash": createCueClashMap,
	"frostbite-arena": createFrostbiteArenaMap,
	"hazard-control": createHazardControlMap,
	"magma-cradle": createMagmaCradleMap,
	"structure-control": createStructureControlMap,
	"symmetric-duel": createSymmetricDuelMap,
	"aurora-basin": createAuroraBasinMap,
	"lantern-gates": createLanternGatesMap,
	"ember-crossing": createEmberCrossingMap,
};

/** Loads a catalog map into validated engine settings through the shared loader. */
export function buildMapSettings(mapId: string, template: GameSettings): GameSettings {
	const entry = getMapCatalogEntry(mapId);
	if (entry.id === "ice-map-v1") return JSON.parse(JSON.stringify(template)) as GameSettings;
	const factory = mapFactories[entry.id];
	if (!factory) throw new Error(`Map ${mapId} is not loadable yet: ${entry.plannedSource ?? "no factory"}`);
	return loadMapDocument(factory({ ...WORLD }), template);
}

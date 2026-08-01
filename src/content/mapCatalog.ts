import { DOCUMENT_SCHEMA_VERSION, loadMapDocument, type MapDocument } from "../contracts/documents.js";
import type { GameSettings } from "../settings/settings.js";
import { createCueClashMap } from "../settings/cueClashMap.js";
import { createFrostbiteArenaMap } from "../settings/frostbiteArenaMap.js";
import { createMagmaCradleMap } from "../settings/magmaCradleMap.js";
import { createSymmetricDuelMap } from "../settings/symmetricDuelMap.js";

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
		status: "candidate",
		knownLimitations: [
			"Shipped local-match arena; Section 17 qualification evidence pending the Task 17.3 harness and 17.7 matrix",
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
		structureCount: countArenaGeometry(cueClash), // includes the containment rect (8)
		hazardCount: cueClash.hazards.length,
		hazardTypes: [],
		friction: "billiards",
		drift: 0,
		teamLayouts: [2],
		figuresPerTeam: [1, 2, 6],
		browserAvailable: false,
		status: "candidate",
		knownLimitations: [
			"Blocked-from-selection in the gameplay content registry; selection evidence pending the 17.7 matrix and 17.8 browser run",
			"No declarative hazards; terminal pressure is containment and obstacle elimination",
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
		structureCount: countArenaGeometry(frostbite), // includes the containment rect (8)
		hazardCount: frostbite.hazards.length,
		hazardTypes: [],
		friction: "ice",
		drift: 1,
		teamLayouts: [2],
		figuresPerTeam: [1, 2, 6],
		browserAvailable: false,
		status: "candidate",
		knownLimitations: [
			"Blocked-from-selection in the gameplay content registry; selection evidence pending the 17.7 matrix and 17.8 browser run",
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
		structureCount: countArenaGeometry(magma), // includes the containment rect (8)
		hazardCount: magma.hazards.length,
		hazardTypes: ["force", "kill-zone"],
		friction: "tiles",
		drift: 0,
		teamLayouts: [2],
		figuresPerTeam: [1, 2, 6],
		browserAvailable: false,
		status: "candidate",
		knownLimitations: [
			"Blocked-from-selection in the gameplay content registry; selection evidence pending the 17.7 matrix and 17.8 browser run",
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
		structureCount: 2,
		hazardCount: 0,
		hazardTypes: [],
		friction: "ice",
		drift: 0,
		teamLayouts: [2],
		figuresPerTeam: [1],
		browserAvailable: false,
		status: "candidate",
		knownLimitations: ["One containment rect plus one central wall; the central wall blocks every straight first-turn line, so early elimination is only reachable through banked or flanking shots."],
	},
	{
		id: "structure-control",
		name: "Structure Control",
		source: "src/settings/structureControlMap.ts",
		schemaVersion: DOCUMENT_SCHEMA_VERSION,
		worldSize: "scalable",
		symmetry: "symmetric",
		spawnRegionCount: 2,
		structureCount: 0,
		hazardCount: 0,
		hazardTypes: [],
		friction: "billiards",
		drift: 0,
		teamLayouts: [2],
		figuresPerTeam: [1],
		browserAvailable: false,
		status: "candidate",
		plannedSource: "src/settings/structureControlMap.ts (Task 17.5)",
		knownLimitations: ["Planned Section 17 candidate; created and verified by Task 17.5"],
	},
	{
		id: "hazard-control",
		name: "Hazard Control",
		source: "src/settings/hazardControlMap.ts",
		schemaVersion: DOCUMENT_SCHEMA_VERSION,
		worldSize: "scalable",
		symmetry: "symmetric",
		spawnRegionCount: 2,
		structureCount: 0,
		hazardCount: 2,
		hazardTypes: ["kill-zone"],
		friction: "tiles",
		drift: 0,
		teamLayouts: [2],
		figuresPerTeam: [1],
		browserAvailable: false,
		status: "candidate",
		plannedSource: "src/settings/hazardControlMap.ts (Task 17.6)",
		knownLimitations: ["Planned Section 17 candidate; created and verified by Task 17.6"],
	},
];

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
	"magma-cradle": createMagmaCradleMap,
	"symmetric-duel": createSymmetricDuelMap,
};

/** Loads a catalog map into validated engine settings through the shared loader. */
export function buildMapSettings(mapId: string, template: GameSettings): GameSettings {
	const entry = getMapCatalogEntry(mapId);
	if (entry.id === "ice-map-v1") return JSON.parse(JSON.stringify(template)) as GameSettings;
	const factory = mapFactories[entry.id];
	if (!factory) throw new Error(`Map ${mapId} is not loadable yet: ${entry.plannedSource ?? "no factory"}`);
	return loadMapDocument(factory({ ...WORLD }), template);
}

import { validateAnimationSettings, validatePresentationEvent, type AnimationSettings, type PresentationEvent } from "../engine/presentation-sdk/index.js";
import { loadMapDocument, validateMapDocument, type MapDocument } from "../contracts/documents.js";
import { validateItemDocument, type ItemDocument } from "../item/types.js";
import { ItemValidator } from "../item/validate.js";
import { validateItemEconomySettings, type GameModeSettings } from "../rules/types.js";
import { validateGameSettings, type GameSettings } from "../settings/settings.js";

export const CONTENT_PACKAGE_SCHEMA_VERSION = 1;
export const CONTENT_PACKAGE_MAX_DEPENDENCIES = 32;
export const CONTENT_PACKAGE_MAX_DOCUMENTS = 256;

export interface ContentPackageDependency { id: string; version: string }
export interface ContentPackageManifest {
	id: string;
	name: string;
	version: string;
	dependencies?: ContentPackageDependency[];
}

export interface ContentUiMetadata {
	labels?: Record<string, string>;
	icons?: Record<string, string>;
	menu?: { route: string; label: string; order: number }[];
}

export interface ContentAudioDeclaration {
	sounds?: Record<string, { asset: string; bus?: string }>;
	music?: Record<string, { asset: string; bus?: string }>;
}

export interface ContentPresentationDeclaration {
	animations?: AnimationSettings[];
	events?: PresentationEvent[];
}

export interface ContentPackage {
	schemaVersion: 1;
	manifest: ContentPackageManifest;
	maps?: MapDocument[];
	items?: ItemDocument[];
	modes?: GameModeSettings[];
	ui?: ContentUiMetadata;
	audio?: ContentAudioDeclaration;
	presentation?: ContentPresentationDeclaration;
}

export interface LoadedContentPackage {
	readonly package: ContentPackage;
	readonly hash: string;
}

const ITEM_EFFECTS = ["modifyForce", "modifyRotation", "lockRotation", "applyTorque", "spawnTrigger", "delayedEffect", "shield", "swapPosition", "ghostMode", "magnet", "selectionLock", "aimVariance", "temporalModifier", "structureLifecycle"] as const;
const EXECUTABLE_KEYS = new Set(["constructor", "prototype", "__proto__", "code", "script", "function", "source", "module", "import", "require", "eval", "execute", "handler", "callback"]);
const MODULE_SCHEMES = /^(?:[a-z]+:|[./\\]|@)/i;

/** Validates a complete package and returns no runtime objects. */
export function validateContentPackage(value: unknown): asserts value is ContentPackage {
	assertJson(value, "package");
	const pkg = value as Record<string, unknown>;
	assertKeys(pkg, ["schemaVersion", "manifest", "maps", "items", "modes", "ui", "audio", "presentation"], "package");
	if (pkg.schemaVersion !== CONTENT_PACKAGE_SCHEMA_VERSION) throw new Error(`Unsupported content package schema version: ${String(pkg.schemaVersion)}`);
	validateManifest(pkg.manifest);
	const maps = arrayOf(pkg.maps, "maps");
	const items = arrayOf(pkg.items, "items");
	const modes = arrayOf(pkg.modes, "modes");
	const ids = new Set<string>();
	for (const map of maps) { validateMapDocument(map); assertKeys(map as unknown as Record<string, unknown>, ["schemaVersion", "metadata", "worldSize", "friction", "drift", "arenaGeometry", "spawnRegions", "hazards", "environmentalMechanics"], "map"); assertKeys(map.metadata as unknown as Record<string, unknown>, ["id", "name", "description"], "map metadata"); unique(ids, map.metadata.id, "map"); }
	const itemValidator = new ItemValidator();
	for (const effect of ITEM_EFFECTS) itemValidator.registerEffectType(effect);
	for (const item of items) { validateItemDocument(item); assertKeys(item as unknown as Record<string, unknown>, ["schemaVersion", "id", "name", "description", "type", "effects", "targetType", "duration", "useLimit", "targetValidation", "cooldown", "interaction"], "item"); itemValidator.validate(item); unique(ids, item.id, "item"); }
	for (const mode of modes) { validateMode(mode); unique(ids, mode.id, "mode"); }
	if (pkg.ui !== undefined) validateUi(pkg.ui);
	if (pkg.audio !== undefined) validateAudio(pkg.audio);
	if (pkg.presentation !== undefined) validatePresentation(pkg.presentation);
	validateReferences(items as ItemDocument[], modes as GameModeSettings[], pkg.presentation as ContentPresentationDeclaration | undefined);
	if (maps.length + items.length + modes.length > CONTENT_PACKAGE_MAX_DOCUMENTS) throw new Error("Content package contains too many documents");
}

/** Loads a package into detached SDK documents; no module or runtime loading occurs. */
export function loadContentPackage(value: unknown): LoadedContentPackage {
	validateContentPackage(value);
	const detached = normalize(value) as ContentPackage;
	return { package: structuredClone(detached), hash: hashCanonicalJson(canonicalize(detached)) };
}

/**
 * Resolves a validated map document into engine settings by overlaying its
 * world size, physics, geometry, spawn regions, hazards, and environmental
 * mechanics on a canonical template roster. The template is never mutated;
 * the returned settings are fully detached.
 */
export function resolveMapDocument(map: MapDocument, template: GameSettings): GameSettings {
	validateMapDocument(map);
	validateGameSettings(template);
	return loadMapDocument(map, structuredClone(template));
}

/** Canonical JSON uses sorted object keys and ID-sorted package collections. */
export function canonicalizeContentPackage(value: unknown): string {
	validateContentPackage(value);
	return JSON.stringify(canonicalize(normalize(value)));
}

export function hashContentPackage(value: unknown): string {
	return hashCanonicalJson(JSON.parse(canonicalizeContentPackage(value)) as unknown);
}

function validateManifest(value: unknown): asserts value is ContentPackageManifest {
	if (!isRecord(value) || typeof value.id !== "string" || !validId(value.id) || typeof value.name !== "string" || !value.name || typeof value.version !== "string" || !validVersion(value.version)) throw new Error("Malformed content package manifest");
	assertKeys(value, ["id", "name", "version", "dependencies"], "manifest");
	const dependencies = arrayOf(value.dependencies, "manifest dependencies");
	if (dependencies.length > CONTENT_PACKAGE_MAX_DEPENDENCIES) throw new Error("Content package has too many dependencies");
	const seen = new Set<string>();
	for (const dependency of dependencies) {
		if (!isRecord(dependency) || typeof dependency.id !== "string" || !validId(dependency.id) || typeof dependency.version !== "string" || !validVersion(dependency.version)) throw new Error("Malformed content package dependency");
		if (seen.has(dependency.id)) throw new Error(`Duplicate dependency '${dependency.id}'`);
		seen.add(dependency.id);
	}
}

function validateMode(value: unknown): asserts value is GameModeSettings {
	if (!isRecord(value) || value.schemaVersion !== undefined && value.schemaVersion !== 1 || typeof value.id !== "string" || !validId(value.id) || !Array.isArray(value.phases) || typeof value.maxItemsPerTurn !== "number" || !Number.isSafeInteger(value.maxItemsPerTurn) || value.maxItemsPerTurn < 0 || value.winCondition !== "last-team-standing") throw new Error("Malformed content package mode");
	assertKeys(value, ["schemaVersion", "id", "phases", "maxItemsPerTurn", "winCondition", "itemEconomy"], "mode");
	if (value.phases.length === 0 || !value.phases.every(phase => typeof phase === "string")) throw new Error("Malformed content package mode phases");
	validateItemEconomySettings(value.itemEconomy);
}

function validateUi(value: unknown): asserts value is ContentUiMetadata {
	if (!isRecord(value)) throw new Error("Malformed UI metadata");
	assertKeys(value, ["labels", "icons", "menu"], "UI metadata");
	for (const key of ["labels", "icons"] as const) if (value[key] !== undefined && (!isRecord(value[key]) || Object.entries(value[key] as Record<string, unknown>).some(([id, text]) => !validId(id) || typeof text !== "string"))) throw new Error("UI metadata must contain string maps");
	if (value.menu !== undefined) for (const entry of arrayOf(value.menu, "UI menu")) if (!isRecord(entry) || typeof entry.route !== "string" || !validId(entry.route) || typeof entry.label !== "string" || !entry.label || !Number.isSafeInteger(entry.order)) throw new Error("Malformed UI menu entry");
}

function validateAudio(value: unknown): asserts value is ContentAudioDeclaration {
	if (!isRecord(value)) throw new Error("Malformed audio declarations");
	assertKeys(value, ["sounds", "music"], "audio declarations");
	for (const key of ["sounds", "music"] as const) if (value[key] !== undefined) for (const [id, declaration] of Object.entries(value[key] as Record<string, unknown>)) {
		if (!validId(id) || !isRecord(declaration) || typeof declaration.asset !== "string" || !safeAsset(declaration.asset) || (declaration.bus !== undefined && (typeof declaration.bus !== "string" || !validId(declaration.bus)))) throw new Error("Malformed audio declaration");
		assertKeys(declaration, ["asset", "bus"], "audio declaration");
	}
}

function validatePresentation(value: unknown): asserts value is ContentPresentationDeclaration {
	if (!isRecord(value)) throw new Error("Malformed presentation declarations");
	assertKeys(value, ["animations", "events"], "presentation declarations");
	for (const animation of arrayOf(value.animations, "animations")) validateAnimationSettings(animation);
	for (const event of arrayOf(value.events, "presentation events")) validatePresentationEvent(event);
}

function validateReferences(items: ItemDocument[], modes: GameModeSettings[], presentation?: ContentPresentationDeclaration): void {
	const itemIds = new Set(items.map(item => item.id));
	for (const mode of modes) {
		const refs = [...mode.itemEconomy.fixedLoadouts.flatMap(loadout => loadout.items.map(item => item.itemId)), ...mode.itemEconomy.mapPickups.map(pickup => pickup.itemId), ...(mode.itemEconomy.randomDraw?.itemIds ?? []), ...(mode.itemEconomy.mysteryBox?.candidatePool ?? [])];
		if (refs.some(id => !itemIds.has(id))) throw new Error("Content package references an unknown item");
	}
	const animationIds = new Set((presentation?.animations ?? []).map(animation => animation.id));
	for (const event of presentation?.events ?? []) if (event.type === "play" && !animationIds.has(event.animationId!)) throw new Error("Content package references an unknown animation");
}

function normalize(value: unknown): unknown {
	const copy = structuredClone(value) as Record<string, unknown>;
	for (const key of ["maps", "items", "modes"] as const) if (Array.isArray(copy[key])) copy[key] = [...copy[key] as unknown[]].sort((a, b) => collectionId(a).localeCompare(collectionId(b)));
	if (isRecord(copy.manifest) && Array.isArray(copy.manifest.dependencies)) copy.manifest.dependencies = [...copy.manifest.dependencies].sort((a, b) => String((a as Record<string, unknown>).id).localeCompare(String((b as Record<string, unknown>).id)));
	return copy;
}

function canonicalize(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(canonicalize);
	if (isRecord(value)) return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalize(value[key])]));
	return value;
}

function assertJson(value: unknown, path: string): void {
	if (value === null || typeof value === "string" || typeof value === "boolean") return;
	if (typeof value === "number") { if (!Number.isFinite(value)) throw new Error(`Malformed JSON value at ${path}`); return; }
	if (Array.isArray(value)) { value.forEach((entry, index) => assertJson(entry, `${path}[${index}]`)); return; }
	if (!isRecord(value)) throw new Error(`Malformed JSON value at ${path}`);
	for (const [key, entry] of Object.entries(value)) { if (EXECUTABLE_KEYS.has(key.toLowerCase()) || key.includes("/") || key.includes("\\")) throw new Error(`Executable or module field '${key}' is not allowed`); assertJson(entry, `${path}.${key}`); }
}
function assertKeys(value: Record<string, unknown>, allowed: string[], label: string): void { for (const key of Object.keys(value)) if (!allowed.includes(key)) throw new Error(`Unknown ${label} field '${key}'`); }
function arrayOf(value: unknown, label: string): unknown[] { if (value === undefined) return []; if (!Array.isArray(value)) throw new Error(`${label} must be an array`); return value; }
function unique(ids: Set<string>, id: string, category: string): void { if (!validId(id) || ids.has(id)) throw new Error(`Duplicate or invalid ${category} ID '${id}'`); ids.add(id); }
function validId(value: string): boolean { return /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value); }
function validVersion(value: string): boolean { return /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/.test(value); }
function safeAsset(value: string): boolean { return value.length <= 512 && !MODULE_SCHEMES.test(value) && !/[<>\s]/.test(value) && !value.toLowerCase().startsWith("data:"); }
function isRecord(value: unknown): value is Record<string, any> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function collectionId(value: unknown): string { const record = value as Record<string, unknown>; const metadata = record.metadata as Record<string, unknown> | undefined; return String(record.id ?? metadata?.id ?? ""); }

// FNV-1a over canonical UTF-8 is intentionally dependency-free for browser SDKs.
function hashCanonicalJson(value: unknown): string {
	const text = JSON.stringify(value);
	let high = 0xcbf29ce4, low = 0x84222325;
	for (const byte of new TextEncoder().encode(text)) { low ^= byte; const oldLow = low; low = Math.imul(low, 0x1b3); high = Math.imul(high, 0x1b3) + Math.imul(oldLow >>> 0, 0x1000000) | 0; }
	return `${(high >>> 0).toString(16).padStart(8, "0")}${(low >>> 0).toString(16).padStart(8, "0")}`;
}

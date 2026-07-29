export const EDITOR_DRAFT_STORAGE_KEY = "slipstrike.editor.draft";

/** Validates the standalone editor document before it crosses the draft-storage boundary. */
export function validateEditorMapDocument(document) {
	if (!isRecord(document) || document.schemaVersion !== 1 || typeof document.name !== "string" || !isBackground(document.background) || !isScreenResolution(document.screenResolution)) throw new Error("Invalid editor map document");
	if (!isFriction(document.friction) || !isNonNegativeFinite(document.drift) || document.drift > 1) throw new Error("Invalid editor map physics");
	if (!Array.isArray(document.mapBoundarys) || !Array.isArray(document.holes) || !Array.isArray(document.players) || !Array.isArray(document.items) || !Array.isArray(document.effects)) throw new Error("Invalid editor map collections");
	if (!document.mapBoundarys.every(isWall) || !document.holes.every(isHole) || !document.players.every(isPlayer)) throw new Error("Invalid editor map geometry");
	if (!document.items.every(isItem) || !hasUniqueIds(document.items) || !document.effects.every(isHazard) || !hasUniqueIds(document.effects)) throw new Error("Invalid editor map collection entry");
	if (!isMode(document.mode) || !isAi(document.ai)) throw new Error("Invalid editor map configuration");
}

export function saveEditorDraft(mapData, storage = getBrowserStorage()) {
	validateEditorMapDocument(mapData);
	if (!storage) return false;
	try {
		storage.setItem(EDITOR_DRAFT_STORAGE_KEY, JSON.stringify(mapData));
		return true;
	} catch {
		return false;
	}
}

export function restoreEditorDraft(mapData, storage = getBrowserStorage()) {
	if (!storage) return false;
	try {
		const serialized = storage.getItem(EDITOR_DRAFT_STORAGE_KEY);
		if (serialized === null) return false;
		const draft = JSON.parse(serialized);
		validateEditorMapDocument(draft);
		for (const key of Object.keys(mapData)) delete mapData[key];
		Object.assign(mapData, draft);
		return true;
	} catch {
		return false;
	}
}

function getBrowserStorage() {
	try {
		return globalThis.localStorage ?? null;
	} catch {
		return null;
	}
}

function isRecord(value) { return typeof value === "object" && value !== null; }
function isNonNegativeFinite(value) { return typeof value === "number" && Number.isFinite(value) && value >= 0; }
function isPositiveFinite(value) { return isNonNegativeFinite(value) && value > 0; }
function isPositiveInteger(value) { return typeof value === "number" && Number.isSafeInteger(value) && value > 0; }
function isVector(value) { return isRecord(value) && Number.isFinite(value.x) && Number.isFinite(value.y); }
function isBackground(value) { return value === null || (isRecord(value) && value.type === "image" && typeof value.url === "string"); }
function isScreenResolution(value) { return isRecord(value) && isPositiveFinite(value.x) && isPositiveFinite(value.y) && isPositiveFinite(value.factor); }
function isFriction(value) { return isRecord(value) && [value.friction, value.linearDrag, value.stopThreshold].every(Number.isFinite); }
function isWall(value) { return isRecord(value) && value.type === "rectangle" && isVector(value) && isPositiveFinite(value.w) && isPositiveFinite(value.h) && typeof value.color === "string"; }
function isHole(value) { return isRecord(value) && value.type === "circle" && isVector(value) && isPositiveFinite(value.r) && typeof value.color === "string"; }
function isPlayer(value) { return isRecord(value) && isVector(value) && typeof value.color === "string" && Number.isSafeInteger(value.team) && value.team >= 0; }
function isItem(value) { return isRecord(value) && typeof value.id === "string" && typeof value.name === "string" && typeof value.effectType === "string" && typeof value.trigger === "string" && isFrequency(value.frequency) && isNonNegativeFinite(value.probability) && value.probability <= 100 && isSpawn(value.spawn) && (value.effectParams === undefined || isNumericRecord(value.effectParams)); }
function isFrequency(value) { return isRecord(value) && typeof value.mode === "string" && [value.intervalRounds, value.killsInterval, value.lastPlayersThreshold, value.healthThreshold, value.boostFactor].every(isNonNegativeFinite); }
function isSpawn(value) { return isRecord(value) && value.type === "points" && Array.isArray(value.points) && value.points.every(isVector) && Array.isArray(value.areas) && value.areas.every(isSpawnArea); }
function isSpawnArea(value) { return isRecord(value) && (value.shape === "circle" || value.shape === "rect") && isVector(value) && isPositiveFinite(value.radius) && isPositiveFinite(value.width) && isPositiveFinite(value.height); }
function isHazard(value) {
	if (!isRecord(value) || typeof value.id !== "string" || !isVector(value.position) || !isRecord(value.size) || !isPositiveFinite(value.size.w) || !isPositiveFinite(value.size.h) || !isRecord(value.params)) return false;
	if (value.type === "push_zone") return isNonNegativeFinite(value.params.direction) && value.params.direction <= 360 && isNonNegativeFinite(value.params.force) && value.params.force <= 5;
	if (value.type === "slide_zone") return isNonNegativeFinite(value.params.slideFactor) && value.params.slideFactor <= 2;
	if (value.type === "sticky_zone") return isNonNegativeFinite(value.params.stickFactor) && value.params.stickFactor <= 1;
	return value.type === "kill_zone" && typeof value.params.killOnTouch === "boolean";
}
function isMode(value) {
	if (!isRecord(value) || !isRecord(value.params)) return false;
	if (value.type === "last_man_standing") return [value.params.itemsEnabled, value.params.hazardsEnabled, value.params.allowTies].every(item => typeof item === "boolean");
	return value.type === "knockout_race" && isPositiveInteger(value.params.pointsToWin) && typeof value.params.respawn === "boolean" && isPositiveInteger(value.params.respawnDelay) && isPositiveInteger(value.params.maxRespawnsPerRound) && typeof value.params.itemsEnabled === "boolean" && typeof value.params.hazardsEnabled === "boolean";
}
function isAi(value) { return isRecord(value) && ["easy", "normal", "hard", "insane", "custom"].includes(value.difficulty) && [value.aggressiveness, value.riskTaking, value.itemPriority, value.hazardAwareness, value.errorRate].every(item => isNonNegativeFinite(item) && item <= 100); }
function isNumericRecord(value) { return isRecord(value) && Object.values(value).every(Number.isFinite); }
function hasUniqueIds(values) { return new Set(values.map(value => value.id)).size === values.length; }

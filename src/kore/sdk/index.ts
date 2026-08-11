import { MultiEffect } from "../../effects/effects.js";
import { EffectModifyMass } from "../../effects/modifyMass.js";
import { EffectModifySetting } from "../../effects/modifySetting.js";
import { EffectMove, type EffectMoveInput } from "../../effects/movement.js";
import { EffectPhysics } from "../../effects/physics.js";
import { EffectNumericAdd } from "../../effects/numericAdd.js";
import { EffectTrigger, EffectType, ItemEffectType, type EffectSettings, type FullEffectSettings, type ItemEffectSettings, type ModifySettingValue } from "../../effects/types.js";
import { GameHandler } from "../runtime/Handler.js";
import { GameState, type EngineSettings } from "../runtime/types.js";
import { engine, EngineSystemRegistry, type EngineFrameworkSettings } from "../../engine/sdk/index.js";
import { ui as engineUi } from "../../engine/ui-sdk/index.js";
import { createRuntimeHandler } from "../runtime/runtimeFactory.js";
import { applyRuntimeForceEffects, createRuntimeItemEffect, resolveRuntimeItemEffects } from "./itemRuntime.js";
import type { JsonValue } from "../../engine/contracts/systemSettings.js";
import { SHAPE, type StructureCollisionRole, type Vector2D } from "../../physics/physics.js";
import { DOCUMENT_SCHEMA_VERSION, type HazardDocument, type MapDocument, type MapMetadata, type MapSpawnRegion, validateMapDocument } from "../../contracts/documents.js";
import type { AssetList } from "../../assetManager/assets/assetRegistry.js";
import { createCollisionCommandBinding } from "../../engine/sdk/collisionCommand.js";
import { createEngineEffectComposition } from "../../engine/sdk/composition.js";
import { PARTICIPATION_SET_DRAWING_EFFECT_ID, PARTICIPATION_SET_PHYSICS_EFFECT_ID } from "../../engine/sdk/participationCapability.js";
import { MOVEMENT_ADD_VELOCITY_EFFECT_ID, MOVEMENT_APPLY_FORCE_TO_ENTITY_EFFECT_ID } from "../../engine/sdk/movementCapability.js";
import { TRANSFORM_SWAP_POSITION_EFFECT_ID } from "../../engine/sdk/transformCapability.js";
export { createEntityResolvedTarget, createPositionResolvedTarget, validateResolvedEffectTarget } from "../../item/resolvedTarget.js";
export type { ResolvedEffectTarget } from "../../item/resolvedTarget.js";
import { validateEnvironmentalMechanics, type EnvironmentalMechanic, type ForceField, type MovingStructure, type TimedHazard, type TriggeredZone, type EnvironmentalCycle } from "../../environment/environmental.js";
import { validateItemPickup, type InventoryItem, type ItemDocument, type ItemPickup } from "../../item/types.js";
export { TriggerDefinitionCatalog, validateTriggerDefinition } from "../../item/triggerDefinitions.js";
export type { TriggerDefinition, TriggerDefinitionDescriptor } from "../../item/triggerDefinitions.js";
import { RulePhase, WinCondition, validateItemEconomySettings, type FixedItemLoadout, type ItemEconomySettings, type MysteryBoxSettings, type SeededItemDrawSettings } from "../../rules/types.js";
import { createPlayerSettings, type PlayerSettings } from "../../entity/types.js";
import { FRICTION_TABLE, createDefaultGameSettings, type FrictionSettings, type GameSettings, type MapBoundarySettings, type MapBoundarySettingsCircle, type SettingsBackground, validateGameSettings } from "../../settings/settings.js";
import { koreAudio } from "../audio.js";
import { koreAi } from "../ai.js";
import {
	authorMatchSettings,
	createGameMode,
	createMatchDefinition,
	createMatchSystemProfile,
	createRuntimeMatch,
	validateKoreMatchDefinition,
	type KoreGameModeInput,
	type KoreMatchDefinition,
	type KoreMatchHeader,
	type KoreMatchOptions,
} from "./match.js";

type KoreEngineItemEffectSettings = { type: string; typeValue: Record<string, unknown> };
import { GAME_MODE_CATALOG_SCHEMA_VERSION, getGameModeCatalogEntry, getSelectableGameModes } from "../../rules/modeCatalog.js";
import { canonicalizeContentPackage, hashContentPackage, loadContentPackage, resolveMapDocument, validateContentPackage } from "../../content/package.js";
export { createRuntimeItemEffect, resolveRuntimeItemEffects, applyRuntimeForceEffects, type RuntimeItemEffect } from "./itemRuntime.js";


type SerializableEffect = { toSettings(): EffectSettings };
type EffectInput = SerializableEffect | EffectSettings | FullEffectSettings;
type StructureInput = MapBoundarySettings | { toSettings(): MapBoundarySettings };

/** Serializable team definition consumed by `KoreMapBuilder.addPlayerSpawn()`. */
export interface KoreTeamSettings {
	teamNr: number;
	name?: string;
	color?: string;
	/** Default figure count for this team when a spawn omits `playerCount`. */
	playerCount?: number;
}

/** A team object whose settings can be embedded in an SDK map definition. */
export interface KoreTeam { toSettings(): KoreTeamSettings }

export interface KoreSpawnSettings {
	x: number;
	y: number;
	w: number;
	h: number;
	/** Number of figures placed in this region. */
	playerCount?: number;
	teamNr?: number;
	team?: KoreTeam | KoreTeamSettings;
}

export type KoreBackground =
	| { type: "color"; color: string }
	| { type: "asset"; asset: number }
	| { type: "url"; url: string };

export interface KoreMapOptions {
	id?: string;
	name?: string;
	description?: string;
	worldSize?: Vector2D;
	friction?: FrictionSettings;
	drift?: number;
}

export interface KoreWorldEffects {
	effects: EffectInput[];
	trigger?: EffectTrigger;
	triggerValue?: [];
}

export interface KoreHazardZone {
	id: string;
	x: number;
	y: number;
	r: number;
	color?: string;
}

export interface KoreForceHazardZone extends KoreHazardZone {
	angle: number;
	power: number;
}

import { composeItemEffects, createItem, type KoreItemInput } from "../../item/sdkItemFactory.js";
export { composeItemEffects, createItem } from "../../item/sdkItemFactory.js";
export type { KoreItemInput } from "../../item/sdkItemFactory.js";

/** Input contract for authoring a canonical KORE player snapshot via `kore.createPlayer()`. */
export interface KorePlayerInput {
	id?: string;
	teamNr?: number;
	team?: number[];
	position?: Vector2D;
	velocity?: Vector2D;
	rotation?: number;
	angularVelocity?: number;
	hp?: number;
	bouncyness?: number;
	mass?: number;
	radius?: number;
	size?: number;
	friction?: number;
	color?: string;
	playericon?: AssetList;
	hoop?: AssetList;
	isPhysicsEnabled?: boolean;
	isDrawingEnabled?: boolean;
	effects?: FullEffectSettings[];
	inventory?: InventoryItem[];
}

/** Authors a detached, canonical `PlayerSettings` object with KORE defaults and structural validation. */
export function createPlayer(input: KorePlayerInput = {}): PlayerSettings {
	if (input.id !== undefined && (typeof input.id !== "string" || input.id.trim().length === 0)) {
		throw new Error("Player ID must be a non-empty string");
	}
	if (input.teamNr !== undefined) {
		if (!Number.isSafeInteger(input.teamNr) || input.teamNr < 0) {
			throw new Error("Player teamNr must be a non-negative integer");
		}
	}
	if (input.position !== undefined) {
		if (!Number.isFinite(input.position.x) || !Number.isFinite(input.position.y)) {
			throw new Error("Player position must contain finite numbers");
		}
	}
	if (input.velocity !== undefined) {
		if (!Number.isFinite(input.velocity.x) || !Number.isFinite(input.velocity.y)) {
			throw new Error("Player velocity must contain finite numbers");
		}
	}
	const radius = input.radius ?? input.size;
	if (radius !== undefined) {
		if (!Number.isFinite(radius) || radius <= 0) {
			throw new Error("Player radius must be a finite positive number");
		}
	}
	if (input.mass !== undefined) {
		if (!Number.isFinite(input.mass) || input.mass <= 0) {
			throw new Error("Player mass must be a finite positive number");
		}
	}
	if (input.hp !== undefined && !Number.isFinite(input.hp)) {
		throw new Error("Player hp must be a finite number");
	}

	const team = input.teamNr !== undefined ? [input.teamNr] : (input.team ? [...input.team] : undefined);

	return createPlayerSettings({
		...(input.id !== undefined ? { id: input.id as PlayerSettings["id"] } : {}),
		...(team !== undefined ? { team } : {}),
		...(input.position !== undefined ? { position: { x: input.position.x, y: input.position.y } } : {}),
		...(input.velocity !== undefined ? { velocity: { x: input.velocity.x, y: input.velocity.y } } : {}),
		...(input.rotation !== undefined ? { rotation: input.rotation } : {}),
		...(input.angularVelocity !== undefined ? { angularVelocity: input.angularVelocity } : {}),
		...(input.hp !== undefined ? { hp: input.hp } : {}),
		...(input.bouncyness !== undefined ? { bouncyness: input.bouncyness } : {}),
		...(input.mass !== undefined ? { mass: input.mass } : {}),
		...(radius !== undefined ? { size: radius } : {}),
		...(input.friction !== undefined ? { friction: input.friction } : {}),
		...(input.color !== undefined ? { color: input.color } : {}),
		...(input.playericon !== undefined ? { playericon: input.playericon } : {}),
		...(input.hoop !== undefined ? { hoop: input.hoop } : {}),
		...(input.isPhysicsEnabled !== undefined ? { isPhysicsEnabled: input.isPhysicsEnabled } : {}),
		...(input.isDrawingEnabled !== undefined ? { isDrawingEnabled: input.isDrawingEnabled } : {}),
		...(input.effects !== undefined ? { effects: input.effects.map(e => ({ ...e })) } : {}),
		...(input.inventory !== undefined ? { inventory: input.inventory.map(i => ({ ...i })) } : {}),
	});
}

class TeamBuilder implements KoreTeam {
	public constructor(private readonly settings: KoreTeamSettings) {
		if (!Number.isSafeInteger(settings.teamNr) || settings.teamNr < 0) throw new Error("A team number must be a non-negative integer");
		if (settings.playerCount !== undefined && (!Number.isSafeInteger(settings.playerCount) || settings.playerCount < 1)) throw new Error("A team playerCount must be a positive integer");
	}
	public toSettings(): KoreTeamSettings { return { ...this.settings }; }
}

/** Fluent builder for a complete, JSON-safe `GameSettings` map snapshot. */
export class KoreMapBuilder {
	private readonly world: ReturnType<typeof engine.createWorld>;
	private readonly teams = new Map<number, KoreTeamSettings>();
	private readonly spawns: Array<KoreSpawnSettings & { teamNr: number; playerCount: number }> = [];
	private readonly worldEffects: FullEffectSettings[] = [];
	private readonly structures: MapBoundarySettings[] = [];
	private readonly generatedHazardStructureIndexes = new Set<number>();
	private readonly hazards: HazardDocument[] = [];
	private readonly environmentalMechanics: EnvironmentalMechanic[] = [];
	private readonly items: ItemDocument[] = [];
	private readonly itemEconomy: ItemEconomySettings = { fixedLoadouts: [], mapPickups: [] };
	private background: SettingsBackground = { type: "color", color: "#dff6ff" };
	private built: GameSettings | undefined;

	public constructor(private readonly options: Required<KoreMapOptions>) {
		this.world = engine.createWorld({ id: options.id, worldSize: options.worldSize });
		this.world.setBackground(toJson(this.background));
		const containment: MapBoundarySettings = { id: `${options.id}.containment`, type: SHAPE.RECTANGLE, x: 0, y: 0, w: options.worldSize.x, h: options.worldSize.y, role: "containment", effects: [] };
		this.structures.push(containment);
		this.world.addStructure(toJson(containment));
	}

	/** Sets a solid color, generated asset key, or external HTTP(S)/same-origin image URL. */
	public addBackground(background: KoreBackground): this {
		if (background.type === "color") this.background = { type: "color", color: background.color };
		else if (background.type === "asset") this.background = { type: "image", url: background.asset };
		else {
			validateImageUrl(background.url);
			this.background = { type: "image", url: background.url };
		}
		this.world.setBackground(toJson(this.background));
		this.built = undefined;
		return this;
	}

	/** Registers a team so its name/color/default figure count can be reused by spawns. */
	public addTeam(team: KoreTeam | KoreTeamSettings): this {
		const settings = "toSettings" in team ? team.toSettings() : { ...team };
		if (!Number.isSafeInteger(settings.teamNr) || settings.teamNr < 0) throw new Error("A team number must be a non-negative integer");
		if (this.teams.has(settings.teamNr)) throw new Error(`Team ${settings.teamNr} is already registered`);
		this.teams.set(settings.teamNr, settings);
		this.built = undefined;
		return this;
	}

	/** Adds a rectangular spawn region and generates `playerCount` figures for its team during `build()`. */
	public addPlayerSpawn(spawn: KoreSpawnSettings): this {
		const teamSettings = spawn.team ? ("toSettings" in spawn.team ? spawn.team.toSettings() : spawn.team) : undefined;
		const teamNr = spawn.teamNr ?? teamSettings?.teamNr;
		if (teamNr === undefined || !Number.isSafeInteger(teamNr) || teamNr < 0) throw new Error("A spawn requires teamNr or team");
		if (teamSettings && !this.teams.has(teamNr)) this.addTeam(teamSettings);
		const playerCount = spawn.playerCount ?? this.teams.get(teamNr)?.playerCount;
		if (playerCount === undefined || !Number.isSafeInteger(playerCount) || playerCount < 1) throw new Error("A spawn requires a positive playerCount or a team playerCount");
		if (![spawn.x, spawn.y, spawn.w, spawn.h].every(Number.isFinite) || spawn.w <= 0 || spawn.h <= 0) throw new Error("Spawn bounds must be finite and positive");
		this.spawns.push({ ...spawn, teamNr, playerCount });
		if (!this.teams.has(teamNr)) this.addTeam({ teamNr, playerCount });
		this.built = undefined;
		return this;
	}

	/** Adds handler-level effects. Runtime effects are converted through their own `toSettings()` method. */
	public addWorldEffects(input: KoreWorldEffects | EffectInput[], trigger: EffectTrigger = EffectTrigger.Always): this {
		const source = Array.isArray(input) ? { effects: input, trigger } : input;
		for (const effect of source.effects) {
			const settings = toFullEffectSettings(effect, source.trigger ?? EffectTrigger.Always, source.triggerValue ?? []);
			this.worldEffects.push(settings);
			this.world.addEffect(toJson(settings));
		}
		this.built = undefined;
		return this;
	}

	/** Adds a serializable runtime structure or raw map-boundary settings. */
	public addStructure(structure: StructureInput): this {
		const settings = "toSettings" in structure ? structure.toSettings() : structure;
		const canonical = { ...settings, id: settings.id ?? `${this.options.id}.structure.${this.structures.length}` };
		this.structures.push(clone(canonical));
		this.world.addStructure(toJson(canonical));
		this.built = undefined;
		return this;
	}

	/** Adds a rectangle structure; use `role: "containment"` only for an intentional arena boundary. */
	public addRectangle(settings: { x: number; y: number; w: number; h: number; color?: string; role?: StructureCollisionRole; effects?: EffectInput[] }): this {
		return this.addStructure({ type: SHAPE.RECTANGLE, ...settings, effects: (settings.effects ?? []).map(effect => toFullEffectSettings(effect, EffectTrigger.Collision, [])) });
	}

	/** Adds a circular obstacle or hazard structure. */
	public addCircle(settings: { x: number; y: number; r: number; color?: string; role?: StructureCollisionRole; effects?: EffectInput[]; collisionCommands?: MapBoundarySettingsCircle["collisionCommands"] }): this {
		return this.addStructure({ type: SHAPE.CIRCLE, ...settings, effects: (settings.effects ?? []).map(effect => toFullEffectSettings(effect, EffectTrigger.Collision, [])) });
	}

	/** Adds a declarative lethal circular zone to the canonical map and runtime build. */
	public addKillZone(settings: KoreHazardZone): this {
		this.assertHazardZone(settings);
		this.hazards.push({ schemaVersion: DOCUMENT_SCHEMA_VERSION, id: settings.id, type: "kill-zone", trigger: { type: "collision" }, config: { x: settings.x, y: settings.y, r: settings.r, ...(settings.color === undefined ? {} : { color: settings.color }) } });
		const structureIndex = this.structures.length;
		this.addCircle({ x: settings.x, y: settings.y, r: settings.r, color: settings.color ?? "#d94b28", effects: [], collisionCommands: [createCollisionCommandBinding(createEngineEffectComposition([
			{ schemaVersion: 1, type: PARTICIPATION_SET_PHYSICS_EFFECT_ID, typeValue: { enabled: false } },
			{ schemaVersion: 1, type: PARTICIPATION_SET_DRAWING_EFFECT_ID, typeValue: { enabled: false } },
		]))] });
		this.generatedHazardStructureIndexes.add(structureIndex);
		return this;
	}

	/** Adds a declarative directional force zone to the canonical map and runtime build. */
	public addForceZone(settings: KoreForceHazardZone): this {
		this.assertHazardZone(settings);
		if (!Number.isFinite(settings.angle) || settings.angle < 0 || settings.angle >= 360 || !Number.isFinite(settings.power) || settings.power <= 0) throw new Error("Force hazard requires an angle in [0, 360) and positive power");
		const radians = settings.angle * Math.PI / 180;
		this.hazards.push({ schemaVersion: DOCUMENT_SCHEMA_VERSION, id: settings.id, type: "force", trigger: { type: "collision" }, config: { x: settings.x, y: settings.y, r: settings.r, angle: settings.angle, power: settings.power, ...(settings.color === undefined ? {} : { color: settings.color }) } });
		const structureIndex = this.structures.length;
		this.addCircle({ x: settings.x, y: settings.y, r: settings.r, color: settings.color ?? "#f0a020", effects: [], collisionCommands: [createCollisionCommandBinding({ schemaVersion: 1, type: MOVEMENT_ADD_VELOCITY_EFFECT_ID, typeValue: { x: Math.cos(radians) * settings.power, y: Math.sin(radians) * settings.power } })] });
		this.generatedHazardStructureIndexes.add(structureIndex);
		return this;
	}

	/** Adds a tick-driven hazard whose collision structure follows a deterministic schedule. */
	public addTimedHazard(settings: Omit<TimedHazard, "schemaVersion" | "type">): this { return this.addEnvironmental({ ...settings, schemaVersion: 1, type: "timed-hazard" }); }
	/** Adds a zone activated by entity entry for a fixed number of simulation ticks. */
	public addTriggeredZone(settings: Omit<TriggeredZone, "schemaVersion" | "type">): this { return this.addEnvironmental({ ...settings, schemaVersion: 1, type: "triggered-zone" }); }
	/** Adds a persistent force-field structure; force/kill behavior is supplied through its declarative effects. */
	public addForceField(settings: Omit<ForceField, "schemaVersion" | "type">): this { return this.addEnvironmental({ ...settings, schemaVersion: 1, type: "force-field" }); }
	/** Adds a structure that moves along a deterministic linear path. */
	public addMovingStructure(settings: Omit<MovingStructure, "schemaVersion" | "type">): this { return this.addEnvironmental({ ...settings, schemaVersion: 1, type: "moving-structure" }); }
	/** Adds a repeating enabled/disabled environmental cycle. */
	public addEnvironmentalCycle(settings: Omit<EnvironmentalCycle, "schemaVersion" | "type">): this { return this.addEnvironmental({ ...settings, schemaVersion: 1, type: "environmental-cycle" }); }

	private addEnvironmental(mechanic: EnvironmentalMechanic): this {
		validateEnvironmentalMechanics([mechanic]);
		if (this.environmentalMechanics.some(candidate => candidate.id === mechanic.id)) throw new Error(`Environmental mechanic ${mechanic.id} is already registered`);
		const structureId = mechanic.structure.id ?? `${this.options.id}.environment.${mechanic.id}`;
		const canonicalMechanic = { ...clone(mechanic), structure: { ...clone(mechanic.structure), id: structureId } };
		this.environmentalMechanics.push(canonicalMechanic);
		this.addStructure({ ...clone(canonicalMechanic.structure), effects: clone(canonicalMechanic.effects ?? canonicalMechanic.structure.effects) });
		this.generatedHazardStructureIndexes.add(this.structures.length - 1);
		this.built = undefined;
		return this;
	}

	/** Registers one validated item document for this map/match composition. */
	public addItem(item: ItemDocument): this {
		const validated = createItem(item);
		if (this.items.some(candidate => candidate.id === validated.id)) throw new Error(`Item ${validated.id} is already registered`);
		this.items.push(validated);
		this.built = undefined;
		return this;
	}

	/** Adds one team loadout using item IDs and positive use counts. */
	public addFixedLoadout(loadout: FixedItemLoadout): this {
		if (!Number.isSafeInteger(loadout.team) || loadout.team < 0 || !Array.isArray(loadout.items) || loadout.items.length === 0) throw new Error("Fixed loadouts require a non-negative team and items");
		if (this.itemEconomy.fixedLoadouts.some(candidate => candidate.team === loadout.team)) throw new Error(`Team ${loadout.team} already has an item loadout`);
		if (loadout.items.some(item => !Number.isSafeInteger(item.uses) || item.uses < 1 || typeof item.itemId !== "string" || item.itemId.length === 0)) throw new Error("Fixed loadout items require an ID and positive use count");
		this.itemEconomy.fixedLoadouts.push(clone(loadout));
		this.built = undefined;
		return this;
	}

	/** Adds a validated map pickup to the item economy. */
	public addItemPickup(pickup: ItemPickup): this {
		validateItemPickup(pickup);
		this.itemEconomy.mapPickups.push(clone(pickup));
		this.built = undefined;
		return this;
	}

	/** Configures deterministic per-turn item draws. */
	public setSeededItemDraw(draw: SeededItemDrawSettings): this {
		if (!Number.isSafeInteger(draw.seed) || !Array.isArray(draw.itemIds) || draw.itemIds.length === 0 || draw.itemIds.some(id => typeof id !== "string" || id.length === 0) || !Number.isSafeInteger(draw.drawsPerTurn) || draw.drawsPerTurn < 1) throw new Error("Seeded item draws require a safe seed, item IDs, and positive draws per turn");
		this.itemEconomy.randomDraw = clone(draw);
		this.built = undefined;
		return this;
	}

	/** Configures the deterministic reward pool for the built-in mystery box. */
	public setMysteryBox(settings: MysteryBoxSettings): this {
		if (!Array.isArray(settings.candidatePool) || settings.candidatePool.length === 0 || settings.candidatePool.some(id => typeof id !== "string" || id.length === 0)) throw new Error("Mystery box rewards require a non-empty candidate pool");
		this.itemEconomy.mysteryBox = clone(settings);
		this.built = undefined;
		return this;
	}

	/** Produces validated `GameSettings`, directly accepted by `GameHandlerBuilder.fromSettings()`. */
	public build(): GameSettings {
		if (this.built) return clone(this.built);
		const genericWorld = this.world.build();
		const spawns = this.spawns.map(spawn => ({ team: spawn.teamNr, x: spawn.x, y: spawn.y, w: spawn.w, h: spawn.h }));
		const canonical = this.buildMapDocumentFrom(spawns);
		validateMapDocument(canonical);
		const teamNumbers = [...new Set(this.spawns.map(spawn => spawn.teamNr))].sort((a, b) => a - b);
		if (teamNumbers.length < 2 || teamNumbers.length > 2) throw new Error("SDK maps currently require exactly two teams");
		if (teamNumbers[0] !== 0 || teamNumbers[1] !== 1) throw new Error("SDK maps currently require team numbers 0 and 1");
		const figuresPerTeam = teamNumbers.map(team => this.spawns.filter(spawn => spawn.teamNr === team).reduce((sum, spawn) => sum + spawn.playerCount, 0));
		if (figuresPerTeam[0] !== figuresPerTeam[1]) throw new Error("SDK maps require the same figure count for both teams");
		const template = createDefaultGameSettings(2, 1);
		const players = this.createPlayers(template.players, teamNumbers);
		this.validateItemReferences();
		const settings: GameSettings = {
			...template,
			id: this.options.id as GameSettings["id"],
			screenResolution: clone(this.options.worldSize),
			worldSize: clone(this.options.worldSize),
			background: clone(genericWorld.background as unknown as SettingsBackground),
			friction: clone(this.options.friction),
			drift: this.options.drift,
			players,
			environmentalMechanics: clone(this.environmentalMechanics),
			items: clone(this.items),
			mapBoundarys: clone(genericWorld.structures as unknown as MapBoundarySettings[]),
			effects: clone(genericWorld.effects as unknown as FullEffectSettings[]),
			...(this.hasItemEconomy() ? {
				gameMode: {
					id: `${this.options.id}-mode`,
					phases: [RulePhase.Item, RulePhase.Aim, RulePhase.Charge, RulePhase.Push, RulePhase.Physics],
					maxItemsPerTurn: 1,
					winCondition: WinCondition.LastTeamStanding,
					itemEconomy: clone(this.itemEconomy),
				},
			} : {}),
			allTeams: teamNumbers.map(team => this.teams.get(team)?.name ?? `Team ${team + 1}`),
			myTeam: [],
			allTeamSize: teamNumbers.length,
			playerCount: teamNumbers.length,
			figuresPerPlayer: figuresPerTeam[0]!,
			minPlayers: teamNumbers.length,
			maxPlayers: teamNumbers.length,
		};
		validateGameSettings(settings);
		this.built = clone(settings);
		return clone(this.built);
	}

	/** Produces a canonical `MapDocument` for map repositories that load against a separate game template. */
	public buildMapDocument(): MapDocument {
		return this.buildMapDocumentFrom(this.spawns.map(spawn => ({ team: spawn.teamNr, x: spawn.x, y: spawn.y, w: spawn.w, h: spawn.h })));
	}

	/** Serializes the engine-importable `GameSettings` without retaining runtime objects. */
	public buildJson(space: number = 2): string { return JSON.stringify(this.build(), null, space); }

	private buildMapDocumentFrom(spawnRegions: MapSpawnRegion[]): MapDocument {
		const genericWorld = this.world.build();
		const metadata: MapMetadata = { id: this.options.id, name: this.options.name, ...(this.options.description ? { description: this.options.description } : {}) };
		return {
			schemaVersion: DOCUMENT_SCHEMA_VERSION,
			metadata,
			worldSize: clone(genericWorld.worldSize),
			background: clone(genericWorld.background) as unknown as GameSettings["background"],
			friction: clone(this.options.friction),
			drift: this.options.drift,
			arenaGeometry: clone((genericWorld.structures as unknown as MapBoundarySettings[]).filter((_, index) => !this.generatedHazardStructureIndexes.has(index))),
			spawnRegions: spawnRegions.map(clone),
			hazards: clone(this.hazards),
			environmentalMechanics: clone(this.environmentalMechanics),
		};
	}

	private assertHazardZone(settings: KoreHazardZone): void {
		if (typeof settings.id !== "string" || settings.id.trim().length === 0) throw new Error("Hazard ID must be a non-empty string");
		if (![settings.x, settings.y, settings.r].every(Number.isFinite) || settings.r <= 0) throw new Error("Hazard zone requires finite coordinates and a positive radius");
		if (this.hazards.some(hazard => hazard.id === settings.id)) throw new Error(`Hazard ${settings.id} is already registered`);
	}

	private hasItemEconomy(): boolean {
		return this.items.length > 0 || this.itemEconomy.fixedLoadouts.length > 0 || this.itemEconomy.mapPickups.length > 0 || this.itemEconomy.randomDraw !== undefined || this.itemEconomy.mysteryBox !== undefined;
	}

	private validateItemReferences(): void {
		if (!this.hasItemEconomy()) return;
		validateItemEconomySettings(this.itemEconomy);
		const known = new Set(this.items.map(item => item.id));
		const references = [
			...this.itemEconomy.fixedLoadouts.flatMap(loadout => loadout.items.map(item => item.itemId)),
			...this.itemEconomy.mapPickups.map(pickup => pickup.itemId),
			...(this.itemEconomy.randomDraw?.itemIds ?? []),
			...(this.itemEconomy.mysteryBox?.candidatePool ?? []),
		];
		if (references.some(itemId => !known.has(itemId))) throw new Error("Item economy references an unknown item");
	}

	private createPlayers(templates: PlayerSettings[], teams: number[]): PlayerSettings[] {
		const players: PlayerSettings[] = [];
		for (const team of teams) {
			const teamTemplate = templates.find(player => player.team.includes(team))!;
			let playerIndex = 0;
			for (const spawn of this.spawns.filter(candidate => candidate.teamNr === team)) {
				const spawned = Array.from({ length: spawn.playerCount }, () => createPlayer({ ...teamTemplate, id: deterministicUuid(`${this.options.id}:team:${team}:player:${playerIndex++}`), teamNr: team, color: this.teams.get(team)?.color ?? teamTemplate.color }));
				arrangePlayers(spawned, spawn);
				players.push(...spawned);
			}
		}
		return players;
	}
}

function arrangePlayers(players: PlayerSettings[], region: KoreSpawnSettings): void {
	const diameter = players[0]!.size * 2;
	const columns = Math.max(1, Math.floor(region.w / (diameter + 1)));
	if (columns * Math.max(1, Math.floor(region.h / (diameter + 1))) < players.length) throw new Error("Spawn region is too small for its playerCount");
	players.forEach((player, index) => {
		player.position = { x: region.x + diameter / 2 + (index % columns) * (diameter + 1), y: region.y + diameter / 2 + Math.floor(index / columns) * (diameter + 1) };
	});
}

function toFullEffectSettings(input: EffectInput, trigger: EffectTrigger, triggerValue: []): FullEffectSettings {
	const settings = "toSettings" in input ? input.toSettings() : input;
	if (isFullEffectSettings(settings)) return clone(settings);
	return { ...clone(settings), trigger, triggerValue: clone(triggerValue) };
}

function isFullEffectSettings(settings: EffectSettings | FullEffectSettings): settings is FullEffectSettings {
	return "trigger" in settings && "triggerValue" in settings;
}

function validateImageUrl(value: string): void {
	try {
		const url = new URL(value, "https://kore.invalid");
		if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error();
	} catch { throw new Error("Background URLs must use http(s) or be same-origin paths"); }
}

function clone<T>(value: T): T { return structuredClone(value); }
function toJson(value: unknown): JsonValue { return JSON.parse(JSON.stringify(value)) as JsonValue; }

function deterministicUuid(value: string): string {
	let hash = 2166136261;
	for (let index = 0; index < value.length; index++) {
		hash ^= value.charCodeAt(index);
		hash = Math.imul(hash, 16777619);
	}
	const hex = (offset: number) => {
		let result = "";
		for (let index = 0; index < 8; index++) {
			hash ^= (offset + index) * 0x9e3779b9;
			hash = Math.imul(hash, 16777619);
			result += (hash >>> 0).toString(16).padStart(8, "0").slice(-2);
		}
		return result.slice(0, 8);
	};
	const raw = `${hex(0)}${hex(8)}${hex(16)}${hex(24)}${hex(32)}${hex(40)}`.slice(0, 32).split("");
	raw[12] = "4";
	raw[16] = (parseInt(raw[16]!, 16) & 0x3 | 0x8).toString(16);
	return `${raw.slice(0, 8).join("")}-${raw.slice(8, 12).join("")}-${raw.slice(12, 16).join("")}-${raw.slice(16, 20).join("")}-${raw.slice(20).join("")}`;
}

function stableAuthoringHash(value: unknown): string {
	const serialized = JSON.stringify(value, (_key, entry) => entry && typeof entry === "object" && !Array.isArray(entry)
		? Object.fromEntries(Object.entries(entry).sort(([a], [b]) => a.localeCompare(b)))
		: entry);
	let hash = 2166136261;
	for (const character of serialized) {
		hash ^= character.charCodeAt(0);
		hash = Math.imul(hash, 16777619);
	}
	return (hash >>> 0).toString(16).padStart(8, "0");
}

/** KORE's deterministic default runtime profile expressed through the generic framework selector. */
export function createDefaultKoreFramework(): EngineFrameworkSettings {
	const registry = new EngineSystemRegistry()
		.register({ id: "core.numeric", provides: ["numeric.state"], acceptsEffects: ["numeric.set", "numeric.add", "numeric.reset"] })
		.register({ id: "core.participation", provides: ["participation.state"], acceptsEffects: ["participation.set-physics", "participation.set-drawing"] })
		.register({ id: "core.movement", provides: ["movement.state"], acceptsEffects: ["movement.integrate"], before: ["core.playback"] })
		.register({ id: "core.transform", provides: ["transform.state"], acceptsEffects: ["transform.set-position", "transform.set-rotation", "transform.swap-position"], before: ["core.playback"] })
		.register({ id: "core.playback", provides: ["playback"] })
		.register({ id: "core.physics", provides: ["physics"], after: ["core.playback"] })
		.register({ id: "core.boundary", requires: ["physics"], after: ["core.physics"] })
		.register({ id: "core.game-state-manager", after: ["core.boundary"] });
	return registry.select(["core.numeric", "core.participation", "core.movement", "core.transform", "core.playback", "core.physics", "core.boundary", "core.game-state-manager"]);
}

/**
 * Single SDK entry point for authoring engine-importable JSON maps.
 *
 * @example
 * const team1 = kore.createTeam({ teamNr: 0, name: "Penguins", playerCount: 2 });
 * const map = kore.createDefaultMap({ name: "Training" })
 *   .addBackground({ type: "url", url: "https://example.test/ice.png" })
 *   .addTeam(team1)
 *   .addPlayerSpawn({ x: 40, y: 150, w: 120, h: 140, team: team1 })
 *   .addPlayerSpawn({ x: 640, y: 150, w: 120, h: 140, teamNr: 1, playerCount: 2 })
 *   .addWorldEffects({ effects: [kore.effects.move({ deltaTime: 0, x: 0, y: 0 })] })
 *   .build();
 * kore.createHandler(map);
 */
export const kore = {
	/** Deliberately selected generic primitives for KORE authors who need custom framework metadata. */
	engine: { createWorld: engine.createWorld, createSystemRegistry: engine.createSystemRegistry },
	/** KORE-facing JSON-safe UI builder, including standalone images and icon buttons. */
	ui: engineUi,
	/** Creates a reusable serializable team definition. */
	createTeam(settings: KoreTeamSettings): KoreTeam { return new TeamBuilder(settings); },
	/** Authors a detached, canonical `PlayerSettings` snapshot with KORE defaults and structural validation. */
	createPlayer(input: KorePlayerInput = {}): PlayerSettings { return createPlayer(input); },
	/** Creates a validated declarative item document. */
	createItem(input: KoreItemInput): ItemDocument { return createItem(input); },
	/** Composes validated declarative item effects in declaration order. */
	composeItemEffects(...effects: Array<{ type: string; value?: Record<string, unknown> }>): Array<{ type: string; value?: Record<string, unknown> }> { return composeItemEffects(...effects); },
	/** Resolves JSON item effects through the authoritative KORE runtime boundary. */
	itemRuntime: { create: createRuntimeItemEffect, resolve: resolveRuntimeItemEffects, applyForce: applyRuntimeForceEffects },
	/** Creates an empty two-team map builder with an 800×450 containment boundary. */
	createDefaultMap(options: KoreMapOptions = {}): KoreMapBuilder {
		const worldSize = options.worldSize ?? { x: 800, y: 450 };
		const name = options.name ?? "Untitled KORE Map";
		const description = options.description ?? "";
		const friction = clone(options.friction ?? FRICTION_TABLE.ice);
		const id = options.id ?? `kore-map-${stableAuthoringHash({ name, description, worldSize, friction, drift: options.drift ?? 0 })}`;
		return new KoreMapBuilder({ id, name, description, worldSize: clone(worldSize), friction, drift: options.drift ?? 0 });
	},
	/** Revalidates a JSON-safe engine settings object before runtime import. */
	validate(settings: unknown): asserts settings is GameSettings { validateGameSettings(settings); },
	/** Builds a runtime handler from a validated SDK map snapshot. */
	createHandler(settings: GameSettings): GameHandler { validateGameSettings(settings); return createRuntimeHandler(settings); },
	/** Restores a persisted engine snapshot through the same runtime boundary. */
	restoreHandler(settings: EngineSettings): GameHandler { validateGameSettings(settings); return createRuntimeHandler(settings); },
	/** Returns KORE's default deterministic runtime system profile as serializable framework metadata. */
	createDefaultFramework(): EngineFrameworkSettings { return createDefaultKoreFramework(); },
	/** KORE semantic sound IDs, bus presets, and browser-resolved asset manifest. */
	audio: koreAudio,
	/** KORE AI profiles and the shared validated decision-to-input boundary. */
	ai: koreAi,
	/** Safe, detached, versioned SDK content packages. */
	contentPackage: { validate: validateContentPackage, load: loadContentPackage, canonicalize: canonicalizeContentPackage, hash: hashContentPackage, resolveMap: resolveMapDocument },
	/**
	 * Match authoring: canonical handler creation, match composition, systems,
	 * rule configuration, teams, and mode setup (milestone 28). Definitions
	 * are detached, validated, JSON-safe; runtime construction happens only
	 * inside the engine handler runtime factory.
	 */
	createGameMode,
	/** Versioned selectable mode metadata authored at the public KORE boundary. */
	gameModes: { schemaVersion: GAME_MODE_CATALOG_SCHEMA_VERSION, list: getSelectableGameModes, get: getGameModeCatalogEntry },
	createMatchSystemProfile,
	authorMatchSettings,
	createMatchDefinition,
	validateMatchDefinition: validateKoreMatchDefinition,
	createRuntimeMatch,
	/** Declarative effect authoring helpers producing detached, JSON-safe settings. */
	effects: {
		move(values: EffectMoveInput): EffectMove { return new EffectMove({ typeValue: values }); },
		physics(values: FrictionSettings): EffectPhysics { return new EffectPhysics({ typeValue: values }); },
		damage(damage: number): EffectNumericAdd {
			if (!Number.isFinite(damage) || damage < 0) throw new Error("Damage must be a non-negative finite number");
			return new EffectNumericAdd({ typeValue: { stateId: "hp", amount: -damage } });
		},
		mass(mass: number): EffectModifyMass {
			if (!Number.isFinite(mass) || mass <= 0) throw new Error("Mass must be a finite positive number");
			return new EffectModifyMass({ typeValue: { mass } });
		},
		size(size: number): EffectSettings {
			if (!Number.isFinite(size) || size <= 0) throw new Error("Size must be a finite positive number");
			return { schemaVersion: 1, type: EffectType.ModifySize, typeValue: { size } };
		},
		position(position: Vector2D): EffectSettings {
			if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) throw new Error("Position coordinates must be finite numbers");
			return { schemaVersion: 1, type: EffectType.Position, typeValue: { ...position } };
		},
		velocity(velocity: Vector2D): EffectSettings {
			if (!Number.isFinite(velocity.x) || !Number.isFinite(velocity.y)) throw new Error("Velocity components must be finite numbers");
			return { schemaVersion: 1, type: EffectType.Velocity, typeValue: { ...velocity } };
		},
		team(team: number[]): EffectSettings {
			return { schemaVersion: 1, type: EffectType.Team, typeValue: { team: [...team] } };
		},
		modifySetting(values: ModifySettingValue): EffectModifySetting { return new EffectModifySetting({ typeValue: values }); },
		multi(...effects: Array<SerializableEffect | EffectSettings>): MultiEffect { return new MultiEffect({ schemaVersion: 1, type: EffectType.Multi, typeValue: effects.map(effect => "toSettings" in effect ? effect.toSettings() : effect) }); },

		// Item Effect Authoring Helpers
		itemEffect(type: ItemEffectType, typeValue: Record<string, unknown> = {}): ItemEffectSettings {
			return { type, typeValue: clone(typeValue) } as ItemEffectSettings;
		},
		shield(capacity: number): ItemEffectSettings {
			if (!Number.isFinite(capacity) || capacity <= 0) throw new Error("Shield capacity must be a positive number");
			return { type: ItemEffectType.Shield, typeValue: { capacity } };
		},
		aimVariance(maxVarianceDegrees: number, seed?: number): ItemEffectSettings {
			if (!Number.isFinite(maxVarianceDegrees) || maxVarianceDegrees < 0) throw new Error("Aim variance must be a finite non-negative number");
			if (seed !== undefined && !Number.isSafeInteger(seed)) throw new Error("Aim variance seed must be a safe integer");
			return { type: ItemEffectType.AimVariance, typeValue: { maxVarianceDegrees, ...(seed === undefined ? {} : { seed }) } };
		},
	freeze(durationTurns: number = 1): ItemEffectSettings {
		if (!Number.isInteger(durationTurns) || durationTurns <= 0) throw new Error("Freeze durationTurns must be a positive integer");
		return { type: ItemEffectType.TemporalModifier, typeValue: { durationUnit: "turns", duration: durationTurns, effect: { schemaVersion: 1, type: "movement.scale-speed", typeValue: { factor: 0.25 } } } };
		},
		magnet(strength: number, range: number): KoreEngineItemEffectSettings {
			if (!Number.isFinite(strength) || !Number.isFinite(range) || range <= 0) throw new Error("Magnet parameters must be finite numbers with positive range");
			return { type: MOVEMENT_APPLY_FORCE_TO_ENTITY_EFFECT_ID, typeValue: { mode: "attract", force: strength, range } };
		},
			temporaryWall(lifetimeTurns: number = 1): ItemEffectSettings {
			if (!Number.isInteger(lifetimeTurns) || lifetimeTurns <= 0) throw new Error("Temporary structure lifetimeTurns must be a positive integer");
			return { type: ItemEffectType.StructureLifecycle, typeValue: { durationUnit: "turns", duration: lifetimeTurns, structure: { type: "rectangle", w: 1, h: 1, role: "solid" } } };
		},
		ghostMode(durationTurns: number = 1): ItemEffectSettings {
			if (!Number.isInteger(durationTurns) || durationTurns <= 0) throw new Error("Ghost mode durationTurns must be a positive integer");
			return { type: ItemEffectType.GhostMode, typeValue: { durationTurns } };
		},
		modifyForce(multiplier: number): ItemEffectSettings {
			if (!Number.isFinite(multiplier) || multiplier <= 0) throw new Error("Modify force multiplier must be a positive finite number");
			return { type: ItemEffectType.ModifyForce, typeValue: { multiplier } };
		},
		modifyRotation(angle: number): ItemEffectSettings {
			if (!Number.isFinite(angle)) throw new Error("Modify rotation angle must be a finite number");
			return { type: ItemEffectType.ModifyRotation, typeValue: { angle } };
		},
		applyTorque(torque: number): ItemEffectSettings {
			if (!Number.isFinite(torque)) throw new Error("Torque must be a finite number");
			return { type: ItemEffectType.ApplyTorque, typeValue: { torque } };
		},
			deferredEffect(delayTicks: number, effect: EffectSettings): ItemEffectSettings {
			if (!Number.isSafeInteger(delayTicks) || delayTicks < 1) throw new Error("Delay ticks must be a positive integer");
			return { type: ItemEffectType.DeferredEffect, typeValue: { durationUnit: "ticks", duration: delayTicks, effect: clone(effect) as never } };
		},
		spawnTrigger(delayTicks: number, triggerType: string): ItemEffectSettings {
			if (!Number.isInteger(delayTicks) || delayTicks < 0) throw new Error("Delay ticks must be a non-negative integer");
			return { type: ItemEffectType.SpawnTrigger, typeValue: { delayTicks, triggerType } };
		},
	},
	/** Shared engine enums and friction presets for declarative authoring. */
	types: {
		gameState: { yourTurn: GameState.Your_turn, gameOver: GameState.Game_over },
		rulePhase: { item: RulePhase.Item, aim: RulePhase.Aim, charge: RulePhase.Charge, push: RulePhase.Push, physics: RulePhase.Physics, complete: RulePhase.Complete },
		winCondition: { lastTeamStanding: WinCondition.LastTeamStanding },
		shape: { circle: SHAPE.CIRCLE, rectangle: SHAPE.RECTANGLE, line: SHAPE.LINE },
		effectType: { physics: EffectType.Physics, movement: EffectType.Movement, multi: EffectType.Multi, modifySetting: EffectType.ModifySetting },
		itemEffectType: {
			modifyForce: ItemEffectType.ModifyForce,
			modifyRotation: ItemEffectType.ModifyRotation,
			lockRotation: ItemEffectType.LockRotation,
			applyTorque: ItemEffectType.ApplyTorque,
			spawnTrigger: ItemEffectType.SpawnTrigger,
			deferredEffect: ItemEffectType.DeferredEffect,
			shield: ItemEffectType.Shield,
			swapPosition: TRANSFORM_SWAP_POSITION_EFFECT_ID,
			structureLifecycle: ItemEffectType.StructureLifecycle,
			ghostMode: ItemEffectType.GhostMode,
			magnet: MOVEMENT_APPLY_FORCE_TO_ENTITY_EFFECT_ID,
			selectionLock: ItemEffectType.SelectionLock,
			aimVariance: ItemEffectType.AimVariance,
		},
		effectTrigger: { always: EffectTrigger.Always, collision: EffectTrigger.Collision, round: EffectTrigger.Round },
		friction: FRICTION_TABLE,
	},
} as const;

export type { KoreGameModeInput, KoreMatchDefinition, KoreMatchHeader, KoreMatchOptions };
export type { GameSettings } from "../../settings/settings.js";
export type { ContentPackage, LoadedContentPackage } from "../../content/package.js";
export type { MapDocument, MapSpawnRegion } from "../../contracts/documents.js";

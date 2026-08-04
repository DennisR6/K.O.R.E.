import { EffectDamage } from "./effects/damage.js";
import { MultiEffect } from "./effects/effects.js";
import { EffectModifyMass } from "./effects/modifyMass.js";
import { EffectModifySetting } from "./effects/modifySetting.js";
import { EffectMove, type EffectMoveInput } from "./effects/movement.js";
import { EffectPhysics } from "./effects/physics.js";
import { EffectTrigger, EffectType, type EffectSettings, type FullEffectSettings, type ModifySettingValue } from "./effects/types.js";
import { GameHandler, GameHandlerBuilder } from "./engine/Handler.js";
import { SHAPE, type StructureCollisionRole, type Vector2D } from "./physics/physics.js";
import { DOCUMENT_SCHEMA_VERSION, type MapDocument, type MapMetadata, type MapSpawnRegion, validateMapDocument } from "./contracts/documents.js";
import { createPlayerSettings, type PlayerSettings } from "./entity/types.js";
import { FRICTION_TABLE, createDefaultGameSettings, type FrictionSettings, type GameSettings, type MapBoundarySettings, type SettingsBackground, validateGameSettings } from "./settings/settings.js";

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
	triggerValue?: unknown;
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
	private readonly teams = new Map<number, KoreTeamSettings>();
	private readonly spawns: Array<KoreSpawnSettings & { teamNr: number; playerCount: number }> = [];
	private readonly worldEffects: FullEffectSettings[] = [];
	private readonly structures: MapBoundarySettings[] = [];
	private background: SettingsBackground = { type: "color", color: "#dff6ff" };
	private built: GameSettings | undefined;

	public constructor(private readonly options: Required<KoreMapOptions>) {
		this.structures.push({ type: SHAPE.RECTANGLE, x: 0, y: 0, w: options.worldSize.x, h: options.worldSize.y, role: "containment", effects: [] });
	}

	/** Sets a solid color, generated asset key, or external HTTP(S)/same-origin image URL. */
	public addBackground(background: KoreBackground): this {
		if (background.type === "color") this.background = { type: "color", color: background.color };
		else if (background.type === "asset") this.background = { type: "image", url: background.asset };
		else {
			validateImageUrl(background.url);
			this.background = { type: "image", url: background.url };
		}
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
		for (const effect of source.effects) this.worldEffects.push(toFullEffectSettings(effect, source.trigger ?? EffectTrigger.Always, source.triggerValue ?? []));
		this.built = undefined;
		return this;
	}

	/** Adds a serializable runtime structure or raw map-boundary settings. */
	public addStructure(structure: StructureInput): this {
		const settings = "toSettings" in structure ? structure.toSettings() : structure;
		this.structures.push(clone(settings));
		this.built = undefined;
		return this;
	}

	/** Adds a rectangle structure; use `role: "containment"` only for an intentional arena boundary. */
	public addRectangle(settings: { x: number; y: number; w: number; h: number; color?: string; role?: StructureCollisionRole; effects?: EffectInput[] }): this {
		return this.addStructure({ type: SHAPE.RECTANGLE, ...settings, effects: (settings.effects ?? []).map(effect => toFullEffectSettings(effect, EffectTrigger.Collision, [])) });
	}

	/** Adds a circular obstacle or hazard structure. */
	public addCircle(settings: { x: number; y: number; r: number; color?: string; role?: StructureCollisionRole; effects?: EffectInput[] }): this {
		return this.addStructure({ type: SHAPE.CIRCLE, ...settings, effects: (settings.effects ?? []).map(effect => toFullEffectSettings(effect, EffectTrigger.Collision, [])) });
	}

	/** Produces validated `GameSettings`, directly accepted by `GameHandlerBuilder.fromSettings()`. */
	public build(): GameSettings {
		if (this.built) return clone(this.built);
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
		const settings: GameSettings = {
			...template,
			id: this.options.id as GameSettings["id"],
			screenResolution: clone(this.options.worldSize),
			worldSize: clone(this.options.worldSize),
			background: clone(this.background),
			friction: clone(this.options.friction),
			drift: this.options.drift,
			players,
			mapBoundarys: this.structures.map(clone),
			effects: this.worldEffects.map(clone),
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
		const metadata: MapMetadata = { id: this.options.id, name: this.options.name, ...(this.options.description ? { description: this.options.description } : {}) };
		return {
			schemaVersion: DOCUMENT_SCHEMA_VERSION,
			metadata,
			worldSize: clone(this.options.worldSize),
			friction: clone(this.options.friction),
			drift: this.options.drift,
			arenaGeometry: this.structures.map(clone),
			spawnRegions: spawnRegions.map(clone),
			hazards: [],
		};
	}

	private createPlayers(templates: PlayerSettings[], teams: number[]): PlayerSettings[] {
		const players: PlayerSettings[] = [];
		for (const team of teams) {
			const teamTemplate = templates.find(player => player.team.includes(team))!;
			for (const spawn of this.spawns.filter(candidate => candidate.teamNr === team)) {
				const spawned = Array.from({ length: spawn.playerCount }, () => createPlayerSettings({ ...teamTemplate, id: crypto.randomUUID() as PlayerSettings["id"], team: [team], color: this.teams.get(team)?.color ?? teamTemplate.color }));
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

function toFullEffectSettings(input: EffectInput, trigger: EffectTrigger, triggerValue: unknown): FullEffectSettings {
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
 * new GameHandlerBuilder().defaultSystems().fromSettings(map).build();
 */
export const kore = {
	/** Creates a reusable serializable team definition. */
	createTeam(settings: KoreTeamSettings): KoreTeam { return new TeamBuilder(settings); },
	/** Creates an empty two-team map builder with an 800×450 containment boundary. */
	createDefaultMap(options: KoreMapOptions = {}): KoreMapBuilder {
		const worldSize = options.worldSize ?? { x: 800, y: 450 };
		return new KoreMapBuilder({ id: options.id ?? crypto.randomUUID(), name: options.name ?? "Untitled KORE Map", description: options.description ?? "", worldSize: clone(worldSize), friction: clone(options.friction ?? FRICTION_TABLE.ice), drift: options.drift ?? 0 });
	},
	/** Revalidates a JSON-safe engine settings object before runtime import. */
	validate(settings: unknown): asserts settings is GameSettings { validateGameSettings(settings); },
	/** Builds a runtime handler from a validated SDK map snapshot. */
	createHandler(settings: GameSettings): GameHandler { validateGameSettings(settings); return new GameHandlerBuilder().defaultSystems().fromSettings(settings).build(); },
	/** Runtime effect constructors; pass their results into `addWorldEffects` or structure effect arrays. */
	effects: {
		move(values: EffectMoveInput): EffectMove { return new EffectMove({ typeValue: values }); },
		physics(values: FrictionSettings): EffectPhysics { return new EffectPhysics({ typeValue: values }); },
		damage(damage: number): EffectDamage { return new EffectDamage({ typeValue: { damage } }); },
		mass(mass: number): EffectModifyMass { return new EffectModifyMass({ typeValue: { mass } }); },
		modifySetting(values: ModifySettingValue): EffectModifySetting { return new EffectModifySetting({ typeValue: values }); },
		multi(...effects: Array<SerializableEffect | EffectSettings>): MultiEffect { return new MultiEffect({ type: EffectType.Multi, typeValue: effects.map(effect => "toSettings" in effect ? effect.toSettings() : effect) }); },
	},
	/** Shared engine enums and friction presets for declarative authoring. */
	types: {
		shape: { circle: SHAPE.CIRCLE, rectangle: SHAPE.RECTANGLE, line: SHAPE.LINE },
		effectType: { physics: EffectType.Physics, movement: EffectType.Movement, damage: EffectType.Damage, multi: EffectType.Multi, modifySetting: EffectType.ModifySetting },
		effectTrigger: { always: EffectTrigger.Always, collision: EffectTrigger.Collision, round: EffectTrigger.Round },
		friction: FRICTION_TABLE,
	},
} as const;

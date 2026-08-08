/** Standalone public KORE SDK declaration. */
type MultiEffect = any;
declare const MultiEffect: any;
type EffectModifyMass = any;
declare const EffectModifyMass: any;
type EffectModifySetting = any;
declare const EffectModifySetting: any;
type EffectMove = any;
declare const EffectMove: any;
type EffectMoveInput = any;
declare const EffectMoveInput: any;
type EffectPhysics = any;
declare const EffectPhysics: any;
type EffectNumericAdd = any;
declare const EffectNumericAdd: any;
type EffectTrigger = any;
declare const EffectTrigger: any;
type EffectType = any;
declare const EffectType: any;
type ItemEffectType = any;
declare const ItemEffectType: any;
type EffectSettings = any;
declare const EffectSettings: any;
type FullEffectSettings = any;
declare const FullEffectSettings: any;
type ItemEffectSettings = any;
declare const ItemEffectSettings: any;
type ModifySettingValue = any;
declare const ModifySettingValue: any;
type GameHandler = any;
declare const GameHandler: any;
type GameState = any;
declare const GameState: any;
type EngineSettings = any;
declare const EngineSettings: any;
type EngineSystemRegistry = any;
declare const EngineSystemRegistry: any;
type EngineFrameworkSettings = any;
declare const EngineFrameworkSettings: any;
type applyRuntimeForceEffects = any;
declare const applyRuntimeForceEffects: any;
type createRuntimeItemEffect = any;
declare const createRuntimeItemEffect: any;
type resolveRuntimeItemEffects = any;
declare const resolveRuntimeItemEffects: any;
type JsonValue = any;
declare const JsonValue: any;
type SHAPE = any;
declare const SHAPE: any;
type StructureCollisionRole = any;
declare const StructureCollisionRole: any;
type Vector2D = any;
declare const Vector2D: any;
type MapDocument = any;
declare const MapDocument: any;
type AssetList = any;
declare const AssetList: any;
type ForceField = any;
declare const ForceField: any;
type MovingStructure = any;
declare const MovingStructure: any;
type TimedHazard = any;
declare const TimedHazard: any;
type TriggeredZone = any;
declare const TriggeredZone: any;
type EnvironmentalCycle = any;
declare const EnvironmentalCycle: any;
type InventoryItem = any;
declare const InventoryItem: any;
type ItemDocument = any;
declare const ItemDocument: any;
type ItemPickup = any;
declare const ItemPickup: any;
type RulePhase = any;
declare const RulePhase: any;
type WinCondition = any;
declare const WinCondition: any;
type FixedItemLoadout = any;
declare const FixedItemLoadout: any;
type MysteryBoxSettings = any;
declare const MysteryBoxSettings: any;
type SeededItemDrawSettings = any;
declare const SeededItemDrawSettings: any;
type PlayerSettings = any;
declare const PlayerSettings: any;
type FrictionSettings = any;
declare const FrictionSettings: any;
type GameSettings = any;
declare const GameSettings: any;
type MapBoundarySettings = any;
declare const MapBoundarySettings: any;
type MapBoundarySettingsCircle = any;
declare const MapBoundarySettingsCircle: any;
type authorMatchSettings = any;
declare const authorMatchSettings: any;
type createGameMode = any;
declare const createGameMode: any;
type createMatchDefinition = any;
declare const createMatchDefinition: any;
type createMatchSystemProfile = any;
declare const createMatchSystemProfile: any;
type createRuntimeMatch = any;
declare const createRuntimeMatch: any;
type validateKoreMatchDefinition = any;
declare const validateKoreMatchDefinition: any;
type KoreGameModeInput = any;
declare const KoreGameModeInput: any;
type KoreMatchDefinition = any;
declare const KoreMatchDefinition: any;
type KoreMatchHeader = any;
declare const KoreMatchHeader: any;
type KoreMatchOptions = any;
declare const KoreMatchOptions: any;
type getGameModeCatalogEntry = any;
declare const getGameModeCatalogEntry: any;
type getSelectableGameModes = any;
declare const getSelectableGameModes: any;
type canonicalizeContentPackage = any;
declare const canonicalizeContentPackage: any;
type hashContentPackage = any;
declare const hashContentPackage: any;
type loadContentPackage = any;
declare const loadContentPackage: any;
type resolveMapDocument = any;
declare const resolveMapDocument: any;
type validateContentPackage = any;
declare const validateContentPackage: any;
type KoreItemInput = any;
declare const KoreItemInput: any;
export type RuntimeItemEffect = any;
export type KoreItemInput = any;
export type KoreGameModeInput = any;
export type KoreMatchDefinition = any;
export type KoreMatchHeader = any;
export type KoreMatchOptions = any;
export type GameSettings = any;
export type ContentPackage = any;
export type LoadedContentPackage = any;
export type MapDocument = any;
export type MapSpawnRegion = any;
export declare function createRuntimeItemEffect(...args: any[]): any;
export declare function resolveRuntimeItemEffects(...args: any[]): any;
export declare function applyRuntimeForceEffects(...args: any[]): any;
export declare function composeItemEffects(...effects: any[]): any;
export declare function createItem(...args: any[]): any;
type KoreEngineItemEffectSettings = {
    type: string;
    typeValue: Record<string, unknown>;
};
type SerializableEffect = {
    toSettings(): any;
};
type EffectInput = SerializableEffect | any | any;
type StructureInput = any | {
    toSettings(): any;
};
/** Serializable team definition consumed by `KoreMapBuilder.addPlayerSpawn()`. */
export interface KoreTeamSettings {
    teamNr: number;
    name?: string;
    color?: string;
    /** Default figure count for this team when a spawn omits `playerCount`. */
    playerCount?: number;
}
/** A team object whose settings can be embedded in an SDK map definition. */
export interface KoreTeam {
    toSettings(): KoreTeamSettings;
}
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
export type KoreBackground = {
    type: "color";
    color: string;
} | {
    type: "asset";
    asset: number;
} | {
    type: "url";
    url: string;
};
export interface KoreMapOptions {
    id?: string;
    name?: string;
    description?: string;
    worldSize?: any;
    friction?: any;
    drift?: number;
}
export interface KoreWorldEffects {
    effects: EffectInput[];
    trigger?: any;
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
/** Input contract for authoring a canonical KORE player snapshot via `kore.createPlayer()`. */
export interface KorePlayerInput {
    id?: string;
    teamNr?: number;
    team?: number[];
    position?: any;
    velocity?: any;
    rotation?: number;
    angularVelocity?: number;
    hp?: number;
    bouncyness?: number;
    mass?: number;
    radius?: number;
    size?: number;
    friction?: number;
    color?: string;
    playericon?: any;
    hoop?: any;
    isPhysicsEnabled?: boolean;
    isDrawingEnabled?: boolean;
    effects?: any[];
    inventory?: any[];
}
/** Authors a detached, canonical `any` object with KORE defaults and structural validation. */
export declare function createPlayer(input?: KorePlayerInput): any;
/** Fluent builder for a complete, JSON-safe `any` map snapshot. */
export declare class KoreMapBuilder {
    private readonly options;
    private readonly world;
    private readonly teams;
    private readonly spawns;
    private readonly worldEffects;
    private readonly structures;
    private readonly generatedHazardStructureIndexes;
    private readonly hazards;
    private readonly environmentalMechanics;
    private readonly items;
    private readonly itemEconomy;
    private background;
    private built;
    constructor(options: Required<KoreMapOptions>);
    /** Sets a solid color, generated asset key, or external HTTP(S)/same-origin image URL. */
    addBackground(background: KoreBackground): this;
    /** Registers a team so its name/color/default figure count can be reused by spawns. */
    addTeam(team: KoreTeam | KoreTeamSettings): this;
    /** Adds a rectangular spawn region and generates `playerCount` figures for its team during `build()`. */
    addPlayerSpawn(spawn: KoreSpawnSettings): this;
    /** Adds handler-level effects. Runtime effects are converted through their own `toSettings()` method. */
    addWorldEffects(input: KoreWorldEffects | EffectInput[], trigger?: any): this;
    /** Adds a serializable runtime structure or raw map-boundary settings. */
    addStructure(structure: StructureInput): this;
    /** Adds a rectangle structure; use `role: "containment"` only for an intentional arena boundary. */
    addRectangle(settings: {
        x: number;
        y: number;
        w: number;
        h: number;
        color?: string;
        role?: any;
        effects?: EffectInput[];
    }): this;
    /** Adds a circular obstacle or hazard structure. */
    addCircle(settings: {
        x: number;
        y: number;
        r: number;
        color?: string;
        role?: any;
        effects?: EffectInput[];
        collisionCommands?: any["collisionCommands"];
    }): this;
    /** Adds a declarative lethal circular zone to the canonical map and runtime build. */
    addKillZone(settings: KoreHazardZone): this;
    /** Adds a declarative directional force zone to the canonical map and runtime build. */
    addForceZone(settings: KoreForceHazardZone): this;
    /** Adds a tick-driven hazard whose collision structure follows a deterministic schedule. */
    addTimedHazard(settings: Omit<any, "schemaVersion" | "type">): this;
    /** Adds a zone activated by entity entry for a fixed number of simulation ticks. */
    addTriggeredZone(settings: Omit<any, "schemaVersion" | "type">): this;
    /** Adds a persistent force-field structure; force/kill behavior is supplied through its declarative effects. */
    addForceField(settings: Omit<any, "schemaVersion" | "type">): this;
    /** Adds a structure that moves along a deterministic linear path. */
    addMovingStructure(settings: Omit<any, "schemaVersion" | "type">): this;
    /** Adds a repeating enabled/disabled environmental cycle. */
    addEnvironmentalCycle(settings: Omit<any, "schemaVersion" | "type">): this;
    private addEnvironmental;
    /** Registers one validated item document for this map/match composition. */
    addItem(item: any): this;
    /** Adds one team loadout using item IDs and positive use counts. */
    addFixedLoadout(loadout: any): this;
    /** Adds a validated map pickup to the item economy. */
    addItemPickup(pickup: any): this;
    /** Configures deterministic per-turn item draws. */
    setSeededItemDraw(draw: any): this;
    /** Configures the deterministic reward pool for the built-in mystery box. */
    setMysteryBox(settings: any): this;
    /** Produces validated `any`, directly accepted by `GameHandlerBuilder.fromSettings()`. */
    build(): any;
    /** Produces a canonical `any` for map repositories that load against a separate game template. */
    buildMapDocument(): any;
    /** Serializes the engine-importable `any` without retaining runtime objects. */
    buildJson(space?: number): string;
    private buildMapDocumentFrom;
    private assertHazardZone;
    private hasItemEconomy;
    private validateItemReferences;
    private createPlayers;
}
/** KORE's deterministic default runtime profile expressed through the generic framework selector. */
export declare function createDefaultKoreFramework(): any;
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
export declare const kore: {
    /** Deliberately selected generic primitives for KORE authors who need custom framework metadata. */
    readonly engine: {
        readonly createWorld: (options: {
            id: string;
            worldSize: {
                x: number;
                y: number;
            };
        }) => any;
        readonly createSystemRegistry: () => any;
    };
    /** KORE-facing JSON-safe UI builder, including standalone images and icon buttons. */
    readonly ui: {
        readonly createMenu: (options: {
            id: string;
            size: {
                width: number;
                height: number;
            };
        }) => any;
        readonly fromSettings: (settings: any) => any;
        readonly createDefaultFramework: typeof any;
        readonly validate: typeof any;
        readonly screen: (settings: any) => any;
        readonly button: (settings: any) => any;
        readonly text: (settings: any) => any;
        readonly textInput: (settings: any) => any;
        readonly image: (settings: any) => any;
        readonly container: (settings: any) => any;
        readonly layout: {
            readonly absolute: (options?: {
                padding?: any;
            }) => any;
            readonly horizontal: (options?: Omit<any, "type">) => any;
            readonly vertical: (options?: Omit<any, "type">) => any;
        };
        readonly action: {
            readonly navigate: (target: string) => any;
            readonly back: () => any;
            readonly emit: (command: string, payload?: any) => any;
            readonly emitValues: (command: string, targets: string[]) => any;
            readonly setEnabled: (target: string, enabled: boolean) => any;
            readonly setText: (target: string, text: string) => any;
        };
        readonly types: {
            readonly containsPoint: (rect: any, point: any) => boolean;
        };
    };
    /** Creates a reusable serializable team definition. */
    readonly createTeam: (settings: KoreTeamSettings) => KoreTeam;
    /** Authors a detached, canonical `any` snapshot with KORE defaults and structural validation. */
    readonly createPlayer: (input?: KorePlayerInput) => any;
    /** Creates a validated declarative item document. */
    readonly createItem: (input: any) => any;
    /** Composes validated declarative item effects in declaration order. */
    readonly composeItemEffects: (...effects: Array<{
        type: string;
        value?: Record<string, unknown>;
    }>) => Array<{
        type: string;
        value?: Record<string, unknown>;
    }>;
    /** Resolves JSON item effects through the authoritative KORE runtime boundary. */
    readonly itemRuntime: {
        readonly create: typeof any;
        readonly resolve: typeof any;
        readonly applyForce: typeof any;
    };
    /** Creates an empty two-team map builder with an 800×450 containment boundary. */
    readonly createDefaultMap: (options?: KoreMapOptions) => KoreMapBuilder;
    /** Revalidates a JSON-safe engine settings object before runtime import. */
    readonly validate: (settings: unknown) => asserts settings is any;
    /** Builds a runtime handler from a validated SDK map snapshot. */
    readonly createHandler: (settings: any) => any;
    /** Restores a persisted engine snapshot through the same runtime boundary. */
    readonly restoreHandler: (settings: any) => any;
    /** Returns KORE's default deterministic runtime system profile as serializable framework metadata. */
    readonly createDefaultFramework: () => any;
    /** KORE semantic sound IDs, bus presets, and browser-resolved asset manifest. */
    readonly audio: {
        readonly assets: {
            readonly "kore.music.menu": "/public/audio/CM_01_Ascension.mp3";
            readonly "kore.music.match": "/public/audio/CM_02_Moon_Shadows.mp3";
            readonly "kore.ui.confirm": "/public/audio/CM_03_Ritualis.mp3";
            readonly "kore.game.shot": "/public/audio/CM_04_Sacrifice.mp3";
            readonly "kore.game.collision": "/public/audio/CM_04_Sacrifice.mp3";
            readonly "kore.game.damage": "/public/audio/CM_04_Sacrifice.mp3";
            readonly "kore.game.shield": "/public/audio/CM_04_Sacrifice.mp3";
            readonly "kore.game.item": "/public/audio/CM_03_Ritualis.mp3";
            readonly "kore.game.hazard": "/public/audio/CM_04_Sacrifice.mp3";
            readonly "kore.game.elimination": "/public/audio/CM_04_Sacrifice.mp3";
            readonly "kore.game.turn": "/public/audio/CM_03_Ritualis.mp3";
            readonly "kore.game.result": "/public/audio/CM_03_Ritualis.mp3";
        };
        readonly buses: any[];
        readonly createSettings: typeof any;
        readonly sounds: {
            readonly uiConfirm: "kore.ui.confirm";
            readonly shot: "kore.game.shot";
            readonly collision: "kore.game.collision";
            readonly damage: "kore.game.damage";
            readonly shield: "kore.game.shield";
            readonly item: "kore.game.item";
            readonly hazard: "kore.game.hazard";
            readonly elimination: "kore.game.elimination";
            readonly turn: "kore.game.turn";
            readonly result: "kore.game.result";
        };
        readonly music: {
            readonly menu: "kore.music.menu";
            readonly match: "kore.music.match";
        };
        readonly command: {
            readonly uiConfirm: (sourceId: string, soundId?: string) => any;
            readonly shot: (sourceId: string) => any;
            readonly menuMusic: (sourceId?: string) => any;
            readonly matchMusic: (sourceId?: string) => any;
        };
    };
    /** KORE AI profiles and the shared validated decision-to-input boundary. */
    readonly ai: {
        readonly createSettings: typeof any;
        readonly createProducer: typeof any;
        readonly createTurnEmitter: typeof any;
    };
    /** Safe, detached, versioned SDK content packages. */
    readonly contentPackage: {
        readonly validate: typeof any;
        readonly load: typeof any;
        readonly canonicalize: typeof any;
        readonly hash: typeof any;
        readonly resolveMap: typeof any;
    };
    /**
     * Match authoring: canonical handler creation, match composition, systems,
     * rule configuration, teams, and mode setup (milestone 28). Definitions
     * are detached, validated, JSON-safe; runtime construction happens only
     * inside the engine handler runtime factory.
     */
    readonly any: typeof any;
    /** Versioned selectable mode metadata authored at the public KORE boundary. */
    readonly gameModes: {
        readonly schemaVersion: 1;
        readonly list: typeof any;
        readonly get: typeof any;
    };
    readonly any: typeof any;
    readonly any: typeof any;
    readonly any: typeof any;
    readonly validateMatchDefinition: typeof any;
    readonly any: typeof any;
    /** Declarative effect authoring helpers producing detached, JSON-safe settings. */
    readonly effects: {
        readonly move: (values: any) => any;
        readonly physics: (values: any) => any;
        readonly damage: (damage: number) => any;
        readonly mass: (mass: number) => any;
        readonly size: (size: number) => any;
        readonly position: (position: any) => any;
        readonly velocity: (velocity: any) => any;
        readonly team: (team: number[]) => any;
        readonly modifySetting: (values: any) => any;
        readonly multi: (...effects: Array<SerializableEffect | any>) => any;
        readonly itemEffect: (type: any, typeValue?: Record<string, unknown>) => any;
        readonly shield: (capacity: number) => any;
        readonly freeze: (durationTurns?: number) => any;
        readonly magnet: (strength: number, range: number) => KoreEngineItemEffectSettings;
        readonly temporaryWall: (lifetimeTurns?: number) => any;
        readonly ghostMode: (durationTurns?: number) => any;
        readonly modifyForce: (multiplier: number) => any;
        readonly modifyRotation: (angle: number) => any;
        readonly applyTorque: (torque: number) => any;
        readonly deferredEffect: (delayTicks: number, effect: any) => any;
        readonly spawnTrigger: (delayTicks: number, triggerType: string) => any;
    };
    /** Shared engine enums and friction presets for declarative authoring. */
    readonly types: {
        readonly gameState: {
            readonly yourTurn: any.Your_turn;
            readonly gameOver: any.Game_over;
        };
        readonly rulePhase: {
            readonly item: any.Item;
            readonly aim: any.Aim;
            readonly charge: any.Charge;
            readonly push: any.Push;
            readonly physics: any.Physics;
            readonly complete: any.Complete;
        };
        readonly winCondition: {
            readonly lastTeamStanding: any;
        };
        readonly shape: {
            readonly circle: any.CIRCLE;
            readonly rectangle: any.RECTANGLE;
            readonly line: any.LINE;
        };
        readonly effectType: {
            readonly physics: any.Physics;
            readonly movement: any.Movement;
            readonly multi: any.Multi;
            readonly modifySetting: any.ModifySetting;
        };
        readonly itemEffectType: {
            readonly modifyForce: any.ModifyForce;
            readonly modifyRotation: any.ModifyRotation;
            readonly lockRotation: any.LockRotation;
            readonly applyTorque: any.ApplyTorque;
            readonly spawnTrigger: any.SpawnTrigger;
            readonly deferredEffect: any.DeferredEffect;
            readonly shield: any.Shield;
            readonly swapPosition: any.SwapPosition;
            readonly structureLifecycle: any.StructureLifecycle;
            readonly ghostMode: any.GhostMode;
            readonly magnet: "movement.apply-force-to-entity";
            readonly selectionLock: any.SelectionLock;
            readonly aimVariance: any.AimVariance;
        };
        readonly effectTrigger: {
            readonly always: any.Always;
            readonly collision: any.Collision;
            readonly round: any.Round;
        };
        readonly friction: {
            readonly ice: {
                readonly friction: 0.995;
                readonly linearDrag: 0.01;
                readonly stopThreshold: 0.1;
            };
            readonly tiles: {
                readonly friction: 0.98;
                readonly linearDrag: 0.05;
                readonly stopThreshold: 0.15;
            };
            readonly wood: {
                readonly friction: 0.96;
                readonly linearDrag: 0.1;
                readonly stopThreshold: 0.2;
            };
            readonly billiards: {
                readonly friction: 0.94;
                readonly linearDrag: 0.15;
                readonly stopThreshold: 0.2;
            };
            readonly carpet_office: {
                readonly friction: 0.91;
                readonly linearDrag: 0.25;
                readonly stopThreshold: 0.3;
            };
            readonly gym: {
                readonly friction: 0.88;
                readonly linearDrag: 0.4;
                readonly stopThreshold: 0.4;
            };
            readonly turf: {
                readonly friction: 0.82;
                readonly linearDrag: 0.8;
                readonly stopThreshold: 0.5;
            };
            readonly asphalt: {
                readonly friction: 0.75;
                readonly linearDrag: 1.2;
                readonly stopThreshold: 0.6;
            };
            readonly grass: {
                readonly friction: 0.6;
                readonly linearDrag: 2.5;
                readonly stopThreshold: 1;
            };
            readonly sand: {
                readonly friction: 0.4;
                readonly linearDrag: 5;
                readonly stopThreshold: 2;
            };
        };
    };
};

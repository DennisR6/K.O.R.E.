import { audio, type AudioRuntimeSettings, validateAudioSettings } from "../../engine/audio-sdk/index.js";
import { engine } from "../../engine/sdk/index.js";
import type { JsonValue } from "../../engine/contracts/systemSettings.js";
import { ui, validateUiSettings, type UiMenuSettings } from "../../engine/ui-sdk/index.js";
import { MAP_CATALOG } from "../../content/mapCatalog.js";
import { koreAudio, createKoreAudioSettings } from "../audio.js";

export type KoreMenuMapIntent = "local" | "online" | "battle" | "ai";
export type KoreMainMenuSettings = {
  schemaVersion: 1;
  id: "kore.main-menu";
  ui: UiMenuSettings;
  audio: AudioRuntimeSettings;
  metadata: {
    schemaVersion: 1;
    title: string;
    worldSize: { width: number; height: number };
    confirmationCommands: string[];
    confirmationSoundId: string;
  };
};

const SIZE = { width: 800, height: 450 };

// Button-Dimensionen für kompaktes blaues Design
const BTN_W = 140;
const BTN_H = 32;
const BTN_STYLE = "kore.button.blue";

// Zentrierung für ein horizontales Layout am unteren Bildschirmrand
// Canvas: 800px Breit, 450px Hoch
// 4 Buttons mit 140px Breite + 12px Lücke = 596px Gesamtbreite
// Start-X: (800 - 596) / 2 = 102px
// Y-Position unten: 450 - 32 (Höhe) - 20 (Abstand zum Rand) = 398px
const BOTTOM_ROW = [
  rect(102, 398, BTN_W, BTN_H),
  rect(254, 398, BTN_W, BTN_H),
  rect(406, 398, BTN_W, BTN_H),
  rect(558, 398, BTN_W, BTN_H),
];

// Zentrierung für Untermenüs mit 3 Buttons (Gesamtbreite 444px, Start-X: 178px)
const BOTTOM_ROW_3 = [
  rect(178, 398, BTN_W, BTN_H),
  rect(330, 398, BTN_W, BTN_H),
  rect(482, 398, BTN_W, BTN_H),
];

// Semantic Actions für KORE
export const MAIN_ACTIONS = {
  openOnline: "kore.menu.open-online",
  openFriends: "kore.menu.open-friends",
  openBattle: "kore.menu.open-battle",
  openAi: "kore.menu.open-ai",
  openLocalMaps: "kore.menu.open-local-maps",
  openAiMaps: "kore.menu.open-ai-maps",
  openAiVsAi: "kore.menu.open-ai-vs-ai",
  selectMap: "kore.menu.select-map",
  startLocal: "kore.menu.start-local-game",
  openSettings: "kore.menu.open-settings",
  openCredits: "kore.menu.open-credits",
} as const;

function buildUiSettings(): UiMenuSettings {
  const builder = ui.createMenu({ id: "kore.main-menu.ui", size: SIZE });

  // 0. LANDING SCREEN
  builder.addScreen(
    ui.screen({
      id: "landing",
      layout: ui.layout.absolute(),
      elements: [
        ui.text({
          id: "landing-prompt",
          text: "drücke um zu starten",
          rect: rect(200, 180, 480, 58),
          style: "kore.menu.landing-prompt",
          visible: false,
        }),
        ui.button({
          id: "landing-start",
          text: "",
          rect: rect(0, 0, 800, 450),
          style: "kore.menu.landing-hitbox",
          action: ui.action.navigate("main"),
        }),
      ],
    })
  );

  // 1. HAUPTMENÜ (Horizontal unten zentriert: Online | Lokal | Settings | Credits)
  builder.addScreen(
    ui.screen({
      id: "main",
      layout: ui.layout.absolute(),
      elements: [
        ui.button({
          id: "btn-online",
          text: "Online",
          rect: BOTTOM_ROW[0]!,
          style: BTN_STYLE,
          action: ui.action.navigate("online-menu"),
        }),
        ui.button({
          id: "btn-lokal",
          text: "Lokal",
          rect: BOTTOM_ROW[1]!,
          style: BTN_STYLE,
          action: ui.action.navigate("local-menu"),
        }),
        ui.button({
          id: "btn-settings",
          text: "Settings",
          rect: BOTTOM_ROW[2]!,
          style: BTN_STYLE,
          action: ui.action.emit(MAIN_ACTIONS.openSettings),
        }),
        ui.button({
          id: "btn-credits",
          text: "Credits",
          rect: BOTTOM_ROW[3]!,
          style: BTN_STYLE,
          action: ui.action.emit(MAIN_ACTIONS.openCredits),
        }),
      ],
    })
  );

  // 2. ONLINE SUB-MENÜ (Horizontal unten zentriert: Matchmaking | vs Friends | Zurück)
  builder.addScreen(
    ui.screen({
      id: "online-menu",
      layout: ui.layout.absolute(),
      elements: [
        ui.button({
          id: "btn-matchmaking",
          text: "Matchmaking",
          rect: BOTTOM_ROW_3[0]!,
          style: BTN_STYLE,
          action: ui.action.emit(MAIN_ACTIONS.openOnline),
        }),
        ui.button({
          id: "btn-vs-friends",
          text: "vs Friends",
          rect: BOTTOM_ROW_3[1]!,
          style: BTN_STYLE,
          action: ui.action.emit(MAIN_ACTIONS.openFriends),
        }),
        ui.button({
          id: "btn-online-back",
          text: "Zurück",
          rect: BOTTOM_ROW_3[2]!,
          style: "kore.button.blue-back",
          action: ui.action.back(),
        }),
      ],
    })
  );

  // 3. LOKAL SUB-MENÜ (Horizontal unten zentriert: vs KI | vs Player | Ki vs Ki | Zurück)
  builder.addScreen(
    ui.screen({
      id: "local-menu",
      layout: ui.layout.absolute(),
      elements: [
        ui.button({
          id: "btn-vs-ki",
          text: "vs KI",
          rect: BOTTOM_ROW[0]!,
          style: BTN_STYLE,
          action: ui.action.navigate("difficulty"),
        }),
        ui.button({
          id: "btn-vs-player",
          text: "vs Player",
          rect: BOTTOM_ROW[1]!,
          style: BTN_STYLE,
          action: ui.action.emit(MAIN_ACTIONS.openLocalMaps),
        }),
        ui.button({
          id: "btn-ki-vs-ki",
          text: "Ki vs Ki",
          rect: BOTTOM_ROW[2]!,
          style: BTN_STYLE,
          action: ui.action.emit(MAIN_ACTIONS.openAiVsAi),
        }),
        ui.button({
          id: "btn-local-back",
          text: "Zurück",
          rect: BOTTOM_ROW[3]!,
          style: "kore.button.blue-back",
          action: ui.action.back(),
        }),
      ],
    })
  );

  // 4. KI-SCHWIERIGKEITS-SCREEN
  builder.addScreen(difficultyScreen());

  // 5. DYNAMISCHE MAP-SCREENS
  for (const intent of ["local", "online", "battle"] as const) {
    builder.addScreen(mapScreen(intent));
  }
  for (const difficulty of ["easy", "medium", "hard"] as const) {
    builder.addScreen(mapScreen("ai", difficulty));
  }

  return builder.build();
}

export class KoreMainMenuComposition {
  public build(): KoreMainMenuSettings {
    const menuMusic = koreAudio.command.menuMusic("kore.menu");
    const audioSettings = createKoreAudioSettings("kore.menu.runtime");

    const settings: KoreMainMenuSettings = {
      schemaVersion: 1,
      id: "kore.main-menu",
      ui: buildUiSettings(),
      audio: {
        ...audioSettings,
        framework: audio.createDefaultFramework(),
        persistentSources: [{ sourceId: "kore.menu", command: menuMusic }],
      },
      metadata: {
        schemaVersion: 1,
        title: "KORE",
        worldSize: { ...SIZE },
        confirmationCommands: [
          MAIN_ACTIONS.openAi,
          MAIN_ACTIONS.openBattle,
          MAIN_ACTIONS.openOnline,
          MAIN_ACTIONS.openFriends,
          MAIN_ACTIONS.openLocalMaps,
          MAIN_ACTIONS.openAiMaps,
          MAIN_ACTIONS.openAiVsAi,
          MAIN_ACTIONS.selectMap,
          MAIN_ACTIONS.startLocal,
          MAIN_ACTIONS.openSettings,
          MAIN_ACTIONS.openCredits,
        ],
        confirmationSoundId: koreAudio.sounds.uiConfirm,
      },
    };

    validateKoreMainMenuSettings(settings);
    return structuredClone(settings);
  }

  public buildJson(space: number = 2): string {
    return JSON.stringify(this.build(), null, space);
  }
}

export function createMainMenuComposition(): KoreMainMenuComposition {
  return new KoreMainMenuComposition();
}

export function validateKoreMainMenuSettings(value: unknown): asserts value is KoreMainMenuSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Malformed KORE main-menu settings");
  const settings = value as Partial<KoreMainMenuSettings>;
  if (
    settings.schemaVersion !== 1 ||
    settings.id !== "kore.main-menu" ||
    !settings.ui ||
    !settings.audio ||
    !settings.metadata ||
    settings.metadata.schemaVersion !== 1 ||
    settings.metadata.title !== "KORE" ||
    settings.metadata.worldSize?.width !== SIZE.width ||
    settings.metadata.worldSize?.height !== SIZE.height ||
    !Array.isArray(settings.metadata.confirmationCommands) ||
    settings.metadata.confirmationCommands.some((command) => typeof command !== "string") ||
    typeof settings.metadata.confirmationSoundId !== "string"
  )
    throw new Error("Malformed KORE main-menu settings");
  validateUiSettings(settings.ui);
  validateAudioSettings(settings.audio);
  if (!settings.audio.persistentSources.some((source) => source.sourceId === "kore.menu" && source.command.type === "playMusic" && source.command.soundId === koreAudio.music.menu))
    throw new Error("Main menu requires persistent menu music");
  for (const sound of settings.audio.persistentSources.map((source) => source.command.soundId))
    if (!(sound in koreAudio.assets)) throw new Error(`Unknown KORE menu sound '${sound}'`);
  if (!(settings.metadata.confirmationSoundId in koreAudio.assets))
    throw new Error(`Unknown KORE menu confirmation sound '${settings.metadata.confirmationSoundId}'`);
  engine.createEntity(JSON.parse(JSON.stringify(settings)) as JsonValue);
}

export const koreMenuCommands = MAIN_ACTIONS;

function mapScreen(intent: KoreMenuMapIntent, difficulty?: "easy" | "medium" | "hard") {
  const eligible = MAP_CATALOG.filter((entry) => entry.browserAvailable && (intent !== "battle" || entry.battleAvailable));
  const title = intent === "ai" ? `Choose Map for ${difficulty} KI` : "Choose Map";
  const elements = [
    ui.text({ id: `map-${intent}-${difficulty ?? "root"}-title`, text: title, rect: rect(155, 25, 580, 42), style: "kore.menu.map-title" }),
    ...(intent === "online"
      ? [ui.text({ id: "map-online-note", text: "Preference only — the server may choose Ice Map", rect: rect(155, 54, 560, 20), style: "kore.menu.map-note" })]
      : []),
    ...eligible.map((entry, index) =>
      ui.button({
        id: `map-${intent}-${difficulty ?? "root"}-${entry.id}`,
        text: `${entry.name} (${entry.id})`,
        rect: rect(150, 80 + index * 50, 500, 40),
        style: "kore.menu.map-row",
        action: ui.action.emit(MAIN_ACTIONS.selectMap, { intent, mapId: entry.id, ...(difficulty ? { difficulty } : {}) }),
      })
    ),
    ui.button({
      id: `map-${intent}-${difficulty ?? "root"}-back`,
      text: "Back",
      rect: rect(150, 80 + eligible.length * 50 + 8, 120, 34),
      style: "kore.button.blue-back",
      action: ui.action.back(),
    }),
  ];
  return ui.screen({ id: mapScreenId(intent, difficulty), layout: ui.layout.absolute(), elements });
}

function difficultyScreen() {
  return ui.screen({
    id: "difficulty",
    layout: ui.layout.absolute(),
    elements: [
      ui.text({ id: "difficulty-title", text: "Choose KI difficulty", rect: rect(265, 64, 300, 32), style: "kore.menu.difficulty-title" }),
      ...(["easy", "medium", "hard"] as const).map((difficulty, index) =>
        ui.button({
          id: `difficulty-${difficulty}`,
          text: `${difficulty[0]!.toUpperCase()}${difficulty.slice(1)} KI`,
          rect: rect(270, 130 + index * 50, 260, 40),
          style: BTN_STYLE,
          action: ui.action.emit(MAIN_ACTIONS.openAiMaps, { difficulty }),
        })
      ),
      ui.button({ id: "difficulty-back", text: "Zurück", rect: rect(270, 320, 260, 36), style: "kore.button.blue-back", action: ui.action.back() }),
    ],
  });
}

function rect(x: number, y: number, width: number, height: number) {
  return { x, y, width, height };
}

export function mapScreenId(intent: KoreMenuMapIntent, difficulty?: "easy" | "medium" | "hard"): string {
  return intent === "ai" ? `map-ai-${difficulty}` : `map-${intent}`;
}
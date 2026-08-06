import { audio, type AudioRuntimeSettings, validateAudioSettings } from "../../engine/audio-sdk/index.js";
import { engine } from "../../engine/sdk/index.js";
import type { JsonValue } from "../../engine/contracts/systemSettings.js";
import { ui, validateUiSettings, type UiMenuSettings } from "../../engine/ui-sdk/index.js";
import { MAP_CATALOG } from "../../content/mapCatalog.js";
import { koreAudio, createKoreAudioSettings } from "../audio.js";
import { KoreMenuCommand, KoreMenuElement, KoreMenuScreen, KoreMenuStyle, KoreMenuText } from "./menuVocabulary.js";

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

// The production menu is authored in world coordinates and consumed by the
// generic UI SDK. Keep these bounds aligned with the browser/world contract.
const BTN_W = 144;
const BTN_H = 58;
const BTN_STYLE = "kore.button.blue";

// Semantic Actions für KORE
export const MAIN_ACTIONS = {
  openOnline: KoreMenuCommand.OpenOnline,
  openBattle: KoreMenuCommand.OpenBattle,
  openAi: KoreMenuCommand.OpenAi,
  openLocalMaps: KoreMenuCommand.OpenLocalMaps,
  openAiMaps: KoreMenuCommand.OpenAiMaps,
  selectMap: KoreMenuCommand.SelectMap,
  startLocal: KoreMenuCommand.StartLocal,
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

  // 1. HAUPTMENÜ. All interaction remains declared in SDK settings; the
  // renderer only projects the resulting runtime state.
  builder.addScreen(
    ui.screen({
      id: "main",
       layout: ui.layout.vertical({ gap: 28, justify: "start", align: "center", padding: { top: 35, right: 30, bottom: 30, left: 30 } }),
       elements: [
         ui.text({ id: KoreMenuElement.MainTitle, text: KoreMenuText.Title, rect: rect(0, 0, 200, 48), style: KoreMenuStyle.MapTitle }),
         ui.container({
           id: KoreMenuElement.MainActions,
           rect: rect(0, 0, 740, 64),
            layout: ui.layout.horizontal({ gap: 4, justify: "space-evenly", align: "center" }),
           style: KoreMenuStyle.MainActions,
           elements: [
             ui.button({ id: KoreMenuElement.MainAi, text: KoreMenuText.Ai, rect: rect(0, 0, BTN_W, BTN_H), style: BTN_STYLE, action: ui.action.navigate(KoreMenuScreen.Difficulty) }),
             ui.button({ id: KoreMenuElement.MainBattle, text: KoreMenuText.Battle, rect: rect(0, 0, BTN_W, BTN_H), style: BTN_STYLE, action: ui.action.navigate(KoreMenuScreen.MapBattle) }),
             ui.button({ id: KoreMenuElement.MainOnline, text: KoreMenuText.Online, rect: rect(0, 0, BTN_W, BTN_H), style: BTN_STYLE, action: ui.action.navigate(KoreMenuScreen.MapOnline) }),
             ui.button({ id: KoreMenuElement.MainLocal, text: KoreMenuText.Local, rect: rect(0, 0, BTN_W, BTN_H), style: BTN_STYLE, action: ui.action.emit(MAIN_ACTIONS.startLocal) }),
             ui.button({ id: KoreMenuElement.MainMaps, text: KoreMenuText.ChooseMap, rect: rect(0, 0, BTN_W, BTN_H), style: BTN_STYLE, action: ui.action.emit(MAIN_ACTIONS.openLocalMaps) }),
           ],
         }),
       ],
    })
  );

  // 2. Map and difficulty screens are all declared in the same SDK menu.
  for (const intent of ["local", "online", "battle"] as const) {
    builder.addScreen(mapScreen(intent));
  }
  builder.addScreen(difficultyScreen());
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
          MAIN_ACTIONS.openLocalMaps,
          MAIN_ACTIONS.openAiMaps,
          MAIN_ACTIONS.selectMap,
          MAIN_ACTIONS.startLocal,
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

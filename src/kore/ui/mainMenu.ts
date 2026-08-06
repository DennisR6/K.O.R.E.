import { audio, type AudioRuntimeSettings, validateAudioSettings } from "../../engine/audio-sdk/index.js";
import { engine } from "../../engine/sdk/index.js";
import type { JsonValue } from "../../engine/contracts/systemSettings.js";
import { ui, validateUiSettings, type UiMenuSettings } from "../../engine/ui-sdk/index.js";
import { MAP_CATALOG } from "../../content/mapCatalog.js";
import { koreAudio, createKoreAudioSettings } from "../audio.js";
import { KoreMenuCommand, KoreMenuElement, KoreMenuScreen, KoreMenuStyle, KoreMenuText } from "./menuVocabulary.js";
import { createEnglishLanguage, translate, type LanguageCatalog } from "../../i18n/language.js";
import { getSelectableGameModes } from "../../rules/modeCatalog.js";

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

const BTN_W = 140;
const BTN_H = 48;
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
  openOnlineFriends: "kore.menu.open-online-friends",
} as const;

function buildUiSettings(language: LanguageCatalog): UiMenuSettings {
  const builder = ui.createMenu({ id: "kore.main-menu.ui", size: SIZE });

  // 0. LANDING SCREEN
  builder.addScreen(
    ui.screen({
      id: "landing",
      layout: ui.layout.absolute(),
      elements: [
        ui.text({
          id: "landing-prompt",
          text: translate(language, KoreMenuText.LandingPrompt),
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

  // 1. HAUPTMENÜ (Online, Lokal, Settings, Credits)
  builder.addScreen(
    ui.screen({
      id: "main",
      layout: ui.layout.vertical({ gap: 20, justify: "center", align: "center", padding: { top: 35, right: 30, bottom: 40, left: 30 } }),
      elements: [
        ui.text({ id: KoreMenuElement.MainTitle, text: translate(language, KoreMenuText.Title), rect: rect(0, 0, 200, 48), style: KoreMenuStyle.MapTitle }),
        ui.container({
          id: KoreMenuElement.MainActions,
          rect: rect(0, 0, 740, 240),
          layout: ui.layout.horizontal({ gap: 12, justify: "center", align: "center", padding: { top: 200, right: 0, bottom: 0, left: 0 } }),
          style: KoreMenuStyle.MainActions,
          elements: [
            ui.button({ id: "main-btn-online", text: translate(language, KoreMenuText.Online), rect: rect(0, 0, BTN_W, BTN_H), style: BTN_STYLE, action: ui.action.navigate("online_sub") }),
            ui.button({ id: "main-btn-local", text: translate(language, KoreMenuText.Local), rect: rect(0, 0, BTN_W, BTN_H), style: BTN_STYLE, action: ui.action.navigate("local_sub") }),
            ui.button({ id: "main-btn-settings", text: "Settings", rect: rect(0, 0, BTN_W, BTN_H), style: BTN_STYLE, action: ui.action.navigate("settings") }),
            ui.button({ id: "main-btn-credits", text: "Credits", rect: rect(0, 0, BTN_W, BTN_H), style: BTN_STYLE, action: ui.action.navigate("credits") }),
          ],
        }),
      ],
    })
  );

  // 2. ONLINE SUBMENU (Matchmaking, vs Friends)
  builder.addScreen(
    ui.screen({
      id: "online_sub",
      layout: ui.layout.vertical({ gap: 20, justify: "center", align: "center", padding: { top: 35, right: 30, bottom: 40, left: 30 } }),
      elements: [
        ui.text({ id: "online-sub-title", text: translate(language, KoreMenuText.Online), rect: rect(0, 0, 200, 40), style: KoreMenuStyle.MapTitle }),
        ui.container({
          id: "online-sub-actions",
          rect: rect(0, 0, 740, 200),
          layout: ui.layout.vertical({ gap: 12, justify: "center", align: "center" }),
          elements: [
            ui.button({ id: "online-btn-matchmaking", text: "Matchmaking", rect: rect(0, 0, 180, BTN_H), style: BTN_STYLE, action: ui.action.navigate(KoreMenuScreen.MapOnline) }),
            ui.button({ id: "online-btn-friends", text: "vs Friends", rect: rect(0, 0, 180, BTN_H), style: BTN_STYLE, action: ui.action.emit(MAIN_ACTIONS.openOnlineFriends) }),
            ui.button({ id: "online-btn-back", text: translate(language, KoreMenuText.Back), rect: rect(0, 0, 120, 36), style: "kore.button.blue-back", action: ui.action.back() }),
          ],
        }),
      ],
    })
  );

  // 3. LOKAL SUBMENU (vs KI, vs Player, KI vs KI)
  builder.addScreen(
    ui.screen({
      id: "local_sub",
      layout: ui.layout.vertical({ gap: 20, justify: "center", align: "center", padding: { top: 35, right: 30, bottom: 40, left: 30 } }),
      elements: [
        ui.text({ id: "local-sub-title", text: translate(language, KoreMenuText.Local), rect: rect(0, 0, 200, 40), style: KoreMenuStyle.MapTitle }),
        ui.container({
          id: "local-sub-actions",
          rect: rect(0, 0, 740, 220),
          layout: ui.layout.vertical({ gap: 12, justify: "center", align: "center" }),
          elements: [
            ui.button({ id: "local-btn-vski", text: "vs KI", rect: rect(0, 0, 180, BTN_H), style: BTN_STYLE, action: ui.action.navigate(KoreMenuScreen.Difficulty) }),
            ui.button({ id: "local-btn-vsplayer", text: "vs Player", rect: rect(0, 0, 180, BTN_H), style: BTN_STYLE, action: ui.action.emit(MAIN_ACTIONS.startLocal) }),
            ui.button({ id: "local-btn-kivski", text: "KI vs KI", rect: rect(0, 0, 180, BTN_H), style: BTN_STYLE, action: ui.action.navigate(KoreMenuScreen.MapBattle) }),
            ui.button({ id: "local-btn-back", text: translate(language, KoreMenuText.Back), rect: rect(0, 0, 120, 36), style: "kore.button.blue-back", action: ui.action.back() }),
          ],
        }),
      ],
    })
  );

  // 4. SETTINGS SCREEN
  builder.addScreen(
    ui.screen({
      id: "settings",
      layout: ui.layout.vertical({ gap: 20, justify: "center", align: "center" }),
      elements: [
        ui.text({ id: "settings-title", text: "Settings", rect: rect(0, 0, 200, 40), style: KoreMenuStyle.MapTitle }),
        ui.button({ id: "settings-back", text: translate(language, KoreMenuText.Back), rect: rect(0, 0, 120, 36), style: "kore.button.blue-back", action: ui.action.back() }),
      ],
    })
  );

  // 5. CREDITS SCREEN
  builder.addScreen(
    ui.screen({
      id: "credits",
      layout: ui.layout.vertical({ gap: 20, justify: "center", align: "center" }),
      elements: [
        ui.text({ id: "credits-title", text: "Credits", rect: rect(0, 0, 200, 40), style: KoreMenuStyle.MapTitle }),
        ui.button({ id: "credits-back", text: translate(language, KoreMenuText.Back), rect: rect(0, 0, 120, 36), style: "kore.button.blue-back", action: ui.action.back() }),
      ],
    })
  );

  // 6. MAP & DIFFICULTY SCREENS
  for (const intent of ["local", "online", "battle"] as const) {
    builder.addScreen(mapScreen(intent, undefined, language));
  }
  builder.addScreen(difficultyScreen(language));
  for (const difficulty of ["easy", "medium", "hard"] as const) {
    builder.addScreen(mapScreen("ai", difficulty, language));
  }

  return builder.build();
}

export class KoreMainMenuComposition {
  public constructor(private readonly language: LanguageCatalog = createEnglishLanguage()) {}
  public build(): KoreMainMenuSettings {
    const menuMusic = koreAudio.command.menuMusic("kore.menu");
    const audioSettings = createKoreAudioSettings("kore.menu.runtime");

    const settings: KoreMainMenuSettings = {
      schemaVersion: 1,
      id: "kore.main-menu",
      ui: buildUiSettings(this.language),
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
          MAIN_ACTIONS.openOnlineFriends,
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

export function createMainMenuComposition(language?: LanguageCatalog): KoreMainMenuComposition {
  return new KoreMainMenuComposition(language);
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

function mapScreen(intent: KoreMenuMapIntent, difficulty: "easy" | "medium" | "hard" | undefined, language: LanguageCatalog) {
  const eligible = MAP_CATALOG.filter((entry) => entry.browserAvailable && (intent !== "battle" || entry.battleAvailable));
  const rowHeight = intent === "local" || intent === "online" ? 18 : 36;
  const elements = [
    ui.text({ id: `map-${intent}-${difficulty ?? "root"}-title`, text: translate(language, KoreMenuText.ChooseMap), rect: rect(155, 25, 580, 42), style: "kore.menu.map-title" }),
    ...(intent === "online"
      ? [ui.text({ id: "map-online-note", text: translate(language, KoreMenuText.OnlineMapNote), rect: rect(155, 54, 560, 20), style: "kore.menu.map-note" })]
      : []),
    ...eligible.flatMap((entry) => (intent === "local" || intent === "online" ? getSelectableGameModes() : [undefined]).map((mode, index) =>
      ui.button({
        id: `map-${intent}-${difficulty ?? "root"}-${entry.id}${mode ? `-${mode.id}` : ""}`,
        text: `${entry.name}${mode ? ` - ${mode.name}` : ""} (${entry.id})`,
        rect: rect(150, 80 + (eligible.indexOf(entry) * (intent === "local" || intent === "online" ? getSelectableGameModes().length : 1) + index) * rowHeight, 500, rowHeight - 2),
        style: "kore.menu.map-row",
        action: ui.action.emit(MAIN_ACTIONS.selectMap, { intent, mapId: entry.id, ...(mode ? { modeId: mode.id } : {}), ...(difficulty ? { difficulty } : {}) }),
      })
    )),
    ui.button({
      id: `map-${intent}-${difficulty ?? "root"}-back`,
      text: translate(language, KoreMenuText.Back),
      rect: rect(150, 80 + eligible.length * ((intent === "local" || intent === "online") ? getSelectableGameModes().length : 1) * rowHeight + 8, 120, 34),
      style: "kore.button.blue-back",
      action: ui.action.back(),
    }),
  ];
  return ui.screen({ id: mapScreenId(intent, difficulty), layout: ui.layout.absolute(), elements });
}

function difficultyScreen(language: LanguageCatalog) {
  return ui.screen({
    id: "difficulty",
    layout: ui.layout.absolute(),
    elements: [
      ui.text({ id: "difficulty-title", text: translate(language, KoreMenuText.ChooseAiDifficulty), rect: rect(265, 64, 300, 32), style: "kore.menu.difficulty-title" }),
      ...(["easy", "medium", "hard"] as const).map((difficulty, index) =>
        ui.button({
          id: `difficulty-${difficulty}`,
          text: `${difficulty[0]!.toUpperCase()}${difficulty.slice(1)} KI`,
          rect: rect(270, 130 + index * 50, 260, 40),
          style: BTN_STYLE,
          action: ui.action.emit(MAIN_ACTIONS.openAiMaps, { difficulty }),
        })
      ),
      ui.button({ id: "difficulty-back", text: translate(language, KoreMenuText.Back), rect: rect(270, 320, 260, 36), style: "kore.button.blue-back", action: ui.action.back() }),
    ],
  });
}

function rect(x: number, y: number, width: number, height: number) {
  return { x, y, width, height };
}

export function mapScreenId(intent: KoreMenuMapIntent, difficulty?: "easy" | "medium" | "hard"): string {
  return intent === "ai" ? `map-ai-${difficulty}` : `map-${intent}`;
}
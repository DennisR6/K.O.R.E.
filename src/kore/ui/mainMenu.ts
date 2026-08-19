import { audio, type AudioRuntimeSettings, validateAudioSettings } from "@coffeemakerstudio/roast";
import { engine } from "@coffeemakerstudio/roast";
import type { JsonValue } from "@coffeemakerstudio/roast";
import { ui, validateUiSettings, type UiMenuSettings } from "@coffeemakerstudio/drip";
import { getFinalReleaseMapEntries } from "../../content/mapCatalog.js";
import { koreAudio, createKoreAudioSettings } from "../audio.js";
import { KoreMenuCommand, KoreMenuDifficulty, KoreMenuElement, KoreMenuId, KoreMenuMapIntent, KoreMenuScreen, KoreMenuStyle, KoreMenuText, isKoreMenuCommand, koreMenuDifficultyElementId, koreMenuMapBackElementId, koreMenuMapElementId, koreMenuMapScreen, koreMenuMapTitleElementId } from "./menuVocabulary.js";
import { createEnglishLanguage, translate, type LanguageCatalog } from "../../i18n/language.js";
import { getSelectableGameModes } from "../../rules/modeCatalog.js";

export { KoreMenuCommand, KoreMenuDifficulty, KoreMenuMapIntent } from "./menuVocabulary.js";
export type KoreMainMenuSettings = { schemaVersion: 1; id: KoreMenuId.Composition; ui: UiMenuSettings; audio: AudioRuntimeSettings; metadata: { schemaVersion: 1; title: string; worldSize: { width: number; height: number }; confirmationCommands: KoreMenuCommand[]; confirmationSoundId: string } };

export const MAIN_ACTIONS = {
  openOnline: KoreMenuCommand.OpenOnline,
  openBattle: KoreMenuCommand.OpenBattle,
  openAi: KoreMenuCommand.OpenAi,
  openLocalMaps: KoreMenuCommand.OpenLocalMaps,
  openAiMaps: KoreMenuCommand.OpenAiMaps,
  selectMap: KoreMenuCommand.SelectMap,
  startLocal: KoreMenuCommand.StartLocal,
  openOnlineFriends: KoreMenuCommand.OpenOnlineFriends,
} as const;

const SIZE = { width: 800, height: 450 };
const MENU_TITLE = "KORE";

// const BTN_W = 180;
// const BTN_H = 48;

/** The sole production source for KORE's menu screens, actions, and audio intent. */
export class KoreMainMenuComposition {
  public constructor(private readonly language: LanguageCatalog = createEnglishLanguage()) { }
  public build(): KoreMainMenuSettings {
    const menuMusic = koreAudio.command.menuMusic(KoreMenuId.AudioSource);
    const audioSettings = createKoreAudioSettings(KoreMenuId.AudioRuntime);
    const settings: KoreMainMenuSettings = {
      schemaVersion: 1,
      id: KoreMenuId.Composition,
      ui: buildUiSettings(this.language),
      audio: { ...audioSettings, framework: audio.createDefaultFramework(), persistentSources: [{ sourceId: KoreMenuId.AudioSource, command: menuMusic }] },
      metadata: { schemaVersion: 1, title: MENU_TITLE, worldSize: { ...SIZE }, confirmationCommands: [KoreMenuCommand.OpenAi, KoreMenuCommand.OpenBattle, KoreMenuCommand.OpenOnline, KoreMenuCommand.OpenOnlineFriends, KoreMenuCommand.OpenLocalMaps, KoreMenuCommand.OpenAiMaps, KoreMenuCommand.SelectMap, KoreMenuCommand.StartLocal, KoreMenuCommand.OpenMods, KoreMenuCommand.ImportModFile, KoreMenuCommand.ImportModPaste, KoreMenuCommand.ValidateMod, KoreMenuCommand.LaunchMod1v1, KoreMenuCommand.LaunchModAiBattle], confirmationSoundId: koreAudio.sounds.uiConfirm },
    };
    validateKoreMainMenuSettings(settings);
    return structuredClone(settings);
  }
  public buildJson(space: number = 2): string { return JSON.stringify(this.build(), null, space); }
}

export function createMainMenuComposition(language?: LanguageCatalog): KoreMainMenuComposition { return new KoreMainMenuComposition(language); }

export function validateKoreMainMenuSettings(value: unknown): asserts value is KoreMainMenuSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Malformed KORE main-menu settings");
  const settings = value as Partial<KoreMainMenuSettings>;
  if (settings.schemaVersion !== 1 || settings.id !== KoreMenuId.Composition || !settings.ui || !settings.audio || !settings.metadata || settings.metadata.schemaVersion !== 1 || settings.metadata.title !== MENU_TITLE || settings.metadata.worldSize?.width !== SIZE.width || settings.metadata.worldSize?.height !== SIZE.height || !Array.isArray(settings.metadata.confirmationCommands) || settings.metadata.confirmationCommands.some(command => typeof command !== "string" || !isKoreMenuCommand(command)) || typeof settings.metadata.confirmationSoundId !== "string") throw new Error("Malformed KORE main-menu settings");
  validateUiSettings(settings.ui); validateAudioSettings(settings.audio);
  if (!settings.audio.persistentSources.some(source => source.sourceId === KoreMenuId.AudioSource && source.command.type === "playMusic" && source.command.soundId === koreAudio.music.menu)) throw new Error("Main menu requires persistent menu music");
  for (const sound of settings.audio.persistentSources.map(source => source.command.soundId)) if (!(sound in koreAudio.assets)) throw new Error(`Unknown KORE menu sound '${sound}'`);
  if (!(settings.metadata.confirmationSoundId in koreAudio.assets)) throw new Error(`Unknown KORE menu confirmation sound '${settings.metadata.confirmationSoundId}'`);
  engine.createEntity(JSON.parse(JSON.stringify(settings)) as JsonValue);
}

export const koreMenuCommands = KoreMenuCommand;

function buildUiSettings(language: LanguageCatalog): UiMenuSettings {
  const builder = ui.createMenu({ id: KoreMenuId.Runtime, size: SIZE });

  // 0. LANDING SCREEN
  builder.addScreen(
    ui.screen({
      id: KoreMenuScreen.Landing,
      layout: ui.layout.absolute(),
      elements: [
        ui.text({
          id: KoreMenuElement.LandingPrompt,
          text: translate(language, KoreMenuText.LandingPrompt),
          rect: rect(160, 330, 480, 58),
          style: KoreMenuStyle.LandingPrompt,
          visible: true,
        }),
        ui.button({
          id: KoreMenuElement.LandingStart,
          text: "",
          rect: rect(0, 0, 800, 450),
          style: KoreMenuStyle.LandingHitbox,
          action: ui.action.navigate(KoreMenuScreen.Main),
        }),
      ],
    })
  );

  // 1. MAIN MENU
  builder.addScreen(
    ui.screen({
      id: KoreMenuScreen.Main,
      layout: ui.layout.absolute(),
      elements: [
        ui.container({
          id: "HelpContainer",
          rect: rect(30, 85, 740, 240),
          style: "HelpContainer",
          elements: [
            ui.button({
              id: "HelpButton",
              rect: rect(250, 40, 240, 270),
              style: "HelpButton",
              text: ""
            }),
            ui.container({
              id: KoreMenuElement.MainActions,
              rect: rect(0, 0, 740, 240),
              layout: ui.layout.vertical({
                gap: 12,
                justify: "center",
                align: "center",
                padding: { top: 0, right: 0, bottom: 30, left: 0 }
              }),
              style: KoreMenuStyle.MainActions,
              elements: [
                ui.text({
                  id: KoreMenuElement.MainTitle,
                  text: translate(language, KoreMenuText.Title),
                  rect: rect(0, 0, 60, 48),
                  style: KoreMenuStyle.MapTitle
                }),

                // Online Button
                ui.container({
                  id: "image-text-button-online",
                  rect: { x: 0, y: 0, width: 220, height: 50 },
                  layout: ui.layout.absolute(),
                  style: KoreMenuStyle.OnlineButton,
                  groupHover: true,
                  elements: [
                    ui.button({
                      id: "action-online",
                      text: "",
                      rect: { x: 0, y: 0, width: 220, height: 50 },
                      style: KoreMenuStyle.OnlineButton,
                      action: ui.action.navigate(KoreMenuScreen.OnlineSub),
                    }),
                    ui.image({
                      id: "icon-online",
                      source: "./public/picture/menuicons/users.svg",
                      rect: { x: 12, y: 10, width: 40, height: 30 },
                      style: KoreMenuStyle.OnlineButton
                    }),
                    ui.image({
                      id: "trenn-online",
                      source: "./public/picture/menuicons/tally-1.svg",
                      rect: { x: 55, y: 15, width: 24, height: 24 },
                      style: KoreMenuStyle.OnlineButton
                    }),
                    ui.text({
                      id: "label-online",
                      text: translate(language, KoreMenuText.Online),
                      rect: { x: 75, y: 15, width: 140, height: 20 },
                      style: KoreMenuStyle.OnlineButton
                    })
                  ]
                }),

                // Local Button
                ui.container({
                  id: "image-text-button-local",
                  rect: { x: 0, y: 0, width: 220, height: 50 },
                  layout: ui.layout.absolute(),
                  style: KoreMenuStyle.LocalButton,
                  groupHover: true,
                  elements: [
                    ui.button({
                      id: "action-local",
                      text: "",
                      rect: { x: 0, y: 0, width: 220, height: 50 },
                      style: KoreMenuStyle.LocalButton,
                      action: ui.action.navigate(KoreMenuScreen.LocalSub)
                    }),
                    ui.image({
                      id: "icon-local",
                      source: "./public/picture/menuicons/gamepad-2.svg",
                      rect: { x: 12, y: 10, width: 40, height: 30 },
                      style: KoreMenuStyle.LocalButton
                    }),
                    ui.image({
                      id: "trenn-local",
                      source: "./public/picture/menuicons/tally-1.svg",
                      rect: { x: 55, y: 15, width: 24, height: 24 },
                      style: KoreMenuStyle.LocalButton
                    }),
                    ui.text({
                      id: "label-local",
                      text: translate(language, KoreMenuText.Local),
                      rect: { x: 75, y: 15, width: 140, height: 20 },
                      style: KoreMenuStyle.LocalButton
                    })
                  ]
                }),

                // Settings Button
                ui.container({
                  id: "image-text-button-settings",
                  rect: { x: 0, y: 0, width: 220, height: 50 },
                  layout: ui.layout.absolute(),
                  style: KoreMenuStyle.SettingsButton,
                  groupHover: true,
                  elements: [
                    ui.button({
                      id: "action-settings",
                      text: "",
                      rect: { x: 0, y: 0, width: 220, height: 50 },
                      style: KoreMenuStyle.SettingsButton,
                      action: ui.action.navigate(KoreMenuScreen.Settings)
                    }),
                    ui.image({
                      id: "icon-settings",
                      source: "./public/picture/menuicons/settings.svg",
                      rect: { x: 12, y: 10, width: 40, height: 30 },
                      style: KoreMenuStyle.SettingsButton
                    }),
                    ui.image({
                      id: "trenn-settings",
                      source: "./public/picture/menuicons/tally-1.svg",
                      rect: { x: 55, y: 15, width: 24, height: 24 },
                      style: KoreMenuStyle.SettingsButton
                    }),
                    ui.text({
                      id: "label-settings",
                      text: "Settings",
                      rect: { x: 75, y: 15, width: 140, height: 20 },
                      style: KoreMenuStyle.SettingsButton
                    })
                  ]
                }),

                // Credits Button
                ui.container({
                  id: "image-text-button-credits",
                  rect: { x: 0, y: 0, width: 220, height: 50 },
                  layout: ui.layout.absolute(),
                  style: KoreMenuStyle.CreditsButton,
                  groupHover: true,
                  elements: [
                    ui.button({
                      id: "action-credits",
                      text: "",
                      rect: { x: 0, y: 0, width: 220, height: 50 },
                      style: KoreMenuStyle.CreditsButton,
                      action: ui.action.navigate(KoreMenuScreen.Credits)
                    }),
                    ui.image({
                      id: "icon-credits",
                      source: "./public/picture/menuicons/circle-star.svg",
                      rect: { x: 12, y: 10, width: 40, height: 30 },
                      style: KoreMenuStyle.CreditsButton
                    }),
                    ui.image({
                      id: "trenn-credits",
                      source: "./public/picture/menuicons/tally-1.svg",
                      rect: { x: 55, y: 15, width: 24, height: 24 },
                      style: KoreMenuStyle.CreditsButton
                    }),
                    ui.text({
                      id: "label-credits",
                      text: "Credits",
                      rect: { x: 75, y: 15, width: 140, height: 20 },
                      style: KoreMenuStyle.CreditsButton
                    })
                  ]
                })
              ]
            })
          ]
        }),
        ui.container({
            id: "MainBottomActions",
            rect: rect(0, 342, 800, 58),
            layout: ui.layout.horizontal({ gap: 16, justify: "center", align: "center" }),
            elements: [
                ui.button({ id: KoreMenuElement.MainAi, text: translate(language, KoreMenuText.Ai), rect: rect(0, 0, 110, 58), style: KoreMenuStyle.MainButton, action: ui.action.emit(KoreMenuCommand.OpenAi) }),
                ui.button({ id: KoreMenuElement.MainBattle, text: translate(language, KoreMenuText.Battle), rect: rect(0, 0, 110, 58), style: KoreMenuStyle.MainButton, action: ui.action.emit(KoreMenuCommand.OpenBattle) }),
                ui.button({ id: KoreMenuElement.MainOnline, text: translate(language, KoreMenuText.Online), rect: rect(0, 0, 110, 58), style: KoreMenuStyle.MainButton, action: ui.action.emit(KoreMenuCommand.OpenOnline) }),
                ui.button({ id: KoreMenuElement.MainLocal, text: translate(language, KoreMenuText.Local), rect: rect(0, 0, 110, 58), style: KoreMenuStyle.MainButton, action: ui.action.emit(KoreMenuCommand.StartLocal) }),
                ui.button({ id: KoreMenuElement.MainMaps, text: translate(language, KoreMenuText.ChooseMap), rect: rect(0, 0, 110, 58), style: KoreMenuStyle.MainButton, action: ui.action.emit(KoreMenuCommand.OpenLocalMaps) }),
                ui.button({ id: KoreMenuElement.MainMods, text: translate(language, KoreMenuText.Mods), rect: rect(0, 0, 110, 58), style: KoreMenuStyle.MainButton, action: ui.action.emit(KoreMenuCommand.OpenMods) }),
            ],
        }),
      ]
    })
  );

  // 2. ONLINE AND LOCAL SUBMENUS
  builder.addScreen(
    ui.screen({
      id: KoreMenuScreen.OnlineSub,
      layout: ui.layout.vertical({
        gap: 20,
        justify: "center",
        align: "center",
        padding: { top: 0, right: 30, bottom: 40, left: 30 }
      }),
      elements: [
        ui.container({
          id: "OnlineSubHelpContainer",
          rect: rect(0, 0, 740, 240),
          style: "HelpContainer",
          elements: [
            ui.button({
              id: "OnlineSubHelpButton",
              rect: rect(250, 40, 240, 270),
              style: "HelpButton",
              text: ""
            }),
            ui.container({
              id: "OnlineSubActions",
              rect: rect(0, 0, 740, 240),
              layout: ui.layout.vertical({
                gap: 12,
                justify: "center",
                align: "center",
                padding: { top: 0, right: 0, bottom: 30, left: 0 }
              }),
              style: KoreMenuStyle.MainActions,
              elements: [
                // Titel des Submenüs
                ui.text({
                  id: "OnlineSubTitle",
                  text: translate(language, KoreMenuText.Online),
                  rect: rect(0, 0, 60, 48),
                  style: KoreMenuStyle.MapTitle
                }),

                // Matchmaking Button
                ui.container({
                  id: "image-text-button-matchmaking",
                  rect: { x: 0, y: 0, width: 220, height: 50 },
                  layout: ui.layout.absolute(),
                  style: KoreMenuStyle.OnlineButton,
                  groupHover: true,
                  elements: [
                    ui.button({
                      id: "online-btn-matchmaking",
                      text: "",
                      rect: { x: 0, y: 0, width: 220, height: 50 },
                      style: KoreMenuStyle.OnlineButton,
                      action: ui.action.navigate(KoreMenuScreen.MapOnline)
                    }),
                    ui.image({
                      id: "icon-matchmaking",
                      source: "./public/picture/menuicons/hand-fist.svg",
                      rect: { x: 12, y: 10, width: 40, height: 30 },
                      style: KoreMenuStyle.OnlineButton
                    }),
                    ui.image({
                      id: "trenn-matchmaking",
                      source: "./public/picture/menuicons/tally-1.svg",
                      rect: { x: 55, y: 15, width: 24, height: 24 },
                      style: KoreMenuStyle.OnlineButton
                    }),
                    ui.text({
                      id: "label-matchmaking",
                      text: translate(language, KoreMenuText.Matchmaking),
                      rect: { x: 75, y: 15, width: 140, height: 20 },
                      style: KoreMenuStyle.OnlineButton
                    })
                  ]
                }),

                // vs Friends Button
                ui.container({
                  id: "image-text-button-friends",
                  rect: { x: 0, y: 0, width: 220, height: 50 },
                  layout: ui.layout.absolute(),
                  style: KoreMenuStyle.OnlineButton,
                  groupHover: true,
                  elements: [
                    ui.button({
                      id: "online-btn-friends",
                      text: "",
                      rect: { x: 0, y: 0, width: 220, height: 50 },
                      style: KoreMenuStyle.OnlineButton,
                      action: ui.action.emit(KoreMenuCommand.OpenOnlineFriends)
                    }),
                    ui.image({
                      id: "icon-friends",
                      source: "./public/picture/menuicons/users.svg",
                      rect: { x: 12, y: 10, width: 40, height: 30 },
                      style: KoreMenuStyle.OnlineButton
                    }),
                    ui.image({
                      id: "trenn-friends",
                      source: "./public/picture/menuicons/tally-1.svg",
                      rect: { x: 55, y: 15, width: 24, height: 24 },
                      style: KoreMenuStyle.OnlineButton
                    }),
                    ui.text({
                      id: "label-friends",
                      text: "vs Friends",
                      rect: { x: 75, y: 15, width: 140, height: 20 },
                      style: KoreMenuStyle.OnlineButton
                    })
                  ]
                }),

                // Back Button
                ui.container({
                  id: "image-text-button-back",
                  rect: { x: 0, y: 0, width: 220, height: 50 },
                  layout: ui.layout.absolute(),
                  style: KoreMenuStyle.Back,
                  groupHover: true,
                  elements: [
                    ui.button({
                      id: "online-btn-back",
                      text: "",
                      rect: { x: 0, y: 0, width: 220, height: 50 },
                      style: KoreMenuStyle.Back,
                      action: ui.action.navigate(KoreMenuScreen.Main) // Navigiert zurück zum Hauptmenü
                    }),
                    ui.image({
                      id: "icon-back",
                      source: "./public/picture/menuicons/log-out.svg", // Pfad für das Pfeil-Icon ggf. anpassen
                      rect: { x: 12, y: 10, width: 40, height: 30 },
                      style: KoreMenuStyle.Back
                    }),
                    ui.image({
                      id: "trenn-back",
                      source: "./public/picture/menuicons/tally-1.svg",
                      rect: { x: 55, y: 15, width: 24, height: 24 },
                      style: KoreMenuStyle.Back
                    }),
                    ui.text({
                      id: "label-back",
                      text: translate(language, KoreMenuText.Back),
                      rect: { x: 75, y: 15, width: 140, height: 20 },
                      style: KoreMenuStyle.Back
                    })
                  ]
                })
              ]
            })
          ]
        })
      ]
    })
  );
  builder.addScreen(
    ui.screen({
      id: KoreMenuScreen.LocalSub,
      layout: ui.layout.vertical({
        gap: 20,
        justify: "center",
        align: "center",
        padding: { top: 0, right: 30, bottom: 40, left: 30 }
      }),
      elements: [
        ui.container({
          id: "LocalSubHelpContainer",
          rect: rect(0, 0, 740, 240),
          style: "HelpContainer",
          elements: [
            ui.button({
              id: "LocalSubHelpButton",
              rect: rect(250, 40, 240, 270),
              style: "HelpButton",
              text: ""
            }),
            ui.container({
              id: "LocalSubActions",
              rect: rect(0, 0, 740, 240),
              layout: ui.layout.vertical({
                gap: 12,
                justify: "center",
                align: "center",
                padding: { top: 0, right: 0, bottom: 30, left: 0 }
              }),
              style: KoreMenuStyle.MainActions,
              elements: [
                // Titel des Submenüs
                ui.text({
                  id: "LocalSubTitle",
                  text: translate(language, KoreMenuText.Local),
                  rect: rect(0, 0, 60, 48),
                  style: KoreMenuStyle.MapTitle
                }),

                // 1. Button: vs Player
                ui.container({
                  id: "image-text-button-vsplayer",
                  rect: { x: 0, y: 0, width: 220, height: 50 },
                  layout: ui.layout.absolute(),
                  style: KoreMenuStyle.LocalButton,
                  groupHover: true,
                  elements: [
                    ui.button({
                      id: "local-btn-vsplayer",
                      text: "",
                      rect: { x: 0, y: 0, width: 220, height: 50 },
                      style: KoreMenuStyle.LocalButton,
                      action: ui.action.emit(KoreMenuCommand.StartLocal)
                    }),
                    ui.image({
                      id: "icon-vsplayer",
                      source: "./public/picture/menuicons/users-round.svg", // Pfad ggf. anpassen
                      rect: { x: 12, y: 10, width: 40, height: 30 },
                      style: KoreMenuStyle.LocalButton
                    }),
                    ui.image({
                      id: "trenn-vsplayer",
                      source: "./public/picture/menuicons/tally-1.svg",
                      rect: { x: 55, y: 15, width: 24, height: 24 },
                      style: KoreMenuStyle.LocalButton
                    }),
                    ui.text({
                      id: "label-vsplayer",
                      text: "vs Player",
                      rect: { x: 75, y: 15, width: 140, height: 20 },
                      style: KoreMenuStyle.LocalButton
                    })
                  ]
                }),

                // 2. Button: vs KI
                ui.container({
                  id: "image-text-button-vski",
                  rect: { x: 0, y: 0, width: 220, height: 50 },
                  layout: ui.layout.absolute(),
                  style: KoreMenuStyle.LocalButton,
                  groupHover: true,
                  elements: [
                    ui.button({
                      id: "local-btn-vski",
                      text: "",
                      rect: { x: 0, y: 0, width: 220, height: 50 },
                      style: KoreMenuStyle.LocalButton,
                      action: ui.action.navigate(KoreMenuScreen.Difficulty)
                    }),
                    ui.image({
                      id: "icon-vski",
                      source: "./public/picture/menuicons/bot.svg", // Pfad ggf. anpassen
                      rect: { x: 12, y: 10, width: 40, height: 30 },
                      style: KoreMenuStyle.LocalButton
                    }),
                    ui.image({
                      id: "trenn-vski",
                      source: "./public/picture/menuicons/tally-1.svg",
                      rect: { x: 55, y: 15, width: 24, height: 24 },
                      style: KoreMenuStyle.LocalButton
                    }),
                    ui.text({
                      id: "label-vski",
                      text: "vs KI",
                      rect: { x: 75, y: 15, width: 140, height: 20 },
                      style: KoreMenuStyle.LocalButton
                    })
                  ]
                }),

                // 3. Button: KI vs KI
                ui.container({
                  id: "image-text-button-kivski",
                  rect: { x: 0, y: 0, width: 220, height: 50 },
                  layout: ui.layout.absolute(),
                  style: KoreMenuStyle.LocalButton,
                  groupHover: true,
                  elements: [
                    ui.button({
                      id: "local-btn-kivski",
                      text: "",
                      rect: { x: 0, y: 0, width: 220, height: 50 },
                      style: KoreMenuStyle.LocalButton,
                      action: ui.action.navigate(KoreMenuScreen.MapBattle)
                    }),
                    ui.image({
                      id: "icon-kivski",
                      source: "./public/picture/menuicons/bot-message-square.svg", // Pfad ggf. anpassen
                      rect: { x: 12, y: 10, width: 40, height: 30 },
                      style: KoreMenuStyle.LocalButton
                    }),
                    ui.image({
                      id: "trenn-kivski",
                      source: "./public/picture/menuicons/tally-1.svg",
                      rect: { x: 55, y: 15, width: 24, height: 24 },
                      style: KoreMenuStyle.LocalButton
                    }),
                    ui.text({
                      id: "label-kivski",
                      text: "KI vs KI",
                      rect: { x: 75, y: 15, width: 140, height: 20 },
                      style: KoreMenuStyle.LocalButton
                    })
                  ]
                }),

                // 4. Button: Zurück
                ui.container({
                  id: "image-text-button-local-back",
                  rect: { x: 0, y: 0, width: 220, height: 50 },
                  layout: ui.layout.absolute(),
                  style: KoreMenuStyle.Back,
                  groupHover: true,
                  elements: [
                    ui.button({
                      id: "local-btn-back",
                      text: "",
                      rect: { x: 0, y: 0, width: 220, height: 50 },
                      style: KoreMenuStyle.Back,
                      action: ui.action.navigate(KoreMenuScreen.Main)
                    }),
                    ui.image({
                      id: "icon-local-back",
                      source: "./public/picture/menuicons/log-out.svg",
                      rect: { x: 12, y: 10, width: 40, height: 30 },
                      style: KoreMenuStyle.Back
                    }),
                    ui.image({
                      id: "trenn-local-back",
                      source: "./public/picture/menuicons/tally-1.svg",
                      rect: { x: 55, y: 15, width: 24, height: 24 },
                      style: KoreMenuStyle.Back
                    }),
                    ui.text({
                      id: "label-local-back",
                      text: translate(language, KoreMenuText.Back),
                      rect: { x: 75, y: 15, width: 140, height: 20 },
                      style: KoreMenuStyle.Back
                    })
                  ]
                })
              ]
            })
          ]
        })
      ]
    })
  );
  builder.addScreen(simpleScreen(KoreMenuScreen.Settings, "Settings", language));
  builder.addScreen(simpleScreen(KoreMenuScreen.Credits, "Credits", language));

  // 3. Map and difficulty screens are all declared in the same SDK menu.
  for (const intent of [KoreMenuMapIntent.Local, KoreMenuMapIntent.Online, KoreMenuMapIntent.Battle]) builder.addScreen(mapScreen(intent, undefined, language));
  builder.addScreen(difficultyScreen(language));
  for (const difficulty of Object.values(KoreMenuDifficulty)) builder.addScreen(mapScreen(KoreMenuMapIntent.Ai, difficulty, language));

  // 3. Mod import screens: file load, pasted-JSON editor, and test launch.
  builder.addScreen(modsScreen(language));
  builder.addScreen(modImportScreen(language));
  builder.addScreen(modResultScreen(language));

  return builder.build();
}

function simpleScreen(id: KoreMenuScreen, title: string, language: LanguageCatalog) {
  return ui.screen({
    id,
    layout: ui.layout.vertical({ gap: 20, justify: "center", align: "center" }),
    elements: [
      ui.text({ id: `${id}-title`, text: title, rect: rect(0, 0, 200, 40), style: KoreMenuStyle.MapTitle }),
      ui.button({ id: `${id}-back`, text: translate(language, KoreMenuText.Back), rect: rect(0, 0, 120, 36), style: KoreMenuStyle.Back, action: ui.action.back() }),
    ],
  });
}

function mapScreen(intent: KoreMenuMapIntent, difficulty: KoreMenuDifficulty | undefined, language: LanguageCatalog) {
  const eligible = getFinalReleaseMapEntries(intent === KoreMenuMapIntent.Battle);
  const withModes = intent === KoreMenuMapIntent.Local || intent === KoreMenuMapIntent.Online;
  const modes = withModes ? getSelectableGameModes() : [undefined];
  const rowHeight = withModes ? 18 : 36;
  const rowsPerMap = modes.length;
  const elements = [
    ui.text({ id: koreMenuMapTitleElementId(intent, difficulty), text: translate(language, KoreMenuText.ChooseMap), rect: rect(155, 25, 580, 42), style: KoreMenuStyle.MapTitle }),
    ...(intent === KoreMenuMapIntent.Online
      ? [ui.text({ id: KoreMenuElement.MapOnlineNote, text: translate(language, KoreMenuText.OnlineMapNote), rect: rect(155, 54, 560, 20), style: KoreMenuStyle.MapNote })]
      : []),
    ...eligible.flatMap((entry, mapIndex) => modes.map((mode, index) =>
      ui.button({
        id: koreMenuMapElementId(intent, entry.id, difficulty, mode?.id),
        text: `${entry.name}${mode ? ` - ${mode.name}` : ""} (${entry.id})`,
        rect: rect(150, 80 + (mapIndex * rowsPerMap + index) * rowHeight, 500, rowHeight - 2),
        style: KoreMenuStyle.MapRow,
        action: ui.action.emit(KoreMenuCommand.SelectMap, { intent, mapId: entry.id, ...(mode ? { modeId: mode.id } : {}), ...(difficulty ? { difficulty } : {}) }),
      })
    )),
    ui.button({
      id: koreMenuMapBackElementId(intent, difficulty),
      text: translate(language, KoreMenuText.Back),
      rect: rect(150, 80 + eligible.length * rowsPerMap * rowHeight + 8, 120, 34),
      style: KoreMenuStyle.Back,
      action: ui.action.back(),
    }),
  ];
  return ui.screen({ id: koreMenuMapScreen(intent, difficulty), layout: ui.layout.absolute(), elements });
}

function difficultyScreen(language: LanguageCatalog) {
  return ui.screen({
    id: KoreMenuScreen.Difficulty,
    layout: ui.layout.absolute(),
    elements: [
      ui.text({ id: KoreMenuElement.DifficultyTitle, text: translate(language, KoreMenuText.ChooseAiDifficulty), rect: rect(265, 64, 300, 32), style: KoreMenuStyle.DifficultyTitle }),
      ...Object.values(KoreMenuDifficulty).map((difficulty, index) =>
        ui.button({
          id: koreMenuDifficultyElementId(difficulty),
          text: `${difficulty[0]!.toUpperCase()}${difficulty.slice(1)} KI`,
          rect: rect(270, 130 + index * 50, 260, 40),
          style: KoreMenuStyle.Difficulty,
          action: ui.action.emit(KoreMenuCommand.OpenAiMaps, { difficulty }),
        })
      ),
      ui.button({ id: KoreMenuElement.DifficultyBack, text: translate(language, KoreMenuText.Back), rect: rect(270, 320, 260, 36), style: KoreMenuStyle.DifficultyBack, action: ui.action.back() }),
    ],
  });
}

function modsScreen(language: LanguageCatalog) {
  return ui.screen({
    id: KoreMenuScreen.Mods,
    layout: ui.layout.absolute(),
    elements: [
      ui.text({ id: KoreMenuElement.ModsTitle, text: translate(language, KoreMenuText.ModsTitle), rect: rect(265, 40, 300, 32), style: KoreMenuStyle.MapTitle }),
      ui.button({ id: KoreMenuElement.ModsLoadFile, text: translate(language, KoreMenuText.ModsLoadFile), rect: rect(250, 95, 300, 42), style: KoreMenuStyle.MainButton, action: ui.action.emit(KoreMenuCommand.ImportModFile) }),
      ui.button({ id: KoreMenuElement.ModsPaste, text: translate(language, KoreMenuText.ModsPasteJson), rect: rect(250, 195, 300, 42), style: KoreMenuStyle.MainButton, action: ui.action.emit(KoreMenuCommand.ImportModPaste) }),
      ui.text({ id: KoreMenuElement.ModsStatus, text: translate(language, KoreMenuText.ModsStatusEmpty), rect: rect(200, 215, 400, 24), style: KoreMenuStyle.MapNote }),
      ui.button({ id: KoreMenuElement.ModsBack, text: translate(language, KoreMenuText.Back), rect: rect(270, 320, 260, 36), style: KoreMenuStyle.DifficultyBack, action: ui.action.back() }),
    ],
  });
}

function modImportScreen(language: LanguageCatalog) {
  return ui.screen({
    id: KoreMenuScreen.ModImport,
    layout: ui.layout.absolute(),
    elements: [
      ui.text({ id: KoreMenuElement.ModImportTitle, text: translate(language, KoreMenuText.ModImportTitle), rect: rect(240, 30, 320, 32), style: KoreMenuStyle.MapTitle }),
      ui.text({ id: KoreMenuElement.ModImportHint, text: translate(language, KoreMenuText.ModImportHint), rect: rect(150, 68, 500, 24), style: KoreMenuStyle.MapNote }),
      ui.textInput({ id: KoreMenuElement.ModImportInput, text: "", rect: rect(150, 100, 500, 180), style: KoreMenuStyle.MapRow }),
      ui.button({ id: KoreMenuElement.ModImportValidate, text: translate(language, KoreMenuText.ModImportValidate), rect: rect(240, 295, 170, 36), style: KoreMenuStyle.MainButton, action: ui.action.emit(KoreMenuCommand.ValidateMod) }),
      ui.button({ id: KoreMenuElement.ModImportBack, text: translate(language, KoreMenuText.Back), rect: rect(270, 330, 260, 36), style: KoreMenuStyle.DifficultyBack, action: ui.action.back() }),
    ],
  });
}

function modResultScreen(language: LanguageCatalog) {
  return ui.screen({
    id: KoreMenuScreen.ModResult,
    layout: ui.layout.absolute(),
    elements: [
      ui.text({ id: KoreMenuElement.ModResultTitle, text: translate(language, KoreMenuText.ModResultTitle), rect: rect(240, 30, 320, 32), style: KoreMenuStyle.MapTitle }),
      ui.text({ id: KoreMenuElement.ModResultSummary, text: "", rect: rect(150, 80, 500, 120), style: KoreMenuStyle.MapNote }),
      ui.button({ id: KoreMenuElement.ModResult1v1, text: translate(language, KoreMenuText.ModTest1v1), rect: rect(240, 240, 320, 40), style: KoreMenuStyle.MainButton, enabled: false, action: ui.action.emit(KoreMenuCommand.LaunchMod1v1) }),
      ui.button({ id: KoreMenuElement.ModResultBattle, text: translate(language, KoreMenuText.ModTestBattle), rect: rect(240, 290, 320, 40), style: KoreMenuStyle.MainButton, enabled: false, action: ui.action.emit(KoreMenuCommand.LaunchModAiBattle) }),
      ui.button({ id: KoreMenuElement.ModResultBack, text: translate(language, KoreMenuText.Back), rect: rect(270, 330, 260, 36), style: KoreMenuStyle.DifficultyBack, action: ui.action.back() }),
    ],
  });
}

function rect(x: number, y: number, width: number, height: number) {
  return { x, y, width, height };
}

export function mapScreenId(intent: KoreMenuMapIntent, difficulty?: KoreMenuDifficulty): KoreMenuScreen { return koreMenuMapScreen(intent, difficulty); }

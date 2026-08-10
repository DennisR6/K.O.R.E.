import { audio, type AudioBusSettings, type AudioRuntimeSettings, type PlayMusicCommand, type PlaySoundCommand } from "../engine/audio-sdk/index.js";

/** KORE-owned semantic IDs and the browser-resolved optional asset manifest. */
export const KORE_AUDIO_ASSETS = {
	"kore.music.menu": "./public/audio/CM_01_Ascension.mp3",
	"kore.music.match": "./public/audio/CM_02_Moon_Shadows.mp3",
	// The current prototype ships only the optional music pack. These short-cue
	// IDs deliberately resolve through that pack until dedicated SFX are added.
	"kore.ui.confirm": "./public/audio/CM_03_Ritualis.mp3",
	"kore.ui.reject": "./public/audio/CM_04_Sacrifice.mp3",
	"kore.game.shot": "./public/audio/CM_04_Sacrifice.mp3",
	"kore.game.collision": "./public/audio/CM_04_Sacrifice.mp3",
	"kore.game.damage": "./public/audio/CM_04_Sacrifice.mp3",
	"kore.game.shield": "./public/audio/CM_04_Sacrifice.mp3",
	"kore.game.item": "./public/audio/CM_03_Ritualis.mp3",
	"kore.game.hazard": "./public/audio/CM_04_Sacrifice.mp3",
	"kore.game.elimination": "./public/audio/CM_04_Sacrifice.mp3",
	"kore.game.turn": "./public/audio/CM_03_Ritualis.mp3",
	"kore.game.result": "./public/audio/CM_03_Ritualis.mp3",
} as const;

export const KORE_AUDIO_BUSES: AudioBusSettings[] = [
	audio.bus({ id: "master", volume: 1, muted: false, maxVoices: 64, defaultPriority: 0, paused: false }),
	audio.bus({ id: "music", volume: 0.1, muted: false, maxVoices: 1, defaultPriority: 50, paused: false }),
	audio.bus({ id: "ambience", volume: 0.6, muted: false, maxVoices: 8, defaultPriority: 20, paused: false }),
	audio.bus({ id: "effects", volume: 0.6, muted: false, maxVoices: 32, defaultPriority: 10, paused: false }),
	audio.bus({ id: "ui", volume: 0.45, muted: false, maxVoices: 8, defaultPriority: 30, paused: false }),
	audio.bus({ id: "voice", volume: 0.8, muted: false, maxVoices: 8, defaultPriority: 40, paused: false }),
];

export function createKoreAudioSettings(runtimeId: string): AudioRuntimeSettings { return audio.createSettings({ runtimeId, buses: KORE_AUDIO_BUSES }); }

export const koreAudio = {
	assets: KORE_AUDIO_ASSETS,
	buses: KORE_AUDIO_BUSES,
	createSettings: createKoreAudioSettings,
	sounds: { uiConfirm: "kore.ui.confirm", uiReject: "kore.ui.reject", shot: "kore.game.shot", collision: "kore.game.collision", damage: "kore.game.damage", shield: "kore.game.shield", item: "kore.game.item", hazard: "kore.game.hazard", elimination: "kore.game.elimination", turn: "kore.game.turn", result: "kore.game.result" },
	music: { menu: "kore.music.menu", match: "kore.music.match" },
	command: {
		uiConfirm(sourceId: string, soundId: string = "kore.ui.confirm"): PlaySoundCommand { return audio.command.play({ sourceId, soundId, bus: "ui", priority: 30, dedupeKey: "confirm" }); },
		uiReject(sourceId: string): PlaySoundCommand { return audio.command.play({ sourceId, soundId: "kore.ui.reject", bus: "ui", priority: 40, dedupeKey: "reject" }); },
		shot(sourceId: string): PlaySoundCommand { return audio.command.play({ sourceId, soundId: "kore.game.shot", bus: "effects", priority: 20, dedupeKey: "shot" }); },
		// Menu creation is an application-mode handoff, so it deliberately claims
		// the slot again when returning from a higher-priority match.
		menuMusic(sourceId: string = "menu.music"): PlayMusicCommand { return audio.command.music({ sourceId, soundId: "kore.music.menu", bus: "music", priority: 10, replacementPolicy: "replace-current", fadeInMs: 250 }); },
		matchMusic(sourceId: string = "match.music"): PlayMusicCommand { return audio.command.music({ sourceId, soundId: "kore.music.match", bus: "music", priority: 20, replacementPolicy: "replace-lower-or-equal", fadeInMs: 500 }); },
	},
} as const;

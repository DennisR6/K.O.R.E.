import type { AudioCommandBatch, ResolvedAudioCommand } from "@coffeemakerstudio/roast";
import { KORE_AUDIO_ASSETS } from "../kore/audio.js";
type BrowserVoiceCommand = Extract<ResolvedAudioCommand, { type: "playSound" | "startLoop" | "playMusic" }>;

export interface BrowserAudioElement {
	src: string;
	volume: number;
	loop: boolean;
	onended: ((event: Event) => unknown) | null;
	play(): Promise<void>;
	pause(): void;
}
export type AudioElementFactory = (url: string) => BrowserAudioElement;
export type AudioAssetResolver = (soundId: string) => string | undefined;
type ActiveSource = { element: BrowserAudioElement; bus: string; volume: number; music: boolean };

/**
 * The sole browser media owner. It intentionally owns DOM media resources,
 * autoplay unlock, loading, volume application, and disposal; it never leaks
 * those objects into generic audio settings or engine runtimes.
 *
 * While locked, bus controls are retained, music/loops are coalesced by global
 * source, and transient one-shots are discarded. `unlock()` replays only the
 * retained persistent intent.
 */
export class AudioManager {
	private readonly sources = new Map<string, ActiveSource>();
	private readonly queuedPersistent = new Map<string, ResolvedAudioCommand>();
	private readonly buses = new Map<string, { volume: number; muted: boolean; paused: boolean }>();
	private readonly applied: ResolvedAudioCommand[] = [];
	private readonly probeGenerations = new Map<string, number>();
	private locked = true;
	private status: "locked" | "ready" | "suspended" | "failed" = "locked";
	private readonly playlistSoundIds = ["kore.music.menu", "kore.music.match"] as const;
	private currentTrackIndex: number;
	private readonly tracks = this.playlistSoundIds.map(soundId => KORE_AUDIO_ASSETS[soundId]);

	public constructor(initialTrack: number = 0, private readonly createElement: AudioElementFactory = url => new Audio(url), private readonly resolveAsset: AudioAssetResolver = soundId => KORE_AUDIO_ASSETS[soundId as keyof typeof KORE_AUDIO_ASSETS]) {
		this.currentTrackIndex = Number.isSafeInteger(initialTrack) && initialTrack >= 0 && initialTrack < this.tracks.length ? initialTrack : 0;
		for (const id of ["master", "music", "ambience", "effects", "ui", "voice"]) this.buses.set(id, { volume: id === "music" ? 0.1 : 1, muted: false, paused: false });
	}
	public getStatus(): "locked" | "ready" | "suspended" | "failed" { return this.status; }
	public getAppliedCommands(): readonly ResolvedAudioCommand[] { return this.applied.map(command => structuredClone(command)); }
	public async unlock(): Promise<void> {
		this.locked = false; this.status = "ready";
		const retained = [...this.queuedPersistent.values()].sort((a, b) => a.globalSourceId.localeCompare(b.globalSourceId)); this.queuedPersistent.clear();
		for (const command of retained) this.applyCommand(command);
	}
	/** Compatibility entry point for the existing keyboard music controls. */
	public start(): void { void this.unlock().then(() => this.playPlaylistTrack()); }
	public nextTrack(): void { this.currentTrackIndex = (this.currentTrackIndex + 1) % this.tracks.length; this.playPlaylistTrack(); }
	public previousTrack(): void { this.currentTrackIndex = (this.currentTrackIndex + this.tracks.length - 1) % this.tracks.length; this.playPlaylistTrack(); }
	public setVolume(volume: number): void { this.setBusVolume("music", volume); }
	public addVolume(delta: number): void { this.setBusVolume("music", (this.buses.get("music")?.volume ?? 0.1) + delta); }
	public dispose(): void { for (const source of this.sources.values()) source.element.pause(); this.sources.clear(); this.queuedPersistent.clear(); this.status = "suspended"; }
	public applyAudioBatch(batch: Readonly<AudioCommandBatch>): void {
		for (const command of batch.commands) {
			this.applied.push(structuredClone(command)); if (this.applied.length > 200) this.applied.shift();
			if (this.locked) { this.applyLocked(command); continue; }
			this.applyCommand(command);
		}
	}
	private applyLocked(command: ResolvedAudioCommand): void {
		if (command.type === "setBusVolume" || command.type === "pauseBus" || command.type === "resumeBus" || command.type === "stopAll" || command.type === "stopSource" || command.type === "stopMusic") { this.applyControl(command); return; }
		if (command.type === "startLoop" || command.type === "playMusic") this.queuedPersistent.set(command.globalSourceId, structuredClone(command));
	}
	private applyCommand(command: ResolvedAudioCommand): void {
		if (command.type === "setBusVolume" || command.type === "pauseBus" || command.type === "resumeBus" || command.type === "stopAll" || command.type === "stopSource" || command.type === "stopMusic" || command.type === "stopInstance") { this.applyControl(command); return; }
		const url = this.resolveAsset(command.soundId); if (!url) return;
		// Audio files are optional in a source checkout. Probe browser-served
		// assets before constructing HTMLAudioElement; otherwise a missing file
		// produces an uncaught browser media error even though the semantic audio
		// command itself was handled correctly.
		if (typeof window !== "undefined" && this.isPublicAudioAsset(url)) {
			const probeUrl = new URL(url, document.baseURI).toString();
			const generation = (this.probeGenerations.get(command.globalSourceId) ?? 0) + 1;
			this.probeGenerations.set(command.globalSourceId, generation);
			void fetch(probeUrl, { method: "HEAD" }).then(response => {
				if (response.ok && this.probeGenerations.get(command.globalSourceId) === generation) this.startAudio(command, url);
			});
			return;
		}
		this.startAudio(command, url);
	}
	private isPublicAudioAsset(url: string): boolean {
		try { return new URL(url, document.baseURI).pathname.includes("/public/audio/"); }
		catch { return false; }
	}
	private startAudio(command: BrowserVoiceCommand, url: string): void {
		const key = command.type === "playSound" ? `${command.globalSourceId}:${command.instanceId ?? command.sequence}` : command.globalSourceId;
		if (command.type !== "playSound") this.stopSource(command.globalSourceId);
		const element = this.createElement(url); element.loop = command.type === "startLoop" || command.type === "playMusic"; element.volume = 0;
		const source: ActiveSource = { element, bus: command.bus ?? (command.type === "playMusic" ? "music" : "effects"), volume: command.volume ?? 1, music: command.type === "playMusic" }; this.sources.set(key, source); this.applyVolume(source);
		element.onended = () => { if (!element.loop) this.sources.delete(key); };
		void element.play().catch(() => { this.status = "locked"; this.locked = true; if (element.loop) this.queuedPersistent.set(command.globalSourceId, structuredClone(command)); });
	}
	private applyControl(command: ResolvedAudioCommand): void {
		if (command.type === "setBusVolume") { this.setBusVolume(command.bus, command.volume, command.muted); return; }
		if (command.type === "pauseBus" || command.type === "resumeBus") { const bus = this.buses.get(command.bus) ?? { volume: 1, muted: false, paused: false }; bus.paused = command.type === "pauseBus"; this.buses.set(command.bus, bus); for (const source of this.sources.values()) if (source.bus === command.bus) { if (bus.paused) source.element.pause(); else void source.element.play().catch(() => { this.status = "locked"; this.locked = true; }); } return; }
		if (command.type === "stopAll") { for (const key of [...this.sources.keys()]) this.stopSource(key); this.queuedPersistent.clear(); return; }
		if (command.type === "stopMusic") { for (const [key, source] of this.sources) if (source.music && (!command.sourceId || key === `${command.runtimeId}:${command.sourceId}`)) { source.element.pause(); this.sources.delete(key); } return; }
		if (command.type === "stopInstance") { this.stopSource(`${command.globalSourceId}:${command.instanceId}`); return; }
		this.stopSource(command.globalSourceId);
	}
	private stopSource(globalSourceId: string): void { for (const [key, source] of this.sources) if (key === globalSourceId || key.startsWith(`${globalSourceId}:`)) { source.element.pause(); this.sources.delete(key); } this.queuedPersistent.delete(globalSourceId); }
	private setBusVolume(busId: string, volume: number, muted?: boolean): void { const bus = this.buses.get(busId) ?? { volume: 1, muted: false, paused: false }; bus.volume = Math.max(0, Math.min(1, Number.isFinite(volume) ? volume : 0)); if (muted !== undefined) bus.muted = muted; this.buses.set(busId, bus); for (const source of this.sources.values()) if (source.bus === busId) this.applyVolume(source); }
	private applyVolume(source: ActiveSource): void { const master = this.buses.get("master") ?? { volume: 1, muted: false, paused: false }; const bus = this.buses.get(source.bus) ?? { volume: 1, muted: false, paused: false }; source.element.volume = master.muted || bus.muted ? 0 : Math.max(0, Math.min(1, source.volume * master.volume * bus.volume)); }
	private playPlaylistTrack(): void { const soundId = this.playlistSoundIds[this.currentTrackIndex]; if (!soundId) return; this.applyCommand({ type: "playMusic", sourceId: "playlist", soundId, bus: "music", priority: 10, runtimeId: "browser", globalSourceId: "browser:playlist", sequence: 0, replacementPolicy: "replace-current" }); }
}

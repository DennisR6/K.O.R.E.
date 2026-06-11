export class AudioManager {
	private player: HTMLAudioElement
	private currentTrackIndex: number = 0;
	private tracks: string[] = [
		"/public/audio/CM_01_Ascension.mp3",
		"/public/audio/CM_02_Moon_Shadows.mp3",
		"/public/audio/CM_03_Ritualis.mp3",
		"/public/audio/CM_04_Sacrifice.mp3",
		"/public/audio/CM_05_Passage.mp3",
		"/public/audio/CM_06_Sage.mp3",
		"/public/audio/CM_07_Illusions.mp3",
		"/public/audio/CM_08_Firestorm.mp3",
		"/public/audio/CM_09_The_Gathering.mp3",
		"/public/audio/CM_10_Solstice.mp3",
	]

	constructor(initialTrack: number = 0) {
		this.currentTrackIndex = initialTrack;
		this.player = new Audio(this.tracks[this.currentTrackIndex]);
		this.player.volume = 0.1;

		this.player.onended = () => this.nextTrack();
	}

	public nextTrack() {
		this.currentTrackIndex = (this.currentTrackIndex + 1) % this.tracks.length;
		this.player.src = this.tracks[this.currentTrackIndex];
		console.log("now Playing:", this.currentTrackIndex, this.tracks[this.currentTrackIndex])
		this.player.play().catch(e => console.warn("Autoplay blockiert:", e));
	}

	public previousTrack() {
		this.currentTrackIndex = (this.currentTrackIndex - 1) < 0 ? this.tracks.length - 1 : this.currentTrackIndex - 1;
		this.player.src = this.tracks[this.currentTrackIndex];
		console.log("now Playing:", this.currentTrackIndex, this.tracks[this.currentTrackIndex])
		this.player.play().catch(e => console.warn("Autoplay blockiert:", e));
	}

	public start() {
		console.log("now Playing:", this.currentTrackIndex, this.tracks[this.currentTrackIndex])
		this.player.play().catch(e => console.warn("Autoplay blockiert:", e));
	}

	public setVolume(volume: number) { this.player.volume = Math.max(0, Math.min(1, volume)); }
	public addVolume(volume: number) { this.player.volume = Math.max(0, Math.min(1, this.player.volume + volume)); }


}

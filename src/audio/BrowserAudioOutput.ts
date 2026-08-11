import type { AudioCommandBatch, AudioOutputPort } from "@coffeemakerstudio/roast";
import type { AudioManager } from "../menu/AudioManager.js";

/** Browser-only output adapter. Generic runtimes only know the AudioOutputPort. */
export class BrowserAudioOutput implements AudioOutputPort {
	public constructor(private readonly manager: AudioManager) { }
	public apply(batch: Readonly<AudioCommandBatch>): void { this.manager.applyAudioBatch(batch); }
}

import { audio } from "../src/engine/audio-sdk/index.js";
import { koreAudio } from "../src/kore/audio.js";

/** Emit semantic audio commands through the generic explicit-tick runtime. */
export function run(): Record<string, unknown> {
	const runtime = audio.createRuntime(koreAudio.createSettings("example-06-audio"));
	const emitter = audio.emitter("example-06-ui");
	emitter.emit(koreAudio.command.uiConfirm("example-06-ui"));
	runtime.tick([emitter]);
	const batch = runtime.drainOutput();
	const first = batch.commands[0];
	return {
		runtimeId: batch.runtimeId,
		commands: batch.commands.length,
		soundId: first && "soundId" in first ? first.soundId : null,
		bus: first && "bus" in first ? first.bus ?? null : null,
	};
}

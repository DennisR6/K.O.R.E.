import * as p5Instance from 'p5';
import type { AudioManager } from '../menu/AudioManager.js';
import type { HardAiWorkerMetrics } from '../ai/worker/host.js';
import type { getStartupTelemetry } from '../kore/runtime/startupTelemetry.js';

declare global {
	interface Window {
		p5: typeof p5;
		game: {
			handler: GameHandler
			mapId: string | null
			readonly logs: readonly import('../kore/runtime/runtimeLog.js').RuntimeLogEntry[]
			aiWorkerMetrics?: HardAiWorkerMetrics
			readonly startup: ReturnType<typeof getStartupTelemetry>
			audio: AudioManager
		},
	}
	const p5: typeof p5Instance;
}

export { };

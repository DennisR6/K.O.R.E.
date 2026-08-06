import * as p5Instance from 'p5';
import type { AudioManager } from '../menu/AudioManager.js';

declare global {
	interface Window {
		p5: typeof p5;
		game: {
			handler: GameHandler
			mapId: string | null
			logs: {
				timestamp,
				level,
				caller,
				data: args
			}[]
			audio: AudioManager
		},
	}
	const p5: typeof p5Instance;
}

export { };

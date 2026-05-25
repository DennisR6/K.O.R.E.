import * as p5Instance from 'p5';

declare global {
	interface Window {
		p5: typeof p5;
		game: {
			handler: GameHandler
			logs: {
				timestamp,
				level,
				caller,
				data: args
			}[]
		}
	}
	const p5: typeof p5Instance;
}

export { };

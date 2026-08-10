import { qualifyGameplayCase, type GameplayQualificationCase } from "./gameplayQualification.js";

self.onmessage = (event: MessageEvent<GameplayQualificationCase[]>) => {
	try {
		self.postMessage(event.data.map(testCase => qualifyGameplayCase(testCase)));
	} catch (error) {
		self.postMessage({ error: error instanceof Error ? error.message : String(error) });
	}
};

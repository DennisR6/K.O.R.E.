import type { HardAiWorkerRequest } from "./protocol.js";
import { GameSettings } from "../../settings/settings.js";

// Match the browser application's settings-before-handler initialization order
// so the legacy effect graph's runtime imports do not enter a TDZ cycle.
void GameSettings;

// Load the gameplay graph after the worker global is initialized. The KORE
// runtime has intentional engine/effect cycles that are safe in the main
// bundle's order but can otherwise trip browser-worker TDZ initialization.
self.onmessage = async event => {
	try {
		const { computeHardAiWorkerRequest } = await import("./compute.js");
		const response = computeHardAiWorkerRequest(event.data as HardAiWorkerRequest);
		self.postMessage({ type: "result", response });
	} catch (error) {
		self.postMessage({ type: "error", message: error instanceof Error ? error.message : String(error) });
	}
};

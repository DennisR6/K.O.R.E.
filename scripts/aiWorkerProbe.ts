import { parentPort } from "node:worker_threads";
import { computeHardAiWorkerRequest } from "../src/ai/worker/compute.js";

if (!parentPort) throw new Error("AI worker probe requires a parent port");

parentPort.on("message", message => {
	if (message?.type === "ready") {
		parentPort!.postMessage({ type: "ready" });
		return;
	}
	if (message?.type === "ping") {
		parentPort!.postMessage({ type: "pong" });
		return;
	}
	try {
		parentPort!.postMessage({ type: "result", response: computeHardAiWorkerRequest(message) });
	} catch (error) {
		parentPort!.postMessage({ type: "error", message: error instanceof Error ? error.message : String(error) });
	}
});

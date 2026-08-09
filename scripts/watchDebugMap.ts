import { watch } from "node:fs/promises";
import { buildDebugMap } from "./buildDebugMap.ts";

const sourcePath = `${import.meta.dir}/../src/content/debugMap.ts`;
await buildDebugMap();

for await (const event of watch(sourcePath)) {
	if (event.eventType !== "change") continue;
	try {
		await buildDebugMap();
	} catch (error) {
		console.error("Debug map rebuild failed", error);
	}
}

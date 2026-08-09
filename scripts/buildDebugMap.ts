import { validateEditorMapDocument } from "../src/contracts/documents.ts";

const outputPath = `${import.meta.dir}/../public/map.json`;

export async function buildDebugMap(): Promise<void> {
	const { debugMap } = await import(`../src/content/debugMap.ts?reload=${Date.now()}`);
	validateEditorMapDocument(debugMap);
	await Bun.write(outputPath, `${JSON.stringify(debugMap, null, 2)}\n`);
	console.log(`Debug map written to ${outputPath}`);
}

if (import.meta.main) await buildDebugMap();

import { fstatSync, openSync, readdirSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";

(() => {
	let size = 0;
	let fileSize = 0;
	const jsonDir = path.resolve(__dirname, "../public/assets/json");

	if (!existsSync(jsonDir)) {
		console.log("Keine JSON-Assets gefunden in:", jsonDir);
		return;
	}

	for (const file of readdirSync(jsonDir)) {
		if (!file.endsWith(".json")) continue;
		const filePath = path.join(jsonDir, file);
		const json = JSON.parse(readFileSync(filePath, "utf-8"));
		const fd = openSync(filePath, "r");
		console.log(file, json.payload.slice(0, 30));
		const jsonSize = json.payload.length;
		const realSize = fstatSync(fd).size;
		size += jsonSize;
		fileSize += realSize;
		console.log(jsonSize, realSize, (jsonSize / realSize).toFixed(2));
	}
	console.log(`Gesamtgröße: ${(size / 1024 / 1024).toFixed(2)} MB`);
})();

import { fstatSync, openSync, readdirSync, readFileSync } from "node:fs"

(() => {
	let size = 0
	let fileSize = 0
	for (const file of readdirSync("../src/assetManager/assets")) {
		if (!file.endsWith(".json")) continue
		const json = JSON.parse(readFileSync(`../src/assetManager/assets/${file}`).toString())
		const fd = openSync(`../src/assetManager/assets/${file}`, "r")
		console.log(json.payload.slice(0, 20))
		const jsonSize = json.payload.length
		const realSize = fstatSync(fd).size
		size += jsonSize
		fileSize += realSize
		console.log(jsonSize, realSize, (jsonSize / realSize).toFixed(2))
	}
	console.log(`size: ${(size / 1024 / 1024).toFixed(2)} MB`)
})()

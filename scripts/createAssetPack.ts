#!/usr/bin/env bun
import { readdirSync, statSync, writeFileSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

const PUBLIC_DIR = path.resolve(__dirname, '../public');
const OUTPUT_DIR = path.resolve(__dirname, '../src/assetManager/assets');

if (!statSync(OUTPUT_DIR, { throwIfNoEntry: false })) {
	mkdirSync(OUTPUT_DIR, { recursive: true });
}

function getAllFiles(dirPath: string, arrayOfFiles: string[] = []) {
	const files = readdirSync(dirPath);
	files.forEach(file => {
		const fullPath = path.join(dirPath, file);
		if (statSync(fullPath).isDirectory()) {
			arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
		} else if (/\.(png|jpg|jpeg|gif|svg|webp)$/i.test(file)) {
			arrayOfFiles.push(fullPath);
		}
	});
	return arrayOfFiles;
}

function generateAssetPacks() {
	const allFiles = getAllFiles(PUBLIC_DIR);
	const assetRegistry: string[] = [];
	const assetManifest: Record<string, string> = {};
	const JSON_OUTPUT_DIR = path.join(OUTPUT_DIR, 'json');

	mkdirSync(JSON_OUTPUT_DIR, { recursive: true });

	allFiles.forEach(filePath => {
		const relativePath = path.relative(PUBLIC_DIR, filePath);
		const parts = relativePath.replace(/\\/g, '/').split('/');
		const fileName = parts.pop()!;
		const fileBuffer = readFileSync(filePath);
		const base64Data = fileBuffer.toString('base64');
		const [name, ext] = fileName.split('.');

		let cleanKey = [...parts, name, ext.toUpperCase()]
			.map(p => p.charAt(0).toUpperCase() + p.slice(1).replace(/[^a-zA-Z0-9]/g, ''))
			.join('');
		cleanKey = `${cleanKey[0].toLowerCase()}${cleanKey.slice(1)}`;

		assetManifest[cleanKey] = relativePath;
		assetRegistry.push(cleanKey);

		const jsonPayload = {
			name: name,
			type: ext,
			payload: `data:image/${ext};base64,${base64Data}`
		};
		writeFileSync(
			path.join(JSON_OUTPUT_DIR, `${cleanKey}.json`),
			JSON.stringify(jsonPayload, null, 2)
		);
	});

	const enumContent = assetRegistry.join(",\n\t");

	const registryEntries = assetRegistry.map(key =>
		`\t[AssetList.${key}]: "${assetManifest[key]}"`
	).join(',\n');

	const typeContent = `export enum AssetList {
\t${enumContent}
}

export const AssetPaths: Record<AssetList, string> = {
${registryEntries}
};

export type AssetKey = AssetList;
`;

	writeFileSync(path.join(OUTPUT_DIR, 'assetRegistry.ts'), typeContent);
	console.log(`Assets generiert! ${assetRegistry.length} Assets in Registry erstellt.`);
}

generateAssetPacks();

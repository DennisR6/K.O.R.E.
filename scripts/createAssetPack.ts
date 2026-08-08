#!/usr/bin/env bun
import { readdirSync, statSync, writeFileSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

const PUBLIC_DIR = path.resolve(__dirname, '../public');
const JSON_OUTPUT_DIR = path.resolve(__dirname, '../public/assets/json');
const DIST_JSON_OUTPUT_DIR = path.resolve(__dirname, '../dist/assets/json');
const OUTPUT_KEYS = path.resolve(__dirname, '../src/assetManager/assets');

function getMimeType(ext: string): string {
	const lower = ext.toLowerCase();
	switch (lower) {
		case 'svg':
			return 'image/svg+xml';
		case 'jpg':
		case 'jpeg':
			return 'image/jpeg';
		case 'png':
			return 'image/png';
		case 'webp':
			return 'image/webp';
		case 'gif':
			return 'image/gif';
		default:
			return `image/${lower}`;
	}
}

function getAllFiles(dirPath: string, arrayOfFiles: string[] = []): string[] {
	const files = readdirSync(dirPath);
	files.forEach(file => {
		const fullPath = path.join(dirPath, file);
		if (statSync(fullPath).isDirectory()) {
			// Skip generated JSON asset directory to avoid infinite/redundant scans
			if (fullPath.includes(path.join('assets', 'json')) || fullPath.includes(path.join('dist', 'assets'))) {
				return;
			}
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

	mkdirSync(JSON_OUTPUT_DIR, { recursive: true });
	if (statSync(path.resolve(__dirname, '../dist'), { throwIfNoEntry: false })) {
		mkdirSync(DIST_JSON_OUTPUT_DIR, { recursive: true });
	}

	allFiles.forEach(filePath => {
		const relativePath = path.relative(PUBLIC_DIR, filePath);
		const parts = relativePath.replace(/\\/g, '/').split('/');
		const fileName = parts.pop()!;
		const fileBuffer = readFileSync(filePath);
		const base64Data = fileBuffer.toString('base64');

		const extIndex = fileName.lastIndexOf('.');
		const name = extIndex !== -1 ? fileName.slice(0, extIndex) : fileName;
		const ext = extIndex !== -1 ? fileName.slice(extIndex + 1) : '';

		let cleanKey = [...parts, name, ext.toUpperCase()]
			.map(p => p.charAt(0).toUpperCase() + p.slice(1).replace(/[^a-zA-Z0-9]/g, ''))
			.join('');
		cleanKey = `${cleanKey[0].toLowerCase()}${cleanKey.slice(1)}`;

		assetManifest[cleanKey] = relativePath;
		assetRegistry.push(cleanKey);

		const mimeType = getMimeType(ext);
		const jsonPayload = {
			name: name,
			type: ext,
			payload: `data:${mimeType};base64,${base64Data}`
		};

		const jsonString = JSON.stringify(jsonPayload, null, 2);
		writeFileSync(path.join(JSON_OUTPUT_DIR, `${cleanKey}.json`), jsonString);

		if (statSync(DIST_JSON_OUTPUT_DIR, { throwIfNoEntry: false })) {
			writeFileSync(path.join(DIST_JSON_OUTPUT_DIR, `${cleanKey}.json`), jsonString);
		}
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

	writeFileSync(path.join(OUTPUT_KEYS, 'assetRegistry.ts'), typeContent);
	console.log(`Assets generiert! ${assetRegistry.length} Assets in Registry erstellt.`);
}

generateAssetPacks();


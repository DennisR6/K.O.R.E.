import { mkdir, rename, unlink } from "node:fs/promises";
import { Database } from "bun:sqlite";
import { gunzipSync } from "node:zlib";

const ROOT_ENV_PATH = `${import.meta.dir}/../.env`;
const DATABASE_URL = "https://lupricht.net/kore/operator/db";
const DATABASE_PATH = `${import.meta.dir}/../data/kore.db`;

function parseDotEnv(contents: string): Record<string, string> {
	const values: Record<string, string> = {};
	for (const line of contents.split(/\r?\n/)) {
		const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
		if (!match) continue;
		let value = match[2] ?? "";
		if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
		values[match[1]!] = value;
	}
	return values;
}

async function main(): Promise<void> {
	const envFile = Bun.file(ROOT_ENV_PATH);
	if (!(await envFile.exists())) throw new Error(`Missing root .env file: ${ROOT_ENV_PATH}`);

	const dotenv = parseDotEnv(await envFile.text());
	const accessToken = process.env.KORE_API_KEY ?? dotenv.KORE_API_KEY ?? process.env.KORE_DASHBOARD_OPERATOR_SECRET ?? dotenv.KORE_DASHBOARD_OPERATOR_SECRET;
	if (!accessToken) throw new Error("KORE_API_KEY or KORE_DASHBOARD_OPERATOR_SECRET is required to access /operator/db");

	const response = await fetch(DATABASE_URL, {
		headers: {
			accept: "application/vnd.sqlite3, application/octet-stream",
			authorization: `Bearer ${accessToken}`,
		},
	});
	if (!response.ok) {
		const body = await response.text();
		throw new Error(`Database download failed (${response.status} ${response.statusText}): ${body.slice(0, 500)}`);
	}

	const database = new Uint8Array(await response.arrayBuffer());
	const sqliteMagic = new TextEncoder().encode("SQLite format 3\0");
	if (database.length < sqliteMagic.length || sqliteMagic.some((byte, index) => database[index] !== byte)) throw new Error("Downloaded response is not a SQLite database");

	await mkdir(`${import.meta.dir}/../data`, { recursive: true });
	const temporaryPath = `${DATABASE_PATH}.tmp`;
	await Bun.write(temporaryPath, database);
	const check = new Database(temporaryPath, { readonly: true });
	const integrity = check.query("PRAGMA integrity_check").get() as { integrity_check?: string };
	check.close();
	if (integrity.integrity_check !== "ok") {
		await unlink(temporaryPath).catch(() => undefined);
		throw new Error(`Downloaded database failed SQLite integrity check: ${integrity.integrity_check ?? "unknown"}`);
	}
	const snapshotCheck = new Database(temporaryPath, { readonly: true });
	try {
		for (const row of snapshotCheck.query("SELECT snapshot FROM games").all() as Array<{ snapshot: Uint8Array }>) JSON.parse(gunzipSync(row.snapshot).toString());
	} catch (error) {
		await unlink(temporaryPath).catch(() => undefined);
		throw new Error(`Downloaded database contains an unreadable game snapshot: ${error instanceof Error ? error.message : String(error)}`);
	} finally {
		snapshotCheck.close();
	}
	await rename(temporaryPath, DATABASE_PATH);
	console.log(`Downloaded ${database.byteLength} bytes to ${DATABASE_PATH}`);
}

await main();

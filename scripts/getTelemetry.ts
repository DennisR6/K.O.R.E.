const ROOT_ENV_PATH = `${import.meta.dir}/../.env`;
const METRICS_URL = "https://lupricht.net/kore/operator/dashboard/metrics";

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
	const apiKey = process.env.KORE_API_KEY ?? dotenv.KORE_API_KEY;
	if (!apiKey) throw new Error("KORE_API_KEY is missing from the environment and root .env");

	const response = await fetch(METRICS_URL, {
		headers: {
			accept: "application/json",
			authorization: `Bearer ${apiKey}`,
		},
	});
	const body = await response.text();
	if (!response.ok) throw new Error(`Telemetry request failed (${response.status} ${response.statusText}): ${body.slice(0, 500)}`);

	try {
		console.log(JSON.stringify(JSON.parse(body), null, 2));
	} catch {
		throw new Error("Telemetry endpoint returned invalid JSON");
	}
}

await main();

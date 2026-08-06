const commands: readonly string[][] = [
	["bun", "test", "tests/sdk_content_release_gate.test.ts", "tests/content_cross_system_qualification.test.ts", "tests/sdk_only_release_gate.test.ts", "tests/presentation_sdk.test.ts", "tests/item_interaction_qualification.test.ts", "tests/item_inventory.test.ts", "tests/environmental_mechanics.test.ts", "tests/milestone47_game_modes.test.ts", "tests/content_package.test.ts", "tests/competitive_map_pack.test.ts"],
	["bun", "run", "examples:typecheck"],
	["bun", "run", "examples:verify"],
	["bun", "run", "test:browser:full"],
	["npx", "tsc", "--noEmit"],
	["bun", "run", "build"],
	["bun", "run", "desktop:build"],
];

for (const command of commands) {
	console.log(`\n[content-release-gate] ${command.join(" ")}`);
	const result = Bun.spawnSync(command, { stdout: "inherit", stderr: "inherit", env: command.includes("test:browser:full") ? { ...process.env, E2E_WORKERS: "1" } : undefined });
	if (result.exitCode !== 0) {
		console.error(`[content-release-gate] FAILED (${result.exitCode}): ${command.join(" ")}`);
		process.exit(result.exitCode || 1);
	}
}

console.log("\n[content-release-gate] technical checks passed; human evidence remains separately classified in docs/sdk-content-release-verification.md");

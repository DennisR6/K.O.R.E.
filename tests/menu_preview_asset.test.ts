import { expect, test } from "bun:test";

test("menu preview asset contains precomputed render frames", async () => {
	const asset = await Bun.file("public/menu-preview.json").json() as {
		schemaVersion: number;
		frameIntervalMs: number;
		mapId: string;
		frames: Array<{ players: Array<{ x: number; y: number; rotation: number; dead?: boolean }> }>;
	};
	expect(asset.schemaVersion).toBe(1);
	expect(asset.mapId).toBe("magma-cradle");
	expect(asset.frameIntervalMs).toBeGreaterThan(0);
	expect(asset.frames.length).toBeGreaterThan(100);
	expect(asset.frames.every(frame => frame.players.length === 12)).toBe(true);
	expect(asset.frames.every(frame => frame.players.every(player => Number.isFinite(player.x) && Number.isFinite(player.y) && Number.isFinite(player.rotation)))).toBe(true);
	expect(asset.frames.some((frame, index) => index > 0 && frame.players[0]!.x !== asset.frames[0]!.players[0]!.x)).toBe(true);
	expect(asset.frames.some(frame => frame.players.some(player => player.dead === true))).toBe(true);
});

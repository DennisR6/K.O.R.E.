import { expect, test } from "bun:test";
import { createMagmaCradleMap } from "../src/settings/magmaCradleMap.ts";
import { createCanonicalPlayableMatchSettings } from "../src/settings/canonicalPlayableMatch.ts";
import { loadMapDocument } from "../src/contracts/documents.ts";
import { binaryBackedKoreTransform, decodeKorePackedSnapshot, encodeKorePackedSnapshot, koreSettingsToRoastPacked } from "../src/net/roastPackedSnapshot.ts";
import { decodeKorePackedInit, encodeKorePackedInit } from "../src/net/roastPackedInit.ts";
import type { EngineSettings } from "../src/kore/runtime/types.ts";
import { GameDatabase } from "../src/server/db.ts";
import { GameRegistry } from "../src/server/gameRegistry.ts";
import { ServerRuntime, type ServerSocket } from "../src/server/runtime.ts";
import { NetworkMessageType, type WebSocketData } from "../src/server/types.ts";

function fixture(): EngineSettings { return loadMapDocument(createMagmaCradleMap({ x: 800, y: 450 }), createCanonicalPlayableMatchSettings()) as EngineSettings; }
test("KORE packed Roast round trip preserves canonical player state", () => { const settings = fixture(); const restored = decodeKorePackedSnapshot(encodeKorePackedSnapshot(settings)); expect(restored.players).toEqual(settings.players); expect(restored.worldSize).toEqual(settings.worldSize); expect(restored.mapBoundarys).toEqual(settings.mapBoundarys); });
test("KORE uses the public Roast packed fixed schemas for players", () => { const packed = koreSettingsToRoastPacked(fixture()); expect(packed.entities).toHaveLength(12); expect((packed.entities[0] as Record<string, unknown>)["transform.state"]).toBeDefined(); expect((packed.entities[0] as Record<string, unknown>)["movement.state"]).toBeDefined(); });
test("KORE binary-backed transform mutation updates bytes immediately", () => { const settings = fixture(); const transform = binaryBackedKoreTransform(settings); const before = transform.toBinary().slice(); transform.x += 5; expect(transform.toSettings().position.x).toBe(settings.players[0]!.position.x + 5); expect(Array.from(transform.toBinary())).not.toEqual(Array.from(before)); });
test("JSON and packed adapter preserve gameplay-relevant players and movement state", () => { const settings = fixture(); const restored = decodeKorePackedSnapshot(encodeKorePackedSnapshot(settings)); expect(restored.players.map(player => ({ id: player.id, position: player.position, velocity: player.velocity, rotation: player.rotation, angularVelocity: player.angularVelocity, isPhysicsEnabled: player.isPhysicsEnabled }))).toEqual(settings.players.map(player => ({ id: player.id, position: player.position, velocity: player.velocity, rotation: player.rotation, angularVelocity: player.angularVelocity, isPhysicsEnabled: player.isPhysicsEnabled }))); });

test("staged packed snapshots preserve effects and thresholds through fallback storage", () => {
	const settings = fixture();
	for (const stage of [1, 2, 3] as const) {
		expect(decodeKorePackedSnapshot(encodeKorePackedSnapshot(settings, undefined, stage), stage).players).toEqual(settings.players);
	}
});

test("packed INIT preserves metadata and authoritative settings", () => {
	const settings = fixture();
	const decoded = decodeKorePackedInit(encodeKorePackedInit(settings, { gameId: "game-1", mapId: "map-1", modeId: "mode-1", ruleState: settings.ruleState }));
	expect(decoded.gameId).toBe("game-1");
	expect(decoded.mapId).toBe("map-1");
	expect(decoded.modeId).toBe("mode-1");
	expect(decoded.ruleState).toEqual(settings.ruleState);
	expect(decoded.settings.players).toEqual(settings.players);
});

test.serial("server opt-in sends packed INIT frames that restore on the browser boundary", () => {
	const database = new GameDatabase(":memory:");
	const runtime = new ServerRuntime(new GameRegistry(database), undefined, true);
	class Socket implements ServerSocket {
		public sent: Array<string | Uint8Array> = [];
		constructor(public data: WebSocketData) { }
		send(value: string | Uint8Array): void { this.sent.push(value); }
	}
	const one = new Socket({ connectionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" });
	const two = new Socket({ connectionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" });
	runtime.open(one); runtime.open(two);
	runtime.message(one, JSON.stringify({ type: NetworkMessageType.LOGIN, userid: "11111111-1111-4111-8111-111111111111" }));
	runtime.message(two, JSON.stringify({ type: NetworkMessageType.LOGIN, userid: "22222222-2222-4222-8222-222222222222" }));
	runtime.matchmakeOnce();
	const frame = one.sent.findLast(value => value instanceof Uint8Array);
	expect(frame).toBeInstanceOf(Uint8Array);
	const decoded = decodeKorePackedInit(frame as Uint8Array);
	expect(decoded.settings.players).toHaveLength(12);
	expect(decoded.gameId).toBeString();
	database.close();
});

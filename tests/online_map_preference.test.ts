import { expect, test } from "bun:test";
import { GameDatabase } from "../src/server/db.ts";
import { GameRegistry } from "../src/server/gameRegistry.ts";
import { ServerRuntime, type ServerSocket } from "../src/server/runtime.ts";
import { MapRepository } from "../src/server/mapRepository.ts";
import { createCueClashMap } from "../src/settings/cueClashMap.ts";
import { NetworkMessageType, type WebSocketData } from "../src/server/types.ts";

class Socket implements ServerSocket {
	public sent: string[] = [];
	constructor(public data: WebSocketData) { }
	public send(value: string): void { this.sent.push(value) }
}
const packet = (socket: Socket) => JSON.parse(socket.sent.at(-1)!);

test.serial("online map preferences reject maps outside the production roster", () => {
	const database = new GameDatabase(":memory:");
	const runtime = new ServerRuntime(new GameRegistry(database));
	const one = new Socket({ connectionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" });
	const two = new Socket({ connectionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" });
	runtime.open(one); runtime.open(two);
	runtime.message(one, JSON.stringify({ type: NetworkMessageType.LOGIN, userid: "11111111-1111-4111-8111-111111111111", mapPreference: "cue-clash" }));
	runtime.message(two, JSON.stringify({ type: NetworkMessageType.LOGIN, userid: "22222222-2222-4222-8222-222222222222", mapPreference: "cue-clash" }));
	runtime.matchmakeOnce();
	expect(packet(one)).toEqual({ type: NetworkMessageType.ERROR, message: "Invalid map preference" });
	expect(packet(two)).toEqual({ type: NetworkMessageType.ERROR, message: "Invalid map preference" });
	database.close();
});

test.serial("friend room codes pair only the intended two players", () => {
	const database = new GameDatabase(":memory:");
	const runtime = new ServerRuntime(new GameRegistry(database));
	const host = new Socket({ connectionId: "ffffffff-ffff-4fff-8fff-ffffffffffff" });
	const guest = new Socket({ connectionId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee" });
	runtime.open(host); runtime.open(guest);
	runtime.message(host, JSON.stringify({ type: NetworkMessageType.LOGIN, userid: "66666666-6666-4666-8666-666666666666", friendRole: "create" }));
	const code = JSON.parse(host.sent.find(value => value.includes("FRIEND_ROOM_CREATED"))!).code;
	runtime.message(guest, JSON.stringify({ type: NetworkMessageType.LOGIN, userid: "77777777-7777-4777-8777-777777777777", friendRole: "join", friendCode: code }));
	runtime.matchmakeOnce();
	expect(packet(host).type).toBe(NetworkMessageType.INIT);
	expect(packet(guest).type).toBe(NetworkMessageType.INIT);
	database.close();
});

test.serial("invalid or mismatched preferences never become a server map payload", () => {
	const database = new GameDatabase(":memory:");
	const runtime = new ServerRuntime(new GameRegistry(database));
	const one = new Socket({ connectionId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" });
	runtime.open(one);
	runtime.message(one, JSON.stringify({ type: NetworkMessageType.LOGIN, userid: "33333333-3333-4333-8333-333333333333", mapPreference: "../../raw-settings" }));
	expect(packet(one)).toEqual({ type: NetworkMessageType.ERROR, message: "Invalid map preference" });
	database.close();
});

test.serial("database-backed matchmaking expands only an approved immutable map ID", () => {
	const database = new GameDatabase(":memory:");
	const mapId = "994e2514-344e-4f59-a509-2b4e1b5bf96f";
	database.createMap({ id: mapId, document: createCueClashMap({ x: 800, y: 450 }), status: "approved" });
	const runtime = new ServerRuntime(new GameRegistry(database), new MapRepository(database));
	const one = new Socket({ connectionId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd" });
	const two = new Socket({ connectionId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee" });
	runtime.open(one); runtime.open(two);
	runtime.message(one, JSON.stringify({ type: NetworkMessageType.LOGIN, userid: "44444444-4444-4444-8444-444444444444", mapPreference: mapId }));
	runtime.message(two, JSON.stringify({ type: NetworkMessageType.LOGIN, userid: "55555555-5555-4555-8555-555555555555", mapPreference: mapId }));
	runtime.matchmakeOnce();
	expect(packet(one).mapId).toBe(mapId);
	expect(packet(two).mapId).toBe(mapId);
	database.close();
});

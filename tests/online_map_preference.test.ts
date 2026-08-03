import { expect, test } from "bun:test";
import { GameDatabase } from "../src/server/db.ts";
import { GameRegistry } from "../src/server/gameRegistry.ts";
import { ServerRuntime, type ServerSocket } from "../src/server/runtime.ts";
import { NetworkMessageType, type WebSocketData } from "../src/server/types.ts";

class Socket implements ServerSocket {
	public sent: string[] = [];
	constructor(public data: WebSocketData) { }
	public send(value: string): void { this.sent.push(value) }
}
const packet = (socket: Socket) => JSON.parse(socket.sent.at(-1)!);

test.serial("online map preferences select only a shared eligible catalog map and otherwise fall back", () => {
	const database = new GameDatabase(":memory:");
	const runtime = new ServerRuntime(new GameRegistry(database));
	const one = new Socket({ connectionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" });
	const two = new Socket({ connectionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" });
	runtime.open(one); runtime.open(two);
	runtime.message(one, JSON.stringify({ type: NetworkMessageType.LOGIN, userid: "11111111-1111-4111-8111-111111111111", mapPreference: "cue-clash" }));
	runtime.message(two, JSON.stringify({ type: NetworkMessageType.LOGIN, userid: "22222222-2222-4222-8222-222222222222", mapPreference: "cue-clash" }));
	runtime.matchmakeOnce();
	expect(packet(one).mapId).toBe("cue-clash");
	expect(packet(two).mapId).toBe("cue-clash");
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

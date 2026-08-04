import { expect, test } from "bun:test";
import { GameHandlerBuilder } from "../src/engine/Handler.ts";
import { MatchEndReason, MatchStatus } from "../src/rules/types.ts";
import { createDefaultGameSettings } from "../src/settings/settings.ts";
import { GameDatabase } from "../src/server/db.ts";
import { GameRegistry } from "../src/server/gameRegistry.ts";
import { ServerRuntime, type ServerSocket } from "../src/server/runtime.ts";
import { NetworkMessageType, type WebSocketData } from "../src/server/types.ts";

const FIRST_USER = "11111111-1111-4111-8111-111111111111";
const SECOND_USER = "22222222-2222-4222-8222-222222222222";

class Socket implements ServerSocket {
	public readonly sent: string[] = [];
	public constructor(public data: WebSocketData) { }
	public send(message: string): void { this.sent.push(message); }
	public last(type: NetworkMessageType): Record<string, unknown> | undefined {
		return this.sent.map(message => JSON.parse(message) as Record<string, unknown>).filter(message => message.type === type).at(-1);
	}
}

test("either completed-match participant exports the same replay token and both receive it", () => {
	const handler = new GameHandlerBuilder().defaultSystems().fromSettings(createDefaultGameSettings()).build();
	handler.finishMatch({ status: MatchStatus.Draw, winnerTeam: null, reason: MatchEndReason.Draw, turnNumber: 0 });
	const database = new GameDatabase(":memory:");
	database.createGame({ id: "replay-participant-game", settings: handler.toSettings(), users: [FIRST_USER, SECOND_USER], currentTeam: 0, turnNumber: 0, updatedAt: 1, lifecycle: { version: 1, status: "completed", createdAt: 1, statusChangedAt: 1, completedAt: 1 } });
	const runtime = new ServerRuntime(new GameRegistry(database));
	const first = new Socket({ connectionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" });
	const second = new Socket({ connectionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" });
	runtime.open(first); runtime.open(second);
	runtime.message(first, JSON.stringify({ type: NetworkMessageType.LOGIN, userid: FIRST_USER }));
	runtime.message(second, JSON.stringify({ type: NetworkMessageType.LOGIN, userid: SECOND_USER }));

	runtime.message(first, JSON.stringify({ type: NetworkMessageType.CREATE_REPLAY_SHARE }));
	const firstToken = first.last(NetworkMessageType.REPLAY_SHARE_CREATED)?.token;
	expect(firstToken).toMatch(/^[a-f0-9]{32}$/);
	expect(second.last(NetworkMessageType.REPLAY_SHARE_CREATED)?.token).toBe(firstToken);

	runtime.message(second, JSON.stringify({ type: NetworkMessageType.CREATE_REPLAY_SHARE }));
	expect(first.last(NetworkMessageType.REPLAY_SHARE_CREATED)?.token).toBe(firstToken);
	expect(second.last(NetworkMessageType.REPLAY_SHARE_CREATED)?.token).toBe(firstToken);
	database.close();
});

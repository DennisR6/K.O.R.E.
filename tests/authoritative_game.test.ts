import { expect, test } from "bun:test";
import { EffectModifyMass } from "../src/effects/modifyMass.ts";
import { EffectTrigger } from "../src/effects/types.ts";
import { GameHandlerBuilder } from "../src/engine/Handler.ts";
import { NetworkEmitter, installTurnReceiver } from "../src/emitter/NetworkEmitter.ts";
import { GameState, type TurnPacket } from "../src/engine/types.ts";
import { createPlayerSettings, type PlayerSettings } from "../src/entity/types.ts";
import { Player } from "../src/entity/Player.ts";
import { RulePhase } from "../src/rules/types.ts";
import { GameSettings } from "../src/settings/settings.ts";
import { ServerRuntime, type ServerSocket } from "../src/server/runtime.ts";
import { GameDatabase } from "../src/server/db.ts";
import { GameRegistry } from "../src/server/gameRegistry.ts";
import { NetworkMessageType, type WebSocketData } from "../src/server/types.ts";

const userOne = "11111111-1111-4111-8111-111111111111";
const userTwo = "22222222-2222-4222-8222-222222222222";

class FakeSocket implements ServerSocket {
	public sent: string[] = [];
	public listeners: Array<(event: MessageEvent) => void> = [];
	constructor(public data: WebSocketData) { }
	public send(message: string): void { this.sent.push(message) }
	public addEventListener(_type: "message", listener: (event: MessageEvent) => void): void { this.listeners.push(listener) }
	public receive(message: string): void { this.listeners.forEach(listener => listener({ data: message } as MessageEvent)) }
}

function packet(socket: FakeSocket): any {
	return JSON.parse(socket.sent.at(-1)!)
}

function connectMatchedRuntime(): { runtime: ServerRuntime; first: FakeSocket; second: FakeSocket } {
	const runtime = new ServerRuntime()
	const first = new FakeSocket({ connectionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" })
	const second = new FakeSocket({ connectionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" })
	runtime.open(first)
	runtime.open(second)
	runtime.message(first, JSON.stringify({ type: NetworkMessageType.LOGIN, userid: userOne }))
	runtime.message(second, JSON.stringify({ type: NetworkMessageType.LOGIN, userid: userTwo }))
	runtime.matchmakeOnce()
	expect(packet(first).settings.state).toBe(GameState.Your_turn)
	expect(packet(second).settings.state).toBe(GameState.Opponents_turn)
	expect(packet(first).ruleState).toEqual({ phase: RulePhase.Physics, activeTeam: 0, turnNumber: 0, itemUses: 0 })
	return { runtime, first, second }
}

test("Player settings round-trip all mutable state", () => {
	const settings = createPlayerSettings({
		position: { x: 12, y: 34 },
		velocity: { x: 5, y: -6 },
		rotation: 90,
		angularVelocity: 1.5,
		hp: 7,
		mass: 0.5,
		size: 17,
		friction: 0.3,
		team: [2],
		isPhysicsEnabled: false,
		isDrawingEnabled: false,
		inventory: [{ itemId: "anchor", remainingUses: 1, usesThisTurn: 0 }],
		effects: [{ trigger: EffectTrigger.Collision, triggerValue: [], ...new EffectModifyMass({ typeValue: { mass: 0.25 } }).toSettings() }],
	})
	expect(new Player(settings).toSettings()).toEqual(settings)
})

test("handler settings round-trip includes real map structures", () => {
	const handler = new GameHandlerBuilder().defaultSystems().fromSettings(GameSettings).build()
	const restored = new GameHandlerBuilder().defaultSystems().fromSettings(handler.toSettings()).build()
	expect(restored.toSettings()).toEqual(handler.toSettings())
})

test("server accepts only the active user's valid actor and broadcasts one authoritative turn", () => {
	const { runtime, first, second } = connectMatchedRuntime()
	const game = runtime.getRegistry().getForUser(userOne)!
	const actorId = game.handler.getEntityManager().getEntities().find(entity => entity.getTeam().includes(0))!.getId()

	runtime.message(first, JSON.stringify({ type: NetworkMessageType.SHOOT, actorId, angle: 0, power: 1 }))
	const firstTurn = packet(first)
	const secondTurn = packet(second)

	expect(firstTurn).toEqual(secondTurn)
	expect(firstTurn.type).toBe(NetworkMessageType.TURN)
	expect(firstTurn.gameId).toBe(game.id)
	expect(firstTurn.sequence).toBe(1)
	expect(firstTurn.stateHash).toMatch(/^[0-9a-f]{8}$/)
	expect(firstTurn.turnNumber).toBe(1)
	expect(firstTurn.activeTeam).toBe(1)
	expect(firstTurn.ruleState).toEqual({ phase: RulePhase.Physics, activeTeam: 1, turnNumber: 1, itemUses: 0 })
	expect(game.handler.getEntityManager().serialize()).toEqual(firstTurn.sim.finalState)
	expect(game.ruleState).toEqual({ phase: RulePhase.Physics, activeTeam: 1, turnNumber: 1, itemUses: 0 })

	runtime.message(first, JSON.stringify({ type: NetworkMessageType.SHOOT, actorId, angle: 0, power: 1 }))
	expect(packet(first)).toEqual({ type: NetworkMessageType.ERROR, message: "It is not your turn" })
})

test("server rejects malformed, unauthenticated, invalid, and enemy-actor inputs without changing state", () => {
	const runtime = new ServerRuntime()
	const anonymous = new FakeSocket({ connectionId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" })
	runtime.open(anonymous)
	runtime.message(anonymous, "not json")
	expect(packet(anonymous).message).toBe("Malformed network packet")
	runtime.message(anonymous, JSON.stringify({ type: NetworkMessageType.SHOOT, actorId: "x", angle: 0, power: 1 }))
	expect(packet(anonymous).message).toBe("Login is required before shooting")

	const matched = connectMatchedRuntime()
	const game = matched.runtime.getRegistry().getForUser(userOne)!
	const before = game.handler.getEntityManager().serialize()
	const enemy = game.handler.getEntityManager().getEntities().find(entity => entity.getTeam().includes(1))!.getId()
	matched.runtime.message(matched.first, JSON.stringify({ type: NetworkMessageType.SHOOT, actorId: enemy, angle: 0, power: 1 }))
	expect(packet(matched.first).message).toBe("Actor is not controlled by this user")
	matched.runtime.message(matched.first, JSON.stringify({ type: NetworkMessageType.SHOOT, actorId: enemy, angle: 360, power: 50 }))
	expect(packet(matched.first).message).toBe("Invalid shot input")
	expect(game.handler.getEntityManager().serialize()).toEqual(before)
})

test("disconnect removes a waiting user before matchmaking", () => {
	const runtime = new ServerRuntime()
	const disconnected = new FakeSocket({ connectionId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee" })
	const first = new FakeSocket({ connectionId: "ffffffff-ffff-4fff-8fff-ffffffffffff" })
	const second = new FakeSocket({ connectionId: "99999999-9999-4999-8999-999999999999" })
	runtime.open(disconnected)
	runtime.message(disconnected, JSON.stringify({ type: NetworkMessageType.LOGIN, userid: userOne }))
	runtime.close(disconnected)
	runtime.open(first)
	runtime.open(second)
	runtime.message(first, JSON.stringify({ type: NetworkMessageType.LOGIN, userid: userTwo }))
	runtime.message(second, JSON.stringify({ type: NetworkMessageType.LOGIN, userid: "44444444-4444-4444-8444-444444444444" }))
	runtime.matchmakeOnce()
	expect(runtime.getRegistry().getForUser(userOne)).toBeUndefined()
	expect(packet(first).type).toBe(NetworkMessageType.INIT)
	expect(packet(second).type).toBe(NetworkMessageType.INIT)
})

test("server rematch resets authoritative state and broadcasts initialized settings", () => {
	const { runtime, first, second } = connectMatchedRuntime()
	const game = runtime.getRegistry().getForUser(userOne)!
	const actorId = game.handler.getEntityManager().getEntities().find(entity => entity.getTeam().includes(0))!.getId()
	runtime.message(first, JSON.stringify({ type: NetworkMessageType.SHOOT, actorId, angle: 0, power: 1 }))
	runtime.message(second, JSON.stringify({ type: NetworkMessageType.REMATCH }))

	expect(packet(first).type).toBe(NetworkMessageType.INIT)
	expect(packet(second).type).toBe(NetworkMessageType.INIT)
	expect(packet(first).settings.turnNumber).toBe(0)
	expect(packet(first).settings.activeTeam).toBe(0)
	expect(game.ruleState).toEqual({ phase: RulePhase.Physics, activeTeam: 0, turnNumber: 0, itemUses: 0 })
});

test("compressed SQLite state restores an evicted authoritative game", () => {
	const database = new GameDatabase(":memory:")
	const registry = new GameRegistry(database, 1)
	const record = registry.create(GameSettings, [userOne, userTwo])
	registry.connectUser(userOne)
	registry.connectUser(userTwo)
	const actorId = record.handler.getEntityManager().getEntities().find(entity => entity.getTeam().includes(0))!.getId()
	const result = registry.submitTurn(userOne, { actorId, angle: 0, power: 1 })
	expect(result.ok).toBe(true)
	if (!result.ok) throw new Error(result.error)
	const expectedState = result.packet.finalState
	expect(database.getCompressedSnapshotSize(record.id)).toBeGreaterThan(0)

	registry.evictInactive(Date.now() + 2)
	expect(registry.isCached(record.id)).toBe(false)

	const restored = registry.getForUser(userTwo)!
	expect(restored.turnNumber).toBe(1)
	expect(restored.currentTeam).toBe(1)
	expect(restored.handler.getEntityManager().serialize()).toEqual(expectedState)
	database.close()
})

test("a reconnect restores the stored game instead of entering matchmaking", () => {
	const database = new GameDatabase(":memory:")
	const registry = new GameRegistry(database)
	const runtime = new ServerRuntime(registry)
	const first = new FakeSocket({ connectionId: "55555555-5555-4555-8555-555555555555" })
	const second = new FakeSocket({ connectionId: "66666666-6666-4666-8666-666666666666" })
	runtime.open(first)
	runtime.open(second)
	runtime.message(first, JSON.stringify({ type: NetworkMessageType.LOGIN, userid: userOne }))
	runtime.message(second, JSON.stringify({ type: NetworkMessageType.LOGIN, userid: userTwo }))
	runtime.matchmakeOnce()
	const gameId = registry.getForUser(userOne)!.id
	runtime.close(first)
	runtime.close(second)
	expect(registry.isCached(gameId)).toBe(false)

	const reconnect = new FakeSocket({ connectionId: "77777777-7777-4777-8777-777777777777" })
	runtime.open(reconnect)
	runtime.message(reconnect, JSON.stringify({ type: NetworkMessageType.LOGIN, userid: userOne }))
	expect(packet(reconnect).type).toBe(NetworkMessageType.INIT)
	expect(packet(reconnect).settings.id).toBe(gameId)
	database.close()
})

test("explicit leave ends the match and lets the same user enter a fresh lobby", () => {
	const { runtime, first, second } = connectMatchedRuntime()
	const oldGameId = runtime.getRegistry().getForUser(userOne)!.id
	runtime.message(first, JSON.stringify({ type: NetworkMessageType.LEAVE_GAME }))
	const firstEnded = packet(first)
	const secondEnded = packet(second)
	expect(firstEnded).toMatchObject({ type: NetworkMessageType.GAME_ENDED, reason: "A player left the game" })
	expect(firstEnded.players).toBeArray()
	expect(secondEnded).toMatchObject({ type: NetworkMessageType.GAME_ENDED, reason: "A player left the game", players: firstEnded.players })
	expect(runtime.getRegistry().getForUser(userOne)).toBeUndefined()
	expect(runtime.getRegistry().getForUser(userTwo)).toBeUndefined()

	runtime.close(first)
	const retry = new FakeSocket({ connectionId: "77777777-7777-4777-8777-777777777778" })
	const replacement = new FakeSocket({ connectionId: "88888888-8888-4888-8888-888888888888" })
	runtime.open(retry)
	runtime.open(replacement)
	runtime.message(retry, JSON.stringify({ type: NetworkMessageType.LOGIN, userid: userOne }))
	runtime.message(replacement, JSON.stringify({ type: NetworkMessageType.LOGIN, userid: "33333333-3333-4333-8333-333333333333" }))
	runtime.matchmakeOnce()
	expect(packet(retry).type).toBe(NetworkMessageType.INIT)
	expect(packet(retry).settings.id).not.toBe(oldGameId)
})

test("surrender completes the persisted match and allows immediate rematch matchmaking", () => {
	const { runtime, first, second } = connectMatchedRuntime()
	const oldGameId = runtime.getRegistry().getForUser(userOne)!.id
	runtime.message(first, JSON.stringify({ type: NetworkMessageType.SURRENDER_GAME }))
	const ended = JSON.parse(first.sent.at(-2)!)
	const otherEnded = packet(second)
	const surrendered = packet(first)
	expect(ended.type).toBe(NetworkMessageType.GAME_ENDED)
	expect(ended.result).toMatchObject({ status: "winner", winnerTeam: 1, reason: "surrendered" })
	expect(ended.players).toBeArray()
	expect(ended.players.length).toBeGreaterThan(0)
	expect(otherEnded).toMatchObject({ type: NetworkMessageType.GAME_ENDED, result: ended.result, players: ended.players })
	expect(surrendered).toMatchObject({ type: NetworkMessageType.SURRENDERED, result: ended.result })
	expect(runtime.getRegistry().getForUser(userOne)?.lifecycle.status).toBe("completed")
	expect(runtime.getRegistry().getDatabase().getLifecycle(oldGameId)?.status).toBe("completed")

	runtime.close(first)
	const retry = new FakeSocket({ connectionId: "77777777-7777-4777-8777-777777777779" })
	const replacement = new FakeSocket({ connectionId: "88888888-8888-4888-8888-888888888889" })
	runtime.open(retry)
	runtime.open(replacement)
	runtime.message(retry, JSON.stringify({ type: NetworkMessageType.LOGIN, userid: userOne }))
	runtime.message(replacement, JSON.stringify({ type: NetworkMessageType.LOGIN, userid: "33333333-3333-4333-8333-333333333333" }))
	runtime.matchmakeOnce()
	expect(packet(retry).type).toBe(NetworkMessageType.INIT)
	expect(packet(retry).gameId).not.toBe(oldGameId)
	runtime.getRegistry().getDatabase().close()
})

test("NetworkEmitter sends only shot input and TURN fully reconciles the local entity", () => {
	const source = createPlayerSettings({ id: "33333333-3333-4333-8333-333333333333", position: { x: 0, y: 0 }, team: [0] })
	const handler = new GameHandlerBuilder().defaultSystems().setPlayerTeam([0]).addPlayer(new Player(source)).build()
	const socket = new FakeSocket({ connectionId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd" })
	const emitter = new NetworkEmitter(socket as unknown as WebSocket)
	emitter.sendShot(source.id, 90, 2)
	expect(JSON.parse(socket.sent[0])).toEqual({ type: NetworkMessageType.SHOOT, actorId: source.id, angle: 90, power: 2 })

	installTurnReceiver(socket as unknown as WebSocket, handler)
	const finalState: PlayerSettings = createPlayerSettings({
		...source,
		position: { x: 50, y: 60 },
		velocity: { x: 0, y: 0 },
		hp: 5,
		mass: 0.4,
		size: 9,
		team: [1],
		isDrawingEnabled: false,
		isPhysicsEnabled: false,
		inventory: [{ itemId: "item", remainingUses: 1, usesThisTurn: 0 }],
	})
	const turn: TurnPacket = { actorId: source.id, input: { angle: 0, power: 1 }, durationFrames: 0, finalState: [finalState] }
	const ruleState = { phase: RulePhase.Physics, activeTeam: 1, turnNumber: 3, itemUses: 0 }
	socket.receive(JSON.stringify({ type: NetworkMessageType.TURN, sim: turn, turnNumber: 3, activeTeam: 1, ruleState }))
	handler.tick()
	expect(handler.getState()).toBe(GameState.Opponents_turn)
	expect(handler.getEntityManager().getEntities()[0].toSettings()).toEqual(finalState)
	expect(handler.getContext().currTurn).toBe(3)
	expect(handler.getRuleState()).toEqual(ruleState)
	expect(handler.getLogs().some(log => log.type === "turnPacket.pre-sync-drift")).toBe(true)

	const endedPlayers = [createPlayerSettings({ ...finalState, position: { x: 90, y: 100 } })];
	socket.receive(JSON.stringify({ type: NetworkMessageType.GAME_ENDED, reason: "A player surrendered", players: endedPlayers }));
	expect(handler.getState()).toBe(GameState.Game_over);
	expect(handler.getEntityManager().getEntities()[0].toSettings()).toEqual(endedPlayers[0]);
})

test("NetworkEmitter rejects stale turns and records hash mismatches", () => {
	const source = createPlayerSettings({ id: "44444444-4444-4444-8444-444444444444", position: { x: 0, y: 0 }, team: [0] });
	const handler = new GameHandlerBuilder().defaultSystems().setPlayerTeam([0]).addPlayer(new Player(source)).build();
	const socket = new FakeSocket({ connectionId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee" });
	installTurnReceiver(socket as unknown as WebSocket, handler);
	const ruleState = { phase: RulePhase.Physics, activeTeam: 1, turnNumber: 1, itemUses: 0 };
	const finalState = [createPlayerSettings({ ...source, position: { x: 12, y: 13 } })];
	socket.receive(JSON.stringify({ type: NetworkMessageType.TURN, sequence: 1, turnNumber: 1, activeTeam: 1, ruleState, stateHash: "00000000", sim: { actorId: source.id, input: { angle: 0, power: 1 }, durationFrames: 0, finalState } }));
	handler.tick();
	expect(handler.getLogs().some(log => log.type === "turnPacket.hash-mismatch")).toBe(true);
	socket.receive(JSON.stringify({ type: NetworkMessageType.TURN, sequence: 1, turnNumber: 1, activeTeam: 1, ruleState, stateHash: "00000000", sim: { actorId: source.id, input: { angle: 0, power: 1 }, durationFrames: 0, finalState: [createPlayerSettings({ ...source, position: { x: 99, y: 99 } })] } }));
	expect(handler.getLogs().some(log => log.type === "turnPacket.stale")).toBe(true);
	expect(handler.getEntityManager().getEntities()[0].getPos()).toEqual({ x: 12, y: 13 });
});

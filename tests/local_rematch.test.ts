import { expect, test } from "bun:test";
import { GameHandlerBuilder } from "../src/engine/Handler.ts";
import { GameState } from "../src/engine/types.ts";
import { MatchEndReason, MatchStatus } from "../src/rules/types.ts";
import { GameSettings } from "../src/settings/settings.ts";

test("local rematch restores configured players and fresh match state", () => {
	const handler = new GameHandlerBuilder().defaultSystems().fromSettings(GameSettings).build();
	const initial = GameSettings.players.map(player => ({ id: player.id, position: player.position, isPhysicsEnabled: player.isPhysicsEnabled, isDrawingEnabled: player.isDrawingEnabled }));
	const player = handler.getEntityManager().getEntities()[0];
	player.setPos({ x: 999, y: 999 });
	player.setIsDead(true);
	handler.setTurnNumber(4);
	handler.setActiveTeam(1);
	handler.setMatchResult({ status: MatchStatus.Winner, winnerTeam: 1, reason: MatchEndReason.LastTeamStanding, turnNumber: 4 });
	handler.setState(GameState.Game_over);

	handler.rematch();

	expect(handler.getState()).toBe(GameState.Your_turn);
	expect(handler.getTurnNumber()).toBe(0);
	expect(handler.getActiveTeam()).toBe(0);
	expect(handler.getMatchResult()).toBeUndefined();
	expect(handler.getEntityManager().getEntities().map(entity => ({ id: entity.getId(), position: entity.getPos(), isPhysicsEnabled: entity.physicsEnabled(), isDrawingEnabled: entity.drawingEnabled() }))).toEqual(initial);
});

import { expect, test } from "bun:test";
import { issuePlayerSession, verifyPlayerSession } from "../src/server/playerSession.ts";

test("player sessions are signed, time bounded, and restore the player identity", () => {
	const token = issuePlayerSession("player-1", "test-secret", 1000, 1000);
	expect(verifyPlayerSession(token, "test-secret", 1500)).toMatchObject({ userId: "player-1", issuedAt: 1000, expiresAt: 2000 });
	expect(verifyPlayerSession(token, "wrong-secret", 1500)).toBeUndefined();
	expect(verifyPlayerSession(token, "test-secret", 2000)).toBeUndefined();
});

test("player sessions reject tampering and invalid identities", () => {
	const token = issuePlayerSession("player-1", "test-secret", 1000);
	const parts = token.split(".");
	parts[0] = "player-2";
	expect(verifyPlayerSession(parts.join("."), "test-secret", 1001)).toBeUndefined();
	expect(() => issuePlayerSession("bad id", "test-secret", 1000)).toThrow();
});

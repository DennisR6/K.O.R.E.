import { expect, test } from "bun:test";
import { RankedQueue } from "../src/server/rankedQueue.ts";

test("ranked queue pairs compatible players by wait time and rating range", () => {
	const queue = new RankedQueue();
	queue.enqueue({ playerId: "a", seasonId: "s1", rating: 1000, region: "eu", joinedAt: 0 });
	queue.enqueue({ playerId: "b", seasonId: "s1", rating: 1080, region: "eu", joinedAt: 100 });
	const match = queue.match(1_000, 50, 50);
	expect(match?.first.playerId).toBe("a");
	expect(match?.mapId).toBe("magma-cradle");
	expect(queue.size()).toBe(0);
});

test("ranked queue does not pair different seasons or regions and supports cancellation", () => {
	const queue = new RankedQueue();
	queue.enqueue({ playerId: "a", seasonId: "s1", rating: 1000, region: "eu", joinedAt: 0 });
	queue.enqueue({ playerId: "b", seasonId: "s2", rating: 1000, region: "eu", joinedAt: 0 });
	queue.enqueue({ playerId: "c", seasonId: "s1", rating: 1000, region: "us", joinedAt: 0 });
	expect(queue.match(1_000)).toBeUndefined();
	expect(queue.cancel("c")).toBe(true);
	expect(queue.has("c")).toBe(false);
});

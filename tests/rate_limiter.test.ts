import { expect, test } from "bun:test";
import { RateLimiter } from "../src/server/rateLimiter.ts";

test("rate limiter refills deterministically and reports retry time", () => {
	const limiter = new RateLimiter(2, 1);
	expect(limiter.consume("player", 0).allowed).toBe(true);
	expect(limiter.consume("player", 0).allowed).toBe(true);
	const blocked = limiter.consume("player", 0);
	expect(blocked.allowed).toBe(false);
	expect(blocked.retryAfterMs).toBe(1000);
	expect(limiter.consume("player", 1000).allowed).toBe(true);
});

test("rate limiter isolates keys and can clear a bucket", () => {
	const limiter = new RateLimiter(1, 1);
	expect(limiter.consume("a", 0).allowed).toBe(true);
	expect(limiter.consume("b", 0).allowed).toBe(true);
	limiter.clear("a");
	expect(limiter.consume("a", 0).allowed).toBe(true);
});

export type RateLimitDecision = { allowed: boolean; remaining: number; retryAfterMs: number };

type Bucket = { tokens: number; updatedAt: number };

/** Small deterministic in-memory token bucket for login, queue, and action gates. */
export class RateLimiter {
	private readonly buckets = new Map<string, Bucket>();
	public constructor(private readonly capacity: number, private readonly refillPerSecond: number) {
		if (!Number.isFinite(capacity) || capacity <= 0 || !Number.isFinite(refillPerSecond) || refillPerSecond <= 0) throw new Error("Invalid rate limiter configuration");
	}

	public consume(key: string, now: number, cost = 1): RateLimitDecision {
		if (!key || !Number.isFinite(now) || !Number.isFinite(cost) || cost <= 0) throw new Error("Invalid rate limiter request");
		const previous = this.buckets.get(key) ?? { tokens: this.capacity, updatedAt: now };
		const elapsed = Math.max(0, now - previous.updatedAt) / 1000;
		const tokens = Math.min(this.capacity, previous.tokens + elapsed * this.refillPerSecond);
		if (tokens < cost) {
			const retryAfterMs = Math.ceil((cost - tokens) / this.refillPerSecond * 1000);
			this.buckets.set(key, { tokens, updatedAt: now });
			return { allowed: false, remaining: Math.floor(tokens), retryAfterMs };
		}
		const remaining = tokens - cost;
		this.buckets.set(key, { tokens: remaining, updatedAt: now });
		return { allowed: true, remaining: Math.floor(remaining), retryAfterMs: 0 };
	}

	public clear(key?: string): void { if (key === undefined) this.buckets.clear(); else this.buckets.delete(key); }
}

import { expect, test } from "bun:test";
import { advanceLifetime, createLifetime, validateLifetime } from "@coffeemakerstudio/roast";

test("lifetime advances immutably at duration one and two boundaries", () => {
	const one = createLifetime({ durationUnit: "turns", duration: 1 });
	const two = createLifetime({ durationUnit: "ticks", duration: 2 });

	expect(advanceLifetime(one)).toBeUndefined();
	const next = advanceLifetime(two)!;
	expect(next).toEqual({ durationUnit: "ticks", duration: 2, remaining: 1 });
	expect(advanceLifetime(next)).toBeUndefined();
	expect(two).toEqual({ durationUnit: "ticks", duration: 2, remaining: 2 });
});

test("lifetime validates both supported time domains without advancing either", () => {
	expect(() => createLifetime({ durationUnit: "turns", duration: 2, remaining: 0 })).toThrow("remaining");
	expect(() => createLifetime({ durationUnit: "ticks", duration: 2, remaining: 3 })).toThrow("remaining");
	expect(() => createLifetime({ durationUnit: "seconds" as never, duration: 1 })).toThrow("unit");
	expect(() => validateLifetime({ durationUnit: "turns", duration: 1, remaining: 1 })).not.toThrow();
});

test("lifetime transitions do not mutate the input object", () => {
	const current = { durationUnit: "turns" as const, duration: 3, remaining: 2 };
	const next = advanceLifetime(current)!;

	expect(current).toEqual({ durationUnit: "turns", duration: 3, remaining: 2 });
	expect(next).toEqual({ durationUnit: "turns", duration: 3, remaining: 1 });
});

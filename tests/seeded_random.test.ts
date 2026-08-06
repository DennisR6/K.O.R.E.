import { expect, test } from "bun:test";
import { SeededRandom } from "../src/utils/random.ts";

test("SeededRandom repeats a sequence for the same seed", () => {
	const first = new SeededRandom(42)
	const second = new SeededRandom(42)
	const differentSeed = new SeededRandom(7)
	const firstSequence = Array.from({ length: 8 }, () => first.next())
	const secondSequence = Array.from({ length: 8 }, () => second.next())

	expect(firstSequence).toEqual(secondSequence)
	expect(firstSequence).toEqual([
		0.6011037519201636,
		0.44829055899754167,
		0.8524657934904099,
		0.6697340414393693,
		0.17481389874592423,
		0.5265925421845168,
		0.2732279943302274,
		0.6247446539346129,
	])
	expect(firstSequence.every(value => value >= 0 && value < 1)).toBe(true)
	expect(firstSequence).not.toEqual(Array.from({ length: 8 }, () => differentSeed.next()))
})

test("SeededRandom provides bounded integers and rejects invalid bounds", () => {
	const random = new SeededRandom(7)
	expect(Array.from({ length: 20 }, () => random.nextInt(3)).every(value => value >= 0 && value < 3)).toBe(true)
	expect(() => new SeededRandom(0.5)).toThrow(RangeError)
	expect(() => random.nextInt(0)).toThrow(RangeError)
})

/** Deterministic pseudo-random source for replayable gameplay decisions. */
export class SeededRandom {
	private state: number;

	public constructor(seed: number) {
		if (!Number.isSafeInteger(seed)) throw new RangeError("Seed must be a safe integer")
		this.state = seed >>> 0
	}

	/** Returns a deterministic value in the range [0, 1). */
	public next(): number {
		this.state = (this.state + 0x6D2B79F5) >>> 0
		let value = this.state
		value = Math.imul(value ^ (value >>> 15), value | 1)
		value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
		return ((value ^ (value >>> 14)) >>> 0) / 0x100000000
	}

	/** Returns a deterministic integer in the range [0, maxExclusive). */
	public nextInt(maxExclusive: number): number {
		if (!Number.isSafeInteger(maxExclusive) || maxExclusive <= 0) {
			throw new RangeError("Maximum must be a positive safe integer")
		}
		return Math.floor(this.next() * maxExclusive)
	}
}

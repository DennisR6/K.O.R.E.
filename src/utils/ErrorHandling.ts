export interface Result<T, K> {
	isErr(): this is ResultError<K>
	isOk(): this is ResultOk<T>
	unwrap(): T | undefined
	Error(): K | undefined
}

export function Ok<T>(data: T): ResultOk<T> { return new ResultOk<T>(data) }
export function Err<K>(data: K): ResultError<K> { return new ResultError<K>(data) }

class ResultError<K> implements Result<undefined, K> {
	private err: K
	constructor(errmsg: K) { this.err = errmsg }
	isErr(): this is ResultError<K> { return true }
	isOk(): this is ResultOk<undefined> { return false }
	Error(): K { return this.err }
	unwrap(): undefined { console.trace("you tried to unwrap an Error", this.err) }
}

class ResultOk<T> implements Result<T, undefined> {
	private data: T
	constructor(data: T) { this.data = data }
	isErr(): this is ResultError<undefined> { return false }
	isOk(): this is ResultOk<T> { return true }
	unwrap(): T { return this.data }
	Error(): undefined { }
}

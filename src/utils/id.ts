import type { UUID } from "crypto";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function getUserUUUID(): UUID | null {
	if (typeof window === 'undefined') return null
	return window.localStorage.getItem("userid") as UUID | null
}
export function setUserUUUID(uuid: UUID | undefined): UUID {
	let newuuid: UUID
	if (!uuid) newuuid = crypto.randomUUID()
	else newuuid = uuid
	window.localStorage.setItem("userid", newuuid)
	return newuuid
}
export function getGameUUUID(): UUID | null {
	if (typeof window === 'undefined') return null
	return window.localStorage.getItem("gameid") as (UUID | null)
}


export function uuidToUint32Array(uuid: string): Uint32Array {
	const hex = uuid.replace(/-/g, '');
	const bytes = new Uint8Array(16);

	for (let i = 0; i < 16; i++) {
		const start = i * 2;
		bytes[i] = parseInt(hex.slice(start, start + 2), 16);
	}

	return new Uint32Array(bytes.buffer);
}

export function uint8ArrayToUuid(bytes: Uint8Array): string {
	if (bytes.length !== 16) {
		throw new Error("UUID muss genau 16 Bytes lang sein.");
	}

	const hex = Array.from(bytes)
		.map(b => b.toString(16).padStart(2, '0'))
		.join('');

	return [
		hex.slice(0, 8),
		hex.slice(8, 12),
		hex.slice(12, 16),
		hex.slice(16, 20),
		hex.slice(20)
	].join('-');
}

export function stringToBytes(str: string): Uint8Array {
	return encoder.encode(str);
}

export function bytesToString(bytes: Uint8Array): string {
	return decoder.decode(bytes);
}

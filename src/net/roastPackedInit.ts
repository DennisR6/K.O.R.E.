
import type { EngineSettings } from "../kore/runtime/types.js";
import { decodeKorePackedSnapshot, encodeKorePackedSnapshot } from "./roastPackedSnapshot.js";

const MAGIC = 0x31494e4b; // KIN1, little-endian

export interface PackedInitMeta { gameId?: string; mapId?: string; modeId?: string; ruleState: EngineSettings["ruleState"] }
export function encodeKorePackedInit(settings: EngineSettings, meta: PackedInitMeta): Uint8Array {
	const payload = encodeKorePackedSnapshot(settings);
	const metadata = new TextEncoder().encode(JSON.stringify(meta));
	const result = new Uint8Array(8 + metadata.byteLength + payload.byteLength);
	const view = new DataView(result.buffer); view.setUint32(0, MAGIC, true); view.setUint32(4, metadata.byteLength, true);
	result.set(metadata, 8); result.set(payload, 8 + metadata.byteLength); return result;
}
export function decodeKorePackedInit(bytes: Uint8Array): PackedInitMeta & { settings: EngineSettings } {
	if (bytes.byteLength < 8) throw new Error("Packed INIT is truncated"); const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength); if (view.getUint32(0, true) !== MAGIC) throw new Error("Invalid packed INIT magic"); const metadataLength = view.getUint32(4, true); if (metadataLength > bytes.byteLength - 8) throw new Error("Invalid packed INIT metadata length");
	let meta: PackedInitMeta; try { meta = JSON.parse(new TextDecoder().decode(bytes.subarray(8, 8 + metadataLength))) as PackedInitMeta; } catch { throw new Error("Invalid packed INIT metadata"); }
	return { ...meta, settings: decodeKorePackedSnapshot(bytes.subarray(8 + metadataLength)) };
}

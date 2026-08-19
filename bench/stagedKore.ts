import { createMagmaCradleMap } from "../src/settings/magmaCradleMap.ts";
import { createCanonicalPlayableMatchSettings } from "../src/settings/canonicalPlayableMatch.ts";
import { loadMapDocument } from "../src/contracts/documents.ts";
import { decodeFrame } from "@coffeemakerstudio/roast";
import { diagnoseKorePackedSnapshot, encodeKorePackedSnapshot, decodeKorePackedSnapshot } from "../src/net/roastPackedSnapshot.ts";
const settings = loadMapDocument(createMagmaCradleMap({ x: 800, y: 450 }), createCanonicalPlayableMatchSettings()) as any;
for (const stage of [1, 2, 3] as const) {
 const bytes = encodeKorePackedSnapshot(settings, undefined, stage); const payload = decodeFrame(bytes).payload; const v = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
 const offsets = { frameByteLength: bytes.byteLength, payloadLength: payload.byteLength, entityTableOffset:v.getUint32(12,true), componentTableOffset:v.getUint32(16,true), dataOffset:v.getUint32(20,true), dataLength:v.getUint32(24,true), stringTableOffset:v.getUint32(28,true), stringTableLength:v.getUint32(32,true), metadataOffset:v.getUint32(36,true), metadataLength:v.getUint32(40,true) };
 try { const d=diagnoseKorePackedSnapshot(settings,stage).diagnostics; console.log(JSON.stringify({stage,bytes:bytes.byteLength, diagnostics:d, offsets})); } catch (e) { console.log(JSON.stringify({stage,bytes:bytes.byteLength, error:String(e), offsets})); }
 try { decodeKorePackedSnapshot(bytes,stage); console.log("decode",stage,"PASS"); } catch(e) { console.log("decode",stage,"FAIL",String(e)); }
}

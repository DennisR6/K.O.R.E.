import type { UnTypedNetworkMessage } from "../server/types.js"

export function wrap<T extends UnTypedNetworkMessage>(payload: T): string { return JSON.stringify(payload) }
export function unwrap<T extends UnTypedNetworkMessage>(payload: string): T { return JSON.parse(payload) }

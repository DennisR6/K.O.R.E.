export interface DiscordInvitePayload {
	gameId: string;
	secret?: string;
}

export function validateGameIdentifier(gameId: unknown): boolean {
	if (typeof gameId !== "string" || gameId.trim().length === 0) return false;
	const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
	return uuidRegex.test(gameId) || gameId.length <= 64;
}

export function parseDiscordInvite(payload: unknown): DiscordInvitePayload {
	if (!payload || typeof payload !== "object") {
		throw new Error("Invalid invite payload");
	}
	const rec = payload as Record<string, unknown>;
	if (!validateGameIdentifier(rec.gameId)) {
		throw new Error("Invalid or unsafe game identifier in Discord invite");
	}
	return {
		gameId: String(rec.gameId),
		secret: typeof rec.secret === "string" ? rec.secret : undefined,
	};
}

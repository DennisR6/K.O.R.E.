import { createHmac, timingSafeEqual } from "node:crypto";

export type PlayerSession = { userId: string; issuedAt: number; expiresAt: number };

/** Signs short-lived player sessions; account creation/transport remains a host policy. */
export function issuePlayerSession(userId: string, secret: string, now: number, ttlMs = 8 * 60 * 60 * 1000): string {
	if (!/^[a-zA-Z0-9._:-]{1,120}$/.test(userId) || !secret || !Number.isSafeInteger(now) || now < 0 || !Number.isSafeInteger(ttlMs) || ttlMs <= 0) throw new Error("Invalid player session input");
	const payload = `${userId}.${now}.${now + ttlMs}`;
	return `${payload}.${sign(payload, secret)}`;
}

export function verifyPlayerSession(token: string, secret: string, now: number): PlayerSession | undefined {
	if (!token || !secret || !Number.isSafeInteger(now) || now < 0) return undefined;
	const parts = token.split(".");
	if (parts.length !== 4) return undefined;
	const [userId, issuedRaw, expiresRaw, signature] = parts;
	if (!userId || !issuedRaw || !expiresRaw || !signature || !/^\d+$/.test(issuedRaw) || !/^\d+$/.test(expiresRaw)) return undefined;
	const issuedAt = Number(issuedRaw); const expiresAt = Number(expiresRaw);
	if (!Number.isSafeInteger(issuedAt) || !Number.isSafeInteger(expiresAt) || now < issuedAt || now >= expiresAt) return undefined;
	const expected = sign(`${userId}.${issuedAt}.${expiresAt}`, secret);
	try { if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return undefined; } catch { return undefined; }
	return { userId, issuedAt, expiresAt };
}

function sign(payload: string, secret: string): string { return createHmac("sha256", secret).update(`kore-player-session-v1.${payload}`).digest("base64url"); }

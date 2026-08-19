import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdirSync, readdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { AssetPaths } from "../assetManager/assets/assetRegistry.js";
import type { GameDatabase } from "./db.js";

export const DEBUG_ASSETS_PATH = "/debug-assets";
export const DEBUG_ASSET_SESSION_PATH = "/debug-assets/session";
const COOKIE = "kore_debug_asset_session";
const MAX_BYTES = 8 * 1024 * 1024;
const EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp", "gif"]);

type AssetDatabase = Pick<GameDatabase, "isDebugAssetTokenValid">;

export function isDebugAssetsPath(pathname: string): boolean {
	return pathname === DEBUG_ASSETS_PATH || pathname === DEBUG_ASSET_SESSION_PATH || pathname.startsWith(`${DEBUG_ASSETS_PATH}/`);
}

export async function serveDebugAssets(request: Request, database: AssetDatabase, secret: string | undefined, root: string): Promise<Response | undefined> {
	const url = new URL(request.url);
	if (!isDebugAssetsPath(url.pathname)) return undefined;
	if (!secret) return notFound();
	if (url.pathname === DEBUG_ASSET_SESSION_PATH) return createSession(request, database, secret);
	if (!isSession(request, secret)) return notFound();
	mkdirSync(root, { recursive: true });
	if (url.pathname === DEBUG_ASSETS_PATH && request.method === "GET") return listAssets(root);
	const asset = decodeURIComponent(url.pathname.slice(`${DEBUG_ASSETS_PATH}/`.length));
	const fileAsset = asset.endsWith("/file") ? asset.slice(0, -5) : asset;
	if (!fileAsset || !assetNameAllowed(fileAsset)) return notFound();
	if (asset.endsWith("/file")) return serveFile(fileAsset, root);
	if (request.method === "POST") return upload(request, asset, root);
	if (request.method === "DELETE") return remove(asset, root);
	return new Response("Method not allowed", { status: 405, headers: { allow: "POST, DELETE" } });
}

async function createSession(request: Request, database: AssetDatabase, secret: string): Promise<Response> {
	if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers: { allow: "POST" } });
	const authorization = request.headers.get("authorization");
	const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";
	if (!token || !database.isDebugAssetTokenValid(token)) return notFound();
	const expires = Math.floor(Date.now() / 1000) + 8 * 60 * 60;
	const payload = `kore-debug-assets-v1.${expires}`;
	const signature = createHmac("sha256", secret).update(payload).digest("base64url");
	return Response.json({ ok: true }, { headers: { "set-cookie": `${COOKIE}=${expires}.${signature}; Path=${DEBUG_ASSETS_PATH}; HttpOnly; Secure; SameSite=Strict; Max-Age=28800`, "cache-control": "no-store" } });
}

function isSession(request: Request, secret: string): boolean {
	const raw = request.headers.get("cookie")?.split(";").map(part => part.trim()).find(part => part.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1) ?? "";
	const [expires, signature, ...extra] = raw.split(".");
	if (extra.length || !/^\d+$/.test(expires ?? "") || Number(expires) < Math.floor(Date.now() / 1000) || !signature) return false;
	const expected = createHmac("sha256", secret).update(`kore-debug-assets-v1.${expires}`).digest("base64url");
	const supplied = Buffer.from(signature); const wanted = Buffer.from(expected);
	return supplied.length === wanted.length && timingSafeEqual(supplied, wanted);
}

function assetNameAllowed(asset: string): boolean {
	return Object.values(AssetPaths).includes(asset) && asset.split("/").length <= 3 && !asset.includes("..") && EXTENSIONS.has(asset.split(".").pop()?.toLowerCase() ?? "");
}

function assetFile(asset: string, root: string): string { return join(root, encodeURIComponent(asset)); }

function listAssets(root: string): Response {
	const overrides = new Set(readdirSync(root, { withFileTypes: true }).filter(entry => entry.isFile()).map(entry => decodeURIComponent(entry.name)));
	const assets = Object.values(AssetPaths).map(path => ({ path, override: overrides.has(path), url: overrides.has(path) ? `${DEBUG_ASSETS_PATH}/${encodeURIComponent(path)}/file` : `/public/${path}` }));
	return Response.json({ schemaVersion: 1, assets }, { headers: { "cache-control": "no-store" } });
}

async function upload(request: Request, asset: string, root: string): Promise<Response> {
	const body = await request.arrayBuffer();
	if (body.byteLength === 0 || body.byteLength > MAX_BYTES) return new Response("Invalid asset size", { status: 400 });
	const contentType = request.headers.get("content-type") ?? "";
	if (!contentType.startsWith("image/")) return new Response("Only image uploads are allowed", { status: 415 });
	mkdirSync(root, { recursive: true });
	await Bun.write(assetFile(asset, root), body);
	return Response.json({ ok: true, asset }, { headers: { "cache-control": "no-store" } });
}

async function serveFile(asset: string, root: string): Promise<Response> {
	if (!assetNameAllowed(asset)) return notFound();
	const file = Bun.file(assetFile(asset, root));
	if (!await file.exists()) return notFound();
	return new Response(file, { headers: { "cache-control": "no-store", "content-type": file.type || "application/octet-stream" } });
}

function remove(asset: string, root: string): Response {
	const path = assetFile(asset, root);
	try { unlinkSync(path); } catch { return notFound(); }
	return Response.json({ ok: true }, { headers: { "cache-control": "no-store" } });
}

function notFound(): Response { return new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } }); }

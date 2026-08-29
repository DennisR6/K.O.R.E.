import { AssetPaths } from "../assetManager/assets/assetRegistry.js";
import { assetManager } from "../assetManager/loader.js";
import type { GameHandler } from "../kore/runtime/Handler.js";

type AssetRow = { path: string; override: boolean; url: string };
type ItemRow = { itemId: string; override: boolean; source?: string };

function appUrl(path: string): string { return new URL(path.replace(/^\//, ""), document.baseURI).toString(); }

export async function startAssetDebugPanel(): Promise<void> {
	const root = document.createElement("main");
	root.style.cssText = "font:16px system-ui;max-width:1000px;margin:2rem auto;padding:1rem;color:#172033";
	document.body.style.cursor = "auto";
	document.body.style.display = "block";
	document.body.style.height = "auto";
	document.body.style.minHeight = "100vh";
	document.body.style.overflow = "auto";
	document.body.style.backgroundColor = "#f8fafc";
	document.body.style.color = "#172033";
	document.body.replaceChildren(root);
	root.innerHTML = `<h1>KORE debug assets</h1><p>Overrides are isolated from production assets.</p><form id="login"><label>Debug asset API key <input name="key" type="password" required autocomplete="off"></label> <button>Unlock</button></form><p id="status"></p><h2>Item pictures</h2><section id="items"></section><h2>Registered assets</h2><section id="assets"></section>`;
	const status = root.querySelector("#status")!;
	const assets = root.querySelector("#assets")!;
	const items = root.querySelector("#items")!;
	const login = root.querySelector("#login") as HTMLElement;
	const openSession = async (message: string): Promise<void> => {
		const assetRows = await refreshAssets(assets, status);
		if (assetRows.length === 0) return;
		login.hidden = true;
		status.textContent = message;
		await refreshItems(items, status, assetRows);
	};
	const existingSession = await fetch(appUrl("debug-assets"), { credentials: "same-origin" });
	if (existingSession.ok) await openSession("Session restored from the existing debug-asset cookie.");
	root.querySelector("form")!.addEventListener("submit", async event => {
		event.preventDefault();
		const key = new FormData(event.currentTarget as HTMLFormElement).get("key");
		if (typeof key !== "string") return;
		const response = await fetch(appUrl("debug-assets/session"), { method: "POST", headers: { authorization: `Bearer ${key}` } });
		if (!response.ok) { status.textContent = "Invalid or expired debug asset key."; return; }
		status.textContent = "Unlocked. The key is held by an HttpOnly cookie.";
		await openSession(status.textContent);
	});
}

async function refreshItems(container: Element, status: Element, assets: AssetRow[]): Promise<void> {
	const response = await fetch(appUrl("debug-assets/items"), { credentials: "same-origin" });
	if (!response.ok) { status.textContent = "Debug asset session expired."; return; }
	const rows = (await response.json() as { items: ItemRow[] }).items;
	container.replaceChildren(...rows.map(row => itemCard(row, status, container, assets)));
}

function itemCard(row: ItemRow, status: Element, container: Element, assets: AssetRow[]): HTMLElement {
	const card = document.createElement("article"); card.style.cssText = "display:inline-flex;vertical-align:top;flex-direction:column;gap:.5rem;width:220px;margin:.5rem;padding:1rem;border:1px solid #ccd3df;border-radius:8px";
	const title = document.createElement("strong"); title.textContent = row.itemId;
	const image = document.createElement("img"); image.alt = `${row.itemId} item`; image.style.cssText = "width:180px;height:120px;object-fit:contain;background:#eef2f7";
	const selectedAsset = row.source ? assets.find(asset => `public/${asset.path}` === row.source) : undefined;
	if (row.source) image.src = appUrl(selectedAsset?.override ? selectedAsset.url : row.source);
	const select = document.createElement("select"); for (const asset of assets) { const option = document.createElement("option"); option.value = `public/${asset.path}`; option.textContent = asset.path; option.selected = option.value === row.source; select.append(option); }
	const upload = document.createElement("button"); upload.textContent = "Assign asset key";
	upload.onclick = async () => { const result = await fetch(appUrl(`debug-assets/items/${encodeURIComponent(row.itemId)}`), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ source: select.value }) }); status.textContent = result.ok ? `Assigned ${row.itemId}.` : `Assignment failed for ${row.itemId}.`; if (result.ok) await refreshItems(container, status, assets); };
	const restore = document.createElement("button"); restore.textContent = "Use placeholder"; restore.disabled = !row.override;
	restore.onclick = async () => { const result = await fetch(appUrl(`debug-assets/items/${encodeURIComponent(row.itemId)}`), { method: "DELETE" }); if (result.ok) await refreshItems(container, status, assets); };
	card.append(title, image, select, upload, restore); return card;
}

/** Loads authenticated overrides before an opt-in debug game starts. */
export async function loadDebugAssetOverrides(): Promise<boolean> {
	const response = await fetch(appUrl("debug-assets"), { credentials: "same-origin" });
	if (!response.ok) return false;
	const rows = (await response.json() as { assets: AssetRow[] }).assets;
	installDebugAssetOverrides(rows);
	return true;
}

export async function loadDebugItemOverrides(): Promise<Map<string, string>> {
	const response = await fetch(appUrl("debug-assets/items"), { credentials: "same-origin" });
	if (!response.ok) return new Map();
	const rows = (await response.json() as { items: ItemRow[] }).items;
	return new Map(rows.filter(row => row.override && row.source).map(row => [row.itemId, row.source!]));
}

export function applyDebugItemOverrides(handler: GameHandler, overrides: Map<string, string>): void {
	if (overrides.size === 0) return;
	const items = handler.getSettings()?.items;
	if (!items) return;
	handler.setItems(items.map(item => { const source = overrides.get(item.id); return source ? { ...structuredClone(item), ui: { ...(item.ui ?? {}), component: { type: "image", source } } } : item; }));
}

async function refreshAssets(container: Element, status: Element): Promise<AssetRow[]> {
	const response = await fetch(appUrl("debug-assets"), { credentials: "same-origin" });
	if (!response.ok) { status.textContent = "Debug asset session expired."; return []; }
	const rows = (await response.json() as { assets: AssetRow[] }).assets;
	container.replaceChildren(...rows.map(row => assetCard(row, status, container)));
	return rows;
}

function assetCard(row: AssetRow, status: Element, container: Element): HTMLElement {
	const card = document.createElement("article");
	card.style.cssText = "display:inline-flex;vertical-align:top;flex-direction:column;gap:.5rem;width:220px;margin:.5rem;padding:1rem;border:1px solid #ccd3df;border-radius:8px";
	const title = document.createElement("strong"); title.textContent = row.path;
	const image = document.createElement("img"); image.src = `${appUrl(row.url)}?t=${Date.now()}`; image.alt = row.path; image.style.cssText = "width:180px;height:120px;object-fit:contain;background:#eef2f7";
	const input = document.createElement("input"); input.type = "file"; input.accept = "image/png,image/jpeg,image/webp,image/gif";
	const upload = document.createElement("button"); upload.textContent = "Upload replacement";
	upload.onclick = async () => { const file = input.files?.[0]; if (!file) return; const result = await fetch(appUrl(`debug-assets/${encodeURIComponent(row.path)}`), { method: "POST", body: file, headers: { "content-type": file.type } }); status.textContent = result.ok ? `Uploaded ${row.path}. Reloading preview.` : `Upload failed for ${row.path}.`; if (result.ok) { row.override = true; row.url = `/debug-assets/${encodeURIComponent(row.path)}/file`; image.src = `${appUrl(row.url)}?t=${Date.now()}`; } };
	const restore = document.createElement("button"); restore.textContent = "Use production asset"; restore.disabled = !row.override;
	restore.onclick = async () => { const result = await fetch(appUrl(`debug-assets/${encodeURIComponent(row.path)}`), { method: "DELETE" }); if (result.ok) await refreshAssets(container, status); };
	card.append(title, image, input, upload, restore);
	return card;
}

export function installDebugAssetOverrides(rows: AssetRow[]): void {
	for (const row of rows) {
		if (!row.override) continue;
		const numericKey = (Object.entries(AssetPaths).find(([, path]) => path === row.path)?.[0]);
		const overrideUrl = appUrl(row.url);
		if (numericKey !== undefined) assetManager.setOverride(Number(numericKey), overrideUrl);
		// Item UI declarations use the registered `public/...` source string,
		// while map/player settings commonly use the numeric AssetKey.
		assetManager.setOverride(`public/${row.path}`, overrideUrl);
	}
}

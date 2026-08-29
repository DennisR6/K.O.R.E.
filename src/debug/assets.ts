import { AssetPaths } from "../assetManager/assets/assetRegistry.js";
import { assetManager } from "../assetManager/loader.js";
import type { GameHandler } from "../kore/runtime/Handler.js";

type AssetRow = { path: string; override: boolean; url: string };
type ItemRow = { itemId: string; override: boolean; source?: string };

function appUrl(path: string): string { return new URL(path.replace(/^\//, ""), document.baseURI).toString(); }

export async function startAssetDebugPanel(): Promise<void> {
	const root = document.createElement("main");
	root.className = "mx-auto max-w-7xl space-y-6 px-5 py-8 lg:px-8";
	document.body.style.cursor = "auto";
	document.body.style.display = "block";
	document.body.style.height = "auto";
	document.body.style.minHeight = "100vh";
	document.body.style.overflow = "auto";
	document.body.style.backgroundColor = "#020617";
	document.body.style.color = "#0f172a";
	document.body.replaceChildren(root);
	if (!document.querySelector('script[src="https://cdn.tailwindcss.com"]')) { const tailwind = document.createElement("script"); tailwind.src = "https://cdn.tailwindcss.com"; document.head.append(tailwind); }
	root.innerHTML = `<header class="-mx-5 -mt-8 mb-2 border-b border-white/10 bg-slate-950/80 text-white backdrop-blur lg:-mx-8"><div class="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 lg:px-8"><div><p class="text-xs font-bold uppercase tracking-[.28em] text-violet-300">KORE / DESIGNER TOOLS</p><h1 class="mt-1 text-2xl font-semibold tracking-tight">Debug asset workspace</h1></div><a class="rounded-lg px-3 py-2 text-sm text-slate-300 transition hover:bg-white/10 hover:text-white" href="${appUrl("operator/dashboard")}">Operator dashboard</a></div></header><section><p class="text-sm font-medium text-violet-400">Private development overrides</p><h2 class="mt-1 text-3xl font-bold tracking-tight text-white">Preview and assign game assets</h2><p class="mt-2 max-w-2xl text-sm text-slate-400">Replace registered images for your debug session without modifying the shipped game files.</p></section><section class="rounded-2xl border border-violet-200 bg-violet-50 p-6 shadow-xl shadow-slate-950/10"><p class="text-xs font-bold uppercase tracking-[.18em] text-violet-700">Before you begin</p><h3 class="mt-2 text-xl font-bold text-slate-900">How overrides work</h3><div class="mt-4 grid gap-4 text-sm text-slate-600 md:grid-cols-3"><p><strong class="block text-slate-900">Private storage</strong>Uploads live in <code>data/debug-assets/</code>; production files are never changed.</p><p><strong class="block text-slate-900">Assignments</strong>Item picture mappings are stored separately as <code>item-overrides.json</code>.</p><p><strong class="block text-slate-900">Enable in-game</strong>Open the game with <code>?assets=1</code> in this same browser session.</p></div></section><section class="rounded-2xl border border-slate-800 bg-slate-900 p-6 text-white shadow-xl shadow-slate-950/20"><p class="text-xs font-bold uppercase tracking-[.18em] text-slate-500">Authentication</p><h3 class="mt-2 text-xl font-bold">Unlock designer access</h3><form id="login" class="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end"><label class="flex-1 text-sm text-slate-300">Debug asset API key<input name="key" type="password" required autocomplete="off" class="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"></label><button class="rounded-lg bg-violet-500 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-400">Unlock</button></form><p id="status" class="mt-4 text-sm text-slate-400"></p></section><section><div class="mb-4"><p class="text-xs font-bold uppercase tracking-[.18em] text-slate-500">Item catalog</p><h2 class="mt-1 text-2xl font-bold text-white">Item pictures</h2><p class="mt-1 text-sm text-slate-400">Assign a registered asset key to the item preview used by local debug matches.</p></div><section id="items" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"></section></section><section><div class="mb-4"><p class="text-xs font-bold uppercase tracking-[.18em] text-slate-500">Registered catalog</p><h2 class="mt-1 text-2xl font-bold text-white">Game assets</h2><p class="mt-1 text-sm text-slate-400">Upload a replacement or restore the original production asset.</p></div><section id="assets" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"></section></section>`;
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
	const card = document.createElement("article"); card.className = "flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl shadow-slate-950/10";
	const title = document.createElement("strong"); title.textContent = row.itemId;
	const assignment = document.createElement("small"); assignment.textContent = row.override ? `Assigned asset key: ${row.source ?? "unknown"}` : "Using the item placeholder"; assignment.style.color = row.override ? "#166534" : "#64748b";
	const image = document.createElement("img"); image.alt = `${row.itemId} item`; image.className = "h-32 w-full rounded-xl bg-slate-100 object-contain";
	const selectedAsset = row.source ? assets.find(asset => `public/${asset.path}` === row.source) : undefined;
	if (row.source) image.src = appUrl(selectedAsset?.override ? selectedAsset.url : row.source);
	const select = document.createElement("select"); select.className = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"; for (const asset of assets) { const option = document.createElement("option"); option.value = `public/${asset.path}`; option.textContent = asset.path; option.selected = option.value === row.source; select.append(option); }
	const upload = document.createElement("button"); upload.textContent = "Assign asset key"; upload.className = "rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-500";
	upload.onclick = async () => { const result = await fetch(appUrl(`debug-assets/items/${encodeURIComponent(row.itemId)}`), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ source: select.value }) }); status.textContent = result.ok ? `Assigned ${row.itemId}.` : `Assignment failed for ${row.itemId}.`; if (result.ok) await refreshItems(container, status, assets); };
	const restore = document.createElement("button"); restore.textContent = "Use placeholder"; restore.disabled = !row.override; restore.className = "rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40";
	restore.onclick = async () => { const result = await fetch(appUrl(`debug-assets/items/${encodeURIComponent(row.itemId)}`), { method: "DELETE" }); if (result.ok) await refreshItems(container, status, assets); };
	card.append(title, assignment, image, select, upload, restore); return card;
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
	card.className = "flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl shadow-slate-950/10";
	const title = document.createElement("strong"); title.textContent = row.path;
	const state = document.createElement("small"); state.textContent = row.override ? "Using uploaded replacement" : "Using production asset"; state.style.color = row.override ? "#166534" : "#64748b";
	const image = document.createElement("img"); image.src = `${appUrl(row.url)}?t=${Date.now()}`; image.alt = row.path; image.className = "h-32 w-full rounded-xl bg-slate-100 object-contain";
	const input = document.createElement("input"); input.type = "file"; input.accept = "image/png,image/jpeg,image/webp,image/gif"; input.className = "w-full text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-slate-700";
	const upload = document.createElement("button"); upload.textContent = "Upload replacement"; upload.className = "rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-500";
	upload.onclick = async () => { const file = input.files?.[0]; if (!file) return; const result = await fetch(appUrl(`debug-assets/${encodeURIComponent(row.path)}`), { method: "POST", body: file, headers: { "content-type": file.type } }); status.textContent = result.ok ? `Uploaded ${row.path}. Reloading preview.` : `Upload failed for ${row.path}.`; if (result.ok) { row.override = true; row.url = `/debug-assets/${encodeURIComponent(row.path)}/file`; image.src = `${appUrl(row.url)}?t=${Date.now()}`; } };
	const restore = document.createElement("button"); restore.textContent = "Use production asset"; restore.disabled = !row.override; restore.className = "rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40";
	restore.onclick = async () => { const result = await fetch(appUrl(`debug-assets/${encodeURIComponent(row.path)}`), { method: "DELETE" }); if (result.ok) await refreshAssets(container, status); };
	card.append(title, state, image, input, upload, restore);
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

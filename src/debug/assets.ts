import { AssetPaths } from "../assetManager/assets/assetRegistry.js";
import { assetManager } from "../assetManager/loader.js";

type AssetRow = { path: string; override: boolean; url: string };

export async function startAssetDebugPanel(): Promise<void> {
	const root = document.createElement("main");
	root.style.cssText = "font:16px system-ui;max-width:1000px;margin:2rem auto;padding:1rem;color:#172033";
	document.body.style.cursor = "auto";
	document.body.replaceChildren(root);
	root.innerHTML = `<h1>KORE debug assets</h1><p>Overrides are isolated from production assets.</p><form id="login"><label>Debug asset API key <input name="key" type="password" required autocomplete="off"></label> <button>Unlock</button></form><p id="status"></p><section id="assets"></section>`;
	const status = root.querySelector("#status")!;
	const assets = root.querySelector("#assets")!;
	root.querySelector("form")!.addEventListener("submit", async event => {
		event.preventDefault();
		const key = new FormData(event.currentTarget as HTMLFormElement).get("key");
		if (typeof key !== "string") return;
		const response = await fetch("/debug-assets/session", { method: "POST", headers: { authorization: `Bearer ${key}` } });
		if (!response.ok) { status.textContent = "Invalid or expired debug asset key."; return; }
		status.textContent = "Unlocked. The key is held by an HttpOnly cookie.";
		(root.querySelector("#login") as HTMLElement).hidden = true;
		await refreshAssets(assets, status);
	});
}

async function refreshAssets(container: Element, status: Element): Promise<void> {
	const response = await fetch("/debug-assets", { credentials: "same-origin" });
	if (!response.ok) { status.textContent = "Debug asset session expired."; return; }
	const rows = (await response.json() as { assets: AssetRow[] }).assets;
	container.replaceChildren(...rows.map(row => assetCard(row, status, container)));
}

function assetCard(row: AssetRow, status: Element, container: Element): HTMLElement {
	const card = document.createElement("article");
	card.style.cssText = "display:inline-flex;vertical-align:top;flex-direction:column;gap:.5rem;width:220px;margin:.5rem;padding:1rem;border:1px solid #ccd3df;border-radius:8px";
	const title = document.createElement("strong"); title.textContent = row.path;
	const image = document.createElement("img"); image.src = `${row.url}?t=${Date.now()}`; image.alt = row.path; image.style.cssText = "width:180px;height:120px;object-fit:contain;background:#eef2f7";
	const input = document.createElement("input"); input.type = "file"; input.accept = "image/png,image/jpeg,image/webp,image/gif";
	const upload = document.createElement("button"); upload.textContent = "Upload replacement";
	upload.onclick = async () => { const file = input.files?.[0]; if (!file) return; const result = await fetch(`/debug-assets/${encodeURIComponent(row.path)}`, { method: "POST", body: file, headers: { "content-type": file.type } }); status.textContent = result.ok ? `Uploaded ${row.path}. Reloading preview.` : `Upload failed for ${row.path}.`; if (result.ok) { image.src = `${row.url}?t=${Date.now()}`; row.override = true; } };
	const restore = document.createElement("button"); restore.textContent = "Use production asset"; restore.disabled = !row.override;
	restore.onclick = async () => { const result = await fetch(`/debug-assets/${encodeURIComponent(row.path)}`, { method: "DELETE" }); if (result.ok) await refreshAssets(container, status); };
	card.append(title, image, input, upload, restore);
	return card;
}

export function installDebugAssetOverrides(rows: AssetRow[]): void {
	for (const row of rows) {
		if (!row.override) continue;
		const numericKey = (Object.entries(AssetPaths).find(([, path]) => path === row.path)?.[0]);
		if (numericKey !== undefined) assetManager.setOverride(Number(numericKey), row.url);
	}
}

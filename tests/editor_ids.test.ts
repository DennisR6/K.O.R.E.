import { expect, test } from "bun:test";

const editorHtml = await Bun.file("src-website/index.html").text();
const hazardsEditor = await Bun.file("src-website/js/editor-hazards.js").text();

test("editor markup has unique IDs and both hazard add controls use their intended selectors", () => {
	const ids = [...editorHtml.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
	const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);

	expect(duplicateIds).toEqual([]);
	expect(ids).toContain("btn-add-hazard-sidebar");
	expect(ids).toContain("btn-add-hazard-editor");
	expect(hazardsEditor).toContain('document.getElementById("btn-add-hazard-sidebar")');
	expect(hazardsEditor).toContain('document.getElementById("btn-add-hazard-editor")');
	expect(hazardsEditor).not.toContain('document.getElementById("btn-add-hazard")');
});

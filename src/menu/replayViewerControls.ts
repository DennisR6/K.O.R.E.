import { UiRuntime, type UiRuntimeNode } from "../engine/ui-sdk/index.js";
import { createReplayViewerComposition, KoreReplayCommand, KoreReplayElement } from "../kore/ui/replayViewer.js";

export interface ReplayViewerControlCallbacks {
	onLoad: (token: string) => void | Promise<void>;
	onPaste: () => string | undefined | Promise<string | undefined>;
}

/** Browser DOM adapter for the SDK-authored replay control composition. */
export function createReplayViewerControls(initialToken: string, callbacks: ReplayViewerControlCallbacks): {
	element: HTMLElement;
	setStatus: (text: string) => void;
	setToken: (token: string) => void;
} {
	const runtime = UiRuntime.fromSettings(createReplayViewerComposition().ui);
	const root = document.createElement("section");
	root.id = "replay-viewer-controls";
	root.setAttribute("data-ui-composition", "kore.replay-viewer");
	const nodes = new Map<string, HTMLElement>();
	for (const node of runtime.getActiveElements()) root.append(renderNode(node, nodes));
	const token = nodes.get(KoreReplayElement.Token) as HTMLInputElement | undefined;
	if (!token) throw new Error("Replay viewer composition is missing its token input");
	token.value = initialToken;
	const status = nodes.get(KoreReplayElement.Status);
	const setStatus = (text: string): void => {
		runtime.dispatch({ type: "setText", target: KoreReplayElement.Status, text });
		if (status) status.textContent = text;
	};
	const setToken = (value: string): void => {
		token.value = value;
		runtime.dispatch({ type: "setValue", target: KoreReplayElement.Token, value });
	};
	const dispatch = async (id: string): Promise<void> => {
		const element = runtime.toSettings().screens[0]?.elements.find(candidate => candidate.id === id);
		if (!element || element.kind !== "button" || !element.action) return;
		runtime.dispatch(element.action);
		for (const command of runtime.drainCommands()) {
			const payload = command.payload && typeof command.payload === "object" && !Array.isArray(command.payload) ? command.payload : undefined;
			if (command.command === KoreReplayCommand.Load) await callbacks.onLoad(String(payload?.[KoreReplayElement.Token] ?? ""));
			if (command.command === KoreReplayCommand.Paste) {
				const pasted = await callbacks.onPaste();
				if (pasted !== undefined) setToken(pasted);
			}
		}
	};
	const load = nodes.get(KoreReplayElement.Load);
	const paste = nodes.get(KoreReplayElement.Paste);
	load?.addEventListener("click", () => { void dispatch(KoreReplayElement.Load); });
	paste?.addEventListener("click", () => { void dispatch(KoreReplayElement.Paste); });
	token.addEventListener("input", () => runtime.dispatch({ type: "setValue", target: KoreReplayElement.Token, value: token.value }));
	return { element: root, setStatus, setToken };
}

function renderNode(node: UiRuntimeNode, nodes: Map<string, HTMLElement>): HTMLElement {
	if ("elements" in node) {
		const container = document.createElement("div");
		container.dataset.uiId = node.id;
		for (const child of node.elements) container.append(renderNode(child, nodes));
		nodes.set(node.id, container);
		return container;
	}
	const element = node.kind === "text" ? document.createElement(node.id === KoreReplayElement.Title ? "h1" : "p") : node.kind === "textInput" ? document.createElement("input") : document.createElement("button");
	element.dataset.uiId = node.id;
	element.textContent = node.kind === "textInput" ? "" : node.text ?? "";
	if (node.kind === "textInput") {
		const input = element as HTMLInputElement;
		input.type = "text";
		input.value = node.value ?? "";
		input.setAttribute("aria-label", "Replay share ID");
	}
	if (node.kind === "text" && node.id === KoreReplayElement.Status) element.setAttribute("role", "status");
	nodes.set(node.id, element);
	return element;
}

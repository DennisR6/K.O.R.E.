import type { JsonValue } from "@coffeemakerstudio/roast";
import type { ItemTarget } from "../../item/target.js";

/** Stable KORE HUD authoring vocabulary; generic UI remains string-based. */
export enum KoreHudCommand {
	UseItem = "kore.hud.use-item",
	SkipItemPhase = "kore.hud.skip-item-phase",
	Pause = "kore.hud.pause",
	Resume = "kore.hud.resume",
	Rematch = "kore.hud.rematch",
	Replay = "kore.hud.replay",
	Share = "kore.hud.share",
	ReplayShare = "kore.hud.replay-share",
	ReturnToMenu = "kore.hud.return-to-menu",
	Report = "kore.hud.report",
	ReportCategory = "kore.hud.report-category",
	SubmitReport = "kore.hud.submit-report",
	CancelReport = "kore.hud.cancel-report",
}

export type KoreReportCategory = "conduct" | "technical";

export interface KoreHudCommandPayloads {
	[KoreHudCommand.UseItem]: { itemId: string; target: ItemTarget };
	[KoreHudCommand.SkipItemPhase]: undefined;
	[KoreHudCommand.Pause]: undefined;
	[KoreHudCommand.Resume]: undefined;
	[KoreHudCommand.Rematch]: undefined;
	[KoreHudCommand.Replay]: undefined;
	[KoreHudCommand.Share]: undefined;
	[KoreHudCommand.ReplayShare]: undefined;
	[KoreHudCommand.ReturnToMenu]: undefined;
	[KoreHudCommand.Report]: undefined;
	[KoreHudCommand.ReportCategory]: { category: KoreReportCategory };
	[KoreHudCommand.SubmitReport]: { category: KoreReportCategory; text: string };
	[KoreHudCommand.CancelReport]: undefined;
}

export type KoreHudCommandMessage = { [Command in KoreHudCommand]: { type: Command; payload: KoreHudCommandPayloads[Command] } }[KoreHudCommand];
const VALUES = new Set<string>(Object.values(KoreHudCommand));

export function isKoreHudCommand(value: string): value is KoreHudCommand { return VALUES.has(value); }
export function parseKoreHudCommand(command: string, payload: JsonValue | undefined): KoreHudCommandMessage | undefined {
	if (!isKoreHudCommand(command)) return undefined;
	if (command === KoreHudCommand.UseItem) {
		if (!payload || typeof payload !== "object" || Array.isArray(payload) || typeof (payload as { itemId?: unknown }).itemId !== "string" || !("target" in payload)) return undefined;
		return { type: command, payload: { itemId: (payload as { itemId: string }).itemId, target: (payload as { target: ItemTarget }).target } };
	}
	if (command === KoreHudCommand.ReportCategory) {
		if (!payload || typeof payload !== "object" || Array.isArray(payload) || ((payload as { category?: unknown }).category !== "conduct" && (payload as { category?: unknown }).category !== "technical")) return undefined;
		return { type: command, payload: { category: (payload as { category: KoreReportCategory }).category } };
	}
	if (command === KoreHudCommand.SubmitReport) {
		if (!payload || typeof payload !== "object" || Array.isArray(payload)) return undefined;
		const value = payload as { category?: unknown; text?: unknown };
		if ((value.category !== "conduct" && value.category !== "technical") || typeof value.text !== "string") return undefined;
		return { type: command, payload: { category: value.category, text: value.text } };
	}
	if (payload !== undefined) return undefined;
	return { type: command, payload: undefined } as KoreHudCommandMessage;
}

export function assertNeverHudCommand(value: never): never { throw new Error(`Unhandled KORE HUD command '${String(value)}'`); }

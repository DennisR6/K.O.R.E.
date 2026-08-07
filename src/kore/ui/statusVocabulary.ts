import { KoreMenuStyle } from "./menuVocabulary.js";

/** KORE-owned status surface vocabulary. Generic UI continues to accept strings. */
export enum KoreStatusId {
	Runtime = "kore.status.ui",
}

export enum KoreStatusScreen {
	Main = "status",
}

export enum KoreStatusElement {
	Title = "status-title",
	Message = "status-message",
	Retry = "status-retry",
	Back = "status-back",
}

export enum KoreStatusCommand {
	Retry = "kore.status.retry",
	Back = "kore.status.back",
}

export enum KoreStatusStyle {
	Title = "kore.status.title",
	Message = "kore.status.message",
	/** Primary/back buttons reuse the shared KORE button theme styles. */
	Retry = KoreMenuStyle.MainButton,
	Back = KoreMenuStyle.Back,
}

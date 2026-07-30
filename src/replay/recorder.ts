import { DOCUMENT_SCHEMA_VERSION } from "../contracts/documents.js";
import type { ReplayDocument } from "./types.js";
import type { GameSettings } from "../settings/settings.js";
import { validateReplayDocument } from "./types.js";

export class ReplayRecorder {
	private document: ReplayDocument;

	public constructor(initialSettings: GameSettings, seed: number = 12345) {
		this.document = {
			schemaVersion: DOCUMENT_SCHEMA_VERSION,
			initialSettings: JSON.parse(JSON.stringify(initialSettings)),
			seed,
			actions: [],
		};
		validateReplayDocument(this.document);
	}

	public recordShoot(actorId: string, angle: number, power: number): void {
		this.document.actions.push({
			type: "shoot",
			actorId,
			input: { angle, power },
		});
	}

	public recordItemUse(actorId: string, itemId: string, target: unknown): void {
		this.document.actions.push({
			type: "itemUse",
			actorId,
			itemId,
			target: JSON.parse(JSON.stringify(target)),
		});
	}

	public getReplay(): ReplayDocument {
		validateReplayDocument(this.document);
		return JSON.parse(JSON.stringify(this.document));
	}
}

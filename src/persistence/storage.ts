import { validateSaveSlotDocument, createSaveSlot } from "./saveSlots.js";
import type { SaveSlotDocument } from "./saveSlots.js";
import type { GameSettings } from "../settings/settings.js";

export class LocalMatchStorage {
	private slots: Map<string, SaveSlotDocument> = new Map();

	public saveMatch(id: string, name: string, settings: GameSettings, snapshot: Record<string, unknown>): SaveSlotDocument {
		const slot = createSaveSlot(id, name, settings, snapshot);
		validateSaveSlotDocument(slot);
		this.slots.set(id, slot);
		return slot;
	}

	public getSlot(id: string): SaveSlotDocument | undefined {
		const slot = this.slots.get(id);
		if (!slot) return undefined;
		validateSaveSlotDocument(slot);
		return JSON.parse(JSON.stringify(slot));
	}

	public listSlots(): SaveSlotDocument[] {
		const results: SaveSlotDocument[] = [];
		for (const slot of this.slots.values()) {
			validateSaveSlotDocument(slot);
			results.push(JSON.parse(JSON.stringify(slot)));
		}
		return results.sort((a, b) => b.timestamp - a.timestamp);
	}

	public deleteSlot(id: string): boolean {
		return this.slots.delete(id);
	}

	public clear(): void {
		this.slots.clear();
	}
}

export const defaultLocalStorage = new LocalMatchStorage();

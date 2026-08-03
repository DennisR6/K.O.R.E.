import { loadMapDocument } from "../contracts/documents.js";
import type { GameSettings } from "../settings/settings.js";
import type { GameDatabase, StoredMap } from "./db.js";

/**
 * Server-only lookup boundary for declarative database maps. It deliberately
 * returns copied settings: a caller cannot mutate a stored approved revision.
 */
export class MapRepository {
	public constructor(private readonly database: Pick<GameDatabase, "getMap" | "listMaps">) { }

	public getApproved(mapId: string): StoredMap {
		const map = this.database.getMap(mapId);
		if (!map || map.status !== "approved") throw new Error("Map is not approved for matchmaking");
		return map;
	}

	public listApproved(): StoredMap[] {
		return this.database.listMaps("approved");
	}

	/** Converts only a fresh, approved database document into match settings. */
	public buildSettings(mapId: string, template: GameSettings): { map: StoredMap; settings: GameSettings } {
		const map = this.getApproved(mapId);
		return {
			map,
			settings: {
				...loadMapDocument(map.document, structuredClone(template)),
				mapReference: { mapId: map.id, contentHash: map.contentHash },
			},
		};
	}
}

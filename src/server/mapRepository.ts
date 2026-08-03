import { loadMapDocument } from "../contracts/documents.js";
import type { GameSettings } from "../settings/settings.js";
import type { GameDatabase, StoredMap } from "./db.js";

/**
 * Server-only lookup boundary for declarative database maps. It deliberately
 * returns copied settings: a caller cannot mutate a stored approved revision.
 */
export class MapRepository {
	private approvedCache: StoredMap[] | undefined;
	private revision = 0;

	public constructor(private readonly database: Pick<GameDatabase, "getMap" | "listMaps">) { }

	public getApproved(mapId: string): StoredMap {
		const map = this.listApproved().find(candidate => candidate.id === mapId);
		if (!map) throw new Error("Map is not approved for matchmaking");
		return map;
	}

	public listApproved(): StoredMap[] {
		if (!this.approvedCache) this.approvedCache = this.database.listMaps("approved");
		return structuredClone(this.approvedCache);
	}

	/** Invalidates the approval cache; new matches see the next database revision. */
	public refresh(): number {
		this.approvedCache = undefined;
		this.revision++;
		return this.revision;
	}

	public getRevision(): number { return this.revision; }

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

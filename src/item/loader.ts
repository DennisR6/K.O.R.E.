import type { ItemDocument } from "./types.js";
import { ItemValidator } from "./validate.js";

export type ItemSource = "built-in" | "local-mod";

interface LoadedItem {
	document: ItemDocument;
	source: ItemSource;
}

/**
 * Registers built-in and local-mod documents through one declarative validation
 * boundary. Runtime item behavior is intentionally outside this loader.
 */
export class ItemLoader {
	private readonly items = new Map<string, LoadedItem>();

	public constructor(private readonly validator: ItemValidator) {}

	public registerBuiltIn(document: unknown): ItemDocument {
		return this.register(document, "built-in");
	}

	public registerLocalMod(document: unknown): ItemDocument {
		return this.register(document, "local-mod");
	}

	public get(id: string): ItemDocument | undefined {
		const item = this.items.get(id);
		return item ? structuredClone(item.document) : undefined;
	}

	public getAll(): ItemDocument[] {
		return [...this.items.values()].map(item => structuredClone(item.document));
	}

	public getSource(id: string): ItemSource | undefined {
		return this.items.get(id)?.source;
	}

	private register(document: unknown, source: ItemSource): ItemDocument {
		const item = this.validator.validate(document);
		if (this.items.has(item.id)) {
			throw new Error(`Item id '${item.id}' is already registered`);
		}

		const stored = structuredClone(item);
		this.items.set(stored.id, { document: stored, source });
		return structuredClone(stored);
	}
}

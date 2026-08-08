import type { IStructure } from "./types.js";

/** Resolves a canonical structure without using collection position as identity. */
export function findStructureById(structures: readonly IStructure[], structureId: string): IStructure | undefined {
	return structures.find(structure => structure.getId() === structureId);
}

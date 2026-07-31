import type { IInput } from "../engine/types.js";

/** Shared boundary for all gameplay shot inputs. */
export function isValidInput(input: unknown): input is IInput {
	if (!input || typeof input !== "object") return false;
	const candidate = input as Partial<IInput>;
	return typeof candidate.actorId === "string" && candidate.actorId.length > 0 &&
		typeof candidate.angle === "number" && Number.isFinite(candidate.angle) && candidate.angle >= 0 && candidate.angle < 360 &&
		typeof candidate.power === "number" && Number.isFinite(candidate.power) && candidate.power > 0 && candidate.power <= 10;
}

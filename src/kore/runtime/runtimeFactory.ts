import type { SystemSettings } from "../../engine/contracts/systemSettings.js";
import type { EngineSettings } from "./types.js";
import type { GameSettings } from "../../settings/settings.js";
import { GameHandler, GameHandlerBuilder } from "./Handler.js";

/**
 * The only permitted production boundary for constructing a runtime
 * `GameHandler` from canonical settings. Match authoring composes validated,
 * detached settings and system snapshots through the SDKs; this factory is
 * where those snapshots become runtime objects. Legacy `GameHandlerBuilder`
 * usage outside this file is a migration violation (milestone 28).
 *
 * @param settings Canonical match settings. A fresh `GameSettings` starts a
 *   new match; an `EngineSettings` snapshot restores its persisted state.
 * @param systems Optional data-only engine system profile (sorted by stable
 *   ID, matching `EngineFrameworkSettings.systems`). When present, the
 *   handler is restored with exactly these systems in `systemOrder`.
 * @param systemOrder Explicit tick registration order. Defaults to the
 *   systems' own IDs when omitted.
 */
export function createRuntimeHandler(
	settings: GameSettings | EngineSettings,
	systems?: readonly SystemSettings[],
	systemOrder?: readonly string[],
): GameHandler {
	if (systems && systems.length > 0) {
		const order = systemOrder && systemOrder.length === systems.length
			? [...systemOrder]
			: systems.map(system => system.systemId);
		const snapshot: EngineSettings = {
			...settings as GameSettings,
			systems: systems.map(system => ({ systemId: system.systemId, schemaVersion: 1, state: structuredClone(system.state) })),
			systemOrder: [...order],
		} as EngineSettings;
		return new GameHandlerBuilder().defaultSystems().fromSettings(snapshot).build();
	}
	return new GameHandlerBuilder().defaultSystems().fromSettings(settings).build();
}

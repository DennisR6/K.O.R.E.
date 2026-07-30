import { getDiscordConfig } from "./config.js";

export interface PresencePayload {
	details: string;
	state: string;
	largeImageKey?: string;
	largeImageText?: string;
}

export class DiscordPresenceManager {
	private currentPresence: PresencePayload | null = null;

	public update(payload: PresencePayload): boolean {
		const config = getDiscordConfig();
		if (!config.active) {
			return false;
		}
		this.currentPresence = { ...payload };
		return true;
	}

	public setMenuState(): boolean {
		return this.update({
			details: "Main Menu",
			state: "Browsing menus",
		});
	}

	public setMatchState(mapName: string, activeTeam: number, turnNumber: number): boolean {
		return this.update({
			details: `Playing on ${mapName}`,
			state: `Turn ${turnNumber} (Team ${activeTeam})`,
		});
	}

	public getCurrentPresence(): PresencePayload | null {
		return this.currentPresence ? { ...this.currentPresence } : null;
	}
}

export const discordPresence = new DiscordPresenceManager();

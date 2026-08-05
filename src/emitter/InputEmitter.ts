import { type IInputEmitter } from "../engine/types.js";
import type { ItemTarget } from "../item/target.js";
import type { AudioCommand, ISoundEmitter } from "../engine/audio-sdk/index.js";

/**
 * Die "Steckerleiste" für Inputs.
 * 
 * Ermöglicht es, einen Schuss-Befehl an beliebig viele Emitter gleichzeitig 
 * zu senden. So kann ein Zug gleichzeitig im Netzwerk gesendet, geloggt 
 * und lokal verarbeitet werden.
 */
export class CombiEmitter implements IInputEmitter, ISoundEmitter {
	private emitters: IInputEmitter[];
	public readonly soundSourceId = "kore.combi-emitter";

	/**
		 * @param emitters - Eine Liste von Emittern, die beim Start registriert werden.
		 */
	constructor(emitters: IInputEmitter[] = []) {
		this.emitters = emitters;
	}

	/**
	 * Verteilt den Schuss an alle registrierten Emitter.
	 */
	sendShot = (actorId: string, angle: number, power: number): void => {
		this.emitters.forEach(e => e.sendShot(actorId, angle, power));
	}

	sendItemUse = (actorId: string, itemId: string, target: ItemTarget): void => {
		this.emitters.forEach(emitter => emitter.sendItemUse?.(actorId, itemId, target));
	}

	skipPhase = (): void => {
		this.emitters.forEach(emitter => emitter.skipPhase?.());
	}

	/** Fügt zur Laufzeit einen weiteren Emitter hinzu. */
	addEmitter(...emitter: IInputEmitter[]) {
		for (const em of emitter) {
			this.emitters.push(em)
		}
	}
	/** Returns the registered emitters so host code can reach recording children. */
	getEmitters(): IInputEmitter[] {
		return this.emitters;
	}
	/** Forwards optional semantic audio capability without knowing child classes. */
	drainSoundCommands(): AudioCommand[] {
		return this.emitters.flatMap(emitter => {
			const candidate = emitter as Partial<ISoundEmitter>;
			return typeof candidate.drainSoundCommands === "function" ? candidate.drainSoundCommands() : [];
		});
	}
}

/**
 * Ein reiner Debug-Emitter.
 * 
 * Schreibt jeden Schuss-Befehl mit Winkel und Kraft in die Konsole.
 * Extrem hilfreich, um zu prüfen, ob die Maus-Berechnungen korrekt ankommen.
 */
export class LogEmitter implements IInputEmitter {
	sendShot(actorId: string, angle: number, power: number) {
		// Strukturiertes Logging über das Engine-Tool
		console.debug("Log Emitter", { actorId, angle, power })
	}

	sendItemUse(actorId: string, itemId: string, target: ItemTarget): void {
		console.log("sendItemUse", JSON.stringify({ actorId, itemId, target }));
	}
}

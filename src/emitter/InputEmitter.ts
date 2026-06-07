import { type IInputEmitter } from "../engine/types.js";

/**
 * Die "Steckerleiste" für Inputs.
 * 
 * Ermöglicht es, einen Schuss-Befehl an beliebig viele Emitter gleichzeitig 
 * zu senden. So kann ein Zug gleichzeitig im Netzwerk gesendet, geloggt 
 * und lokal verarbeitet werden.
 */
export class CombiEmitter implements IInputEmitter {
	private emitters: IInputEmitter[];

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

	/** Fügt zur Laufzeit einen weiteren Emitter hinzu. */
	addEmitter(...emitter: IInputEmitter[]) {
		for (const em of emitter) {
			this.emitters.push(em)
		}
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
		console.debug("TURN", { actorId, angle, power })
	}
}

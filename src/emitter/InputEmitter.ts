import { type IInputEmitter } from "../engine/types.js";
import { GameLogger } from "../utils/log.js";

/**
 * Die "Steckerleiste" für Inputs.
 * 
 * Ermöglicht es, einen Schuss-Befehl an beliebig viele Emitter gleichzeitig 
 * zu senden. So kann ein Zug gleichzeitig im Netzwerk gesendet, geloggt 
 * und lokal verarbeitet werden.
 */
export class CombiEmitter implements IInputEmitter {
	private emitters: IInputEmitter[] = [];

	/**
		 * @param emitters - Eine Liste von Emittern, die beim Start registriert werden.
		 */
	constructor(emitters: IInputEmitter[]) {
		this.emitters = emitters;
	}

	/**
	 * Verteilt den Schuss an alle registrierten Emitter.
	 */
	sendShot(actorId: string | number, angle: number, power: number): void {
		this.emitters.forEach(e => e.sendShot(actorId, angle, power));
	}

	/** Fügt zur Laufzeit einen weiteren Emitter hinzu. */
	addEmitter(emitter: IInputEmitter) {
		this.emitters.push(emitter)
	}
}

/**
 * Ein reiner Debug-Emitter.
 * 
 * Schreibt jeden Schuss-Befehl mit Winkel und Kraft in die Konsole.
 * Extrem hilfreich, um zu prüfen, ob die Maus-Berechnungen korrekt ankommen.
 */
export class LogEmitter implements IInputEmitter {
	sendShot(actorId: string | number, angle: number, power: number) {
		// Direkte Ausgabe für schnelle Kontrolle
		console.log({ actorId, angle, power })
		// Strukturiertes Logging über das Engine-Tool
		GameLogger.debug("TURN", { actorId, angle, power })
	}
}

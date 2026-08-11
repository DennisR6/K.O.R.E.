import type { IInput, IInputEmitter } from "../kore/runtime/types.js";

/**
 * Ein passiver Emitter, der den letzten Schuss-Befehl zwischenspeichert.
 * 
 * Anstatt den Zug sofort an die Engine oder das Netzwerk zu senden, 
 * hält dieser Emitter die Daten nur fest. 
 * 
 * Einsatzgebiete:
 * - Unit-Tests: Um zu validieren, ob ein Input korrekt berechnet wurde.
 * - UI-Vorschau: Um den letzten getätigten Zug irgendwo anzuzeigen.
 */
export class ObjectEmitter implements IInputEmitter {
	/** Speichert den letzten empfangenen Schuss-Befehl. */
	lastShot: IInput | undefined

	/**
	 * Empfängt den Schuss und legt ihn in den Zwischenspeicher.
	 */
	sendShot(actorId: string, angle: number, power: number): void {
		this.lastShot = { actorId, angle, power }
	}

	/**
	 * Gibt den gespeicherten Schuss zurück.
	 * @returns Das IInput Objekt oder undefined, wenn noch nicht geschossen wurde.
	 */
	getLastShot(): IInput | undefined {
		return this.lastShot
	}
}

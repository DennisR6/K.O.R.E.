/**
 * INPUT MODULE
 * Bündelt alle Emitter und Hilfsfunktionen zur Steuerung der Engine.
 * Nutzen Sie den CombiEmitter, um mehrere Ausgabekanäle (z.B. Log + Network) zu verbinden.
 */
export type IInput = {
	/** Eindeutige ID des Spielers/Objekts, das den Zug ausführt. */
	actorId: string | number;
	/** Der Winkel in Grad (0-360). */
	angle: number;
	/** Die Stärke des Stoßes (meist 0-100). */
	power: number;
}
export type IInputCallbackFunction = (actorId: string | number, angle: number, power: number) => void
// --- Emitter-Exporte ---
// Wir exportieren hier alle verfügbaren Emitter, damit man nur 
// einen einzigen Import-Pfad nutzen muss.

export { CombiEmitter, LogEmitter } from "./InputEmitter.js"
export { ObjectEmitter } from "./ObjectEmitter.js"
export { GameEmitter } from "./EngineEmitter.js"
export { NetworkEmitter } from "./NetworkEmitter.js"
/**
 * Hilfsfunktion: Berechnet einen Zielpunkt basierend auf Startpunkt, Winkel und Kraft.
 * 
 * Nützlich, um zu visualisieren, wohin die Maus ziehen müsste, 
 * um einen bestimmten Input zu reproduzieren.
 * 
 * @param origin - Der Startpunkt (meist die Position des Pucks).
 * @param vec - Die Schuss-Daten (Winkel und Kraft).
 * @returns Die berechnete Zielposition im Raum.
 */
export function calcMousePositionFromInput(
	origin: { x: number, y: number },
	vec: { angle: number, power: number }
): { x: number, y: number } {
	// Umrechnung von Grad in Bogenmaß (für die Math-Funktionen)
	const rad = vec.angle * (Math.PI / 180);

	return {
		x: origin.x + Math.cos(rad) * vec.power,
		y: origin.y + Math.sin(rad) * vec.power
	};
}

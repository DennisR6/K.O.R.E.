/**
 * Die Konfiguration für ein neues Spiel.
 * Hier werden das Spielfeld, die Regeln (Reibung) und die Teilnehmer definiert.
 */
export interface GameOptions {
	/** Die logische Größe der Spielwelt (Standard meist 16:9 Verhältnis). */
	mapSize?: {
		x: number,
		y: number,
	}
	/** Eine Liste von statischen Hindernissen oder Wänden. */
	mapBoundarys?: Array<mapBoundary>
	/** Die Liste der Spieler, die am Match teilnehmen. */
	players: Array<Player>
	/** 
	 * Die globale Reibung. 
	 * 1 = Keine Reibung (Ewiges Gleiten), < 1 = Objekte bremsen ab. 
	 */
	friction: number,
}

/** 
 * Definiert ein Hindernis auf der Karte.
 * Kann entweder eine Linie (Wand) oder ein Kreis (Pfosten) sein.
 */
export type mapBoundary =
	mapBoundaryCircle |
	mapBoundaryLine

export interface mapBoundaryLine {
	type: "line"
	x: number
	y: number
	x2: number
	y2: number
}

export interface mapBoundaryCircle {
	type: "circle"
	x: number
	y: number
	radius: number
}

/** 
 * Die Daten eines Spielers beim Start des Spiels.
 */
export interface Player {
	/** Startposition X */
	x: number
	/** Startposition Y */
	y: number
	/** Die Teamfarbe oder individuelle Farbe (als String, z.B. 'red' oder '#FF0000'). */
	color: string
	/** Pfad oder ID zum Icon/Avatar des Spielers. */
	playericon: string
}

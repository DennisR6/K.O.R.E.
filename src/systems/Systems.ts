/**
 * @fileoverview Zentraler Export-Hub für alle Engine-Systeme.
 * 
 * In der Spiel-Architektur folgt jedes System dem "Single Responsibility Principle".
 * Hier fließen Logik (Physics), Ablaufsteuerung (Playback/Round) und 
 * Welt-Begrenzungen (Boundary) zusammen.
 */

// --- Typ-Definitionen ---
export type { IPlayback, ISystem, IGameContext } from "./types.ts";

// --- Kern-Systeme ---

/** 
 * Das PhysicsSystem kümmert sich um die Berechnung von Bewegungen und Kollisionen.
 * Es ist der "Motor" unter der Haube.
 */
export { PhysicsSystem } from "../systems/PhysicsSystem.ts";

/** 
 * Das PlaybackSystem ermöglicht das Abspielen von aufgezeichneten Spielzügen.
 * Es nutzt die EntitySnapshots, um die Vergangenheit zu rekonstruieren.
 */
export { PlaybackSystem } from "./PlayBackSystem";

/** 
 * Das BoundarySystem ist für die visuelle Darstellung der Spielfeldbegrenzungen zuständig.
 */
export { BoundarySystem } from "./BoundarySystem";

/** 
 * Das Round2PlayerSystem steuert die Spiellogik: 
 * Wer ist dran? Wann beginnt eine neue Runde? Wer hat gewonnen?
 */
export { Round2PlayerSystem } from "./RoundSystem.ts";
export { Simulator } from "./Simulator.ts"
export { } from "./UiSystem.ts"

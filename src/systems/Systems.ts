/**
 * @fileoverview Zentraler Export-Hub für alle Engine-Systeme.
 * 
 * In der Spiel-Architektur folgt jedes System dem "Single Responsibility Principle".
 * Hier fließen Logik (Physics), Ablaufsteuerung (Playback/Round) und 
 * Welt-Begrenzungen (Boundary) zusammen.
 */

// --- Typ-Definitionen ---
export type { IPlayback, ISystem, IGameContext } from "./types.js";
export { createSystemFromSettings, validateSystemSettings, validateSystemSettingsList } from "./systemSettings.js";
export type { IUiSystem } from "./UiSystem.js"
// --- Kern-Systeme ---

/** 
 * Das PhysicsSystem kümmert sich um die Berechnung von Bewegungen und Kollisionen.
 * Es ist der "Motor" unter der Haube.
 */

/** 
 * Das PlaybackSystem ermöglicht das Abspielen von aufgezeichneten Spielzügen.
 * Es nutzt die EntitySnapshots, um die Vergangenheit zu rekonstruieren.
 */
export { PlaybackSystem } from "./PlayBackSystem.js";

/** 
 * Das BoundarySystem ist für die visuelle Darstellung der Spielfeldbegrenzungen zuständig.
 */
// export { BoundarySystem } from "./BoundarySystem.js";

/** 
 * Das Round2PlayerSystem steuert die Spiellogik: 
 * Wer ist dran? Wann beginnt eine neue Runde? Wer hat gewonnen?
 */
export { RoundPlayerSystem } from "./RoundSystem.js";
export { TurnSystem } from "./TurnSystem.js";
export { Simulator } from "./Simulator.js"

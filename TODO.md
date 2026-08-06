# Slipstrike - Reconciled Master TODO

Custom Engine · p5.js · data-driven · rotation + force physics

## Audit Rules

- `[x]` is verified by current source and active tests.
- `[ ]` is incomplete. Its `Current:` text describes only what exists now;
  its `Done when:` text is the acceptance criterion.
- `step-by-step.md` is the compact completed-delivery record. Source and
  verified tests remain authoritative when its summaries become stale.

---

## Grundprinzip (verbindlich)

- [x] Engine = deterministischer Simulator. Fixed-frame turn simulation, final-state sync, and fixed-tick accumulator exist with deterministic regression coverage.
- [x] Engine kennt **keine Spielregeln**. A data-driven rule interpreter owns gameplay phases and turn progression.
- [x] Gameplay = Daten (JSON / Mods). Validated game, map, item, hazard, and mode documents use one declarative pipeline.
- [x] Bewegung basiert auf Rotation (Richtung). Rotation is serialized and the shared forward vector determines shot direction.
- [x] Bewegung basiert auf Force (Stoßstärke). Bounded power creates impulses and serializable force modifiers affect pending shots.

---

## Phase 0 - Projekt & Architektur

### Projektstruktur

- [x] Git-Repository
- [x] Ordnerstruktur: `src/engine`, `src/assetManager/assets`, and `public` are the active equivalents of the original `/engine` and `/assets` layout.

---

## Phase 1 - Engine-Kern (nicht auslagerbar)

### Game Loop

- [x] Fester Tick (`update(dt)`). Fixed deterministic accumulator and simulation ticks are implemented and tested.
- [x] Render-Pass
- [x] Deterministische Reihenfolge

---

## Phase 2 - Physiksystem (Rotation + Force)

### Figure Physics Model

- [x] Figure-State: Position (`Vec2`) und Velocity (`Vec2`)
- [x] Rotation (float). Player settings, runtime state, and snapshots round-trip rotation.
- [x] Angular Velocity (optional). Snapshots serialize angular velocity and runtime updates angular updates deterministically.
- [x] Forward-Vektor aus Rotation berechnen. The tested shared helper derives a forward vector from rotation and physics uses it for shot direction.

### Stoß-Mechanik

- [x] Stoßparameter: Richtung = Rotation, Stärke = Force. Staged aim sets rotation and charge sets force.
- [x] Power -> Velocity-Impuls
- [x] Modifizierbare Force (Items, Map). Data effects deterministically modify an accepted shot's force.

### Bewegung

- [x] Positionsintegration durch `EffectMove`
- [x] Reibung (Map-basiert). Loaded maps reliably inject friction into relevant entities.
- [x] Stillstand-Erkennung (Velocity < Threshold)

### Drift-System

- [x] Drift-Faktor (Map). Canonical map settings serialize a finite `[0, 1]` drift factor.
- [x] Lenkung: Velocity uses a speed-preserving per-tick map-drift blend toward the forward direction, with fixed-frame deterministic tests.
- [x] Extreme Drift für Eis-Maps. Frostbite map data exercises the same runtime drift implementation.

---

## Phase 3 - Kollision & Reaktion

### Kollisionen

- [x] Figur <-> Figur
- [x] Figur <-> Arena. All declared arena shapes (circles, rectangles, lines) collide and apply configured behavior.
- [x] Impuls-Weitergabe für implementierte Kreis-Kollisionen
- [x] Richtungsänderung durch Normalen. All supported shape pairs have tested normal response.

### Arena-Grenzen

- [x] Out-of-Bounds-Erkennung. Outer circle/rectangle structures contain full player circles; lines are obstacles.
- [x] Death-Event. Leaving containment geometry eliminates an entity on that tick; configured death circles and kill zones eliminate on collision.

---

## Phase 4 - Runden- & Regel-Interpreter

### Runden-State-Machine (JSON)

- [x] Item-Phase. The active team may use at most one permitted item before the shot phase.
- [x] Stoß-Phase. Declarative rules explicitly manage aim, charge, push, and physics transitions.
- [x] Physik-Phase. Declarative rule state rejects all input until entities settle.
- [x] Spielerwechsel

### Regeln (datengetrieben)

- [x] Items pro Runde. Mode data limits each active team to one validated item use during its item phase.
- [x] Stoßstärke-Limits. Mode data and UI cap power, applying equally to local and network input.
- [x] Zug-Reihenfolge

---

## Phase 5 - Items (100 % Modding)

### Item-System

- [x] Item-Schema. Versioned item, target, duration, use-limit, and inventory schemas are validated.
- [x] Validator. Untrusted item JSON is rejected unless it matches the schema and effect whitelist.
- [x] Loader. Built-in and local-mod item data share one loader.

### Effekt-Typen (Engine)

- [x] modifyForce
- [x] modifyRotation
- [x] lockRotation
- [x] applyTorque
- [x] spawnTrigger
- [x] delayedEffect
- [x] shield
- [x] freeze

### GDD-Items als JSON

- [x] Anker (Force-Multiplikator)
- [x] Magnet (Force-Zugrichtung)
- [x] Power-Dash (Force-Boost / Friction-Reduktion)
- [x] Switch (Positions-Tausch)
- [x] Weitere offizielle GDD-Items: Durchlaessigkeit, Falltuer, Verzoegerte Mine, Mini-Wall, Freeze-Shot, Jaegermeister-Elixier und Vodka Zero.

---

## Phase 6 - Maps & Hazards (Modding)

### Maps

- [x] Map-Schema. Versioned canonical maps validate friction, drift, arena geometry, spawns, hazards, and metadata.
- [x] Reibung-Feld in den Runtime-Settings
- [x] Drift-Feld und Runtime-Verhalten
- [x] Arena-Form. All declared shapes load and collide end-to-end.

### Hazards

- [x] Hazard-Registry
- [x] ApplyForce
- [x] ApplyRotation
- [x] KillZone. Kill zones are a validated hazard type using common death handling.

---

## Phase 7 - Input-System (Richtung = Rotation)

### Actions

- [x] Aim (Rotation setzen). Aim persists player rotation through the action-binding layer.
- [x] Charge: drag distance waehlt begrenzte Power
- [x] Push: wendet den Impuls an
- [x] UseItem. Action binding selects a validated available item and emits an authorized item-use request during the item phase.

### Mapping

- [x] Mouse
- [x] Touch
- [x] Controller

---

## Phase 8 - KI (Rotation + Force)

### KI-Modell
- [x] Zielwinkel berechnen
- [x] Force evaluieren
- [x] Risikoabschätzung (Out-of-Bounds)

### Schwierigkeit

- [x] Leicht - Zufallswinkel. Runtime AI emits seeded deterministic random legal shots.
- [x] Mittel - Heuristik
- [x] Schwer - Simulation (Winkel x Force)

---

## Phase 9 - UI & UX

### UI

- [x] Richtungsanzeige: active-team marker und drag-direction arrow
- [x] Force-Meter. UI displays a readable numeric/graduated bounded power value.
- [x] Aktives Item. Item phase shows inventory, selection, valid targets, and use state.

---

## Phase 10 - Plattformen

### Desktop

- [x] Tauri. Tauri configuration and production packaging scripts are documented.
- [x] Savegames. Users can create, list, and restore local save slot documents and SQLite persistent matches.

### Mobile

- [x] Touch-Steuerung
- [x] Offline-Modus. Mobile web is installable/cached and can launch offline.

---

## Phase 11 - Discord

### Rich Presence

- [x] Status
- [x] Map
- [x] Runde

---

## Optional

- [x] Replays. Versioned seed and action log reproduces final snapshots without live input.
- [x] Kein separates Mod-Workshop-Backend. Scope decision: validated `game.handler.toSettings()` exports and server-shared settings are sufficient for sharing settings and mods.

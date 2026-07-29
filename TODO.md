# Slipstrike - Reconciled Master TODO

Custom Engine · p5.js · data-driven · rotation + force physics

## Audit Rules

- `[x]` is verified by current source and active tests.
- `[ ]` is incomplete. Its `Current:` text describes only what exists now;
  its `Done when:` text is the acceptance criterion.
- `step-by-step.md` is the ordered, commit-sized implementation plan. Source
  and verified tests remain authoritative when this file becomes stale.

---

## Grundprinzip (verbindlich)

- [ ] Engine = deterministischer Simulator. Current: fixed-frame turn
  simulation and final-state sync exist. Done when: the browser also uses an
  explicit fixed-tick accumulator with deterministic regression coverage.
- [ ] Engine kennt **keine Spielregeln**. Current: `GameHandler`, UI, and server
  own turn/team rules. Done when: a data-driven rule interpreter owns gameplay
  phases and the engine is limited to simulation services.
- [ ] Gameplay = Daten (JSON / Mods). Current: settings, effects, and structures
  serialize, but no validated mod loader exists. Done when: validated game,
  map, item, hazard, and mode documents use one declarative pipeline.
- [ ] Bewegung basiert auf Rotation (Richtung). Current: shots use an input
  angle; players have no rotation state. Done when: rotation is serialized and
  the shared forward vector determines shot direction.
- [ ] Bewegung basiert auf Force (Stoßstärke). Current: bounded `power` creates
  an impulse. Done when: serializable force modifiers can affect pending shots.

---

## Phase 0 - Projekt & Architektur

### Projektstruktur

- [x] Git-Repository
- [x] Ordnerstruktur: `src/engine`, `src/assetManager/assets`, and `public`
  are the active equivalents of the original `/engine` and `/assets` layout.

---

## Phase 1 - Engine-Kern (nicht auslagerbar)

### Game Loop

- [ ] Fester Tick (`update(dt)`). Current: `GameHandler.tick(dt)` exists, but
  p5 calls it once per draw with its default delta. Done when: browser runtime
  accumulates real time into fixed deterministic simulation ticks.
- [x] Render-Pass
- [x] Deterministische Reihenfolge

---

## Phase 2 - Physiksystem (Rotation + Force)

### Figure Physics Model

- [x] Figure-State: Position (`Vec2`) und Velocity (`Vec2`)
- [x] Rotation (float). Player settings, runtime state, and snapshots round-trip
  rotation.
- [ ] Angular Velocity (optional). Current: snapshots serialize angular velocity,
  but runtime does not update it. Done when:
  optional angular velocity has deterministic update and serialization rules.
- [x] Forward-Vektor aus Rotation berechnen. The tested shared helper derives a
  forward vector from a rotation and physics uses it for shot direction.

### Stoß-Mechanik

- [ ] Stoßparameter: Richtung = Rotation, Stärke = Force. Current: UI provides
  drag angle and power. Done when: aim sets rotation and charge sets force.
- [x] Power -> Velocity-Impuls
- [ ] Modifizierbare Force (Items, Map). Current: velocity and mass effects
  exist, but none changes pending shot power. Done when: data effects can
  deterministically modify an accepted shot's force.

### Bewegung

- [x] Positionsintegration durch `EffectMove`
- [ ] Reibung (Map-basiert). Current: friction settings and player friction
  effects exist. Done when: each loaded map reliably injects its friction into
  all relevant entities.
- [x] Stillstand-Erkennung (Velocity < Threshold)

### Drift-System

- [x] Drift-Faktor (Map). Canonical map settings serialize a finite `[0, 1]`
  drift factor.
- [x] Lenkung: Velocity uses a speed-preserving per-tick map-drift blend toward
  the forward direction, with fixed-frame deterministic tests.
- [ ] Extreme Drift für Eis-Maps. Done when: Frostbite map data exercises the
  same runtime drift implementation.

---

## Phase 3 - Kollision & Reaktion

### Kollisionen

- [x] Figur <-> Figur
- [ ] Figur <-> Arena. Current: circle, rectangle, and line detection work;
  line response and rectangle collision effects are incomplete. Done when: all
  declared arena shapes collide and apply configured behavior.
- [x] Impuls-Weitergabe für implementierte Kreis-Kollisionen
- [ ] Richtungsänderung durch Normalen. Current: circle and line responses use
  normals. Done when: all supported shape pairs have tested normal response.

### Arena-Grenzen

- [x] Out-of-Bounds-Erkennung. Outer circle/rectangle structures are inferred
  from mixed map geometry and contain full player circles; lines are obstacles.
- [x] Death-Event. Leaving inferred outer circle/rectangle containment geometry
  eliminates an entity on that tick; configured death circles still kill on
  collision. Dead entities do not move, collide, render, or accept selection
  and cannot resolve a turn.

---

## Phase 4 - Runden- & Regel-Interpreter

### Runden-State-Machine (JSON)

- [ ] Item-Phase. Done when: the active team may use at most one permitted item
  before the shot phase.
- [ ] Stoß-Phase. Current: input, simulation, and playback exist. Done when:
  declarative rules explicitly require aim, charge, and push transitions.
- [ ] Physik-Phase. Current: simulation/playback blocks normal turn progress.
  Done when: declarative rule state rejects all input until entities settle.
- [x] Spielerwechsel

### Regeln (datengetrieben)

- [ ] Items pro Runde. Current: no active item system exists. Done when: mode
  data limits each active team to one validated item use during its item phase.
- [ ] Stoßstärke-Limits. Current: UI caps power and the server accepts `(0, 10]`.
  Done when: limits are mode data and apply equally to local and network input.
- [x] Zug-Reihenfolge

---

## Phase 5 - Items (100 % Modding)

### Item-System

- [ ] Item-Schema. Current: minimal item settings and unused interfaces exist.
  Done when: versioned item, target, duration, use-limit, and inventory schemas
  are validated.
- [ ] Validator. Done when: untrusted item JSON is rejected unless it matches
  the schema and effect whitelist.
- [ ] Loader. Done when: built-in and local-mod item data share one loader.

### Effekt-Typen (Engine)

- [ ] modifyForce
- [ ] modifyRotation
- [ ] lockRotation
- [ ] applyTorque
- [ ] spawnTrigger
- [ ] delayedEffect
- [ ] shield
- [ ] freeze

Each effect is done only when it is serializable, data-addressable, deterministic,
covered by a focused test, and usable through the item pipeline.

### GDD-Items als JSON

- [ ] Anker (Force-Multiplikator)
- [ ] Magnet (Force-Zugrichtung)
- [ ] Power-Dash (Force-Boost / Friction-Reduktion)
- [ ] Switch (Positions-Tausch)
- [ ] Weitere offizielle GDD-Items: Durchlaessigkeit, Falltuer, Verzoegerte
  Mine, Mini-Wall, Freeze-Shot, Jaegermeister-Elixier und Vodka Zero.

Each item is done only when declarative data, validation, authoritative use,
serialization, and behavior tests exist.

---

## Phase 6 - Maps & Hazards (Modding)

### Maps

- [ ] Map-Schema. Current: typed runtime settings support friction and numeric
  shapes but no strict JSON schema. Done when: versioned canonical maps validate
  friction, drift, arena geometry, spawns, hazards, and metadata.
- [x] Reibung-Feld in den Runtime-Settings
- [x] Drift-Feld und Runtime-Verhalten
- [ ] Arena-Form. Current: circles and rectangles work; lines are incomplete.
  Done when: all declared shapes load and collide end-to-end.

### Hazards

- [ ] Hazard-Registry
- [ ] ApplyForce
- [ ] ApplyRotation
- [ ] KillZone. Current: manually configured death circles exist. Done when:
  kill zones are a validated hazard type using common death handling.

Each hazard is done only when it is declarative, serializable, deterministic,
and covered by a collision or trigger regression test.

---

## Phase 7 - Input-System (Richtung = Rotation)

### Actions

- [ ] Aim (Rotation setzen). Current: drag derives an impulse angle. Done when:
  aim persists player rotation through the action-binding layer.
- [x] Charge: drag distance waehlt begrenzte Power
- [x] Push: wendet den Impuls an
- [ ] UseItem. Done when: the action binding selects a validated available item
  and emits an authorized item-use request during the item phase.

### Mapping

- [x] Mouse
- [ ] Touch
- [ ] Controller

Touch and controller are done only when they use the same configurable actions
as mouse input and have device-appropriate regression coverage.

---

## Phase 8 - KI (Rotation + Force)

### KI-Modell

- [ ] Zielwinkel berechnen
- [ ] Force evaluieren
- [ ] Risikoabschätzung (Out-of-Bounds)

Each AI model item is done only when it uses current arena and hazard geometry
to produce a legal angle/power decision through the shared action path.

### Schwierigkeit

- [ ] Leicht - Zufallswinkel. Current: only editor presets exist. Done when:
  runtime AI emits seeded deterministic random legal shots.
- [ ] Mittel - Heuristik
- [ ] Schwer - Simulation (Winkel x Force)

Medium and hard AI are done only when they use serialized configuration, submit
through the same validation path as players, and have deterministic tests.

---

## Phase 9 - UI & UX

### UI

- [x] Richtungsanzeige: active-team marker und drag-direction arrow
- [ ] Force-Meter. Current: arrow length reflects drag power. Done when: UI
  displays a readable numeric or graduated bounded power value.
- [ ] Aktives Item. Current: deprecated generic item slots are not in startup.
  Done when: item phase shows inventory, selection, valid targets, and use state.

---

## Phase 10 - Plattformen

### Desktop

- [ ] Tauri. Done when: a Tauri shell packages the built browser client and has
  a documented release build.
- [ ] Savegames. Current: SQLite persists authoritative network snapshots and
  reconnect state. Done when: users can create, list, and restore local slots.

### Mobile

- [ ] Touch-Steuerung
- [ ] Offline-Modus. Current: local hotseat works without a WebSocket. Done
  when: mobile web is installable/cached and can launch offline.

---

## Phase 11 - Discord

### Rich Presence

- [ ] Status
- [ ] Map
- [ ] Runde

Discord work is done only when environment-configured integration reports these
states, disabled configuration is a no-op, and join/invite payloads validate
game identifiers.

---

## Optional

- [ ] Replays. Current: in-memory turn packets and settings export exist, but
  `ReplayEmitter` is commented out and playback is absent. Done when: a
  versioned seed/action log reproduces final snapshots without live input.
- [x] Kein separates Mod-Workshop-Backend. Scope decision: validated
  `game.handler.toSettings()` exports and server-shared settings are sufficient
  for sharing settings and mods.

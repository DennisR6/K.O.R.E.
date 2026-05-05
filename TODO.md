# Slipstrike – Master TODO
Custom Engine · p5.js · Datengetrieben · Rotation + Force Physik

---

## Grundprinzip (verbindlich)
- [x] Engine = deterministischer Simulator
- [x] Engine kennt **keine Spielregeln**
- [x] Gameplay = Daten (JSON / Mods)
- [x] Bewegung basiert auf:
  - [x] Rotation (Richtung)
  - [x] Force (Stoßstärke)

---

## Phase 0 – Projekt & Architektur

### Projektstruktur
- [x] Git-Repository
- [x] Ordnerstruktur
  - [x] `/engine`
  - [x] `/assets`

---

## Phase 1 – Engine-Kern (nicht auslagerbar)

### Game Loop
- [x] Fester Tick (`update(dt)`)
- [x] Render-Pass
- [x] Deterministische Reihenfolge

---

## Phase 2 – Physiksystem (Rotation + Force)

### Figure Physics Model
- [x] Figure-State
  - [x] Position (Vec2)
  - [x] Rotation (float)
  - [x] Velocity (Vec2)
  - [x] Angular Velocity (optional)
- [x] Forward-Vektor aus Rotation berechnen

### Stoß-Mechanik
- [x] Stoßparameter
  - [x] Richtung = Rotation
  - [x] Stärke = Force
- [x] Force → Velocity-Impuls
- [x] Modifizierbare Force (Items, Map)

### Bewegung
- [x] Positionsintegration
- [x] Reibung (Map-basiert)
- [x] Stillstand-Erkennung (Velocity < Threshold)

### Drift-System
- [x] Drift-Faktor (Map)
- [x] Lenkung:
  - [x] Velocity tendiert zur Forward-Richtung
- [x] Extreme Drift für Eis-Maps

---

## Phase 3 – Kollision & Reaktion

### Kollisionen
- [x] Figur ↔ Figur
- [x] Figur ↔ Arena
- [x] Impuls-Weitergabe
- [x] Richtungsänderung durch Normalen

### Arena-Grenzen
- [x] Out-of-Bounds-Erkennung
- [ ] Death-Event

---

## Phase 4 – Runden- & Regel-Interpreter

### Runden-State-Machine (JSON)
- [ ] Item-Phase
- [ ] Stoß-Phase
- [ ] Physik-Phase
- [x] Spielerwechsel

### Regeln (datengetrieben)
- [ ] Items pro Runde
- [x] Stoßstärke-Limits
- [x] Zug-Reihenfolge

---

## Phase 5 – Items (100 % Modding)

### Item-System
- [ ] Item-Schema
- [ ] Validator
- [ ] Loader

### Effekt-Typen (Engine)
- [ ] modifyForce
- [ ] modifyRotation
- [ ] lockRotation
- [ ] applyTorque
- [ ] spawnTrigger
- [ ] delayedEffect
- [ ] shield
- [ ] freeze

### GDD-Items als JSON
- [ ] Anker (Force-Multiplikator)
- [ ] Magnet (Force-Zugrichtung)
- [ ] Power-Dash (Force-Boost)
- [ ] Switch (Positions-Tausch)
- [ ] etc.

---

## Phase 6 – Maps & Hazards (Modding)

### Maps
- [x] Map-Schema
  - [x] Reibung
  - [x] Drift
  - [x] Arena-Form

### Hazards
- [ ] Hazard-Registry
- [ ] Effekte:
  - [ ] ApplyForce
  - [ ] ApplyRotation
  - [ ] KillZone

---

## Phase 7 – Input-System (Richtung = Rotation)

### Actions
- [ ] Aim (Rotation setzen)
- [x] Charge (Force aufladen)
- [x] Push (Force anwenden)
- [ ] UseItem

### Mapping
- [x] Mouse
- [ ] Touch
- [ ] Controller

---

## Phase 8 – KI (Rotation + Force)

### KI-Modell
- [ ] Zielwinkel berechnen
- [ ] Force evaluieren
- [ ] Risikoabschätzung (Out-of-Bounds)

### Schwierigkeit
- [x] Leicht – Zufallswinkel
- [ ] Mittel – Heuristik
- [ ] Schwer – Simulation (Winkel × Force)

---

## Phase 9 – UI & UX

### UI
- [x] Richtungsanzeige
- [x] Force-Meter
- [x] Aktives Item

---

## Phase 10 – Plattformen

### Desktop
- [ ] Electron / Tauri
- [x] Savegames

### Mobile
- [ ] Touch-Steuerung
- [x] Offline-Modus

---

## Phase 11 – Discord

### Rich Presence
- [x] Status
- [x] Map
- [x] Runde

---

## Optional
- [x] Replays (Rotation + Force = perfekt deterministisch)
- [ ] Mod-Workshop??

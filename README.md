# 🎮 Slipstrike – Game Design Document (GDD)

**Version:** 1.1.1
**Status:** Engine-agnostisch · Modding-first · Deterministisch

---

## 1. High Concept

**Slipstrike** ist ein rundenbasiertes 2D‑Arena‑Taktikspiel mit stark physikbasierter Bewegung.
Spieler stoßen Figuren über rutschige Arenen, manipulieren den Zug mit taktischen Items und versuchen, Gegner durch geschickte Richtungswahl und Kraftdosierung aus der Arena zu drängen.

Das Spiel ist **nicht reaktionsbasiert**, sondern **entscheidungsbasiert**:
Jeder Zug besteht aus Planung, Ausführung und Beobachtung eines deterministischen Physik‑Ergebnisses.

Kernversprechen:

* Jeder Stoß ist eine bewusste Entscheidung
* Physik ist vorhersagbar, nicht chaotisch
* Taktik entsteht aus Geometrie, Timing und Regeln

---

## 2. Design‑Ziele

* **Deterministische Physik** (replay‑ & KI‑freundlich)
* **Minimale Engine**, maximale Auslagerung in Daten
* **100 % datengetriebene Items & Maps**
* **Modding als First‑Class‑Feature** (intern & extern identisch)
* Plattformübergreifend ohne Gameplay‑Unterschiede

---

## 3. Plattformen

Slipstrike wird aus einer gemeinsamen Codebasis betrieben:

* **PC (Steam)** – Maus & Controller
* **Steam Deck** – Controller, 1280×800
* **Android / iOS** – Touch‑Steuerung
* **Discord** – Maus & Tastatur, Rich Presence

Alle Plattformen nutzen **dieselben Regeln, Items und Physikdaten**.

---

## 4. Kern‑Gameplay‑Loop

Jede Runde folgt strikt diesem Ablauf:

1. **Item‑Phase (optional)**
   Der aktive Spieler kann **genau ein Item** einsetzen.

2. **Stoß‑Phase (Pflicht)**
   Der Spieler wählt eine eigene Figur, richtet sie aus und stößt sie.

3. **Physik‑Phase**
   Es gibt **keine Eingaben**. Die Physik läuft, bis alle Figuren nahezu stillstehen.

4. **Rundenwechsel**
   Der nächste Spieler ist am Zug.

---

## 5. Physik & Bewegung (Rotation + Force)

Slipstrike verwendet ein **gerichtetes Impulsmodell**.

### Figuren‑Zustand

Jede Figur besitzt:

* Position (2D)
* Rotation (Richtung)
* Velocity (Bewegungsvektor)
* optionale Angular Velocity

### Stoß‑Mechanik

* **Rotation bestimmt die Richtung**
* **Force bestimmt die Stärke**
* Ein Stoß ist ein einmaliger Impuls

Konzeptuell:

* Rotation → Vorwärtsvektor
* Force → Skalierung dieses Vektors
* Velocity += Forward × Force

### Bewegung

* Position wird aus Velocity integriert
* Reibung reduziert Velocity pro Tick
* Figuren kommen deterministisch zum Stillstand

### Drift

* Drift ist **mapabhängig**
* Velocity tendiert zur Rotationsrichtung
* Eis‑Maps erlauben extreme Drift‑Abweichungen

### Kollisionen

* Figur ↔ Figur
* Figur ↔ Arena
* Kollisionen ändern Richtung & Geschwindigkeit

### Tod

* Verlässt eine Figur die Arena → sofort eliminiert

---

## 6. Items (Modding‑first)

Items sind **rein deklarativ** und werden **nicht im Code definiert**.

### Grundregeln

* Maximal **ein Item pro Runde**
* Items werden **vor dem Stoß** eingesetzt
* Items können auf:

  * Figuren
  * Positionen
  * Zonen
    angewendet werden

### Item‑Architektur

* Items sind JSON‑Daten
* Die Engine kennt nur **Effekt‑Typen**, keine Items
* Interne Items und Mods nutzen **dieselbe Pipeline**

### Effekt‑Beispiele

* Force‑Multiplikation
* Richtungsänderung
* Positions‑Tausch
* Temporäre Barrieren
* Verzögerte Effekte

### Offizielle Item‑Liste

* Anker
* Magnet
* Köder
* Falltür
* Power‑Dash
* Verzögerte Mine
* Mini‑Wall
* Freeze‑Shot
* Switch
* Jägermeister‑Elixier

---

## 7. Maps & Arenen

Maps definieren **physikalisches Verhalten**, nicht nur Layout.

### Map‑Eigenschaften

* Reibung
* Drift‑Faktor
* Arena‑Form
* Gefahrenzonen

### Gefahrenzonen (Hazards)

Hazards sind datengetriebene Trigger:

* Lava (Kill Zone)
* Geysire (Impuls)
* Slow‑Zones
* Falltüren

### Offizielle Maps

* **Cue Clash** – klassische Reibung, Hindernisse
* **Frostbite Arena** – extrem niedrige Reibung
* **Magma Cradle** – aktive Gefahren & Zonen

---

## 8. Spielmodi & Siegbedingungen

### Spielmodi

* 1v1 PvP
* 1v1 vs KI

### Siegbedingungen

* Last Man Standing (Standard)
* Erweiterbar über Daten (z. B. Punkte‑Modi)

---

## 9. KI‑Gegner

Die KI nutzt **dieselben Regeln wie Spieler**.

### Entscheidungsbasis

* Figurenpositionen
* Arena‑Geometrie
* Gefahrenzonen
* Item‑Effekte
* Out‑of‑Bounds‑Risiko

### KI‑Modell

* Entscheidung = Winkel + Force
* Simulation möglicher Züge
* Bewertung über Heuristiken

### Schwierigkeitsgrade

* **Leicht** – Zufallsbasierte Entscheidungen
* **Mittel** – Heuristiken & Risikoabschätzung
* **Schwer** – Simulation & Optimierung

Alle KI‑Parameter sind datengetrieben.

---

## 10. Input & Steuerung

### Abstrakte Aktionen

* Aim (Rotation setzen)
* Charge (Force aufladen)
* Push (Stoß ausführen)
* Use Item

### Plattformen

* **PC:** Maus / Tastatur
* **Controller:** Stick + Trigger
* **Mobile:** Drag & Hold

Input‑Mapping ist vollständig konfigurierbar.

---

## 11. UI & UX

### Design‑Prinzipien

* Klar
* Minimalistisch
* Taktik im Vordergrund

### Plattformanpassung

* PC: kompakt
* Mobile: große Touch‑Elemente
* Steam Deck: größere Schrift
* Discord: reduzierte UI

---

## 12. Modding‑System

Modding ist ein **Kernfeature**, kein Zusatz.

### Mod‑Umfang

* Items
* Maps
* Hazards
* Spielmodi
* KI‑Parameter

### Sicherheit

* Keine Skripte
* Kein eval
* Strikte Schema‑Validierung
* Effekt‑Whitelist

---

## 13. Technik‑Philosophie

* Custom Engine
* Deterministisch
* Daten‑ und regelgetrieben
* Engine ≠ Gameplay

Die Engine ist ein **stabiler Simulator**, kein Regelträger.

---

## 14. Discord‑Integration

* Rich Presence

  * Menü / Match
  * Map
  * Aktiver Zug
* Einladungen
* Join‑Flows

---

## 15. Release‑Plan

### Phase 1 – Prototyp

* Core‑Physik
* Eine Map
* Drei Items

### Phase 2 – Content

* Alle Maps
* Alle Items
* UI

### Phase 3 – KI & Mobile

* KI‑Gegner
* Touch‑Steuerung

### Phase 4 – Steam Release

* Store Page
* Playtests
* Marketing

### Phase 5 – Mobile Release

* Android / iOS Builds

### Phase 6 – Discord

* Rich Presence
* Einladungen

---

## 16. Zusammenfassung

Slipstrike ist ein **taktisches Physikspiel**, dessen Tiefe nicht aus Reaktionsgeschwindigkeit, sondern aus **klaren Regeln, deterministischer Bewegung und datengetriebenem Design** entsteht.

Die Architektur ermöglicht:

* präzises Balancing
* starke KI
* Modding‑Community
* langfristige Erweiterbarkeit

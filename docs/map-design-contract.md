# Qualified Map Design Contract

Status: **active** (Section 17.1)
Applies to: every shipped map and every new candidate that may enter the
qualified map matrix (`docs/map-qualification-report.md`).

This contract defines the technical and gameplay requirements a map must
satisfy before it can receive a qualification status. It intentionally reuses
the existing schema, physics, gameplay-qualification, softlock, fairness, and
browser detectors. It does not weaken them.

## 1. Data And Schema Contract

1. Map data must pass the existing schema and game-settings validators:
   `validateMapDocument()` / `loadMapDocument()` for canonical map documents,
   `validateGameSettings()` for the resulting engine settings, and
   `validateEditorMapDocument()` / `convertEditorMapDocument()` for editor
   exports. Editor JSON is never passed directly to
   `GameHandlerBuilder.fromSettings()`.
2. A candidate map must be expressed entirely through existing map, structure,
   hazard, effect, and settings primitives. No map-only executable code and no
   new engine behavior may be introduced to make a candidate pass.
3. The map must be loadable through the production rule path: the settings it
   produces must start a canonical local match that accepts input through the
   shared `isValidInput` boundary used by the emitter, AI, server, and replay
   paths.

## 2. Spawn Contract

1. Every configured player must have a finite, non-overlapping, legal spawn:
   finite coordinates, finite size, positive HP, exactly one team.
2. Spawned figures must not begin inside solid geometry.
3. Spawned figures must not begin inside a lethal hazard region (kill zone or
   deadly obstacle), and must not begin inside a force hazard that would move
   them into an unavoidable immediate death on the first tick.
4. Spawn positions must be inside the map's containment geometry.
5. There must be no unavoidable first-turn elimination: from every legal spawn,
   at least one legal action exists that does not itself eliminate the actor.

## 3. Containment And Geometry Contract

1. Containment geometry must enclose all legal spawn and gameplay regions; the
   full playable area must be reachable without leaving containment through
   ordinary movement.
2. Solid structures must not embed a spawn or trap a figure such that no legal
   action can produce meaningful positional change.
3. No single structure may permanently partition all opponents from each other
   (the map must keep at least one navigable interaction route).
4. Collision geometry must satisfy the Section 13 physics contract: complete
   depenetration, bounded multi-contact iteration, deterministic
   pair/order processing, and explicit failure for unsupported states.

## 4. Action And Playback Contract

1. The first legal action must be reachable through the production rule path
   (menu selection → emitter → simulation → playback), not through direct
   handler mutation or gameplay-API calls.
2. Every accepted action must settle within the existing playback bound
   (1,200 frames); a map that stalls playback or repeats full state is
   rejected.
3. Accepted actions must produce a meaningful deterministic state change;
   no-op-only actions disqualify a map.
4. Live execution must equal replay execution, snapshot restore must continue
   without interruption, and duplicate seeded runs must produce byte-for-byte
   identical results.

## 5. Terminal Contract

1. The map must expose at least one technically reachable terminal mechanism
   (e.g., kill zones, deadly obstacles, out-of-containment elimination,
   last-team-standing) through the production winning evaluation.
2. "Map cannot terminate" must be distinguished from "the selected AI policy
   does not pursue the terminal mechanism". A safety-limit result remains a
   warning or failure per the existing qualification contract; it is never
   converted into an artificial draw.
3. A map whose only terminal route requires pixel-exact browser input is not
   browser-qualified.

## 6. Symmetry And Fairness Contract

1. A map may be symmetric or intentionally asymmetric, but the classification
   must be explicit (`symmetric` or `asymmetric`) and recorded per map.
2. Map qualification must not infer fairness from non-terminal samples.
   Fairness findings come from mirrored tournaments with side-swapped spawns,
   swapped first turn, and matched policies; small-sample findings remain
   warnings pending human review unless they expose an invariant or
   unavoidable elimination.
3. Hazard placement must not make one physical side automatically terminal.

## 7. Browser Contract

1. A map may only become `browser-qualified` after a real browser session
   proves: visible menu selection, visible finite entities, expected
   structures/hazards rendered, one real pointer-driven legal action, bounded
   playback, and a clean return to the menu without console or page errors.
2. Browser play must not depend exclusively on a sub-pixel or extremely narrow
   angle corridor (Section 16.4: ice-arena kill margins are chaotic below
   ~0.25°; terminal routes must tolerate integer-pixel mouse quantization).
3. Browser evidence reuses the Section 16 bounded diagnostics: screenshot,
   console, page errors, interaction log, seed, map ID, and viewport.

## 8. Qualification Classification

Every map in the catalog must carry exactly one of:

| Status | Meaning |
| --- | --- |
| `candidate` | Registered for qualification; evidence collection in progress |
| `technically-qualified` | Passes schema, spawn, containment, action, playback, determinism, replay/restore, and terminal checks |
| `browser-qualified` | `technically-qualified` plus real-browser play evidence |
| `human-qualified` | `browser-qualified` plus external human playtest evidence |
| `blocked` | Qualification attempted; known defects or gaps prevent qualification |
| `rejected` | Contract violation found; not eligible for the matrix |

Rules:

- A map may be `technically-qualified` and `browser-qualified` without human
  evidence, but it must not be marked `human-qualified`.
- A `blocked` or `rejected` status must be accompanied by committed evidence
  (test names or report rows) explaining the decision.
- No map may be exposed as qualified in the production selection path without
  the matching committed evidence.
- Section 17 may be complete while individual candidates remain blocked or
  rejected, provided every candidate has an explicit, evidence-backed status
  and no unqualified map is shipped as qualified.

## 9. Constraint

Existing gameplay, physics, softlock, fairness, and browser detectors must not
be weakened to admit a map. These include, but are not limited to:

- schema/settings validators (`validateMapDocument`, `validateGameSettings`),
- the Section 13 physics qualification suite,
- the Section 15 gameplay content matrix and softlock detection,
- the mirrored fairness tournament,
- the Section 16 real-browser harness and its console/page-error policy,
- the Section 17 map qualification harness (added in Task 17.3).

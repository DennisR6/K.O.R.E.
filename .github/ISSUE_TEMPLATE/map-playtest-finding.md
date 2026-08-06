---
name: Map playtest finding
about: Report a map-specific blocker, usability defect, balance concern, or playtest observation
title: "map-playtest: "
labels: playtest, maps
---

## Classification

- [ ] blocker
- [ ] usability defect
- [ ] balance concern
- [ ] preference
- [ ] unsupported request

## Severity

- [ ] critical (session cannot continue; crash, unreachable menu row, unreadable arena)
- [ ] major (required action undiscoverable without help; misleading hazard or route)
- [ ] minor (discomfort or preference-level observation)

## Session And Build

- Session ID (non-identifying):
- Source commit or deployed revision:
- Server URL or artifact path:
- Browser, platform, and display size:
- Map ID (stable catalog ID, e.g. `hazard-control`):
- Map name (as shown in the menu):
- Match settings seed (default `12345`):
- Match number and turn/action:

## Finding

### Expected result

<!-- What should have happened? -->

### Actual result

<!-- What happened? Include tester wording where useful. -->

### First confusion / first meaningful strategy

<!-- Verbatim observation if this finding is about the tester's first
     encounter with the map. -->

### Reproduction steps

1.
2.
3.

### Frequency

- [ ] once
- [ ] reproducible
- [ ] every attempt
- [ ] unknown

## Evidence

- Screenshot:
- Browser console log:
- `window.game.logs` export:
- Questionnaire or observer-sheet reference:
- Deterministic reproduction (seed and `bun run test:maps` fixture, when applicable):

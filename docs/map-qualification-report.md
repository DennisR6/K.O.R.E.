# Map Qualification Report

Section 17 record of every shipped and candidate map's qualification status,
evidence, and known limitations. The design contract is
`docs/map-design-contract.md`; the final evidence gate is Task 17.10.

## Status Ledger

Classification values are defined by the map design contract:
`candidate`, `technically-qualified`, `browser-qualified`, `human-qualified`,
`blocked`, `rejected`.

| Map ID | Name | Classification | Evidence | Known limitations |
| --- | --- | --- | --- | --- |
| ice-map-v1 | Ice Map | candidate | none yet (17.1) | Existing shipped local-match map; qualification evidence pending the Section 17 matrix |
| cue-clash | Cue Clash | candidate | none yet (17.1) | Currently blocked-from-selection in the content registry; inventory and matrix pending |
| frostbite-arena | Frostbite Arena | candidate | none yet (17.1) | Currently blocked-from-selection; forced drift 1.0 |
| magma-cradle | Magma Cradle | candidate | none yet (17.1) | Currently blocked-from-selection; force vents and kill zones |
| (Section 17 candidates) | TBD | candidate | none yet (17.1) | Created by Tasks 17.4-17.6 |

No map receives `technically-qualified` or higher before the Task 17.3
qualification harness and the Task 17.7 matrix evidence are recorded here.
Human qualification remains `PENDING` until external playtest evidence exists
(Task 17.9).

## Evidence Record

- 17.1: design contract defined (`docs/map-design-contract.md`), status ledger
  opened with every known map as `candidate`.

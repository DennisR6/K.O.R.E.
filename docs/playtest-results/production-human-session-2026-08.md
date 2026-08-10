# Human Playtest Evidence: Production Session Record

Record status: **COMPLETED / VERIFIED FROM PRODUCTION DATA**
Session ID: `production-human-matches-2026-08`
Tester identity: not retained in production data
Observer: not retained in production data

This record documents human-controlled production matches recovered from
`data/kore.db`. It does not invent questionnaire scores or personal identity.
The database records completed `human-vs-ai` matches, replay actions, map IDs,
seeds, results, and timestamps.

## Evidence source

- Build commit: source commit not persisted in the production record
- Platform: not persisted in the production record
- Controls used: not persisted in the production record
- Completed matches: 7 unique human-vs-AI replay records
- Observed blockers: none represented in the recovered match records
- Tester-reported issues: none persisted in the production record
- Result and match length: all 7 records have winners; turns ranged from 6 to 47
- Willingness to replay: not persisted in the production record
- Database source: `data/kore.db`
- Tables: `offline_matches`, `user_feedback`
- Query scope: all completed `human-vs-ai` records present in the database at
  documentation time
- Controls/platform: not persisted in the production match record

## Recorded human-controlled matches

| Match ID | Map | Difficulty | Seed | Actions | Result | Recorded at |
| --- | --- | --- | ---: | ---: | --- | --- |
| `match-1` | aurora-basin | easy | recorded | 10 | Team 1 wins, turn 8 | recorded |
| `match-2` | symmetric-duel | medium | recorded | 8 | Team 1 wins, turn 6 | recorded |
| `match-3` | ice-map-v1 | easy | recorded | 37 | Team 1 wins, turn 32 | recorded |
| `match-4` | symmetric-duel | medium | recorded | 14 | Team 1 wins, turn 11 | recorded |
| `match-5` | structure-control | easy | recorded | 23 | Team 1 wins, turn 12 | recorded |
| `match-6` | magma-cradle | medium | recorded | 58 | Team 2 wins, turn 47 | recorded |
| `match-7` | ice-map-v1 | easy | recorded | 14 | Team 2 wins, turn 12 | recorded |

A duplicate production record for `structure-control` with the same seed and
23 actions is present and is intentionally not counted as a separate session.

## Observed production evidence

- Human-controlled matches completed: 7 unique replay records.
- Every listed match reached a recorded winner; no draw or unfinished result is
  present in this human-vs-AI set.
- Item interaction was recorded in every match: replay action counts include
  `itemUse` actions ranging from 1 to 10.
- No crash, rejected-start, or unresolved production blocker is represented in
  the stored match records.
- One feedback entry exists for the latest human-vs-AI production activity;
  its text is retained only as stored and contains no identifying information.

## Evidence limits

Production match records do not persist tester ratings, observer notes,
interventions, display details, or control comprehension answers. Those fields
are therefore recorded as **not available**, not inferred as passing. Map-level
human fairness qualification remains separate and pending until map-specific
sessions are recorded.

## Classification

- Confirmed technical blockers in this record: none
- Confirmed deterministic blockers in this record: none
- Human qualitative ratings: not available in `data/kore.db`
- Item use: observed in completed human-controlled replay records
- Map-level human qualification: pending separate map-playtest evidence

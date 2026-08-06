# Human Playtest Protocol

This protocol is the human half of Section 15. It measures whether a person
can understand and operate the shipped game, not whether the engine is
deterministic. Use the packaged build and instructions from
`docs/playtest-build.md`.

This is a two-match session for one tester and one observer. Use a new session
ID for every tester. Record only the minimum identity information needed to
connect a result to its issue reports.

## Session Setup

1. Build or obtain the exact artifact with `bun run playtest:build`. Confirm the
   executable or `.deb` path, source commit, and platform before inviting the
   tester. The build gate is documented in `docs/playtest-build.md`.
2. Record the artifact, source commit, platform, display size, controls,
   map/mode, observer, and non-identifying tester session ID in the observation
   sheet below.
3. Use a clean launch and the documented reset procedure before Match 1.
4. The observer may explain only how to launch the build and reach **Play Local
   Game**. Do not explain the objective, phases, aiming, power, items, or result
   flow before Match 1.
5. Keep the observation sheet open during play. Record timestamps, actions,
   confusion, rejected inputs, interventions, crashes, and screenshots without
   coaching or interpreting the event in the moment.

## Session Procedure

1. Launch the build and ask the tester to start a local match.
2. Run Match 1 with no gameplay explanation. Record the first point of
   confusion, attempted actions, rejected actions, pauses, and whether the
   tester completes the match without intervention.
3. Before helping, ask the tester to state the goal, active team, current phase,
   selected actor, aim, and power. Record the answers and uncertainty.
4. Give only the documented control explanation from `docs/playtest-build.md`.
   Do not solve a strategy problem or demonstrate a winning shot.
5. Run Match 2. Record whether the tester can use or skip the item phase,
   submit a shot, wait for playback, recognize the result, and use Rematch or
   Menu. Clarification is allowed only after Match 1 and must be logged.
6. Ask `docs/playtest-questionnaire.md` immediately after Match 2. Record the
   match outcome and turn/action length for each started match.
7. Classify every crash or blocker with the issue template. Include exact
   reproduction steps, build/commit, platform, expected result, actual result,
   and screenshot/log references.
8. Reset and repeat only when reproducing a blocker. Do not discard failed
   sessions; a failed first match is evidence.

## Observer Sheet

Copy this block once per session. Use timestamps relative to launch when an
absolute clock would identify the tester. Write observed behavior before the
observer's interpretation.

```text
session_id: <non-identifying ID>
artifact: <executable or package path>
source_commit: <commit>
platform/display: <OS, architecture, resolution>
controls/map/mode: <values>
observer: <name or ID>

match_1: started=<yes|no>, completed=<yes|no>, result=<winner|draw|none>, turns=<n|n/a>, actions=<n|n/a>
match_1_first_confusion: <timestamp and verbatim observation>
match_1_interventions: <none or timestamp/reason>
match_1_events:
  - <timestamp> <tester action> | <game response> | screenshot/log: <reference>

clarification_given_after_match_1: <exact documented instruction or none>
tester_explanation_before_match_2: goal=<...>; team=<...>; phase=<...>; actor=<...>; aim=<...>; power=<...>

match_2: started=<yes|no>, completed=<yes|no>, result=<winner|draw|none>, turns=<n|n/a>, actions=<n|n/a>
match_2_interventions: <none or timestamp/reason>
match_2_events:
  - <timestamp> <tester action> | <game response> | screenshot/log: <reference>

crashes: <none or issue references>
blockers: <none or issue references>
observer_notes: <short factual notes>
```

## Measurable Human Criteria

Record each rating from 1 (strongly disagree) to 5 (strongly agree), plus a
short quote or observation. The criteria are evidence targets for later
Section 15 tasks, not an assertion that the game has already passed them.

| Criterion | Prompt | Suggested qualification signal |
| --- | --- | --- |
| Control comprehension | “I understood how to select, aim, set power, and release a shot.” | Median >= 4; no more than 1 of 5 testers unable to submit a legal first shot |
| Objective comprehension | “I understood how to win or draw.” | Median >= 4; tester can state the objective before Match 2 |
| Phase comprehension | “I understood whose turn it was and what the current phase allowed.” | Median >= 4; no repeated phase-blocking confusion after clarification |
| Action feedback | “The game clearly showed what happened after my action and why an action was rejected.” | Median >= 4; no unclassified blocker caused by missing feedback |
| Camera usability | “The arena, actor, target, and relevant feedback remained visible and usable.” | Median >= 4; no tester blocked by framing or obscured controls |
| Pacing | “The match length and waiting during playback felt appropriate.” | Median >= 3; record exact too-short/too-long observations |
| Perceived fairness | “The outcome and available actions felt fair and understandable.” | Median >= 3; all reports of unavoidable or unexplained loss are reviewed |
| Willingness to replay | “I would voluntarily play another match.” | Median >= 3; record yes/no and reasons, not just the score |

Technical completion is also recorded: completed matches / started matches,
developer interventions, crashes, blockers, and result-overlay reachability.
These counts do not replace the ratings.

Classify findings as blocker, usability defect, balance concern, preference,
or unsupported request. A blocker includes a crash, inability to start or
complete a match, or a required action that the tester cannot discover after
the documented clarification. Preserve enough build and action detail for a
later deterministic regression test where possible.

Complete the questionnaire and attach it to the observer sheet. The combined
sheet is the session record for Section 15.10; this task only defines the
collection format and does not claim that any human session has passed.

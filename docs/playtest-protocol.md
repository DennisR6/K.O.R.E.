# Human Playtest Protocol

This protocol is the human half of Section 15. It measures whether a person
can understand and operate the shipped game, not whether the engine is
deterministic. Use the packaged build and instructions from
`docs/playtest-build.md`.

## Session Setup

- Record the build artifact, source commit, platform, display size, controls,
  map/mode, and tester session ID. Store no unnecessary personal information.
- Use a clean launch and the documented reset procedure before the first
  match.
- The observer may explain how to launch the build, but must not explain the
  objective, phases, aiming, power, items, or result flow before Match 1.
- The observer records confusion verbatim and does not immediately rescue the
  tester unless the application is blocked or safety/accessibility requires it.

## Session Procedure

1. Launch the build and ask the tester to start a local match.
2. Run Match 1 with no gameplay explanation. Record the first point of
   confusion, actions attempted, rejected actions, pauses, and whether the
   tester completes the match without developer intervention.
3. Ask the tester to describe the objective, active team, current phase,
   selected actor, aim, and power before intervening.
4. Give only the documented control explanation, then run Match 2. Record
   whether the tester can use or skip the item phase, submit a shot, wait for
   playback, recognize the result, and use Rematch or Menu.
5. Ask the questionnaire below immediately after Match 2. Record match
   outcome and turn/action length for each completed match.
6. Reset and repeat only when reproducing a blocker. Do not discard failed
   sessions; a failed first match is evidence.

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

## Session Record

```text
session: <non-identifying ID>
build/commit: <artifact and source commit>
platform/display/controls: <values>
configuration: <map and mode>
match_1: completed|blocked|crashed, result, turns/actions, intervention: yes|no
match_2: completed|blocked|crashed, result, turns/actions, intervention: yes|no
confusion_observations: <timestamped notes>
ratings: control=<1-5>, objective=<1-5>, phase=<1-5>, feedback=<1-5>, camera=<1-5>, pacing=<1-5>, fairness=<1-5>, replay=<1-5>
blockers: <reproduction, severity, screenshot/log reference, or none>
tester_quotes: <minimal relevant quotes>
```

Classify findings as blocker, usability defect, balance concern, preference,
or unsupported request. A blocker includes a crash, inability to start or
complete a match, or a required action that the tester cannot discover after
the documented clarification. Preserve enough build and action detail for a
later deterministic regression test where possible.

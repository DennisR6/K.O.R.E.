# Performance Testing

The repository keeps representative performance baselines in
`performance/baselines.json`. They are version-controlled so performance
changes remain visible in ordinary Git diffs and review history.

## Commands

```text
bun run test:performance
bun run performance:update
```

`test:performance` runs the existing aggregate Hard AI profiler, compares its
metrics with the committed profile, prints baseline/current/delta/limit values,
and exits non-zero on a regression. It never writes the baseline.

`performance:update` is an explicit maintenance command. It reruns the same
profile and updates only the baseline values in the JSON. Review the resulting
Git diff and explain any intentional increases before committing it.

## Metric Policy

Metrics are separated into two kinds:

- `work`: deterministic quantities such as candidate count, simulation count,
  ticks, physics ticks, and collision checks. These use strict tolerances.
- `wall-clock`: machine-dependent elapsed times such as total match time,
  candidate time, and decision time. These use wider tolerances for CPU load,
  runtime, and CI scheduling noise.

Comparison is asymmetric because lower cost is always an improvement:

```text
current <= baseline -> pass
current > baseline but within maxRegressionPercent -> pass
current exceeds maxRegressionPercent -> fail
```

An improvement never fails because it is not an absolute two-sided tolerance
match.

## Interpreting Diffs

- Time increased while work stayed constant: implementation or hot-path regression.
- Time and work both increased: algorithmic/work-generation regression.
- Time decreased while work stayed constant: implementation optimization.
- Time and work both decreased: algorithmic optimization.
- Work decreased while time stayed flat: another subsystem likely became dominant.

The baseline intentionally avoids timestamps, process IDs, CPU temperature, and
temporary paths. It records workload metadata needed to interpret the result:
map, seed, AI configuration, candidate limits, and horizon.

## Safety

Do not update committed performance baselines merely to make a failing
performance test pass. A baseline increase requires an explicit explanation of
why the additional cost is intentional or unavoidable. Prefer fixing
regressions over moving the baseline.

The normal `test:fast` lane does not run the expensive performance profile.
Performance remains a separate explicit lane until its runtime and machine
noise justify a release or CI policy change.

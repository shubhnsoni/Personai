# P1-013 Orchestration Observability Diagnosis

**Status:** honest one-shot snapshot; no durable monitor is running or claimed.

**Decision date:** 2026-08-28

## Ground truth

The available ACP CLI session cannot arm `monitor_start`. The autonomous-nudge loop list is empty. Therefore no Kiro Crew scheduler or durable session loop owns the orchestration dashboard.

`LIVE_ACTIVITY.md` is an output file, not evidence of a service. A file with an old timestamp only proves that a prior invocation completed; it does not prove a future tick is scheduled or that any monitor remains alive.

## Implemented contract

`Orchestrator-Dashboard.ps1` now always performs exactly one collection and exits:

- It writes an activity **snapshot** with an explicit `Mode: one-shot snapshot` statement.
- It states that it does not start, schedule, or claim a running monitor.
- It does not contain a perpetual `while ($true)` loop or `Start-Sleep` polling path.
- It accepts `-OutputPath` so validation can write outside the worktree without mutating the normal runtime output.
- Every read-only Git probe is capped at three seconds. A blocked Git command is rendered as `timed out after 3s`, never silently reused as fresh data.
- A nonblocking local named mutex permits only one snapshot writer at a time. A concurrent invocation fails without replacing the last completed snapshot.

The output is still named `LIVE_ACTIVITY.md` for compatibility, but its heading and contents make clear that it is a completed snapshot. The next update occurs only when an operator manually invokes the script.

## Why this is not a three-tick monitor claim

We did **not** claim three completed timestamped ticks, no-overlap writer evidence, or an active polling cadence. Producing that claim would require a durable owning scheduler/monitor, timestamped run evidence, and a verified single-writer mechanism. None is available in this ACP CLI session, and adding a scheduler or background service is outside P1-013's permitted scope.

The previous perpetual console loop was removed because a console process is not durable orchestration: closing its shell ends collection, while a static `LIVE_ACTIVITY.md` could misleadingly look current. No 1-second polling was introduced.

## Operator use

Run a fresh snapshot only when needed:

```powershell
.\docs\orchestration\Orchestrator-Dashboard.ps1
```

For isolated validation, direct output to a temporary path:

```powershell
.\docs\orchestration\Orchestrator-Dashboard.ps1 -OutputPath $env:TEMP\orchestrator-dashboard-validation.md
```

## Blockers to durable monitoring

1. `monitor_start` cannot arm from this ACP CLI session.
2. No autonomous loop is registered.
3. Changing schedulers, configuration, or service ownership is explicitly out of scope for this lane.

Until an approved durable owner is available, the only truthful status is a manually triggered one-shot snapshot.

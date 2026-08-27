# KiroCrew Capability Map

Updated: 2026-08-27 03:38 +05:30

## Observed CLI

- List sessions: kirocrew spawn list
- Create/start foreground subagent: kirocrew spawn run "task"
- Create/start background subagent: kirocrew spawn run --async "task"
- Run a spec file: kirocrew run TASK.md
- Read runtime status: kirocrew status
- Gateway logs: kirocrew logs is partially broken on Windows because it expects Unix tail; direct file read of %USERPROFILE%\.kiro\crew\gateway.log works.
- Stop/restart gateway: kirocrew stop, kirocrew restart

## Limitations Observed

- Previous job 127e842f is active/listed but was blocked by denied write / shell tool permissions.
- No verified CLI command was found for isolated branch/worktree creation inside KiroCrew itself.
- Therefore, true worker implementation is not authorized through KiroCrew yet. Safe mode is documentation plus read-only analysis tasks, or orchestrator-created local worktrees after explicit owner approval.

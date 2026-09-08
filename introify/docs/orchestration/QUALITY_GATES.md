# Quality Gates

Updated: 2026-08-27 03:38 +05:30

## Required Before Code Integration

- 
pm run lint
- 
pm run build
- Prisma validation/generation after any schema edit.
- Targeted route/API smoke checks for edited surfaces.
- Manual approval before any migration against non-ephemeral database.

## Required Before Worker Merge

- Worker branch/worktree path recorded.
- Diff reviewed by root orchestrator.
- Evidence attached: commands run, output summary, known gaps.
- No edits to frozen/user-owned paths unless explicitly assigned.

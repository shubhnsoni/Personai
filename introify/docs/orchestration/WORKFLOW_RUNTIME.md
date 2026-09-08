# Executable Workflow Runtime

Status: implemented on the committed additive copilot schema. No migration, generation, live database command, background worker, external action, or authentication bypass is part of this lane.

## Runtime boundary

`src/lib/copilot/execution/` adds a repository-backed execution layer over the committed `WorkflowRun`, `AgentRun`, `WorkflowStep`, `ToolCall`, `Approval`, and `CopilotAuditEvent` models.

- `CopilotExecutionService` is the action boundary. It asks the repository to claim a run before invoking an injected action.
- `PrismaCopilotExecutionRepository` is the durable adapter. Every read and mutation qualifies the run by the authenticated `profileId`; an unknown and a foreign run are intentionally indistinguishable.
- `InMemoryExecutionRepository` implements the same contract for deterministic, database-free evidence.
- The repository interface exposes audit listing and append-producing state operations. It exposes no audit update or delete operation. The durable adapter only calls `copilotAuditEvent.create`.

The original `src/lib/copilot/runtime.ts` remains the pure state-machine reference. The execution layer preserves its legal states while adding persistence, tenant scope, agent attempts, action invocation, and API composition.

## Approval-before-action invariant

A requested approval is a distinct `Approval` row. `beginExecution` loads the tenant-owned run and rejects pending approvals before it claims the workflow or creates an `AgentRun`, step, or tool call. `CopilotExecutionService.execute` invokes the action only after `beginExecution` succeeds. Therefore an approval failure occurs before action code is reachable.

A rejected approval cancels the run. A granted approval remains durable evidence and allows the next execution claim to move `awaiting_approval` to `executing`.

## Execution and recovery

A successful attempt records this history:

1. claim the run as `executing`;
2. append an `AgentRun` attempt (`queued` then `running`);
3. append a `WorkflowStep` (`pending` then `running`);
4. append a running `ToolCall`;
5. invoke the server-owned action with the stable key `<workflowRunId>:<actionKey>`;
6. atomically mark tool, step, agent, and workflow complete while appending audit events.

If action code throws, the tool, step, and agent are retained as failed evidence and the workflow becomes `interrupted`. A retry creates a new step and a new `AgentRun` with a monotonic attempt number. It does not rewrite the failed attempt. Action adapters must use the supplied stable idempotency key when they call a side-effecting domain service; the runtime cannot manufacture exactly-once behavior for an external system that ignores idempotency.

A completed execution retry returns the original result without invoking the action again. Starting a workflow with the same `(profileId, idempotencyKey)` returns the original run and appends nothing.

## Append-only audit

Audit entries use a strictly increasing, one-based sequence within each workflow run. State rows and their corresponding audit entries are written in the same Prisma transaction. The committed database protection remains the final defense against direct update/delete attempts; this adapter deliberately has no mutation path for existing audit rows.

Events include workflow creation/transitions, approval requests/decisions, agent creation/transitions, step creation/transitions, and tool-call start/completion/failure. Payloads contain execution metadata, not copied business-domain records.

## API surface

All endpoints call the existing Clerk-backed `syncUser` path, use its active profile, and require that profile's explicit `businessOs` surface. There is no caller-supplied tenant selector.

- `GET /api/copilot/runs` — list the active profile's runs.
- `POST /api/copilot/runs` — idempotently start a run and optionally request an approval.
- `GET /api/copilot/runs/:runId` — return the tenant-owned run and ordered audit.
- `POST /api/copilot/runs/:runId/approvals/:approvalId` — grant or reject a pending approval.
- `POST /api/copilot/runs/:runId/execute` — execute an explicit server-owned action.

The only registered action in this lane is `recordAudit`, a local deterministic action. Unknown action keys are refused. Money, customer messaging, publishing, domain writes, arbitrary tools, and external calls are not enabled.

## Harness evidence

`scripts/one-off/check-executable-copilot-runtime.ts` uses no network, credentials, environment file, or database. It proves:

- a pending approval blocks before the action and before execution rows/events;
- granting approval permits one action invocation and appends ordered audit;
- workflow-start and completed-action retries are idempotent;
- a failed agent attempt becomes an interrupted run and recovers with a distinct second attempt;
- failed evidence remains append-only rather than being overwritten;
- cross-profile read, list, and execute operations are refused before action invocation;
- returned audit payloads are immutable; and
- `INVERT_ASSERTION=1` deliberately makes the harness fail, demonstrating falsifiability.

## Operational limits

This lane does not add a worker queue, stale-lease timer, arbitrary action registry, domain adapter, or cross-service exactly-once protocol. An executor that crashes after the durable claim but before its catch handler requires a later lease/reaper worker to convert the still-`executing` attempt to `interrupted`. The current synchronous API path handles ordinary action failures and records recovery evidence.

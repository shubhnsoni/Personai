# Copilot Runtime Schema Proposal (Additive Only)

Status: proposal for a later, single-owner schema wave. This document makes no Prisma edits
and does not authorize a migration.

## Non-negotiable compatibility rule

The later migration must be additive only: nothing existing is renamed, dropped, duplicated,
or backfilled. Existing `Profile`, `Booking`, `Notification`, `Conversation`, `Order`, and
course data remain canonical in their present tables. Copilot rows hold references and use
application adapters to load or invoke those domain systems; they do not copy domain records
into a second source of truth.

## Proposed new tables

### `WorkflowRun`

One row per accepted owner-copilot workflow command.

- `id` (primary key)
- `profileId` (required foreign key/reference to the existing `Profile` owner scope)
- `workflowKey`, `workflowName`
- `state` (`queued`, `planning`, `awaiting_approval`, `executing`, `interrupted`,
  `completed`, `failed`, `cancelled`)
- `idempotencyKey` (required, scoped unique with `profileId`)
- `createdAt`, `updatedAt`, `completedAt` (nullable)
- `failureCode`, `failureDetail` (nullable)

Indexes: unique `(profileId, idempotencyKey)`; `(profileId, state, createdAt)` for queues;
`(state, updatedAt)` for recovery scans.

### `AgentRun`

One row per specialized agent attempt inside a workflow run.

- `id` (primary key), `workflowRunId` (required)
- `agentKey`, `state` (`queued`, `running`, `waiting_for_approval`, `completed`, `failed`,
  `cancelled`)
- `attempt`, `startedAt`, `completedAt`, `failureCode` (nullable where appropriate)

Indexes: `(workflowRunId, createdAt)` and `(state, updatedAt)`.

### `WorkflowStep`

Ordered, run-owned execution steps.

- `id` (primary key), `workflowRunId` (required)
- `ordinal` (positive integer, unique within the run)
- `label`, `state` (`pending`, `running`, `completed`, `failed`)
- `startedAt`, `completedAt`, `inputJson`, `resultJson` (nullable as appropriate)

Constraints/indexes: unique `(workflowRunId, ordinal)`; `(workflowRunId, state, ordinal)`.

### `ToolCall`

Ordered tool calls attached to one workflow step.

- `id` (primary key), `workflowStepId` (required)
- `ordinal` (positive integer, unique within the step)
- `toolName`, `inputJson`, `outputJson`, `state`, `startedAt`, `completedAt`, `errorCode`

Constraints/indexes: unique `(workflowStepId, ordinal)`; `(workflowStepId, createdAt)`.

### `Approval`

A distinct approval decision, never a boolean on a run or step.

- `id` (primary key), `workflowRunId` (required), `workflowStepId` (nullable)
- `reason` constrained to the product-owned approval-reason vocabulary
- `state` (`pending`, `granted`, `rejected`)
- `requestedBy`, `requestedAt`, `decidedBy`, `decidedAt`, `decisionNote` (decision fields nullable)

Indexes: `(workflowRunId, state, requestedAt)` and `(state, requestedAt)` for approval inboxes.

### `CopilotAuditEvent`

Application-owned, append-only event ledger. This is the recovery source of truth, not a
mutable activity feed.

- `id` (primary key), `workflowRunId` (required), `agentRunId` (nullable)
- `sequence` (strictly increasing within `workflowRunId`)
- `eventType`, `actorType`, `actorId` (nullable), `occurredAt`, `payloadJson`

Constraint/indexes: unique `(workflowRunId, sequence)`; `(workflowRunId, sequence)` for
ordered recovery; `(eventType, occurredAt)` for operational investigation. Application
permissions must prohibit update/delete after insertion.

## Adapter boundary instead of duplication

A copilot command carries typed references such as `{ kind: "Order", id }` or
`{ kind: "Booking", id }`. Adapters resolve those references within the existing profile
scope and call the canonical business service. `ToolCall` stores request/result metadata
necessary for audit and replay reasoning, not a copied Order, Booking, Notification,
Conversation, Profile, or course payload. The same adapter layer publishes resulting audit
events to `CopilotAuditEvent`.

## Migration and rollout sequence

A single schema owner should review these names against the current Prisma schema, add only
new models/enums/indexes, generate once after sibling worktrees are idle, and deploy the
empty tables before enabling any writer. No backfill is required or proposed. A read-only
adapter and the in-memory contract harness should be retained until the durable repository
matches the state-machine, idempotency, approval, ordering, immutability, and recovery
contracts in `src/lib/copilot/runtime.ts`.

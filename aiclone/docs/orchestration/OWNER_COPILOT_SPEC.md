# Owner-Facing Business Copilot — Product and Runtime Spec

Task: P0-007 (re-queued from P0-004). Documentation only.
Updated: 2026-08-27

Authority: PROGRAM.md (non-negotiable "keep customer-facing AI persona and owner-facing
Business Copilot as separate AI planes"), ADR-001 (separate AI planes), ADR-004
(app-owned run ledger), ADR-005 (canonical blueprint model), ADR-006 (API envelope),
ENGINE_CONTRACTS.md (engine boundaries, blueprint composition, approvals and audit).

Everything in this document is grounded in code that exists today. Where behaviour does
not exist yet it is marked **PROPOSED** and, where it needs a schema change, it is also
marked as blocked on the owner, because `prisma/schema.prisma` and `prisma/migrations/**`
are owner-reviewed paths under OWNERSHIP.md and no worker may run a migration.

## 0. Implemented vs proposed at a glance

| Capability | State today | Where |
|---|---|---|
| Canonical domain model (`BusinessBlueprint`, `WorkflowAction`, `ApprovalPolicy`, `AuditEvent`) | Implemented | `src/lib/business-os/types.ts` |
| Blueprint validation on load | Implemented, and it now rejects a required approval with a blank `reason`, an `event` trigger with no event name, a `schedule` trigger with no schedule, and duplicate blueprint ids | `src/lib/business-os/validation.ts`, `blueprints.ts` |
| Plan-time approval/audit derivation | Implemented, in-memory only | `src/lib/business-os/workflow.ts` |
| Engine + capability registry | Implemented | `src/lib/business-os/engines.ts` |
| Owner-only blueprint API with `{ ok, data }` envelope | Implemented | `src/app/api/business-os/blueprints/route.ts`, `.../[blueprintId]/route.ts`, `src/lib/business-os/api/responses.ts` |
| Owner surface gated server-side | Implemented | `src/app/dashboard/business-os/page.tsx`, `src/lib/require-surface.ts` |
| `ownerCopilotPrompts` rendered | Implemented as static labels, not actions | `src/components/business-os/business-os-shell.tsx` (~line 186) |
| Copilot conversation loop, tool execution | **PROPOSED** | — |
| Durable run ledger (ADR-004) | **PROPOSED**, blocked on an owner-approved migration | — |
| Persisted approvals and audit rows | **PROPOSED**, blocked on the same migration | — |
| `schedule` trigger execution | **PROPOSED**; `WorkflowTrigger.kind` accepts `"schedule"` and nothing consumes it | `src/lib/business-os/types.ts` |

## 1. Two AI planes

### 1.1 The customer-facing persona plane, as it actually works

`POST /api/chat` (`src/app/api/chat/route.ts`, `dynamic = 'force-dynamic'`) is the
existing plane. Concretely:

- **Identity is anonymous by default.** The caller is a visitor keyed by the `pl_vid`
  cookie or a request-body `visitorId`, optionally upgraded to a `Member` via
  `getMemberFromSession()` (`src/lib/members.ts`). There is no signed-in owner.
- **Abuse control substitutes for authorization.** `checkRateLimit(ip)`
  (`src/lib/rate-limit.ts`) keyed on `x-forwarded-for` is the only gate; any visitor may
  reach any `profileId`.
- **Context is public business data.** `buildSystemPrompt(profile, contextDocs, currency)`
  in `src/lib/rag.ts` assembles headline, bio, services, menu/shop, courses, events,
  communities and lead magnets, gated by `hasSurface`/`fieldOn` from
  `src/lib/surfaces.ts`. Retrieval is `vectorRetrieval` over
  `scopeDocuments(profile.documents, visitorKey)`, which restricts `VISITOR_MEMORY`
  documents to the one visitor they belong to.
- **Tools are narrow and mostly read-only.** Twelve function tools are declared and then
  filtered into `allowedTools`; the writing ones are `collectLead` (creates `VisitorLead`,
  updates `Conversation`) and `bookTable` (delegates to `createBooking` /
  `getAvailableSlots` in `src/app/actions/bookings.ts`). Everything else formats data the
  visitor is already allowed to see.
- **No approvals, no audit, no durable run.** The unit of work is one streamed HTTP
  response. Persistence is limited to `Conversation`, `Message`, `VisitorLead` and a
  `ProfileEvent` analytics row. If the process or the provider stream dies mid-answer, the
  work is simply gone: nothing records that a turn was in flight.
- **Human escalation exists but is customer-side.** `Conversation.mode` of `LIVE` or
  `LIVE_REQUESTED` short-circuits the model and emits a holding message.

### 1.2 The owner copilot plane

The owner copilot is a permissioned operations manager for one profile. It is
authenticated (`syncUser()` in `src/lib/auth-sync.ts`, Clerk-backed), scoped to profiles
that user owns, surface-gated by
`requireSurface(profile.roleTemplate, "businessOs", profile)`, reads private operational
data, executes effectful tools through engine-owned functions, stops at approval gates,
writes an audit trail, and survives the death of a provider session.

### 1.3 Why they must not be one plane

| Dimension | Persona plane | Owner copilot plane |
|---|---|---|
| Principal | anonymous visitor / audience `Member` | Clerk-authenticated `User` owning the `Profile` |
| Trust in input | untrusted, adversarial | authenticated but still not authoritative over policy |
| Data scope | public surfaces + that visitor's own memory | private operations: orders, payments, leads, enrolments, inbox |
| Effects | collect a lead, book a table | money, outbound messages, published surfaces, bulk changes |
| Governance | rate limit only | approval gates, audit, permission boundary |
| Durability | request-scoped, dies with the response | durable run ledger, resumable |
| Prompt | persona voice, sales-oriented (`buildSystemPrompt`) | operator voice, policy-first, app-authored |

Merging them would mean one prompt and one tool table serving both an adversarial
anonymous caller and a privileged operator. A prompt-injection in a visitor message would
sit one tool-allowlist bug away from an approval-gated owner action, and the owner's
private operational data would live in the same context window as text written by a
stranger. ADR-001 forecloses that. The planes may share libraries — `prisma`, `pricing`,
`realtime`, engine functions — but never a route, a system prompt, a tool manifest, or a
session.

### 1.4 Boundary rules between planes

1. The copilot never renders on a public profile route and has no anonymous entry point.
2. The copilot never calls `/api/chat`, and `/api/chat` never calls copilot tools.
3. `src/app/api/chat/route.ts` and `src/lib/rag.ts` are patch-only shared contracts
   (OWNERSHIP.md). This spec requires **no change** to either file. Copilot prompt
   assembly lives in its own module (**PROPOSED** `src/lib/business-os/copilot/prompt.ts`)
   so `buildSystemPrompt` stays the persona plane's alone.
4. Owner-plane routes live under `src/app/api/business-os/**` and return the ADR-006
   envelope via `businessOsJson` / `businessOsError`.

### 1.5 Current entry points and one gap

`businessOs` is a registered `Surface` in `src/lib/surfaces.ts`,
`surfaceForPath("/dashboard/business-os")` and `navHrefToSurface("/dashboard/business-os")`
both resolve it, and a "Business OS" navigation entry exists in the shared `navGroups` list,
which `visibleNavItems` filters through `hasSurface` so mobile and header inherit the gate.
P1-002 is done.

Entitlement is deliberately closed by default. `businessOs` is **not** in `ALL_SURFACES` and
not in any role `KIT`, so `RESTAURANT`, `SHOP`, `COACH`, `CUSTOM`, an unrecognised role, a
null role and an empty role are all denied. `CUSTOM` matters specifically because it is the
Prisma default for `Profile.roleTemplate`, the "Something else" onboarding option, the
try-kit role, and the fallback `kit()` uses for any unknown role; granting it there would
have switched an unfinished console on for exactly the profiles most likely to exist. The
only way in is an explicit per-profile opt-in through `extras.surfaces`. All eight of those
cases are asserted in `scripts/one-off/check-business-os-surface.ts`.

The copilot inherits that gate exactly. On the page, `requireSurface` redirects to
`/dashboard`. On the API, the shared `requireBusinessOsAccess` guard distinguishes the two
failures: a caller with no session gets `UNAUTHORIZED`/401, and a caller who is
authenticated but lacks the surface gets **`FORBIDDEN`/403**. Any copilot route must reuse
that guard rather than re-deriving the check.

## 2. Durable run ledger (ADR-004)

ADR-004: an application-owned ledger exists even if the provider offers background
execution. The provider session is a cache. The ledger is the truth.

### 2.1 Why the committed types are not a ledger

`src/lib/business-os/workflow.ts` gives us `planWorkflowRun(workflow, actor, now)`
returning `WorkflowRunPlan { workflowId, workflowName, actions, auditEvents }`, where each
`WorkflowActionPlan.status` is `WorkflowRunStatus = "ready" | "waiting_for_approval"`.
That is a *plan-time, per-action* classification computed from
`action.approval?.required`, returned as a plain object, and discarded when the function
returns. It has no run identity, no terminal states, no persistence, and no notion of an
attempt. The ledger below is a superset; `planWorkflowRun` becomes the planner that seeds
it, unchanged.

### 2.2 Run states (PROPOSED `OwnerCopilotRunStatus`)

| State | Meaning | Exits to |
|---|---|---|
| `queued` | accepted and persisted, not started | `planning`, `cancelled` |
| `planning` | model is producing the step plan | `executing`, `awaiting_approval`, `failed`, `handoff` |
| `awaiting_approval` | ≥1 step has an undecided required `ApprovalPolicy` | `executing`, `handoff`, `expired`, `cancelled` |
| `awaiting_input` | needs owner-supplied data, not a decision | `planning`, `executing`, `handoff`, `expired`, `cancelled` |
| `executing` | unblocked steps running | `awaiting_approval`, `awaiting_input`, `succeeded`, `failed`, `handoff` |
| `handoff` | parked for a human after `handoffToOwner` | `succeeded`, `cancelled` (owner-driven only) |
| `succeeded` | every step terminal, none failed | terminal |
| `failed` | a permanent error, or retry budget exhausted | terminal |
| `expired` | an approval or input request timed out | terminal |
| `cancelled` | owner cancelled | terminal |

Step states (**PROPOSED** `OwnerCopilotStepStatus`), a superset of the committed literals
so plan output maps in without translation: `pending`, `ready`, `waiting_for_approval`,
`running`, `succeeded`, `failed`, `rejected`, `skipped`.

Invariants:

- Only the application writes run and step state. A provider callback is an input, never
  a state write.
- Transitions are guarded and illegal ones rejected at the boundary, the same discipline
  as `assertOrderTransition` / `assertOrderLineTransition` in
  `src/lib/restaurant-orders.ts` (ENGINE_CONTRACTS rule 2).
- Terminal states are immutable. A retry creates a new attempt row, never rewrites one.
- `succeeded` is impossible while any step is non-terminal.

### 2.3 What is persisted

Per run: run id; `profileId`; acting `userId`; `blueprintId` **and** `blueprint.version`
(ADR-005: an active tenant is not silently migrated, so an in-flight run keeps the version
it started on); `workflowId` and `WorkflowTrigger.kind` when the run came from a workflow,
or `null` for an ad-hoc owner question; the originating prompt and, when it came from
`ownerCopilotPrompts`, the prompt index; caller-supplied `idempotencyKey`; status;
`createdAt` / `updatedAt`; `lastHeartbeatAt`; a step cursor; attempt and cost budgets
consumed; and an opaque, explicitly non-authoritative `providerRef`.

Per step: run id; monotonic `seq`; the source `WorkflowAction.id`, `kind` and `label`, or
the tool name for ad-hoc steps; the input arguments actually sent; the result or error
class; status; attempt number; timestamps; and a **snapshot** of the step's
`ApprovalPolicy` (`required`, `approverRole`, `reason`) copied at plan time rather than
referenced by pointer, so editing a blueprint cannot retroactively change a gate that is
already pending.

Per transcript entry: role, content, tool name, arguments, redacted result, token and cost
accounting — enough to rebuild the model context without the provider session.

Per approval: the step it gates, the policy snapshot, requested-at, decision
(`approved` / `declined`), decider principal, decided-at, optional note, expiry.

Per audit entry: the `AuditEvent` shape from `types.ts`, append-only (see §4).

Events are append-only with a monotonic sequence, following the `OrderEvent` precedent in
`prisma/schema.prisma` (`seq BigInt @default(autoincrement())`, `kind`, `from`, `to`,
`actor`, `metadata`, indexed `[orderId, seq]`). Any fan-out to the owner's UI publishes
after commit, per ENGINE_CONTRACTS rule 5 and `publish()` in `src/lib/realtime.ts`, so a
rolled-back write is never broadcast.

### 2.4 Resumability after a provider session dies

Recovery is a reconciler, not a retry-in-place:

1. Select runs in `planning` or `executing` whose `lastHeartbeatAt` is older than the lease
   TTL (**PROPOSED** default 90s, lease renewed on every step boundary).
2. Rebuild context from the persisted transcript and step rows. Do not ask the provider
   what happened; `providerRef` is a hint for observability only.
3. Skip every step already `succeeded`. Never re-request an approval already decided.
4. Re-drive the first non-terminal step as a new attempt. Every effectful tool takes an
   idempotency key derived as `${runId}:${stepId}:${attempt-group}`, so a step that died
   after the side effect but before the result was written returns the original result
   instead of duplicating it. That is ENGINE_CONTRACTS rule 6, and the schema precedent is
   `Order.@@unique([profileId, idempotencyKey])`.
5. If the retry budget for the step is exhausted, classify and escalate per §6.
6. Record a reconciliation audit entry with `actor` `system:reconciler` so a resumed run is
   distinguishable from a clean one.

A run in `awaiting_approval`, `awaiting_input` or `handoff` is *not* a stalled run and the
reconciler leaves it alone; only its expiry timer applies.

### 2.5 Persistence: proposed, and blocked

No run ledger exists in the database today. The models in
`prisma/schema.prisma` are: `User`, `Profile`, `ProfileEvent`, `WorkExperience`,
`Project`, `WelcomeAnimationPreset`, `ProfileDocument`, `ServiceOffering`, `Booking`,
`Payment`, `Conversation`, `Message`, `VisitorLead`, `AdminSettings`,
`AvailabilitySchedule`, `CalendarOverride`, `DigitalProduct`, `Course`, `CourseModule`,
`CourseLesson`, `Event`, `Community`, `LeadMagnet`, `ShortLink`, `Member`,
`MemberSession`, `LibraryLink`, `ProductPurchase`, `OfferReview`, `Order`, `OrderLine`,
`OrderEvent`, `RestaurantTable`, `OrderCounter`, `ProfileImage`, `CourseEnrollment`,
`LessonCompletion`, `EventRegistration`, `CommunityMember`, `Notification`,
`LeadMagnetSubmission`. None of them is a run ledger, an approval record, or an audit log.
`ProfileEvent` is profile analytics and `Notification` is a per-`User` inbox; neither is
suitable, and reusing them would hide the ledger inside an unrelated contract.

**PROPOSED, NOT IMPLEMENTED** — four new models, subject to owner review because
`prisma/schema.prisma` and `prisma/migrations/**` are owner-reviewed:
`OwnerCopilotRun`, `OwnerCopilotRunStep`, `OwnerCopilotRunEvent` (transcript plus audit,
or split if audit retention differs), and `OwnerCopilotApproval`. Field lists follow §2.3.
Indexes at minimum `[profileId, status]`, `[profileId, createdAt]`, `[runId, seq]`, and a
unique `[profileId, idempotencyKey]`.

Consequence while that is unapproved: the copilot may ship **only** synchronous,
single-turn, read-only assistance. Any approval-gated or multi-step effectful run is out of
scope until the ledger exists, because ADR-004 durability cannot otherwise be met. An
in-memory or JSON-file ledger is explicitly rejected: it does not survive a redeploy, so it
would satisfy the letter of ADR-004 and none of its purpose.

## 3. Approval gates

### 3.1 Built on the committed type

```ts
// src/lib/business-os/types.ts
export type ApprovalPolicy = {
  required: boolean
  approverRole: "owner" | "manager" | "staff"
  reason: string
}
```

`planWorkflowRun` already marks any action with `approval?.required` as
`waiting_for_approval`, and `listApprovalGates(workflows)` already enumerates every gate in
a blueprint as `{ workflowId, actionId, approval }`. Those two functions are the runtime's
starting point; the ledger adds the decision, the decider, and the clock.

### 3.2 Which action kinds gate

`WorkflowActionKind` is `createTask | sendNotification | requestApproval | recordAudit |
handoffToOwner`.

| Kind | Gate | Audit | Note |
|---|---|---|---|
| `requestApproval` | always — it *is* the gate | yes | invalid without a non-empty `reason` |
| `sendNotification` | required when the recipient is a customer or the message leaves the business; not required for an internal owner notification | always | the persona plane owns customer messaging; the copilot asks first |
| `createTask` | no | yes | internal, reversible |
| `recordAudit` | no | it is the audit | never gated |
| `handoffToOwner` | no | always | escalation, not an effect (§6) |

Blueprint-declared gates are a floor, not a ceiling. Independently of what a blueprint
says, a copilot tool call is gated when it falls in any of these classes, per
ENGINE_CONTRACTS ("anything that spends money, messages a customer, or changes a published
surface requires an approval gate or an audit record") widened for scale and reversibility:

1. **Money** — charge, refund, discount, price change, payout, invoice issue.
2. **Outbound** — any message or notification delivered to a customer, guest, lead, member
   or enrolee.
3. **Published surface** — profile content, catalog/menu, availability, pricing, course
   publication, anything a visitor can see.
4. **Bulk** — a single intent mutating more than a threshold count of records
   (**PROPOSED** default 10) or spanning more than one customer.
5. **Irreversible** — deletes, cancellations, status transitions with no legal reverse
   under the owning engine's guards.

Unclassified mutations are **denied by default**, not gated: an unrecognised effect is a
missing classification, and asking the owner to approve something the system cannot
describe is not consent.

### 3.3 Who approves

`approverRole` has three values, and today only one is resolvable. The identity model is
`Clerk user → User → Profile` (`syncUser()`); `Member` and `MemberSession` are
audience-side records used by the persona plane's `getMemberFromSession()`. There is no
`Staff` or `Manager` model in `prisma/schema.prisma`.

Rules:

- `approverRole: "owner"` resolves to the authenticated `User` who owns the run's
  `Profile`.
- `approverRole: "manager"` or `"staff"` **fails closed**: it escalates to the owner and
  records an `AuditEvent` noting the substitution. It is never treated as satisfied by
  absence of a staff record, and the copilot never downgrades a gate it cannot route.
- The requester cannot be the approver. `actor` `copilot:<runId>` can never appear as a
  decider.
- A decision applies to exactly one step attempt in one run. There is no blanket
  pre-approval, no "approve all", and no remembered consent across runs in this phase.
- Requests expire (**PROPOSED** 24h for money and outbound classes, 72h otherwise) and the
  run becomes `expired` with an audit entry. Silence is not approval.
- The `reason` from the snapshot is displayed verbatim to the approver together with the
  concrete diff or payload the step will execute. ENGINE_CONTRACTS makes a reasonless
  approval request invalid, and `validateBusinessBlueprint` now enforces this: a required
  approval whose `reason` is empty or whitespace produces the issue
  `workflows.N.actions.M.approval.reason`, so the registry throws at load rather than
  serving a gate the approver cannot understand. The negative case is asserted in
  `scripts/one-off/check-business-os-surface.ts`.

## 4. Audit surface

### 4.1 Built on the committed type

```ts
// src/lib/business-os/types.ts
export type AuditEvent = {
  id: string
  at: string
  actor: string
  action: string
  subject: string
  metadata?: Record<string, unknown>
}
```

`planWorkflowRun` already synthesizes these for any action where
`kind === "recordAudit" || action.auditSubject`, with
`id = ${workflow.id}:${action.id}:${timestamp}`, `action = action.kind`,
`subject = action.auditSubject ?? action.label`, and
`metadata = { workflowId, actionId }`. Those objects are returned in the plan and then
dropped — nothing persists them. The audit surface is that shape, written down.

### 4.2 Tightening required before it is a trail

- **`id`** must be unique per attempt, not per millisecond. Use
  `${runId}:${stepId}:${attempt}` (**PROPOSED**); the plan-time id collides if the same
  action is planned twice inside one timestamp.
- **`actor`** must be a resolvable principal, not a display name:
  `user:<userId>` | `copilot:<runId>` | `system:reconciler` | `system:scheduler`.
- **`subject`** must be a stable reference, since the type allows any string. Use
  `<engineId>:<entity>:<id>`, e.g. `venueOrders:order:<orderId>`, so the trail can be
  filtered by the thing it happened to. Free-text labels stay in `metadata`.
- **`metadata`** always carries `runId`, `blueprintId`, `blueprintVersion`, and for
  workflow-derived steps `workflowId` and `actionId`.

### 4.3 What must be audited

Every tool call attempt and its outcome; every run and step state transition with `from`
and `to`; every approval request, decision, substitution and expiry; every `handoffToOwner`
with its reason; every failure with its error class; every reconciler resume; and the
blueprint id and version in force. Reads are audited at the summary level (which data
scopes a run touched) rather than row by row.

### 4.4 Properties

Append-only. No updates, no deletes. A correction or redaction is a new event that
supersedes an earlier one; the original row is never rewritten. Written in the same
transaction as the change it describes, published after commit (ENGINE_CONTRACTS rules 4
and 5). Secrets, access tokens, `User.clerkId` and full payment identifiers are never
written into `metadata`; arguments are redacted before persistence.

### 4.5 Read surface

Owner-visible timeline on `/dashboard/business-os`, filterable by run and by `subject`,
plus **PROPOSED** routes `GET /api/business-os/runs`,
`GET /api/business-os/runs/[runId]`, and
`POST /api/business-os/runs/[runId]/approvals/[approvalId]`. All use the existing ADR-006
envelope (`businessOsJson`, `businessOsError`) and the existing
`BusinessOsErrorCode` map in `src/lib/business-os/api/responses.ts`, which already includes
`UNAUTHORIZED → 401`. Every route calls `syncUser()` first and scopes by `profileId`, the
pattern already used by `src/app/api/business-os/blueprints/route.ts`.

## 5. Tool and permission boundary

### 5.1 Authorization

Every owner-plane request goes through the shared `requireBusinessOsAccess` guard in
`src/lib/business-os/api/guard.ts`, which returns two distinct failures rather than
collapsing them: `syncUser()` yielding no user is `UNAUTHORIZED`/401, and an authenticated
user whose active profile lacks the surface is `FORBIDDEN`/403. A user with no profile at all
is also `FORBIDDEN`. The target `profileId` must belong to that user, and
`hasSurface(role, "businessOs", extras)` must be true. No cookie-only identity, no `pl_vid`,
no IP-keyed rate limit as an authorization
substitute. Per-profile rate and cost limits still apply, but as budget control.

### 5.2 May read (all filtered by `profileId`)

`Profile` and its configuration, `ServiceOffering`, `Booking`, `AvailabilitySchedule`,
`CalendarOverride`, `DigitalProduct`, `Course`/`CourseModule`/`CourseLesson`/
`CourseEnrollment`/`LessonCompletion`, `Event`/`EventRegistration`,
`Community`/`CommunityMember`, `LeadMagnet`/`LeadMagnetSubmission`,
`Conversation`/`Message` (the owner's own inbox), `VisitorLead`,
`Order`/`OrderLine`/`OrderEvent`/`RestaurantTable`/`OrderCounter`, `Payment`,
`ProductPurchase`, `OfferReview`, `ProfileEvent`, `Notification` for that owner,
`ShortLink`, `ProfileImage`, and its own ledger rows.

### 5.3 May never read

Rows belonging to another `Profile` or `User`; `User.clerkId` or any auth material;
`MemberSession` tokens; `AdminSettings`; environment variables and provider keys. Cross-
profile aggregates, even anonymised, are out of scope.

### 5.4 May mutate directly

Only its own ledger tables (§2.5, proposed) and `Notification` rows addressed to the
owner's own `User`. That is the entire direct-write set.

### 5.5 Everything else goes through the owning engine

ENGINE_CONTRACTS rule 1 is one writer per fact: an engine owns its tables and another
component reads through an exported function and never writes rows it does not own. The
copilot is bound by that rule with no exception.

Worked example, the reference engine. To advance an order the copilot calls the
`venueOrders` engine's exported transition function, which enforces
`assertOrderTransition` / `assertOrderLineTransition` (`src/lib/restaurant-orders.ts`),
appends the `OrderEvent` row in the same transaction, and publishes after commit through
`publish()` in `src/lib/realtime.ts`. The copilot does not call
`prisma.order.update`, does not write `OrderEvent`, and does not touch `OrderCounter`.
Likewise a booking goes through `createBooking` / `getAvailableSlots` in
`src/app/actions/bookings.ts` — the same functions the persona plane's `bookTable` tool
uses — so availability and capacity rules are enforced in one place. Restaurant and order
paths are owner-reviewed under OWNERSHIP.md, so where an engine function does not yet
exist the copilot's tool is **not implemented** and the capability is unavailable; it is
never worked around with a direct write.

Money is computed server-side (rule 3). The copilot never supplies a price, total or tax.
A discount is proposed as an approval-gated request whose amount the engine recomputes from
authoritative records before applying.

Idempotency is a first-class input (rule 6). Every effectful tool signature takes an
idempotency key and returns the original result on replay.

### 5.6 The tool manifest is derived, never hardcoded

Allowed tools for a run =
`intersection(capabilities declared by the active blueprint's engines[], surfaces enabled
for the profile, permissions of the acting principal)`, then default-deny. This mirrors the
persona plane's `allowedTools` filter in `src/app/api/chat/route.ts` but keys on
`BlueprintEngineComposition.capabilities` (validated against
`businessEngineDescriptors` by `validateBusinessBlueprint`) instead of role KITs. Two
consequences: a blueprint that does not compose `commerce` yields no commerce tools even if
the tables hold data; and the allowlist is computed *before* the prompt is assembled, so no
text in a prompt or a document can widen it.

## 6. Blueprint `ownerCopilotPrompts`

`BusinessBlueprint.ownerCopilotPrompts: string[]` is the blueprint's prompt bundle. Live
examples from `src/lib/business-os/blueprints.ts`: `restaurant-venue-v1` (`status:
"active"`) carries "Which open orders have been waiting longest?" and "What did each table
spend today?"; `coaching-studio-v1` and `consulting-agency-v1` are `draft`.

Consumption contract:

1. **Suggestions, not instructions.** They are blueprint-authored data rendered as
   starting questions. They are never concatenated into the system prompt and never carry
   authority. When a prompt is used it enters the run as the first *user* message.
2. **Status gates exposure.** Only a blueprint with `status: "active"` may seed a live
   profile; `draft` is never served (ENGINE_CONTRACTS). `deprecated` prompts remain
   readable on historical runs but are not offered.
3. **Current rendering.** `src/components/business-os/business-os-shell.tsx` (~line 186)
   already lists them, as static `<span>` labels. Making each one a click that starts a run
   is **PROPOSED**.
4. **Provenance.** A run records `blueprintId`, `blueprint.version` and the prompt index,
   so a later prompt-bundle edit does not rewrite the history of what was asked, and an
   in-flight run is not migrated (ADR-005).
5. **App-authored system prompt.** The owner-plane system prompt is built by **PROPOSED**
   `buildOwnerCopilotPrompt` in `src/lib/business-os/copilot/prompt.ts` from the engine and
   capability inventory (`listBusinessEngines`, `businessEngineDescriptors`), the gate
   summary from `listApprovalGates(blueprint.workflows)`, the data scope of §5.2, and the
   escalation rules of §7. It contains no persona or marketing framing and does not reuse
   `buildSystemPrompt` from `src/lib/rag.ts`.
6. **Untrusted-text handling.** Prompt strings, blueprint summaries and any retrieved
   document content are delimited and labelled as data. Instruction-shaped content inside
   them is ignored, and it cannot in any case reach a tool that the pre-computed allowlist
   excludes.

## 7. Failure and escalation

### 7.1 Error classes

| Class | Examples | Behaviour |
|---|---|---|
| Transient | provider timeout, 429, connection reset, lease lost | bounded retry with jitter (**PROPOSED** 3 attempts per step), then escalate |
| Permanent | validation failure, illegal transition rejected by `assertOrderTransition`, unknown capability | no retry; step `failed`; audit; escalate |
| Authorization | surface missing, profile mismatch, tool not in the allowlist | fail closed, no retry, audit, no partial effect |
| Approval declined | owner said no | step `rejected`; dependent steps `skipped`; run `handoff` or `cancelled` |
| Approval expired | TTL elapsed with no decision | run `expired`; audit |
| Budget | step, token or cost budget exhausted | run `handoff` with what remains |

### 7.2 Escalation ladder

Retry (transient only) → ask the owner for missing data (`awaiting_input`) → request
approval (`awaiting_approval`) → `handoffToOwner` → `failed`. The copilot never widens its
own permissions, never substitutes a different tool for a denied one, and never partially
completes a gated step to "make progress".

### 7.3 `handoffToOwner`

A first-class `WorkflowActionKind`, and also the runtime's escape hatch. Triggered when:

- a blueprint workflow declares a `handoffToOwner` action;
- two consecutive attempts fail with a permanent class;
- an approval is declined or expires;
- the task needs a tool outside the allowlist, or a capability with no engine function;
- required data is still missing after asking the owner once;
- a budget is exhausted mid-run.

Behaviour: transition the run to `handoff`; persist the reason, the completed and skipped
steps, and the suggested next action; write an `AuditEvent` with `action:
"handoffToOwner"` and the subject the work concerned; create a `Notification` row for the
owner's `User` (**PROPOSED** `type: "copilot_handoff"`, `href` to the run) — that model
already exists and is indexed `[userId, readAt]`. A handoff never messages a customer, and
never touches `Conversation.mode`: `LIVE` / `LIVE_REQUESTED` in
`src/app/api/chat/route.ts` is the persona plane's customer-side escalation and belongs to
that plane alone. A `handoff` run is resumable by the owner and is not garbage-collected by
the reconciler.

### 7.4 Failure is loud

No silent partial success. Every terminal run renders a summary listing what completed,
what was skipped and why, and what the owner must decide. A run that ends `failed`,
`expired` or `handoff` says so in the UI with the same prominence as a success.

## 8. Non-goals

1. **Not a customer-facing assistant.** It never renders on a public profile, never
   answers a visitor, and does not replace or extend `/api/chat`.
2. **Not autonomous.** No spend, no customer message, no publish, no bulk or irreversible
   mutation without an approval gate. ADR-001: permissioned and auditable, not autonomous.
3. **Not a seventh engine.** It owns no domain tables beyond its ledger and forks no engine
   logic — in particular it does not reimplement any part of the restaurant/venue-orders
   reference implementation.
4. **Not a scheduler.** `WorkflowTrigger.kind: "schedule"` is declarable and unexecuted;
   `manual` and `event` triggers only, until a scheduler is specified.
5. **Not staff RBAC.** `manager` and `staff` approvers are unroutable with today's identity
   model and fail closed to the owner. Per-field masking and delegated permissions are out
   of scope.
6. **Not a schema owner.** This spec proposes models; it does not edit
   `prisma/schema.prisma`, create migrations, or run any database command.
7. **Not analytics.** It reads live operational tables. No warehouse, no aggregation store,
   no cross-profile benchmarking.
8. **Not a provider-managed agent.** Provider-side background execution or session state is
   never the source of truth for run state (ADR-004).
9. **Not an owner of orchestration files.** It does not write `TASKS.json`, `RUNLOG.md`,
   `LIVE_ACTIVITY.md`, `MONITOR_STATUS.md` or any other ledger under
   `docs/orchestration/**`.
10. **Not multi-profile.** One run is scoped to exactly one `Profile`.

## 9. Open dependencies

| Item | Blocks | Owner |
|---|---|---|
| Ledger migration (§2.5) | every durable, gated, or multi-step behaviour | profile owner — `prisma/**` is owner-reviewed |
| Engine-exported write functions per capability | each effectful tool; absent function means absent tool (§5.5) | per-engine, restaurant paths owner-reviewed |
| Scheduler | `schedule` triggers | out of Phase 0 |

Closed since the first draft: P1-002 surface registration is done and the navigation entry
exists; approval `reason` validation is implemented and enforced at load.

## 10. Grounding

Read for this spec: `docs/orchestration/PROGRAM.md`, `DECISIONS.md`,
`ENGINE_CONTRACTS.md`, `OWNERSHIP.md`, `TASKS.json`;
`src/lib/business-os/{types,workflow,engines,blueprints,validation,index}.ts`,
`src/lib/business-os/api/{responses,serialize}.ts`,
`src/lib/business-os/contracts/errors.ts`,
`src/app/api/business-os/blueprints/route.ts` and `.../[blueprintId]/route.ts`,
`src/app/dashboard/business-os/page.tsx`,
`src/components/business-os/business-os-shell.tsx`, `src/lib/surfaces.ts`,
`src/lib/require-surface.ts`, `src/lib/auth-sync.ts`, `src/lib/realtime.ts`,
`src/lib/restaurant-orders.ts`, `prisma/schema.prisma` (model inventory only);
and in the primary checkout `src/app/api/chat/route.ts` and `src/lib/rag.ts`.

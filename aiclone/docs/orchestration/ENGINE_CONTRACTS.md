# Shared Engine Contracts

Updated: 2026-08-27 07:20 +05:30

Canonical contract for the six operating engines and for the blueprints that compose
them. Ratified by ADR-005. `P1-001` implements this; the draft in the `core` lane
(`src/lib/business-os/`) already matches it and is the accepted starting point.

## Why engines rather than industry forks

`src/lib/surfaces.ts` is the lightweight ancestor of this idea: a role picks a `KIT` of
surfaces and field packs. It works, but it only toggles visibility. An engine owns
behaviour — state, transitions, invariants, and events — so several verticals can share
one implementation instead of forking per industry.

The restaurant order work is the reference implementation of one engine. `Order`,
`OrderLine`, `OrderEvent`, `OrderCounter`, and `RestaurantTable`, with a serializable
transaction, snapshotted prices, a daily counter, and an append-only event log, is what
"venue and orders" means concretely. Other engines should be judged against that bar.

## Engine identifiers

Stable ids. Never rename; deprecate instead.

| Id | Label | Owns |
|---|---|---|
| `commerce` | Commerce | catalog, variants, inventory, cart, order, payment, fulfilment, return |
| `appointments` | Appointments | services, staff, resources, availability, deposits, reminders, waitlist, no-show recovery |
| `contentCohorts` | Content and cohorts | courses, batches, lessons, attendance, assignments, progress, certificates, memberships |
| `venueOrders` | Venue and orders | tables, rooms, seats, reservations, QR ordering, live queues, status history, guest tracking |
| `fieldJobs` | Field jobs | intake, quote, technician, route, asset, job card, parts, inspection, invoice |
| `casesProjects` | Cases and projects | lead, brief, documents, milestones, tasks, approvals, deliverables, billing |

Each engine exposes an `EngineDescriptor` with an id, a label, a description, and a list
of `EngineCapability` entries. Capability ids are stable within an engine and are what a
blueprint references.

## Engine boundaries

These are the rules that keep engines shareable.

1. **One writer per fact.** An engine owns its tables. Another engine reads through an
   exported function, never by writing rows it does not own.
2. **State transitions are explicit and guarded.** Legal transitions are declared and
   illegal ones are rejected at the boundary, not trusted from the caller. The restaurant
   `assertOrderTransition` and `assertOrderLineTransition` helpers are the pattern.
3. **Money is computed server-side.** Prices, modifiers, and totals are recalculated from
   authoritative records and snapshotted onto the line. A client never supplies a price.
4. **Every consequential change appends an event.** Events carry `kind`, `from`, `to`,
   `actor`, and a monotonic sequence, and are written in the same transaction as the
   change. Live transport and audit both read from that log.
5. **Publish after commit.** Fan-out happens once the transaction returns, so a
   rolled-back write can never be broadcast. See `src/lib/realtime.ts`.
6. **Idempotency is a first-class input.** Any externally triggered write takes an
   idempotency key and returns the original result on replay rather than duplicating.

## Blueprint composition

A blueprint is a versioned, validated composition. It configures engines; it does not
contain business logic.

```
BusinessBlueprint {
  id, version, status: draft | active | deprecated
  name, vertical, summary
  engines:   [{ engineId, capabilities[], required }]
  workflows: [{ id, name, trigger, actions[] }]
  ownerCopilotPrompts: string[]
}
```

- `engines[].capabilities` must reference capability ids that the named engine actually
  declares. Validation rejects unknown ids rather than ignoring them.
- `status` gates exposure: `draft` is never served to a live profile.
- `version` is explicit so an active tenant is not silently migrated.

## Workflows, approvals, audit

A workflow is a trigger plus an ordered list of actions.

- Triggers are `manual`, `event`, or `schedule`. An `event` trigger names an engine event.
- Action kinds are `createTask`, `sendNotification`, `requestApproval`, `recordAudit`, and
  `handoffToOwner`.
- `requestApproval` carries an `ApprovalPolicy` with `required`, `approverRole`, and a
  human-readable `reason`. The reason is shown to the approver; an approval request
  without a reason is invalid.
- Anything that spends money, messages a customer, or changes a published surface requires
  an approval gate or an audit record. Per ADR-001 the owner copilot is permissioned and
  auditable, not autonomous.

## Validation

Blueprints are validated at load, not at first use, so a malformed blueprint fails fast
in one obvious place. Validation returns a `ValidationResult` of `{ ok, issues[] }` where
each issue carries a `path` and a `message`; the registry asserts on load.

## Relationship to `surfaces.ts`

`surfaces.ts` stays the runtime visibility model for now. A blueprint eventually derives
the surface and pack set instead of duplicating it. Until `P1-002` is approved,
`business-os` is not a registered `Surface`, so its dashboard page is reachable only by
direct URL and is not role-gated. That is a known gap, not a design choice.

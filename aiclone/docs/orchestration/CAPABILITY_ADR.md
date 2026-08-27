# Capability and blueprint contract ADR

Status: accepted for P1-010 (ADR-012/013/014)

## Decision

Business OS capabilities are independently selectable IDs scoped by engine. Existing IDs remain stable, while `deposits`, `waitlist`, `documents`, `variants`, `fulfilment`, and `returns` are added as first-class IDs rather than being hidden inside broad category descriptions.

Every capability descriptor declares one maturity value:

- `planned`: no implemented product behavior; evidence is `none`.
- `partial`: some behavior exists, but the complete engine contract is not shipped; evidence cites its code path or harness.
- `available`: shipped behavior can satisfy an active required blueprint slot; evidence cites its code path or harness.

An active blueprint is invalid when a required selected capability is `planned` or `partial`. Draft and proposed blueprints may compose capabilities before they become available. `plannedCapabilities` records a backlog but does not make those capabilities executable.

## Restaurant correction

`restaurant-venue-v1` remains addressable as deprecated history. It is not rewritten to imply missing functionality exists.

`restaurant-venue-v2` is the active `2.0.0` contract:

- `venueOrders` required: `qrOrdering`, `guestTracking`
- `commerce` required: `catalog`, `orders`
- planned backlog: `venueOrders:reservations`, `commerce:inventory`

The v2 contract links to v1 through `supersedes`. No restaurant runtime or database schema was changed.

## Compatibility

The change is additive at the exported contract boundary: all prior engine IDs, capability IDs, descriptor fields, blueprint fields, functions, and exports remain. New fields and enum members are appended; `plannedCapabilities` and `supersedes` are optional so existing consumers remain source-compatible. The historical restaurant blueprint keeps its ID and content and changes only from active to deprecated so the corrected v2 can be the truthful active contract.

## Verification

`scripts/one-off/check-capability-contract.ts` proves granular IDs exist, every descriptor carries valid maturity/evidence, both restaurant versions remain addressable, v2 has the exact active and planned sets, and an active blueprint requiring planned `venueOrders:reservations` fails validation while the same draft blueprint passes.

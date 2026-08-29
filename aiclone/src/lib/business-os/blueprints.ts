import type { BusinessBlueprint } from "./types"
import { assertValidBusinessBlueprint } from "./validation"

const restaurantWorkflows: BusinessBlueprint["workflows"] = [
  {
    id: "order-placed",
    name: "Order placed",
    trigger: { kind: "event", event: "order.created" },
    actions: [
      { id: "notify-kitchen", kind: "sendNotification", label: "Notify the kitchen board" },
      { id: "audit-order", kind: "recordAudit", label: "Record order status history", auditSubject: "order" },
    ],
  },
  {
    id: "order-paid",
    name: "Order paid",
    trigger: { kind: "event", event: "order.paid" },
    actions: [
      { id: "audit-payment", kind: "recordAudit", label: "Record payment state", auditSubject: "payment" },
    ],
  },
]

const restaurantOwnerCopilotPrompts = [
  "Which open orders have been waiting longest?",
  "What did each table spend today?",
]

const coachingWorkflows: BusinessBlueprint["workflows"] = [
  {
    id: "new-lead-intake",
    name: "New lead intake",
    trigger: { kind: "event", event: "lead.created" },
    actions: [
      { id: "create-follow-up", kind: "createTask", label: "Create owner follow-up task" },
      {
        id: "owner-approval",
        kind: "requestApproval",
        label: "Approve program recommendation",
        approval: { required: true, approverRole: "owner", reason: "Lead receives personalized program guidance." },
      },
      { id: "audit-lead", kind: "recordAudit", label: "Record lead workflow", auditSubject: "lead" },
    ],
  },
]

const coachingOwnerCopilotPrompts = [
  "Which leads need a human follow-up today?",
  "Summarize cohort attendance risk and suggested interventions.",
]

const builtInBlueprints: BusinessBlueprint[] = [
  {
    // Historical contract retained for addressability. Deprecated in Wave E because it
    // REQUIRED appointments:reminders, which is still only partial: a reminder record is
    // persisted and scheduled, but no messaging provider is wired, so nothing is sent.
    // Superseded by coaching-studio-v2, which claims only what exists.
    id: "coaching-studio-v1",
    version: "1.0.0",
    status: "deprecated",
    name: "Coaching Studio",
    vertical: "coaching-training",
    summary: "Runs paid programs with cohorts, appointments, light commerce, and owner approval gates.",
    engines: [
      { engineId: "contentCohorts", capabilities: ["courses", "cohorts", "memberships"], required: true },
      { engineId: "appointments", capabilities: ["services", "availability", "reminders"], required: true },
      { engineId: "commerce", capabilities: ["catalog", "orders"], required: false },
    ],
    workflows: coachingWorkflows,
    ownerCopilotPrompts: coachingOwnerCopilotPrompts,
  },
  {
    id: "coaching-studio-v2",
    version: "2.0.0",
    status: "active",
    name: "Coaching Studio",
    vertical: "coaching-training",
    summary:
      "Runs paid programs as dated cohorts with attendance, assignments, derived progress, certificates and renewal tracking, plus bookable sessions and owner approval gates.",
    engines: [
      {
        engineId: "contentCohorts",
        // All three became genuinely available in Wave D: courses/modules/lessons were
        // already persisted, cohorts added dated runs with capacity, sessions,
        // attendance, assignments and progress DERIVED from LessonCompletion, and
        // memberships added renewal state and certificate eligibility and issuance.
        capabilities: ["courses", "cohorts", "memberships"],
        required: true,
        // Tiered content gating is not built, so it is named rather than implied.
        plannedCapabilities: ["accessLevels"],
      },
      {
        engineId: "appointments",
        // services and availability became available in Wave B with real capacity and
        // overlap refusal against persisted resources.
        capabilities: ["services", "availability"],
        required: true,
        // reminders and deposits stay PLANNED here even though their records exist,
        // because their provider boundaries are inert. A blueprint that required them
        // would be promising delivery and payment that do not happen.
        plannedCapabilities: ["reminders", "deposits"],
      },
      { engineId: "commerce", capabilities: ["catalog", "orders"], required: false },
    ],
    workflows: coachingWorkflows,
    ownerCopilotPrompts: coachingOwnerCopilotPrompts,
    supersedes: "coaching-studio-v1",
  },
  {
    id: "consulting-agency-v1",
    version: "1.0.0",
    // Activated in Wave E. Every capability it already claimed became genuinely
    // available in Wave C, so the contract did not need rewriting - only the status
    // caught up with reality. pipeline is intake, qualification, brief and conversion;
    // delivery is milestones, TaskJob-backed tasks, Approval-backed sign-off and
    // approval-gated deliverables; billing is invoice records, case billing state and
    // Payment linkage.
    status: "active",
    name: "Consulting Agency",
    vertical: "consultants-agencies",
    summary: "Manages lead briefs, delivery milestones, approvals, retainers, and client handoffs.",
    engines: [
      {
        engineId: "casesProjects",
        capabilities: ["pipeline", "delivery", "billing"],
        required: true,
        // Retainer drawdown is not built, so it is named rather than implied by the
        // billing capability.
        plannedCapabilities: ["retainers"],
      },
      { engineId: "appointments", capabilities: ["services", "availability"], required: false },
    ],
    workflows: [
      {
        id: "proposal-ready",
        name: "Proposal ready",
        trigger: { kind: "event", event: "case.proposal_ready" },
        actions: [
          {
            id: "approve-proposal",
            kind: "requestApproval",
            label: "Approve client proposal",
            approval: { required: true, approverRole: "owner", reason: "Proposal terms and price need owner confirmation." },
          },
          { id: "notify-owner", kind: "sendNotification", label: "Notify owner" },
          { id: "audit-proposal", kind: "recordAudit", label: "Record proposal approval state", auditSubject: "proposal" },
        ],
      },
    ],
    ownerCopilotPrompts: [
      "Which projects are blocked on client approval?",
      "What revenue is at risk this week?",
    ],
  },
  {
    // New in Wave E. A CA or accounting practice is the vertical the cases engine fits
    // most exactly, because its core loop IS the document request: ask the client for a
    // record, refuse to mark it received without the actual file, gate the filing on an
    // approval, then invoice. All four required capabilities are available.
    id: "ca-practice-v1",
    version: "1.0.0",
    status: "active",
    name: "CA and accounting practice",
    vertical: "ca-accounting",
    summary:
      "Runs client engagements as cases: intake and scope brief, document requests that cannot be closed without the actual file, filing milestones, partner approval before anything is filed, and invoicing.",
    engines: [
      {
        engineId: "casesProjects",
        capabilities: ["pipeline", "delivery", "billing", "documents"],
        required: true,
        plannedCapabilities: ["retainers"],
      },
    ],
    workflows: [
      {
        id: "document-requested",
        name: "Document requested",
        trigger: { kind: "event", event: "case.document_requested" },
        actions: [
          { id: "chase-document", kind: "createTask", label: "Create client chase task" },
          { id: "audit-request", kind: "recordAudit", label: "Record document request state", auditSubject: "document" },
        ],
      },
      {
        id: "filing-ready",
        name: "Filing ready",
        trigger: { kind: "event", event: "case.filing_ready" },
        actions: [
          {
            id: "approve-filing",
            kind: "requestApproval",
            label: "Partner sign-off before filing",
            approval: {
              required: true,
              approverRole: "owner",
              reason: "A filing is externally visible and cannot be quietly withdrawn.",
            },
          },
          { id: "audit-filing", kind: "recordAudit", label: "Record filing approval state", auditSubject: "filing" },
        ],
      },
    ],
    ownerCopilotPrompts: [
      "Which client documents are still outstanding and how overdue are they?",
      "Which filings are waiting on partner sign-off?",
    ],
  },
  {
    // ACTIVE as of Wave G, and only because the three capabilities that were blocking it
    // stopped being aspirational. Wave F made commerce:inventory real (stock per product
    // per location, an append-only ledger, reservations with a database-level oversell
    // guard). Wave G made commerce:variants, :fulfilment and :returns real: variants own
    // stock and SKUs, shipments carry guarded transitions and partial quantities, and a
    // return can be requested, decided, received and restocked idempotently. All six
    // required capabilities are therefore "available" with an evidence file that exists,
    // which is what validateBusinessBlueprint enforces - activation here is a consequence
    // of that check passing, not a decision taken in this file.
    //
    // What this blueprint still does NOT claim: no carrier is contacted, so tracking is
    // owner-entered text; no refund is executed, only referenced; no email, SMS or
    // WhatsApp is sent. Those remain outside the blueprint rather than being implied by
    // the word "storefront".
    id: "retail-storefront-v1",
    version: "1.0.0",
    status: "active",
    name: "Retail storefront",
    vertical: "retail-ecommerce",
    summary:
      "Sells physical stock online. Catalog, orders, inventory, variants, fulfilment and returns are all executable: stock is held per variant per location, shipments can be partial, and an accepted return restocks once. Carrier tracking is owner-entered and refunds are referenced rather than executed, so nothing here claims an integration that does not exist.",
    engines: [
      {
        engineId: "commerce",
        capabilities: ["catalog", "orders", "inventory", "variants", "fulfilment", "returns"],
        required: true,
      },
    ],
    workflows: [
      {
        id: "order-placed",
        name: "Order placed",
        trigger: { kind: "event", event: "order.created" },
        actions: [
          { id: "audit-order", kind: "recordAudit", label: "Record order status history", auditSubject: "order" },
        ],
      },
    ],
    ownerCopilotPrompts: [
      "Which products are close to running out?",
      "Which orders are unfulfilled and how old are they?",
    ],
  },
  {
    // Historical contract retained for addressability. It is deprecated because it
    // claimed reservations and real inventory before either capability was available.
    id: "restaurant-venue-v1",
    version: "1.0.0",
    status: "deprecated",
    name: "Restaurant and cloud kitchen",
    vertical: "restaurant-cloud-kitchen",
    summary: "QR dine-in and takeaway ordering with a live service queue, guest status history, and payment capture.",
    engines: [
      { engineId: "venueOrders", capabilities: ["reservations", "qrOrdering", "guestTracking"], required: true },
      { engineId: "commerce", capabilities: ["catalog", "inventory", "orders"], required: true },
    ],
    workflows: restaurantWorkflows,
    ownerCopilotPrompts: restaurantOwnerCopilotPrompts,
  },
  {
    // Superseded by v3. Deprecated in Wave F, not because anything it claimed was
    // false, but because it listed inventory in the planned backlog - and inventory is
    // now real, so that backlog entry became a false statement about the product.
    id: "restaurant-venue-v2",
    version: "2.0.0",
    status: "deprecated",
    name: "Restaurant and cloud kitchen",
    vertical: "restaurant-cloud-kitchen",
    summary: "QR dine-in and takeaway ordering with a live service queue, guest status history, and payment capture.",
    engines: [
      {
        engineId: "venueOrders",
        capabilities: ["qrOrdering", "guestTracking", "reservations"],
        required: true,
      },
      {
        engineId: "commerce",
        capabilities: ["catalog", "orders"],
        required: true,
        plannedCapabilities: ["inventory"],
      },
    ],
    workflows: restaurantWorkflows,
    ownerCopilotPrompts: restaurantOwnerCopilotPrompts,
    supersedes: "restaurant-venue-v1",
  },
  {
    // v1 always REQUIRED commerce:inventory; v2 had to demote it to a planned backlog
    // item because it was a single nullable stock column. Wave F built it properly, so
    // v3 restores the original intent rather than leaving the claim parked in a backlog.
    // Stock per product per location, an append-only movement ledger, and a
    // database-level oversell guard are exactly what a kitchen needs to say "we are out
    // of that" truthfully.
    id: "restaurant-venue-v3",
    version: "3.0.0",
    status: "active",
    name: "Restaurant and cloud kitchen",
    vertical: "restaurant-cloud-kitchen",
    summary:
      "QR dine-in and takeaway ordering with a live service queue, guest status history, table reservations, payment capture, and real stock control with reservations that cannot oversell.",
    engines: [
      {
        engineId: "venueOrders",
        capabilities: ["qrOrdering", "guestTracking", "reservations"],
        required: true,
      },
      {
        engineId: "commerce",
        capabilities: ["catalog", "orders", "inventory"],
        required: true,
        // Variants, fulfilment and returns are a retail concern, not a kitchen one, so
        // they are not named here at all rather than parked in this blueprint's backlog.
      },
    ],
    workflows: restaurantWorkflows,
    ownerCopilotPrompts: restaurantOwnerCopilotPrompts,
    supersedes: "restaurant-venue-v2",
  },
]

/**
 * Built-in blueprint templates. Static and non-tenant: these ship with the product and
 * are not owner-authored configuration. Each is validated at module load, so a malformed
 * template fails the build rather than reaching a request.
 */
export const businessBlueprintRegistry = builtInBlueprints.map(assertValidBusinessBlueprint)

const duplicateBlueprintIds = businessBlueprintRegistry
  .map((blueprint) => blueprint.id)
  .filter((id, index, all) => all.indexOf(id) !== index)

if (duplicateBlueprintIds.length > 0) {
  // getBusinessBlueprint resolves by find(), so a duplicate id would silently shadow.
  throw new Error(`Duplicate business blueprint ids: ${[...new Set(duplicateBlueprintIds)].join(", ")}`)
}

export function listBusinessBlueprints() {
  return businessBlueprintRegistry
}

export function getBusinessBlueprint(id: string) {
  return businessBlueprintRegistry.find((blueprint) => blueprint.id === id) ?? null
}

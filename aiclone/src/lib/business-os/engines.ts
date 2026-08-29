import type { BusinessEngineId, EngineDescriptor } from "./types"

export const businessEngineDescriptors: Record<BusinessEngineId, EngineDescriptor> = {
  commerce: {
    id: "commerce",
    label: "Commerce",
    description: "Catalog, inventory, checkout, orders, fulfilment, and returns.",
    capabilities: [
      {
        id: "catalog",
        label: "Catalog",
        description: "Products, variants, pricing, and media.",
        maturity: "available",
        evidence: "src/app/actions/products.ts",
      },
      {
        id: "inventory",
        label: "Inventory",
        description:
          "Stock per product per location, an append-only movement ledger, and reservations that make overselling impossible: on-hand and reserved are separate balances, and reserved <= onHand is a database CHECK constraint, not a convention.",
        maturity: "available",
        evidence: "src/lib/inventory/engine.ts",
      },
      {
        id: "orders",
        label: "Orders",
        description: "Cart, checkout, payment, fulfilment, and returns.",
        maturity: "available",
        evidence: "src/app/actions/orders.ts",
      },
      {
        id: "variants",
        label: "Variants",
        description:
          "Independently sellable variants of a product, with option sets, ordinals, per-variant SKU and optional per-variant price. A variant with no price inherits the product price rather than copying it, so a product price change is not silently forked. Every pre-existing product resolves through one deterministic default variant (var_<productId>), stock is held against the variant rather than the product, and a partial unique index enforces one default per product in the database.",
        maturity: "available",
        evidence: "src/lib/commerce/variants.ts",
      },
      {
        id: "fulfilment",
        label: "Fulfilment",
        description:
          "Shipments against an order, including partial shipments, guarded state transitions, and owner-entered carrier and tracking metadata. No carrier is contacted: tracking is whatever the owner types. Stock leaves at SHIPPED by consuming the existing inventory hold, not at pack time, and a shipped shipment cannot be cancelled.",
        maturity: "available",
        evidence: "src/lib/commerce/fulfilment.ts",
      },
      {
        id: "returns",
        label: "Returns",
        description:
          "Return requests, approval, rejection and item receipt, with eligibility derived from what has actually shipped or been delivered minus what a live return already claims. Restock is idempotent per return item via a stored movement id, so replaying a receipt does not double-count stock. No refund is executed here; a refund payment is only referenced.",
        maturity: "available",
        evidence: "src/lib/commerce/returns.ts",
      },
    ],
  },
  appointments: {
    id: "appointments",
    label: "Appointments",
    description: "Services, staff, availability, deposits, reminders, waitlists, and no-show recovery.",
    capabilities: [
      {
        id: "services",
        label: "Services",
        description: "Bookable offerings, durations, and intake questions.",
        maturity: "available",
        evidence: "src/lib/appointments/engine.ts",
      },
      {
        id: "availability",
        label: "Availability",
        description: "Staff, resources, calendars, and capacity windows.",
        maturity: "available",
        evidence: "src/lib/appointments/engine.ts",
      },
      {
        id: "reminders",
        label: "Reminders",
        description:
          "Confirmation, reminder, and recovery records with their own state machine. PARTIAL on purpose: a reminder is persisted and scheduled, but no messaging provider is wired, so nothing is actually delivered.",
        maturity: "partial",
        evidence: "src/lib/appointments/services.ts",
      },
      {
        id: "deposits",
        label: "Deposits",
        description:
          "Up-front payment requirements attached to a booking. PARTIAL on purpose: the deposit record and its state machine are persisted, but no payment provider is wired, so no money moves.",
        maturity: "partial",
        evidence: "src/lib/appointments/services.ts",
      },
      {
        id: "waitlist",
        label: "Waitlist",
        description: "Demand queues and promotion into newly available appointment slots.",
        maturity: "available",
        evidence: "src/lib/appointments/services.ts",
      },
    ],
  },
  contentCohorts: {
    id: "contentCohorts",
    label: "Content and cohorts",
    description: "Courses, batches, lessons, progress, certificates, and memberships.",
    capabilities: [
      {
        id: "courses",
        label: "Courses",
        description: "Curriculum, modules, lessons, and per-lesson completion.",
        maturity: "available",
        evidence: "src/app/actions/courses.ts",
      },
      {
        id: "cohorts",
        label: "Cohorts",
        description:
          "Dated runs of a course with capacity, sessions, attendance, assignments, submissions and derived learner progress.",
        maturity: "available",
        evidence: "src/lib/cohorts/engine.ts",
      },
      {
        id: "memberships",
        label: "Memberships",
        description:
          "Cohort membership lifecycle, renewal and reminder state, and certificate eligibility and issuance. Access levels are tracked separately as accessLevels.",
        maturity: "available",
        evidence: "src/lib/cohorts/workflow.ts",
      },
      {
        // Split out of `memberships` in Wave D rather than left implied by its
        // description, so the gap stays visible instead of being absorbed by a
        // capability that was marked available for other reasons. Wave G3 closed it.
        id: "accessLevels",
        label: "Access levels",
        description:
          "Ranked tiers on a course, a minimum tier per lesson, and one entitlement per enrolment. This is the first real content-visibility decision in the system: before it, any active enrolment returned every lesson. A lesson with no rule stays visible to everybody, so existing courses are unchanged. An upgrade is requested, decided and then applied as three separate facts, and applying it moves the entitlement - no payment is executed at any step, and a suspended or expired entitlement falls back to the unruled lessons rather than to the lowest tier.",
        maturity: "available",
        evidence: "src/lib/cohorts/access.ts",
      },
    ],
  },
  venueOrders: {
    id: "venueOrders",
    label: "Venue and orders",
    description: "Tables, rooms, reservations, QR ordering, live queues, and guest status history.",
    capabilities: [
      {
        id: "reservations",
        label: "Reservations",
        description: "Table, room, and seat reservations.",
        maturity: "available",
        evidence: "src/lib/reservations/engine.ts",
      },
      {
        id: "qrOrdering",
        label: "QR ordering",
        description: "Guest ordering surfaces and live service queues.",
        maturity: "available",
        evidence: "src/components/shop/restaurant-menu.tsx",
      },
      {
        id: "guestTracking",
        label: "Guest tracking",
        description: "Status history and service recovery cues.",
        maturity: "available",
        evidence: "src/app/actions/orders.ts",
      },
    ],
  },
  fieldJobs: {
    id: "fieldJobs",
    label: "Field jobs",
    // Was "Intake, quotes, technicians, routing, assets, inspections, parts, and invoices." That
    // named two things this engine does not have and never claimed in its capabilities: there is no
    // ROUTING - no route is optimised and no distance is computed - and there are no INVOICES, only
    // a handoff flag. The engine-level summary is what an owner reads first, so it was the one place
    // still promising both.
    description:
      "Intake, quotes, technicians, job cards, inspections and parts used. No routing, no invoicing and no notifications.",
    capabilities: [
      {
        id: "intake",
        label: "Intake",
        description:
          "Inbound requests with qualification, an optional quote, and conversion into a job. A request is a separate record from the job it becomes, so a declined request stays a record and a job that exists means somebody committed to it. One request converts to at most one job, and a request with no site address cannot be converted without one being supplied, because a job with no address cannot be visited.",
        maturity: "available",
        evidence: "src/lib/fieldjobs/engine.ts",
      },
      {
        id: "dispatch",
        label: "Dispatch",
        description:
          "Technician assignment and job-card state. A technician IS an AppointmentResource, so there is no second answer to who can do the work. A job cannot be dispatched without a visit window or without an accountable lead; work cannot start until somebody is on site; and a job is not complete while a technician is still mid-visit. NO ROUTING AND NO NOTIFICATION: no route is optimised, no distance or travel time is computed, no map provider is called, and no technician is told - every assignment event records notified: false.",
        maturity: "available",
        evidence: "src/lib/fieldjobs/engine.ts",
      },
      {
        id: "inspection",
        label: "Inspection",
        description:
          "Reusable checklists, asset checks, measurements with expected ranges, parts used, completion notes and an invoice handoff flag. A checklist's lines are SNAPSHOTTED onto the inspection when it is raised, so editing the checklist later cannot rewrite what a past inspection asked. At most one inspection is open per job. A required line left PENDING blocks submission and completion, while NOT_APPLICABLE is a real answer and does not; completion needs both an outcome and notes. Parts point at existing InventoryItem stock and recording one does NOT move stock unless consumeStock is asked for, in which case the existing inventory engine deducts it and the movement is linked. NO ASSET REGISTRY: an asset check carries the equipment's identity in its own columns, and there is no asset list or per-asset service history. NO INVOICE AND NO PAYMENT: the handoff is a flag stating the owner passed the work to whatever bills, and no invoice row is written and no money moves. NO FILE UPLOAD and NO NOTIFICATION.",
        maturity: "available",
        evidence: "src/lib/fieldjobs/inspection.ts",
      },
    ],
  },
  casesProjects: {
    id: "casesProjects",
    label: "Cases and projects",
    description: "Leads, briefs, documents, milestones, tasks, approvals, deliverables, and billing.",
    capabilities: [
      {
        id: "pipeline",
        label: "Pipeline",
        description: "Lead intake, qualification, brief capture, and conversion into a case.",
        maturity: "available",
        evidence: "src/lib/cases/engine.ts",
      },
      {
        id: "delivery",
        label: "Delivery",
        description:
          "Milestones, tasks on the shared TaskJob queue, approvals on the shared Approval ledger, and approval-gated deliverables.",
        maturity: "available",
        evidence: "src/lib/cases/workflow.ts",
      },
      {
        id: "billing",
        label: "Billing",
        description:
          "Invoice records, billing state on the case, and linkage to an existing Payment. Retainers are tracked separately as retainers.",
        maturity: "available",
        evidence: "src/lib/cases/workflow.ts",
      },
      {
        id: "documents",
        label: "Documents",
        description:
          "Document requests with an explicit lifecycle over the existing ProfileDocument store; receipt requires a real uploaded document.",
        maturity: "available",
        evidence: "src/lib/cases/workflow.ts",
      },
      {
        // Split out of `billing` in Wave C rather than left implied by its description,
        // so the gap stays visible instead of being absorbed by a capability that was
        // marked available for other reasons. Wave G3 closed it.
        id: "retainers",
        label: "Retainers",
        description:
          "A retainer agreement plus a draw-down ledger: an allowance denominated in units or in money, dated periods that snapshot their own allowance, optional rollover of the unused remainder, and an append-only ledger that stores both the signed delta and the balance it produced. Overage is recorded and reported rather than refused, because refusing work that was actually done would misrepresent it. Billing state reuses the existing invoice vocabulary and may reference a CaseInvoice; no payment is executed anywhere.",
        maturity: "available",
        evidence: "src/lib/cases/retainers.ts",
      },
    ],
  },
}

export function getBusinessEngine(id: BusinessEngineId) {
  return businessEngineDescriptors[id]
}

export function listBusinessEngines() {
  return Object.values(businessEngineDescriptors)
}

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
        description: "Stock rules, reservations, and availability signals.",
        maturity: "planned",
        evidence: "none",
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
        description: "Independently selectable product options and pricing variants.",
        maturity: "partial",
        evidence: "src/components/dashboard/quick-add-sheet.tsx",
      },
      {
        id: "fulfilment",
        label: "Fulfilment",
        description: "Physical and digital delivery state after an order is placed.",
        maturity: "partial",
        evidence: "src/components/dashboard/quick-add-sheet.tsx",
      },
      {
        id: "returns",
        label: "Returns",
        description: "Return requests, approvals, item receipt, and refunds.",
        maturity: "planned",
        evidence: "none",
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
        // capability that was marked available for other reasons.
        id: "accessLevels",
        label: "Access levels",
        description: "Tiered entitlements that gate which content a member can reach.",
        maturity: "planned",
        evidence: "none",
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
    description: "Intake, quotes, technicians, routing, assets, inspections, parts, and invoices.",
    capabilities: [
      {
        id: "intake",
        label: "Intake",
        description: "Requests, qualification, and estimate capture.",
        maturity: "planned",
        evidence: "none",
      },
      {
        id: "dispatch",
        label: "Dispatch",
        description: "Technician assignment, routes, and job cards.",
        maturity: "planned",
        evidence: "none",
      },
      {
        id: "inspection",
        label: "Inspection",
        description: "Asset checks, parts, completion notes, and invoice handoff.",
        maturity: "planned",
        evidence: "none",
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
        // marked available for other reasons.
        id: "retainers",
        label: "Retainers",
        description: "Recurring engagement fees with drawdown against delivered work.",
        maturity: "planned",
        evidence: "none",
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

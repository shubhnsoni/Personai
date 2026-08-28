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
        maturity: "partial",
        evidence: "src/app/actions/services.ts",
      },
      {
        id: "availability",
        label: "Availability",
        description: "Staff, resources, calendars, and capacity windows.",
        maturity: "partial",
        evidence: "src/app/api/bookings/route.ts",
      },
      {
        id: "reminders",
        label: "Reminders",
        description: "Confirmation, reminder, and recovery workflows.",
        maturity: "planned",
        evidence: "none",
      },
      {
        id: "deposits",
        label: "Deposits",
        description: "Up-front payment requirements attached to a booking.",
        maturity: "planned",
        evidence: "none",
      },
      {
        id: "waitlist",
        label: "Waitlist",
        description: "Demand queues and promotion into newly available appointment slots.",
        maturity: "planned",
        evidence: "none",
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
        description: "Curriculum, lessons, and gated resources.",
        maturity: "partial",
        evidence: "src/components/profile/store-panel.tsx",
      },
      {
        id: "cohorts",
        label: "Cohorts",
        description: "Batches, attendance, assignments, and learner progress.",
        maturity: "planned",
        evidence: "none",
      },
      {
        id: "memberships",
        label: "Memberships",
        description: "Access levels, renewals, and certificates.",
        maturity: "partial",
        evidence: "src/components/profile/store-panel.tsx",
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
        description: "Lead intake, briefs, and qualification.",
        maturity: "partial",
        evidence: "src/app/dashboard/leads/page.tsx",
      },
      {
        id: "delivery",
        label: "Delivery",
        description: "Milestones, tasks, approvals, and deliverables.",
        maturity: "planned",
        evidence: "none",
      },
      {
        id: "billing",
        label: "Billing",
        description: "Retainers, invoices, and payment follow-up.",
        maturity: "partial",
        evidence: "src/app/dashboard/money/page.tsx",
      },
      {
        id: "documents",
        label: "Documents",
        description: "Case and project documents with explicit ownership and lifecycle.",
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

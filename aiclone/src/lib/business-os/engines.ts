import type { BusinessEngineId, EngineDescriptor } from "./types"

export const businessEngineDescriptors: Record<BusinessEngineId, EngineDescriptor> = {
  commerce: {
    id: "commerce",
    label: "Commerce",
    description: "Catalog, inventory, checkout, orders, fulfilment, and returns.",
    capabilities: [
      { id: "catalog", label: "Catalog", description: "Products, variants, pricing, and media." },
      { id: "inventory", label: "Inventory", description: "Stock rules, reservations, and availability signals." },
      { id: "orders", label: "Orders", description: "Cart, checkout, payment, fulfilment, and returns." },
    ],
  },
  appointments: {
    id: "appointments",
    label: "Appointments",
    description: "Services, staff, availability, deposits, reminders, waitlists, and no-show recovery.",
    capabilities: [
      { id: "services", label: "Services", description: "Bookable offerings, durations, and intake questions." },
      { id: "availability", label: "Availability", description: "Staff, resources, calendars, and capacity windows." },
      { id: "reminders", label: "Reminders", description: "Confirmation, reminder, and recovery workflows." },
    ],
  },
  contentCohorts: {
    id: "contentCohorts",
    label: "Content and cohorts",
    description: "Courses, batches, lessons, progress, certificates, and memberships.",
    capabilities: [
      { id: "courses", label: "Courses", description: "Curriculum, lessons, and gated resources." },
      { id: "cohorts", label: "Cohorts", description: "Batches, attendance, assignments, and learner progress." },
      { id: "memberships", label: "Memberships", description: "Access levels, renewals, and certificates." },
    ],
  },
  venueOrders: {
    id: "venueOrders",
    label: "Venue and orders",
    description: "Tables, rooms, reservations, QR ordering, live queues, and guest status history.",
    capabilities: [
      { id: "reservations", label: "Reservations", description: "Table, room, and seat reservations." },
      { id: "qrOrdering", label: "QR ordering", description: "Guest ordering surfaces and live service queues." },
      { id: "guestTracking", label: "Guest tracking", description: "Status history and service recovery cues." },
    ],
  },
  fieldJobs: {
    id: "fieldJobs",
    label: "Field jobs",
    description: "Intake, quotes, technicians, routing, assets, inspections, parts, and invoices.",
    capabilities: [
      { id: "intake", label: "Intake", description: "Requests, qualification, and estimate capture." },
      { id: "dispatch", label: "Dispatch", description: "Technician assignment, routes, and job cards." },
      { id: "inspection", label: "Inspection", description: "Asset checks, parts, completion notes, and invoice handoff." },
    ],
  },
  casesProjects: {
    id: "casesProjects",
    label: "Cases and projects",
    description: "Leads, briefs, documents, milestones, tasks, approvals, deliverables, and billing.",
    capabilities: [
      { id: "pipeline", label: "Pipeline", description: "Lead intake, briefs, and qualification." },
      { id: "delivery", label: "Delivery", description: "Milestones, tasks, approvals, and deliverables." },
      { id: "billing", label: "Billing", description: "Retainers, invoices, and payment follow-up." },
    ],
  },
}

export function getBusinessEngine(id: BusinessEngineId) {
  return businessEngineDescriptors[id]
}

export function listBusinessEngines() {
  return Object.values(businessEngineDescriptors)
}

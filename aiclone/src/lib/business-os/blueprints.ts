import type { BusinessBlueprint } from "./types"
import { assertValidBusinessBlueprint } from "./validation"

const sampleBlueprints: BusinessBlueprint[] = [
  {
    id: "coaching-studio-v1",
    version: "1.0.0",
    status: "draft",
    name: "Coaching Studio",
    vertical: "coaching-training",
    summary: "Runs paid programs with cohorts, appointments, light commerce, and owner approval gates.",
    engines: [
      { engineId: "contentCohorts", capabilities: ["courses", "cohorts", "memberships"], required: true },
      { engineId: "appointments", capabilities: ["services", "availability", "reminders"], required: true },
      { engineId: "commerce", capabilities: ["catalog", "orders"], required: false },
    ],
    workflows: [
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
    ],
    ownerCopilotPrompts: [
      "Which leads need a human follow-up today?",
      "Summarize cohort attendance risk and suggested interventions.",
    ],
  },
  {
    id: "consulting-agency-v1",
    version: "1.0.0",
    status: "draft",
    name: "Consulting Agency",
    vertical: "consultants-agencies",
    summary: "Manages lead briefs, delivery milestones, approvals, retainers, and client handoffs.",
    engines: [
      { engineId: "casesProjects", capabilities: ["pipeline", "delivery", "billing"], required: true },
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
    id: "restaurant-venue-v1",
    version: "1.0.0",
    status: "active",
    name: "Restaurant and cloud kitchen",
    vertical: "restaurant-cloud-kitchen",
    summary: "QR dine-in and takeaway ordering with a live service queue, guest status history, and payment capture.",
    engines: [
      { engineId: "venueOrders", capabilities: ["reservations", "qrOrdering", "guestTracking"], required: true },
      { engineId: "commerce", capabilities: ["catalog", "inventory", "orders"], required: true },
    ],
    workflows: [
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
    ],
    ownerCopilotPrompts: [
      "Which open orders have been waiting longest?",
      "What did each table spend today?",
    ],
  },
]

export const businessBlueprintRegistry = sampleBlueprints.map(assertValidBusinessBlueprint)

export function listBusinessBlueprints() {
  return businessBlueprintRegistry
}

export function getBusinessBlueprint(id: string) {
  return businessBlueprintRegistry.find((blueprint) => blueprint.id === id) ?? null
}

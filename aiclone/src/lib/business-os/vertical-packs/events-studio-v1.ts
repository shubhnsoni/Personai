import { CANDIDATE_STATUS } from "./types"
import type { VerticalPackCandidate } from "./types"

/**
 * Events and wedding studio - CANDIDATE, not registered.
 *
 * WHY THE CASES ENGINE FITS: an event is a dated project with a brief, milestones, sign-offs and a
 * final deliverable, which is `casesProjects` almost exactly. The two capabilities that make it fit
 * rather than merely resemble are `documents` - the studio's real loop is chasing a signed brief, a
 * guest list and a venue permission, and `documents` refuses to mark a request received without an
 * actual uploaded file - and `retainers`, because event work is normally sold as a booked-out block
 * with a drawdown against it.
 *
 * WHY VENUE RESERVATIONS ARE OPTIONAL AND NOT REQUIRED: `venueOrders:reservations` models a table, room
 * or seat held against a venue the workspace itself operates. A studio that hires third-party venues
 * does not hold those slots in this product at all, so requiring the capability would misdescribe most
 * of the market.
 *
 * WHAT THIS PACK MOST CONSPICUOUSLY DOES NOT DO: there is no seating chart, no floor plan and no
 * run-of-show timeline. Those are the three things an events buyer assumes first, and none of them
 * exists in any engine, so they are named in `unsupported` rather than left to be inferred from the
 * word "events".
 */
export const eventsStudioV1: VerticalPackCandidate = {
  blueprint: {
    id: "events-studio-v1",
    version: "1.0.0",
    status: CANDIDATE_STATUS,
    name: "Events and wedding studio",
    vertical: "events-studio",
    summary:
      "Runs each event as a case: enquiry and brief, document requests that cannot be closed without the actual file, delivery milestones with owner sign-off before anything is promised to the client, retainer drawdown, and invoice records. Venue holds and consultation bookings are available but optional. No seating chart, no run-of-show timeline, no vendor messaging and no payment execution.",
    engines: [
      {
        engineId: "casesProjects",
        capabilities: ["pipeline", "delivery", "billing", "documents", "retainers"],
        required: true,
      },
      {
        // Only meaningful for a studio that operates its own venue. A studio hiring third-party
        // venues holds nothing in this product.
        engineId: "venueOrders",
        capabilities: ["reservations"],
        required: false,
      },
      {
        engineId: "appointments",
        capabilities: ["services", "availability"],
        required: false,
        plannedCapabilities: ["reminders", "deposits"],
      },
    ],
    workflows: [
      {
        id: "events-brief-captured",
        name: "Brief captured",
        trigger: { kind: "event", event: "case.created" },
        actions: [
          { id: "create-brief-review-task", kind: "createTask", label: "Create a task to review the event brief" },
          { id: "audit-brief", kind: "recordAudit", label: "Record the brief capture", auditSubject: "case" },
        ],
      },
      {
        id: "events-document-outstanding",
        name: "Client document outstanding",
        trigger: { kind: "event", event: "case.document_requested" },
        actions: [
          { id: "chase-event-document", kind: "createTask", label: "Create a task to chase the client document" },
          {
            id: "audit-event-document",
            kind: "recordAudit",
            label: "Record the document request state",
            auditSubject: "document",
          },
        ],
      },
      {
        id: "events-final-confirmation",
        name: "Final details confirmed",
        trigger: { kind: "manual" },
        actions: [
          {
            id: "approve-event-confirmation",
            kind: "requestApproval",
            label: "Owner sign-off before the event plan is treated as final",
            approval: {
              required: true,
              approverRole: "owner",
              reason:
                "An event date cannot be re-run, so confirming the plan is an irreversible commercial commitment and no automatic step should be able to make it.",
            },
          },
          {
            id: "handoff-event-delivery",
            kind: "handoffToOwner",
            label: "Hand the confirmed plan to the owner for delivery",
          },
          { id: "audit-event-confirmation", kind: "recordAudit", label: "Record the confirmation", auditSubject: "case" },
        ],
      },
    ],
    ownerCopilotPrompts: [
      "Which events are within thirty days and still missing a client document?",
      "Which retainers are close to exhausted before their event has happened?",
      "Which milestones are waiting on my sign-off?",
    ],
  },
  readiness: "candidate-not-registered",
  registered: false,
  proposedTerminology: {
    calendar: "event schedule",
    case: "event",
    customer: "client",
    milestone: "planning stage",
  },
  terminologyNote:
    "Proposed only. BusinessBlueprint declares no terminology in this product; preview.ts resolves it from the onboarding role and tags it source: \"role-derived\". No role points at this candidate, so none of these labels resolves anywhere today.",
  intendedSurfaces: ["home", "profile", "inbox", "leads", "services", "calendar", "events", "sales"],
  onboarding: {
    proposedRoleKey: "EVENTS_STUDIO",
    correspondsToExistingRole: false,
    steps: [
      "List the event types offered and the planning stages each goes through.",
      "List the documents a client must supply before an event is treated as confirmed.",
      "State whether the studio operates its own venue, which decides whether the venueOrders composition is used.",
      "State whether work is sold as a retainer block or per event.",
    ],
    requiredOwnerDecisions: [
      "What counts as a confirmed event, since the confirmation cannot be undone once the date passes.",
      "Whether a missing document blocks confirmation or is merely flagged.",
      "How overage against a retainer is charged, because no payment is executed anywhere.",
    ],
  },
  ownerWorkflow: {
    configuredWorkflowIds: ["events-brief-captured", "events-document-outstanding", "events-final-confirmation"],
    approvalGates: ["Owner sign-off before an event plan is treated as final."],
    executionNote:
      "Configuration only. workflow.ts exposes planWorkflowRun, which returns a plan; no consumer in this repository executes a blueprint workflow declaration, so nothing here runs on its own.",
  },
  dailyOpportunities: [
    {
      id: "events-imminent-gaps",
      prompt: "Which upcoming events are missing a document or an approval?",
      readsFrom: ["casesProjects:documents", "casesProjects:delivery"],
    },
    {
      id: "events-retainer-burn",
      prompt: "Which retainers are nearly exhausted relative to the work still to come?",
      readsFrom: ["casesProjects:retainers"],
    },
    {
      id: "events-unbilled",
      prompt: "Which delivered events have no invoice record yet?",
      readsFrom: ["casesProjects:billing"],
    },
  ],
  unsupported: [
    {
      id: "events-seating-chart",
      label: "Seating chart and floor plan",
      reason:
        "No engine models a spatial layout. venueOrders:reservations holds a table or room as a bookable unit and carries no geometry, so there is nothing to render a plan from.",
    },
    {
      id: "events-run-of-show",
      label: "Run-of-show timeline",
      reason:
        "casesProjects:delivery models milestones, which are dated checkpoints, not an intra-day ordered schedule with durations. Presenting milestones as a run-of-show would misstate what the data is.",
    },
    {
      id: "events-vendor-marketplace",
      label: "Third-party vendor sourcing and coordination",
      reason: "No engine models an external supplier, their availability or their quotes.",
    },
    {
      id: "events-esignature",
      label: "Contract e-signature",
      reason:
        "casesProjects:documents tracks a request and receipt of an uploaded file. Receiving a file is not signing it, and no signature provider is wired.",
    },
  ],
  ownerGated: [
    {
      id: "events-client-updates",
      label: "Telling the client anything",
      gate: "The owner contacts the client themselves; no messaging provider is wired.",
      boundary: "inert",
    },
    {
      id: "events-deposit",
      label: "Taking a booking deposit",
      gate: "The owner collects payment by their own means and records that they did.",
      boundary: "owner-gated",
    },
  ],
  integrationNotes: [
    "Composes casesProjects, venueOrders and appointments, all of which already back live blueprints, so it adds no engine and no migration.",
    "Its vertical string 'events-studio' is claimed by no registered blueprint.",
    "The `events` surface already exists in the Surface union, so the intended surface set needs no new member.",
  ],
}

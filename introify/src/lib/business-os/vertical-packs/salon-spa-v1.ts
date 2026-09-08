import { REGISTERED_STATUS } from "./types"
import type { RegisteredVerticalPack } from "./types"

/**
 * Salon and spa - active, registered, and mapped from onboarding.
 *
 * WHY THE APPOINTMENTS ENGINE FITS: a salon's core record is a bookable service performed by a named
 * person in a capacity window, which is exactly `appointments:services` + `appointments:availability`.
 * `appointments:waitlist` is the other half of the real business: a chair that goes empty is revenue
 * that cannot be recovered, and the waitlist promotes demand into a slot that just opened.
 *
 * WHY REMINDERS AND DEPOSITS ARE PLANNED, NOT REQUIRED: both records are persisted and both have a
 * state machine, but `appointments:reminders` has no messaging provider wired and `appointments:deposits`
 * has no payment provider wired. A salon pack that REQUIRED them would be promising the two things a
 * salon owner most wants - "my clients get reminded" and "they pay to hold the slot" - and neither
 * happens. They stay in the planned backlog, which is the same decision `coaching-studio-v2` made.
 *
 * WHY COMMERCE IS OPTIONAL: retail product sales are common in salons and entirely real
 * (`catalog`, `orders`, `inventory` are all available), but a salon that only sells services is still a
 * salon. Optional is the truthful strength.
 */
export const salonSpaV1: RegisteredVerticalPack = {
  blueprint: {
    id: "salon-spa-v1",
    version: "1.0.0",
    status: REGISTERED_STATUS,
    name: "Salon and spa",
    vertical: "salon-spa",
    summary:
      "Books services onto named staff with real capacity and overlap refusal, and queues demand on a waitlist so a cancelled slot can be refilled. Retail product sales and consumable stock are available but optional. No reminder is delivered and no deposit is taken: both records exist, and both provider boundaries are inert, so the pack does not require either.",
    engines: [
      {
        engineId: "appointments",
        capabilities: ["services", "availability", "waitlist"],
        required: true,
        // Inert providers, exactly as in coaching-studio-v2. A required reminder would be a
        // delivery claim and a required deposit would be a payment claim.
        plannedCapabilities: ["reminders", "deposits"],
      },
      {
        engineId: "commerce",
        capabilities: ["catalog", "orders", "inventory"],
        required: false,
      },
    ],
    workflows: [
      {
        id: "salon-booking-recorded",
        name: "Booking recorded",
        trigger: { kind: "event", event: "appointment.created" },
        actions: [
          {
            id: "audit-salon-booking",
            kind: "recordAudit",
            label: "Record the booking state change",
            auditSubject: "appointment",
          },
        ],
      },
      {
        id: "salon-no-show-recovery",
        name: "No-show recovery",
        trigger: { kind: "manual" },
        actions: [
          { id: "create-recovery-task", kind: "createTask", label: "Create an owner follow-up task for the no-show" },
          {
            id: "audit-no-show",
            kind: "recordAudit",
            label: "Record the no-show and what was decided about it",
            auditSubject: "appointment",
          },
        ],
      },
      {
        id: "salon-waitlist-promotion",
        name: "Waitlist promotion reviewed",
        trigger: { kind: "manual" },
        actions: [
          {
            id: "approve-waitlist-promotion",
            kind: "requestApproval",
            label: "Owner confirms who gets the freed slot",
            approval: {
              required: true,
              approverRole: "owner",
              reason:
                "Promoting one client over another is a commercial and relationship decision, and the client cannot be told automatically because no messaging provider is wired.",
            },
          },
          {
            id: "audit-waitlist-promotion",
            kind: "recordAudit",
            label: "Record the promotion decision",
            auditSubject: "waitlist",
          },
        ],
      },
    ],
    ownerCopilotPrompts: [
      "Which chairs are empty tomorrow and who is on the waitlist for them?",
      "Which clients have not rebooked since their last visit?",
      "Which retail products are close to running out?",
    ],
  },
  readiness: "active-registered",
  registered: true,
  proposedTerminology: {
    calendar: "appointment book",
    customer: "client",
    staff: "stylist",
    service: "treatment",
  },
  terminologyNote:
    "Role-derived. Preview resolves these labels from the SALON_SPA onboarding role and tags them source: \"role-derived\".",
  intendedSurfaces: ["home", "profile", "inbox", "services", "calendar", "shop", "sales"],
  onboarding: {
    proposedRoleKey: "SALON_SPA",
    correspondsToExistingRole: true,
    steps: [
      "List the treatments offered, each with a duration.",
      "Name the stylists and the hours each actually works.",
      "State whether retail products are sold, which decides whether the commerce composition is used at all.",
      "State whether a deposit would be expected, recorded as intent only because no payment provider is wired.",
    ],
    requiredOwnerDecisions: [
      "Whether a treatment may be double-booked against one stylist.",
      "Who gets a slot freed by a cancellation, because promotion is not automatic.",
      "How a no-show is handled commercially, since no charge can be taken.",
    ],
  },
  ownerWorkflow: {
    configuredWorkflowIds: ["salon-booking-recorded", "salon-no-show-recovery", "salon-waitlist-promotion"],
    approvalGates: ["Owner confirms who gets the freed slot before a waitlist promotion is recorded."],
    executionNote:
      "Configuration only. workflow.ts exposes planWorkflowRun, which returns a plan; no consumer in this repository executes a blueprint workflow declaration, so nothing here runs on its own.",
  },
  dailyOpportunities: [
    {
      id: "salon-empty-slots",
      prompt: "Which slots are unfilled in the next two days?",
      readsFrom: ["appointments:availability"],
    },
    {
      id: "salon-waitlist-depth",
      prompt: "Who is waiting for a slot that has just opened?",
      readsFrom: ["appointments:waitlist"],
    },
    {
      id: "salon-retail-stock",
      prompt: "Which retail products are near their reorder point?",
      readsFrom: ["commerce:inventory"],
    },
  ],
  unsupported: [
    {
      id: "salon-staff-payroll",
      label: "Staff commission and payroll",
      reason:
        "No engine models pay, commission splits or hours worked for wage purposes. Nothing in the repository computes what a stylist earned.",
    },
    {
      id: "salon-loyalty",
      label: "Loyalty points and membership perks",
      reason:
        "contentCohorts:memberships models cohort enrolment and renewal for taught programs, not a visit-count reward scheme. Reusing it would misrepresent what a membership row means.",
    },
    {
      id: "salon-online-payment",
      label: "Online prepayment at booking",
      reason: "No payment provider is wired anywhere in the product. appointments:deposits persists a record and moves no money.",
    },
  ],
  ownerGated: [
    {
      id: "salon-remind-client",
      label: "Reminding a client of an appointment",
      gate: "The owner contacts the client themselves, outside the product.",
      boundary: "inert",
    },
    {
      id: "salon-take-deposit",
      label: "Taking a deposit to hold a slot",
      gate: "The owner collects payment by their own means and records that they did.",
      boundary: "owner-gated",
    },
  ],
  integrationNotes: [
    "Composes only appointments and commerce, both of which already have live blueprints, so it adds no engine and no migration.",
    "Its vertical string 'salon-spa' is unique in the active registry.",
    "The SALON_SPA onboarding role resolves its intended surfaces and terminology without installing reminders or deposits.",
  ],
}

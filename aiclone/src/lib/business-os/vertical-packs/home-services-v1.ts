import { CANDIDATE_STATUS } from "./types"
import type { VerticalPackCandidate } from "./types"

/**
 * Home services - CANDIDATE, not registered.
 *
 * READ THIS FIRST: THIS CANDIDATE SUBSTANTIALLY OVERLAPS THE ACTIVE `field-service-v1`.
 *
 * It composes the same engine with the same three required capabilities (`fieldJobs:intake`,
 * `:dispatch`, `:inspection`) and the same optional `commerce:inventory`. The honest difference is
 * terminology and onboarding emphasis - a domestic trade thinks in "visits" and "quotes to a
 * householder", a commercial operator thinks in "jobs" and "contracts" - and terminology is NOT
 * blueprint-declared in this product, so on the blueprint contract itself the two are near-identical.
 *
 * That is a decision for the integration owner, not for this worker, and it is recorded in
 * `integrationNotes` rather than resolved here. The defensible options are: register this with its own
 * onboarding role and accept two verticals over one engine composition; fold it into `field-service-v1`
 * as a terminology variant once terminology becomes blueprint-declarable; or leave it as a candidate.
 * Presenting it as a clearly distinct vertical would be the one dishonest option.
 *
 * WHAT IT INHERITS FROM THE ENGINE, INCLUDING THE GAPS: `fieldJobs` states plainly that it has no
 * routing, no invoicing and no notifications. Every assignment event records `notified: false`. A
 * domestic-trade buyer assumes exactly those three things, so they are the first entries in
 * `unsupported`.
 */
export const homeServicesV1: VerticalPackCandidate = {
  blueprint: {
    id: "home-services-v1",
    version: "1.0.0",
    status: CANDIDATE_STATUS,
    name: "Home services",
    vertical: "home-services",
    summary:
      "Runs domestic visiting work: an enquiry is qualified and optionally quoted, becomes a visit with a window and an accountable lead, and is checked on site against a reusable checklist whose lines are snapshotted so editing it later cannot rewrite a past visit. Parts fitted point at real stock and only move it when that is explicitly asked for. No route is planned, no travel time is estimated, nobody is notified, and no invoice is raised: finishing a check can flag the work as ready to bill and nothing more.",
    engines: [
      {
        engineId: "fieldJobs",
        capabilities: ["intake", "dispatch", "inspection"],
        required: true,
      },
      {
        // Optional for the same reason field-service-v1 makes it optional: a trade that only wants a
        // record of what was fitted does not need stock to move.
        engineId: "commerce",
        capabilities: ["inventory"],
        required: false,
      },
    ],
    workflows: [
      {
        id: "home-visit-completed",
        name: "Visit completed",
        trigger: { kind: "event", event: "fieldJob.completed" },
        actions: [
          {
            id: "audit-home-visit",
            kind: "recordAudit",
            label: "Record the visit status history",
            auditSubject: "fieldJob",
          },
        ],
      },
      {
        id: "home-quote-approval",
        name: "Quote ready for the householder",
        trigger: { kind: "manual" },
        actions: [
          {
            id: "approve-home-quote",
            kind: "requestApproval",
            label: "Owner sign-off before a price is given to a householder",
            approval: {
              required: true,
              approverRole: "owner",
              reason:
                "A quote given to a domestic customer is relied upon as a price, and the product cannot deliver or withdraw it automatically because nobody is notified by any channel.",
            },
          },
          { id: "audit-home-quote", kind: "recordAudit", label: "Record the quote decision", auditSubject: "quote" },
        ],
      },
      {
        id: "home-billing-handoff",
        name: "Work ready to bill",
        trigger: { kind: "event", event: "inspection.completed" },
        actions: [
          {
            id: "approve-home-billing-handoff",
            kind: "requestApproval",
            label: "Owner sign-off before the visit is handed to billing",
            approval: {
              required: true,
              approverRole: "owner",
              reason:
                "Handing work to billing asserts the visit is finished and chargeable, and the on-site check is the only record of what was actually found.",
            },
          },
          {
            id: "handoff-home-billing",
            kind: "handoffToOwner",
            label: "Hand the completed visit to whatever bills",
          },
          {
            id: "audit-home-billing-handoff",
            kind: "recordAudit",
            label: "Record the invoice handoff flag",
            auditSubject: "inspection",
          },
        ],
      },
    ],
    ownerCopilotPrompts: [
      "Which visits are booked tomorrow and who is leading each?",
      "Which checks are still waiting on a required line?",
      "Which finished visits are ready to bill but have not been handed off?",
    ],
  },
  readiness: "candidate-not-registered",
  registered: false,
  proposedTerminology: {
    calendar: "visit schedule",
    job: "visit",
    customer: "householder",
    technician: "engineer",
  },
  terminologyNote:
    "Proposed only. BusinessBlueprint declares no terminology in this product; preview.ts resolves it from the onboarding role and tags it source: \"role-derived\". No role points at this candidate, so none of these labels resolves anywhere today. This matters more here than elsewhere: terminology is the main thing distinguishing this candidate from the active field-service-v1, and it is exactly the thing a blueprint cannot currently carry.",
  intendedSurfaces: ["home", "profile", "inbox", "leads", "services", "calendar", "sales"],
  onboarding: {
    proposedRoleKey: "HOME_SERVICES",
    correspondsToExistingRole: false,
    steps: [
      "List the trades or visit types offered and a typical duration for each.",
      "Name the engineers, who become AppointmentResource records rather than a separate roster.",
      "Build the on-site checklists, marking which lines are required.",
      "State whether parts fitted should deduct stock, which decides whether the commerce composition is used.",
    ],
    requiredOwnerDecisions: [
      "Whether a quote must be approved before it is given to a householder.",
      "Whether fitting a part deducts stock or only records what was used.",
      "How the householder is told anything, since no channel is wired.",
    ],
  },
  ownerWorkflow: {
    configuredWorkflowIds: ["home-visit-completed", "home-quote-approval", "home-billing-handoff"],
    approvalGates: [
      "Owner sign-off before a price is given to a householder.",
      "Owner sign-off before a completed visit is handed to billing.",
    ],
    executionNote:
      "Configuration only. workflow.ts exposes planWorkflowRun, which returns a plan; no consumer in this repository executes a blueprint workflow declaration, so nothing here runs on its own.",
  },
  dailyOpportunities: [
    {
      id: "home-todays-visits",
      prompt: "Which visits are scheduled today and does each have an accountable lead?",
      readsFrom: ["fieldJobs:dispatch"],
    },
    {
      id: "home-incomplete-checks",
      prompt: "Which on-site checks have required lines still pending?",
      readsFrom: ["fieldJobs:inspection"],
    },
    {
      id: "home-unhanded-work",
      prompt: "Which finished visits are flagged ready to bill but not handed off?",
      readsFrom: ["fieldJobs:inspection"],
    },
    {
      id: "home-parts-not-deducted",
      prompt: "Which visits recorded parts that never left stock?",
      readsFrom: ["fieldJobs:inspection", "commerce:inventory"],
    },
  ],
  unsupported: [
    {
      id: "home-routing",
      label: "Route planning and travel-time estimation",
      reason:
        "fieldJobs:dispatch states it explicitly: no route is optimised, no distance or travel time is computed and no map provider is called. Nothing in the product can order a day's visits by geography.",
    },
    {
      id: "home-engineer-notification",
      label: "Telling an engineer they have been assigned",
      reason:
        "No channel is wired. Every assignment event in fieldJobs records notified: false, so the assignment is a database fact and not a message.",
    },
    {
      id: "home-invoicing",
      label: "Raising an invoice and taking payment",
      reason:
        "The inspection carries an invoice handoff FLAG. No invoice row is written by fieldJobs and no money moves anywhere.",
    },
    {
      id: "home-asset-history",
      label: "Per-appliance service history",
      reason:
        "fieldJobs:inspection states there is no asset registry: an asset check names the equipment in its own columns, so there is no list of appliances and no history across visits.",
    },
    {
      id: "home-photo-evidence",
      label: "Photographic evidence from site",
      reason: "fieldJobs:inspection states it has no file upload, so a check cannot carry a photograph.",
    },
    {
      id: "home-gps-tracking",
      label: "Live engineer location tracking",
      reason: "No coordinate is captured or stored anywhere, and tracking a worker's location is not a function this product provides.",
    },
  ],
  ownerGated: [
    {
      id: "home-householder-contact",
      label: "Contacting the householder",
      gate: "The owner or engineer contacts them directly; no messaging provider is wired.",
      boundary: "inert",
    },
    {
      id: "home-quote-delivery",
      label: "Delivering a quote to the householder",
      gate: "The owner sends the approved quote themselves by whatever means they use.",
      boundary: "owner-gated",
    },
  ],
  integrationNotes: [
    "OVERLAP, EXPLICIT: this composes the identical engine and capability set as the ACTIVE field-service-v1 (fieldJobs:intake+dispatch+inspection required, commerce:inventory optional). On the blueprint contract the two differ only in id, name, vertical, summary prose and workflow ids.",
    "Because terminology is role-derived and not blueprint-declared, the difference this candidate is really expressing cannot currently live in a blueprint at all. Registering it would create two verticals over one composition.",
    "Integration owner decides: register with its own onboarding role, fold into field-service-v1 as a terminology variant once terminology becomes blueprint-declarable, or leave as a candidate. This worker takes no position beyond recording that the overlap is real.",
    "Its vertical string 'home-services' does not collide with the registered 'field-service', so the one-active-blueprint-per-vertical rule would not itself block registration - which is why the overlap needs stating in prose rather than being left to a uniqueness check that would pass.",
  ],
}

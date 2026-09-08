import { REGISTERED_STATUS } from "./types"
import type { RegisteredVerticalPack } from "./types"

/**
 * Real-estate brokerage - active, registered, and mapped from onboarding.
 *
 * WHY THE CASES ENGINE FITS: a deal is a long-running matter with a qualified party, a document pack
 * that must be collected before anything can complete, staged progress and a fee at the end. That is
 * `casesProjects:pipeline` + `documents` + `delivery` + `billing`. The document capability is again the
 * decisive one: identity proof, title papers and a signed agreement are the brokerage's actual work,
 * and `documents` will not let a request be closed without a real uploaded file.
 *
 * WHY `retainers` IS NOT NAMED AT ALL: brokerage income is a success fee, not a drawdown against a
 * booked block. The capability is available, so listing it as a planned backlog entry would be a false
 * statement of the kind `check-capability-contract.ts` refuses for live blueprints - and simply omitting
 * it is what `restaurant-venue-v3` does with the retail capabilities it does not want.
 *
 * WHAT A READER WILL WRONGLY ASSUME: that a listing pack implies a portal feed and a map. There is no
 * MLS or portal integration, no geocoding and no map provider anywhere in this product. A property's
 * address is text. Those assumptions are named in `unsupported` so the pack cannot be read as offering
 * them.
 */
export const realEstateBrokerageV1: RegisteredVerticalPack = {
  blueprint: {
    id: "real-estate-brokerage-v1",
    version: "1.0.0",
    status: REGISTERED_STATUS,
    name: "Real-estate brokerage",
    vertical: "real-estate-brokerage",
    summary:
      "Runs each mandate or deal as a case: enquiry and qualification, the document pack that must be collected before completion, staged progress with owner sign-off before terms are represented to a party, and a fee record at the end. Viewings can be booked as appointments. No portal or MLS feed, no map or geocoding, no e-signature and no payment execution: an address is text and a document is a file that was uploaded, not one that was signed.",
    engines: [
      {
        engineId: "casesProjects",
        capabilities: ["pipeline", "delivery", "billing", "documents"],
        required: true,
        // `retainers` is deliberately absent rather than parked in a backlog: it is available, and a
        // brokerage is paid a success fee, so naming it either way would misdescribe the vertical.
      },
      {
        // Viewings. Optional because a brokerage that arranges them by phone still runs deals here.
        // Only `reminders` is backlogged: a deposit against a VIEWING is not a thing this vertical
        // has, and a holding deposit on a property is not an appointments concern.
        engineId: "appointments",
        capabilities: ["services", "availability"],
        required: false,
        plannedCapabilities: ["reminders"],
      },
    ],
    workflows: [
      {
        id: "brokerage-enquiry-qualified",
        name: "Enquiry qualified",
        trigger: { kind: "event", event: "lead.created" },
        actions: [
          { id: "create-qualification-task", kind: "createTask", label: "Create a task to qualify the enquiry" },
          { id: "audit-enquiry", kind: "recordAudit", label: "Record the enquiry state", auditSubject: "lead" },
        ],
      },
      {
        id: "brokerage-document-pack",
        name: "Document pack outstanding",
        trigger: { kind: "event", event: "case.document_requested" },
        actions: [
          { id: "chase-brokerage-document", kind: "createTask", label: "Create a task to chase the outstanding paper" },
          {
            id: "audit-brokerage-document",
            kind: "recordAudit",
            label: "Record the document request state",
            auditSubject: "document",
          },
        ],
      },
      {
        id: "brokerage-terms-representation",
        name: "Terms ready to represent",
        trigger: { kind: "manual" },
        actions: [
          {
            id: "approve-brokerage-terms",
            kind: "requestApproval",
            label: "Owner sign-off before any terms are represented to a party",
            approval: {
              required: true,
              approverRole: "owner",
              reason:
                "Stating a price or a condition to a buyer or seller carries legal and regulatory weight, and a misstatement cannot be quietly withdrawn once relied upon.",
            },
          },
          {
            id: "audit-brokerage-terms",
            kind: "recordAudit",
            label: "Record the approval of the represented terms",
            auditSubject: "case",
          },
        ],
      },
    ],
    ownerCopilotPrompts: [
      "Which deals are blocked on a document that has not arrived?",
      "Which mandates have had no activity in the last two weeks?",
      "Which completed deals have no fee record yet?",
    ],
  },
  readiness: "active-registered",
  registered: true,
  proposedTerminology: {
    calendar: "viewing schedule",
    case: "deal",
    customer: "party",
    milestone: "deal stage",
  },
  terminologyNote:
    "Role-derived. Preview resolves these labels from the REAL_ESTATE_BROKERAGE onboarding role and tags them source: \"role-derived\".",
  intendedSurfaces: ["home", "profile", "inbox", "leads", "services", "calendar", "sales"],
  onboarding: {
    proposedRoleKey: "REAL_ESTATE_BROKERAGE",
    correspondsToExistingRole: true,
    steps: [
      "List the deal types handled and the stages each passes through.",
      "List the documents required before a deal can complete, per deal type.",
      "State whether viewings are booked in the product or arranged outside it.",
      "State how the fee is calculated, recorded as a note because no fee engine exists.",
    ],
    requiredOwnerDecisions: [
      "Who may represent terms to a party, since doing so is a regulated act.",
      "Whether a missing document blocks the deal stage or is only flagged.",
      "How a fee is computed, because no commission or split engine exists.",
    ],
  },
  ownerWorkflow: {
    configuredWorkflowIds: [
      "brokerage-enquiry-qualified",
      "brokerage-document-pack",
      "brokerage-terms-representation",
    ],
    approvalGates: ["Owner sign-off before any terms are represented to a party."],
    executionNote:
      "Configuration only. workflow.ts exposes planWorkflowRun, which returns a plan; no consumer in this repository executes a blueprint workflow declaration, so nothing here runs on its own.",
  },
  dailyOpportunities: [
    {
      id: "brokerage-blocked-deals",
      prompt: "Which deals are waiting on a document or an approval?",
      readsFrom: ["casesProjects:documents", "casesProjects:delivery"],
    },
    {
      id: "brokerage-stale-mandates",
      prompt: "Which mandates have gone quiet?",
      readsFrom: ["casesProjects:pipeline"],
    },
    {
      id: "brokerage-unbilled-fees",
      prompt: "Which completed deals have no fee record?",
      readsFrom: ["casesProjects:billing"],
    },
  ],
  unsupported: [
    {
      id: "brokerage-portal-feed",
      label: "MLS or property-portal listing feed",
      reason: "No engine publishes to or reads from an external listing service, and no such provider is wired.",
    },
    {
      id: "brokerage-map-search",
      label: "Map display and location search",
      reason:
        "No map provider is called anywhere in this product and no coordinate is stored or computed. An address is free text, so there is nothing to place on a map or search by radius.",
    },
    {
      id: "brokerage-commission-split",
      label: "Commission calculation and agent splits",
      reason:
        "casesProjects:billing records an invoice and can reference a Payment. It does not compute a fee, apportion it between agents, or model an agent's earnings.",
    },
    {
      id: "brokerage-esignature",
      label: "Agreement e-signature",
      reason:
        "casesProjects:documents proves a file was uploaded and received. It does not establish that anybody signed it, and no signature provider is wired.",
    },
    {
      id: "brokerage-valuation",
      label: "Automated property valuation",
      reason: "No engine models comparable sales or price history, and this product gives no financial advice.",
    },
  ],
  ownerGated: [
    {
      id: "brokerage-party-contact",
      label: "Contacting a buyer or seller",
      gate: "The owner contacts the party themselves; no messaging provider is wired.",
      boundary: "inert",
    },
    {
      id: "brokerage-viewing-reminder",
      label: "Reminding a party about a viewing",
      gate: "The owner reminds them personally; the reminder record is persisted and delivers nothing.",
      boundary: "inert",
    },
  ],
  integrationNotes: [
    "Composes casesProjects and appointments only, both of which already back live blueprints, so it adds no engine and no migration.",
    "Its vertical string 'real-estate-brokerage' is unique in the active registry and maps from the REAL_ESTATE_BROKERAGE onboarding role.",
    "It is the pack whose name most invites an assumed integration (portals, maps, signatures); the unsupported list is the substance of the pack, not an appendix to it.",
  ],
}

import { REGISTERED_STATUS } from "./types"
import type { RegisteredVerticalPack } from "./types"

/**
 * Recruitment agency - active, registered, and mapped from onboarding.
 *
 * WHY THE CASES ENGINE FITS: a vacancy is a matter opened for a client, worked through stages, gated by
 * documents that must actually arrive, and billed on an outcome. `casesProjects:pipeline` captures the
 * brief, `:delivery` carries the shortlist and interview stages on the shared TaskJob queue with
 * approvals on the shared Approval ledger, `:documents` refuses to close a request without the real
 * uploaded file - which is what a right-to-work check or a signed terms-of-business actually is - and
 * `:billing` records the placement fee.
 *
 * WHY `retainers` IS NOT REQUIRED: retained search genuinely exists and the capability is available, but
 * contingency - no fee until a placement - is the ordinary model in this vertical. Requiring a retainer
 * would misdescribe most agencies, and listing an AVAILABLE capability as a planned backlog entry would
 * be a false statement of the kind `check-capability-contract.ts` refuses. So it is named in
 * `integrationNotes` instead: an agency doing retained search would want it added to the composition.
 *
 * WHY `contentCohorts` IS ABSENT: candidate training is plausible and the engine is real, but it is a
 * different business (running taught programs) bolted onto this one. Composing it speculatively would
 * widen the pack's claim without evidence that agencies want it here.
 *
 * THE BOUNDARY THAT MATTERS MOST: this pack handles people's personal documents. It stores what was
 * uploaded and whether a request was satisfied. It does not screen, score, rank or vet anybody, and it
 * runs no background check.
 */
export const recruitmentAgencyV1: RegisteredVerticalPack = {
  blueprint: {
    id: "recruitment-agency-v1",
    version: "1.0.0",
    status: REGISTERED_STATUS,
    name: "Recruitment agency",
    vertical: "recruitment-agency",
    summary:
      "Runs each vacancy as a case for a client: brief and qualification, shortlist and interview stages as tasks, document requests that cannot be closed without the actual file, owner sign-off before a candidate is put forward, and a placement fee record. Interviews can be booked as appointments. No job-board posting, no CV parsing or ranking, no background checking and no candidate messaging: a document is a file that arrived, and no automated judgement is made about any person.",
    engines: [
      {
        engineId: "casesProjects",
        capabilities: ["pipeline", "delivery", "billing", "documents"],
        required: true,
        // `retainers` is available but deliberately not named: contingency is the ordinary model, so
        // requiring it would misdescribe the vertical and backlogging an available capability would be
        // a false statement.
      },
      {
        // Interviews. Optional because an agency that arranges them over the phone still runs vacancies
        // here. Only `reminders` is backlogged: an interview deposit is not a thing this vertical has.
        engineId: "appointments",
        capabilities: ["services", "availability"],
        required: false,
        plannedCapabilities: ["reminders"],
      },
    ],
    workflows: [
      {
        id: "recruitment-vacancy-opened",
        name: "Vacancy opened",
        trigger: { kind: "event", event: "case.created" },
        actions: [
          { id: "create-brief-task", kind: "createTask", label: "Create a task to confirm the vacancy brief" },
          { id: "audit-vacancy", kind: "recordAudit", label: "Record the vacancy state", auditSubject: "case" },
        ],
      },
      {
        id: "recruitment-compliance-documents",
        name: "Compliance document outstanding",
        trigger: { kind: "event", event: "case.document_requested" },
        actions: [
          { id: "chase-compliance-document", kind: "createTask", label: "Create a task to chase the outstanding document" },
          {
            id: "audit-compliance-document",
            kind: "recordAudit",
            label: "Record the document request state",
            auditSubject: "document",
          },
        ],
      },
      {
        id: "recruitment-candidate-submission",
        name: "Candidate ready to put forward",
        trigger: { kind: "manual" },
        actions: [
          {
            id: "approve-candidate-submission",
            kind: "requestApproval",
            label: "Owner sign-off before a candidate is put forward to a client",
            approval: {
              required: true,
              approverRole: "owner",
              reason:
                "Putting a person forward shares their personal information with a third party and stakes the agency's judgement on them; no automatic step should be able to do either.",
            },
          },
          {
            id: "audit-candidate-submission",
            kind: "recordAudit",
            label: "Record the submission decision",
            auditSubject: "case",
          },
        ],
      },
    ],
    ownerCopilotPrompts: [
      "Which vacancies have had no candidate put forward this week?",
      "Which candidates are missing a required document?",
      "Which placements have no fee record yet?",
    ],
  },
  readiness: "active-registered",
  registered: true,
  proposedTerminology: {
    calendar: "interview schedule",
    case: "vacancy",
    customer: "client",
    milestone: "hiring stage",
  },
  terminologyNote:
    "Role-derived. Preview resolves these labels from the RECRUITMENT_AGENCY onboarding role and tags them source: \"role-derived\".",
  intendedSurfaces: ["home", "profile", "inbox", "leads", "services", "calendar", "sales"],
  onboarding: {
    proposedRoleKey: "RECRUITMENT_AGENCY",
    correspondsToExistingRole: true,
    steps: [
      "List the roles or disciplines recruited for and the stages each vacancy passes through.",
      "List the documents a candidate must supply before being put forward.",
      "State whether interviews are booked in the product or arranged outside it.",
      "State how the placement fee is agreed, recorded as a note because no fee engine exists.",
    ],
    requiredOwnerDecisions: [
      "Who may put a candidate forward, since it discloses personal information to a client.",
      "How long candidate documents are retained, because the product applies no retention policy.",
      "Whether the agency works on contingency or retainer, which decides whether casesProjects:retainers should be composed at all.",
    ],
  },
  ownerWorkflow: {
    configuredWorkflowIds: [
      "recruitment-vacancy-opened",
      "recruitment-compliance-documents",
      "recruitment-candidate-submission",
    ],
    approvalGates: ["Owner sign-off before a candidate is put forward to a client."],
    executionNote:
      "Configuration only. workflow.ts exposes planWorkflowRun, which returns a plan; no consumer in this repository executes a blueprint workflow declaration, so nothing here runs on its own.",
  },
  dailyOpportunities: [
    {
      id: "recruitment-quiet-vacancies",
      prompt: "Which vacancies have had no movement this week?",
      readsFrom: ["casesProjects:pipeline", "casesProjects:delivery"],
    },
    {
      id: "recruitment-missing-documents",
      prompt: "Which candidates are missing a required document?",
      readsFrom: ["casesProjects:documents"],
    },
    {
      id: "recruitment-unbilled-placements",
      prompt: "Which placements have no fee record?",
      readsFrom: ["casesProjects:billing"],
    },
  ],
  unsupported: [
    {
      id: "recruitment-job-board-posting",
      label: "Posting to job boards or aggregators",
      reason: "No engine publishes to an external listing service and no such provider is wired.",
    },
    {
      id: "recruitment-cv-parsing",
      label: "CV parsing, scoring and ranking",
      reason:
        "casesProjects:documents records that a file was requested and received. It does not read the file, extract fields from it, or derive any score. No automated assessment of a person exists in this product.",
    },
    {
      id: "recruitment-background-checks",
      label: "Background, reference and right-to-work verification",
      reason:
        "Receiving a document is not verifying it. No verification provider is wired, and the product makes no claim that anything a candidate supplied is genuine.",
    },
    {
      id: "recruitment-candidate-messaging",
      label: "Messaging candidates",
      reason: "No messaging provider is wired anywhere in the product.",
    },
    {
      id: "recruitment-payroll",
      label: "Contractor timesheets and payroll",
      reason:
        "No engine models hours worked for pay or computes what anybody is owed. casesProjects:billing records an invoice and references a Payment; it originates neither.",
    },
    {
      id: "recruitment-candidate-pool-search",
      label: "Searchable candidate database across vacancies",
      reason:
        "A candidate exists here as a party to one case, not as a reusable profile in a pool. There is no cross-vacancy candidate entity to search.",
    },
  ],
  ownerGated: [
    {
      id: "recruitment-candidate-contact",
      label: "Contacting a candidate or client",
      gate: "The owner contacts them themselves; no messaging provider is wired.",
      boundary: "inert",
    },
    {
      id: "recruitment-interview-reminder",
      label: "Reminding anybody about an interview",
      gate: "The owner reminds them personally; the reminder record is persisted and delivers nothing.",
      boundary: "inert",
    },
  ],
  integrationNotes: [
    "Composes casesProjects and appointments only, both of which already back live blueprints, so it adds no engine and no migration.",
    "Its vertical string 'recruitment-agency' is unique in the active registry and maps from the RECRUITMENT_AGENCY onboarding role.",
    "An agency doing RETAINED search would want casesProjects:retainers added to the required composition. It is available, so that is a one-line change - but it is a change of what the pack claims about the vertical, and belongs to whoever registers it.",
    "This pack can hold personal documents about third parties. No retention, deletion or subject-access automation is claimed; owners remain responsible for those policies.",
  ],
}

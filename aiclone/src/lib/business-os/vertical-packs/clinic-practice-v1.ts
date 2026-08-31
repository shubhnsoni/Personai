import { CANDIDATE_STATUS } from "./types"
import type { VerticalPackCandidate } from "./types"

/**
 * Clinic practice - CANDIDATE, not registered. NON-CLINICAL ADMINISTRATION ONLY.
 *
 * WHAT THIS PACK IS: front-desk scheduling. Who is booked, with which practitioner, in which capacity
 * window, and who is waiting for a slot that frees up. That is `appointments:services`,
 * `:availability` and `:waitlist`, and it is the whole of it.
 *
 * WHAT THIS PACK IS NOT, stated as a boundary rather than a roadmap: it does not diagnose, does not
 * prescribe, does not advise on treatment, does not hold a medical record, makes no claim to handle
 * protected health information, models no hospital or inpatient workflow, and has no role in emergency
 * or urgent care. Each of those is enumerated in `unsupported` with its reason, and the verification
 * harness asserts every one of them is present and that no affirmative prose in this pack claims any of
 * them. A clinical claim here would not be an overstatement of a feature; it would be a safety problem.
 *
 * WHY `casesProjects:documents` IS DELIBERATELY NOT COMPOSED, even though it is available and would be
 * the obvious way to collect an identity document or an insurance form: it is a GENERAL document store
 * over `ProfileDocument`, with no content typing and no way to constrain what is uploaded into it. The
 * product therefore cannot ENFORCE an "administrative documents only" boundary - it could only ask for
 * one. Composing it would put a clinical-record-shaped hole in a pack whose entire justification is that
 * it holds no clinical record, so the capability is listed in `unsupported` instead. If a clinic needs
 * to collect administrative paperwork, that is a deliberate future decision requiring a real constraint,
 * not a capability to be inherited quietly.
 *
 * WHY NO COMMERCE COMPOSITION: selling anything from a clinic invites product recommendation, which is
 * adjacent to treatment advice. A booking pack does not need it, so it is not here.
 *
 * WHY REMINDERS AND DEPOSITS REMAIN BACKLOGGED: the same inert providers as everywhere else. It matters
 * more here, because a missed appointment reminder in a care setting is the kind of failure somebody
 * would reasonably assume the product prevents. It does not, and it must not imply that it does.
 */
export const clinicPracticeV1: VerticalPackCandidate = {
  blueprint: {
    id: "clinic-practice-v1",
    version: "1.0.0",
    status: CANDIDATE_STATUS,
    name: "Clinic practice administration",
    vertical: "clinic-practice",
    summary:
      "Front-desk scheduling for a practice, and nothing beyond it: bookable consultation slots with real capacity and overlap refusal, named practitioners with the hours they actually work, and a waitlist so a freed slot can be offered to somebody. This pack is administrative only. It holds no health information, keeps no record of what happened in an appointment, and has no part in urgent or emergency care. No reminder is delivered and no fee is taken: both records exist and both provider boundaries are inert.",
    engines: [
      {
        engineId: "appointments",
        capabilities: ["services", "availability", "waitlist"],
        required: true,
        // Inert providers. A required reminder would be a delivery claim, and in a care setting that
        // claim is the most dangerous one this pack could make.
        plannedCapabilities: ["reminders", "deposits"],
      },
      // No other engine is composed. casesProjects:documents is available and is deliberately excluded -
      // see the file header - and no commerce composition exists here at all.
    ],
    workflows: [
      {
        id: "clinic-booking-recorded",
        name: "Booking recorded",
        trigger: { kind: "event", event: "appointment.created" },
        actions: [
          {
            id: "audit-clinic-booking",
            kind: "recordAudit",
            label: "Record the booking state change",
            auditSubject: "appointment",
          },
        ],
      },
      {
        id: "clinic-missed-appointment",
        name: "Missed appointment recorded",
        trigger: { kind: "manual" },
        actions: [
          {
            id: "create-missed-appointment-task",
            kind: "createTask",
            label: "Create a front-desk task to follow up on the missed appointment",
          },
          {
            id: "audit-missed-appointment",
            kind: "recordAudit",
            label: "Record that the appointment was missed",
            auditSubject: "appointment",
          },
        ],
      },
      {
        id: "clinic-waitlist-offer",
        name: "Freed slot offered",
        trigger: { kind: "manual" },
        actions: [
          {
            id: "approve-clinic-waitlist-offer",
            kind: "requestApproval",
            label: "Practice owner decides who is offered the freed slot",
            approval: {
              required: true,
              approverRole: "owner",
              reason:
                "Deciding who is seen sooner is a judgement for the practice and must never be made automatically by scheduling software; nobody can be told automatically either, because no messaging provider is wired.",
            },
          },
          {
            id: "audit-clinic-waitlist-offer",
            kind: "recordAudit",
            label: "Record the offer decision",
            auditSubject: "waitlist",
          },
        ],
      },
    ],
    ownerCopilotPrompts: [
      "Which consultation slots are unfilled tomorrow?",
      "Which practitioners are fully booked this week?",
      "How many appointments were missed last week?",
    ],
  },
  readiness: "candidate-not-registered",
  registered: false,
  proposedTerminology: {
    calendar: "appointment diary",
    customer: "patient",
    staff: "practitioner",
    service: "consultation type",
  },
  terminologyNote:
    "Proposed only. BusinessBlueprint declares no terminology in this product; preview.ts resolves it from the onboarding role and tags it source: \"role-derived\". No role points at this candidate, so none of these labels resolves anywhere today. Note that \"patient\" here is a scheduling label for who holds a booking, and carries no health information.",
  intendedSurfaces: ["home", "profile", "inbox", "services", "calendar"],
  onboarding: {
    proposedRoleKey: "CLINIC_PRACTICE",
    correspondsToExistingRole: false,
    steps: [
      "List the consultation types offered and how long each takes.",
      "Name the practitioners and the hours each actually works.",
      "State the cancellation window the practice operates.",
      "Acknowledge that this pack stores no health information and keeps no record of what happens in an appointment.",
    ],
    requiredOwnerDecisions: [
      "Who is offered a freed slot, because the product must not make that judgement.",
      "How a patient is contacted at all, since no channel is wired and no reminder is delivered.",
      // Phrased so the negator sits in the SAME clause as "clinical records". The harness scans clauses,
      // not sentences, so a boundary statement has to deny the term next to the term.
      "That clinical records are not kept here and must live in a dedicated system.",
    ],
  },
  ownerWorkflow: {
    configuredWorkflowIds: ["clinic-booking-recorded", "clinic-missed-appointment", "clinic-waitlist-offer"],
    approvalGates: ["Practice owner decides who is offered a freed slot before the offer is recorded."],
    executionNote:
      "Configuration only. workflow.ts exposes planWorkflowRun, which returns a plan; no consumer in this repository executes a blueprint workflow declaration, so nothing here runs on its own.",
  },
  dailyOpportunities: [
    {
      id: "clinic-unfilled-slots",
      prompt: "Which consultation slots are unfilled in the next two days?",
      readsFrom: ["appointments:availability"],
    },
    {
      id: "clinic-waitlist-depth",
      prompt: "How many people are waiting for an earlier slot?",
      readsFrom: ["appointments:waitlist"],
    },
    {
      id: "clinic-missed-rate",
      prompt: "How many appointments were missed last week?",
      readsFrom: ["appointments:services"],
    },
  ],
  unsupported: [
    {
      id: "clinic-no-diagnosis",
      label: "Diagnosis of any kind",
      reason:
        "This pack schedules appointments. No engine models a symptom, a finding or a condition, and the product performs no assessment of anybody's health. Diagnosis is a clinician's act and is outside this software entirely.",
    },
    {
      id: "clinic-no-prescriptions",
      label: "Prescriptions and medication management",
      reason:
        "No engine models a medicine, a dose, a course or a dispensing event. Nothing here may be used to issue, alter or track a prescription.",
    },
    {
      id: "clinic-no-treatment-advice",
      label: "Treatment advice and care guidance",
      reason:
        "The product gives no clinical advice to a practitioner or to a patient. A scheduling record carries no clinical meaning and must not be presented as guidance about care.",
    },
    {
      id: "clinic-no-medical-records",
      label: "Medical records and clinical notes",
      reason:
        "There is no clinical record here and no place to put one. casesProjects:documents is available but deliberately NOT composed by this pack, because it is a general untyped document store and the product could not enforce a non-clinical boundary on it. Clinical records must live in a dedicated system.",
    },
    {
      id: "clinic-no-phi-claim",
      label: "Any claim to handle protected health information",
      reason:
        "This pack makes NO claim of compliance with any health-information regime, and no part of the product has been built or assessed for one. Because it stores no health information, it must not be relied upon as if it could.",
    },
    {
      id: "clinic-no-hospital-workflows",
      label: "Hospital, inpatient and theatre workflows",
      reason:
        "No engine models a bed, an admission, a discharge, a ward or an operating list. appointments:availability models a capacity window for an outpatient booking and nothing larger.",
    },
    {
      id: "clinic-no-emergency-care",
      label: "Emergency, urgent care and triage",
      reason:
        "Nothing here prioritises by clinical urgency. The waitlist is ordered by demand and promoted by an explicit human decision, and it must never be read as triage. This product has no role in an emergency.",
    },
    {
      id: "clinic-no-insurance-claims",
      label: "Insurance claims and billing to a payer",
      reason:
        "No engine models a payer, a policy, a claim or a reimbursement code, and no payment provider is wired anywhere in the product.",
    },
  ],
  ownerGated: [
    {
      id: "clinic-patient-contact",
      label: "Contacting a patient about anything",
      gate: "The practice contacts them directly; no messaging provider is wired and no reminder is delivered.",
      boundary: "inert",
    },
    {
      id: "clinic-consultation-fee",
      label: "Taking a consultation fee up front",
      gate: "The practice collects payment by its own means and records that it did.",
      boundary: "owner-gated",
    },
  ],
  integrationNotes: [
    "Composes exactly one engine (appointments) with three available capabilities. It adds no engine, no table and no migration, and it is the narrowest of the six candidates by design.",
    "Its vertical string 'clinic-practice' is claimed by no registered blueprint. Note the registered ca-practice-v1 is an ACCOUNTING practice and is unrelated despite the similar name.",
    "The non-clinical boundary is currently prose plus harness assertions. If this were ever registered, that boundary would need to be enforceable rather than asserted - most obviously by constraining any document capability before composing one.",
    "install-types.ts already names ClinicConfig in FORBIDDEN_TABLES. This pack respects that: it is declarative configuration over a shared engine, and it adds no vertical-specific storage of any kind.",
  ],
}

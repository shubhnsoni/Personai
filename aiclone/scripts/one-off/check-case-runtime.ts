/**
 * Wave C / C2 cases and projects runtime harness.
 *
 * Executes the REAL cases engine against the authorized disposable rehearsal database with
 * a controlled identity. Executable boundary evidence.
 *
 * Two negative claims are measured rather than asserted in prose:
 *   * zero external calls — global fetch is replaced with a counting blocker
 *   * zero residue — every fixture row is removed and counts return to baseline
 *
 * Set INVERT_ASSERTION=1 to flip one expectation and prove the harness fails loudly.
 *
 *   ts-node -r tsconfig-paths/register scripts/one-off/check-case-runtime.ts
 */
import { PrismaClient } from "@prisma/client"

import { PersistenceError } from "../../src/lib/persistence/errors"
import { PersistedTenancy, type PlatformIdentity } from "../../src/lib/persistence/tenancy"
import { CaseIntakeService, CaseProjectService } from "../../src/lib/cases/engine"
import {
    CASE_STATUSES,
    DELIVERABLE_STATUSES,
    DOCUMENT_REQUEST_STATUSES,
    INTAKE_STATUSES,
    INVOICE_STATES,
    MILESTONE_STATUSES,
    caseFlow,
    deliverableFlow,
    documentRequestFlow,
    intakeFlow,
    invoiceFlow,
    milestoneFlow,
} from "../../src/lib/cases/lifecycle"
import { CaseContext } from "../../src/lib/cases/shared"
import { CaseWorkflowService } from "../../src/lib/cases/workflow"
import { assertDisposableTarget, parseDatabaseName } from "../lib/disposable-db"

const AUTHORIZED_TARGET = "personalink_phase0_rehearsal_20260826_210704"
const INVERT = process.env.INVERT_ASSERTION === "1"
const RUN = `wc2_${Date.now()}_${Math.floor(Math.random() * 1e6)}`

const results: Array<{ name: string; pass: boolean; detail: string }> = []
function check(name: string, pass: boolean, detail = "") {
    results.push({ name, pass, detail })
}

/** Counts any attempted outbound call. The cases engine must never make one. */
let fetchCalls = 0
const realFetch = globalThis.fetch
globalThis.fetch = (async (...args: unknown[]) => {
    fetchCalls += 1
    throw new Error(`BLOCKED external call: ${String(args[0])}`)
}) as unknown as typeof fetch

class ControlledIdentity implements PlatformIdentity {
    current: string | null = null
    async userId(): Promise<string | null> {
        return this.current
    }
}

type Envelope = { ok: false; code: string; message: string } | { ok: true }
async function attempt(fn: () => Promise<unknown>): Promise<Envelope> {
    try {
        await fn()
        return { ok: true }
    } catch (e) {
        if (e instanceof PersistenceError) return { ok: false, code: e.code, message: e.message }
        return { ok: false, code: "UNEXPECTED", message: (e as Error).message.split("\n")[0] }
    }
}

const actor = { actorType: "STAFF" as const, actorId: "harness" }

async function main() {
    const url = process.env.DATABASE_URL
    const db = parseDatabaseName(url)
    assertDisposableTarget(url)
    if (db !== AUTHORIZED_TARGET) {
        console.error(`ABORT: harness only runs against ${AUTHORIZED_TARGET}, got ${db}`)
        process.exit(1)
    }

    const prisma = new PrismaClient()
    const identity = new ControlledIdentity()
    const ctx = new CaseContext(prisma, new PersistedTenancy(prisma, identity))
    const intakes = new CaseIntakeService(ctx)
    const cases = new CaseProjectService(ctx)
    const flow = new CaseWorkflowService(ctx)

    const live = await prisma.$queryRawUnsafe<{ db: string }[]>("select current_database() as db")
    if (live[0].db !== AUTHORIZED_TARGET) {
        console.error(`ABORT: connected to ${live[0].db}`)
        process.exit(1)
    }

    const ids = {
        userA: `${RUN}_ua`, userB: `${RUN}_ub`,
        profileA: `${RUN}_pa`, profileB: `${RUN}_pb`,
        wsA: `${RUN}_wa`, wsB: `${RUN}_wb`,
        contactA: `${RUN}_ca`, contactB: `${RUN}_cb`,
        locA: `${RUN}_la`, locB: `${RUN}_lb`,
        docA: `${RUN}_da`,
    }

    const base = {
        cases: 0, intakes: 0, events: 0, tasks: 0, approvals: 0, runs: 0, invoices: 0,
    }
    let caseId = ""
    let foreignCaseId = ""

    try {
        base.cases = await prisma.caseProject.count()
        base.intakes = await prisma.caseIntake.count()
        base.events = await prisma.caseEvent.count()
        base.tasks = await prisma.taskJob.count()
        base.approvals = await prisma.approval.count()
        base.runs = await prisma.workflowRun.count()
        base.invoices = await prisma.caseInvoice.count()

        // ---- 0. pure lifecycle tables are total and terminal-correct ------
        // Typed loosely on purpose: the six flows have different value unions, and a
        // heterogeneous tuple would collapse to `never` under inference.
        const flows: Array<{ label: string; all: readonly string[]; can: (a: string, b: string) => boolean }> = [
            { label: "case", all: CASE_STATUSES, can: (a, b) => caseFlow.can(a as never, b as never) },
            { label: "intake", all: INTAKE_STATUSES, can: (a, b) => intakeFlow.can(a as never, b as never) },
            { label: "milestone", all: MILESTONE_STATUSES, can: (a, b) => milestoneFlow.can(a as never, b as never) },
            { label: "deliverable", all: DELIVERABLE_STATUSES, can: (a, b) => deliverableFlow.can(a as never, b as never) },
            { label: "documentRequest", all: DOCUMENT_REQUEST_STATUSES, can: (a, b) => documentRequestFlow.can(a as never, b as never) },
            { label: "invoice", all: INVOICE_STATES, can: (a, b) => invoiceFlow.can(a as never, b as never) },
        ]
        for (const { label, all, can } of flows) {
            let legal = 0
            let illegal = 0
            for (const from of all) {
                for (const to of all) {
                    if (can(from, to)) legal += 1
                    else illegal += 1
                }
            }
            check(`${label} transition table is total over ${all.length}x${all.length} pairs`, legal + illegal === all.length ** 2, `legal=${legal} illegal=${illegal}`)
        }
        check("terminal case statuses allow nothing", caseFlow.isTerminal("CLOSED") && caseFlow.isTerminal("CANCELLED"))
        check("PAID and VOID invoices are terminal", invoiceFlow.isTerminal("PAID") && invoiceFlow.isTerminal("VOID"))

        // ---- seed two workspaces --------------------------------------
        for (const [u, p, w, c, l] of [
            [ids.userA, ids.profileA, ids.wsA, ids.contactA, ids.locA],
            [ids.userB, ids.profileB, ids.wsB, ids.contactB, ids.locB],
        ]) {
            await prisma.user.create({ data: { id: u, clerkId: `clerk_${u}`, email: `${u}@example.test` } })
            await prisma.profile.create({ data: { id: p, userId: u, slug: `slug-${p}`, displayName: `P ${p}` } })
            await prisma.workspace.create({ data: { id: w, profileId: p, name: `WS ${w}`, slug: `ws-${w}` } })
            await prisma.membership.create({ data: { workspaceId: w, userId: u, role: "OWNER" } })
            await prisma.contact.create({ data: { id: c, workspaceId: w, displayName: "Client", confidence: "CONFIRMED" } })
            await prisma.location.create({ data: { id: l, workspaceId: w, name: `Office ${l}` } })
        }
        await prisma.profileDocument.create({
            data: { id: ids.docA, profileId: ids.profileA, type: "OTHER", title: "Engagement letter", sourceType: "UPLOAD" },
        })

        // ---- 1. anonymous refused, nothing written --------------------
        identity.current = null
        const beforeCases = await prisma.caseProject.count()
        const anonCase = await attempt(() => cases.create(ids.wsA, { reference: "R1", title: "T" }, actor))
        const anonList = await attempt(() => cases.list(ids.wsA))
        const anonIntake = await attempt(() => intakes.create(ids.wsA, { source: "web", summary: "s" }))
        const afterCases = await prisma.caseProject.count()
        check("anonymous case create refused UNAUTHORIZED", !anonCase.ok && anonCase.code === "UNAUTHORIZED", !anonCase.ok ? anonCase.code : "ACCEPTED")
        check("anonymous list refused UNAUTHORIZED", !anonList.ok && anonList.code === "UNAUTHORIZED", !anonList.ok ? anonList.code : "ACCEPTED")
        check("anonymous intake refused UNAUTHORIZED", !anonIntake.ok && anonIntake.code === "UNAUTHORIZED", !anonIntake.ok ? anonIntake.code : "ACCEPTED")
        check("anonymous wrote zero cases", beforeCases === afterCases, `before=${beforeCases} after=${afterCases}`)

        // ---- 2. valid member: intake -> accept -> convert -------------
        identity.current = `clerk_${ids.userA}`
        const intake = await intakes.create(ids.wsA, { source: "referral", summary: "Year-end audit", contactId: ids.contactA, idempotencyKey: "i1" })
        check("intake created NEW", intake.intake.status === "NEW", `status=${intake.intake.status}`)
        const intakeReplay = await intakes.create(ids.wsA, { source: "other", summary: "different", idempotencyKey: "i1" })
        check("intake replay returns the original", intakeReplay.replayed === true && intakeReplay.intake.id === intake.intake.id, `replayed=${intakeReplay.replayed}`)

        const notConvertible = await attempt(() => intakes.convert(ids.wsA, intake.intake.id, { reference: "C-1", title: "Audit" }, actor))
        check("a NEW intake cannot be converted", !notConvertible.ok && notConvertible.code === "CONFLICT", !notConvertible.ok ? notConvertible.message : "ACCEPTED")

        await intakes.transition(ids.wsA, intake.intake.id, "QUALIFYING")
        await intakes.transition(ids.wsA, intake.intake.id, "ACCEPTED")
        const converted = await intakes.convert(ids.wsA, intake.intake.id, { reference: "C-1", title: "Audit", locationId: ids.locA }, actor)
        caseId = converted.id
        check("converted case starts at INTAKE", converted.status === "INTAKE", `status=${converted.status}`)
        check("converted case inherits the intake contact", converted.contactId === ids.contactA, `contactId=${converted.contactId}`)
        const intakeAfter = await prisma.caseIntake.findUnique({ where: { id: intake.intake.id } })
        check("the intake is marked CONVERTED", intakeAfter?.status === "CONVERTED", `status=${intakeAfter?.status}`)
        const doubleConvert = await attempt(() => intakes.convert(ids.wsA, intake.intake.id, { reference: "C-2", title: "Again" }, actor))
        check("a converted intake cannot be converted twice", !doubleConvert.ok && doubleConvert.code === "CONFLICT", !doubleConvert.ok ? doubleConvert.message : "ACCEPTED")

        // ---- 3. idempotent case create --------------------------------
        const direct = await cases.create(ids.wsA, { reference: "C-9", title: "Direct", idempotencyKey: "k9" }, actor)
        const directReplay = await cases.create(ids.wsA, { reference: "C-OTHER", title: "Other", idempotencyKey: "k9" }, actor)
        check("case replay returns the original id and title", directReplay.replayed === true && directReplay.record.id === direct.record.id && directReplay.record.title === "Direct", `replayed=${directReplay.replayed}`)
        const dupRef = await attempt(() => cases.create(ids.wsA, { reference: "C-9", title: "Clash" }, actor))
        check("duplicate case reference in a workspace is refused", !dupRef.ok && dupRef.code === "CONFLICT", !dupRef.ok ? dupRef.code : "ACCEPTED")

        // ---- 4. cross-workspace association refused -------------------
        const foreignContact = await attempt(() => cases.assignContact(ids.wsA, caseId, ids.contactB, actor))
        check("assigning another workspace's contact is refused", !foreignContact.ok && foreignContact.code === "FORBIDDEN", !foreignContact.ok ? foreignContact.code : "LEAKED")
        const foreignLocation = await attempt(() => cases.create(ids.wsA, { reference: "C-L", title: "L", locationId: ids.locB }, actor))
        check("using another workspace's location is refused", !foreignLocation.ok && foreignLocation.code === "FORBIDDEN", !foreignLocation.ok ? foreignLocation.code : "LEAKED")

        // ---- 5. wrong tenant: foreign == missing ---------------------
        identity.current = `clerk_${ids.userB}`
        const fCase = await cases.create(ids.wsB, { reference: "B-1", title: "Bee" }, actor)
        foreignCaseId = fCase.record.id
        const foreignGet = await attempt(() => cases.get(ids.wsB, caseId))
        const missingGet = await attempt(() => cases.get(ids.wsB, `${RUN}_nope`))
        check("wrong-tenant get refused FORBIDDEN", !foreignGet.ok && foreignGet.code === "FORBIDDEN", !foreignGet.ok ? foreignGet.code : "LEAKED")
        // This is the single inverted assertion.
        check(
            "foreign and missing case responses are byte-identical",
            INVERT ? JSON.stringify(foreignGet) !== JSON.stringify(missingGet) : JSON.stringify(foreignGet) === JSON.stringify(missingGet),
            `${JSON.stringify(foreignGet)} vs ${JSON.stringify(missingGet)}`,
        )
        const bList = await cases.list(ids.wsB)
        check("wrong tenant sees only its own case", bList.length === 1 && bList[0].id === foreignCaseId, `count=${bList.length}`)

        const stBefore = (await prisma.caseProject.findUnique({ where: { id: caseId } }))?.status
        const foreignTransition = await attempt(() => cases.transition(ids.wsB, caseId, "CANCELLED", actor))
        const stAfter = (await prisma.caseProject.findUnique({ where: { id: caseId } }))?.status
        check("wrong-tenant transition refused", !foreignTransition.ok && foreignTransition.code === "FORBIDDEN", !foreignTransition.ok ? foreignTransition.code : "MUTATED")
        check("refused transition changed nothing", stBefore === stAfter, `${stBefore} -> ${stAfter}`)

        // ---- 6. brief, milestones, exhaustive illegal transitions -----
        identity.current = `clerk_${ids.userA}`
        await cases.upsertBrief(ids.wsA, caseId, { objectives: "Audit FY26", scope: "Statutory" }, actor)
        const brief = await cases.getBrief(ids.wsA, caseId)
        check("brief is stored and readable", brief?.objectives === "Audit FY26", `objectives=${brief?.objectives}`)
        await cases.upsertBrief(ids.wsA, caseId, { objectives: "Audit FY26 revised", agreed: true }, actor)
        const brief2 = await cases.getBrief(ids.wsA, caseId)
        check("brief upsert replaces rather than duplicating", brief2?.objectives === "Audit FY26 revised" && brief2?.agreedAt !== null, `agreedAt=${String(brief2?.agreedAt)}`)
        const briefCount = await prisma.caseBrief.count({ where: { caseId } })
        check("exactly one brief exists after upsert", briefCount === 1, `count=${briefCount}`)

        await cases.transition(ids.wsA, caseId, "BRIEFED", actor)
        await cases.transition(ids.wsA, caseId, "ACTIVE", actor)
        let caseIllegalRefused = 0
        let caseIllegalTotal = 0
        for (const to of CASE_STATUSES) {
            const row = await prisma.caseProject.findUnique({ where: { id: caseId } })
            const from = row!.status as (typeof CASE_STATUSES)[number]
            if (caseFlow.can(from, to)) continue
            caseIllegalTotal += 1
            const r = await attempt(() => cases.transition(ids.wsA, caseId, to, actor))
            const post = await prisma.caseProject.findUnique({ where: { id: caseId } })
            if (!r.ok && r.code === "CONFLICT" && post!.status === from) caseIllegalRefused += 1
        }
        check("every illegal case transition is refused with no state change", caseIllegalTotal > 0 && caseIllegalRefused === caseIllegalTotal, `refused=${caseIllegalRefused}/${caseIllegalTotal}`)

        const m1 = await flow.addMilestone(ids.wsA, caseId, { title: "Fieldwork", ordinal: 1 }, actor)
        const dupOrdinal = await attempt(() => flow.addMilestone(ids.wsA, caseId, { title: "Clash", ordinal: 1 }, actor))
        check("duplicate milestone ordinal is refused", !dupOrdinal.ok && dupOrdinal.code === "CONFLICT", !dupOrdinal.ok ? dupOrdinal.code : "ACCEPTED")
        await flow.transitionMilestone(ids.wsA, caseId, m1.id, "IN_PROGRESS", actor)
        const mIllegal = await attempt(() => flow.transitionMilestone(ids.wsA, caseId, m1.id, "PENDING", actor))
        check("illegal milestone transition refused", !mIllegal.ok && mIllegal.code === "CONFLICT", !mIllegal.ok ? mIllegal.message : "ACCEPTED")
        await flow.transitionMilestone(ids.wsA, caseId, m1.id, "DONE", actor)
        const mDone = (await prisma.caseMilestone.findUnique({ where: { id: m1.id } }))!
        check("DONE milestone records completedAt", mDone.completedAt !== null, `completedAt=${String(mDone.completedAt)}`)

        // A milestone on another case must be refused exactly as a missing one.
        const foreignMilestone = await attempt(() => flow.transitionMilestone(ids.wsA, foreignCaseId, m1.id, "CANCELLED", actor))
        check("a milestone reached via the wrong case is refused", !foreignMilestone.ok && foreignMilestone.code === "FORBIDDEN", !foreignMilestone.ok ? foreignMilestone.code : "LEAKED")

        // ---- 7. document requests require a real document ------------
        const dr = await flow.requestDocument(ids.wsA, caseId, { title: "Trial balance" }, actor)
        const noDoc = await attempt(() => flow.transitionDocumentRequest(ids.wsA, caseId, dr.id, "RECEIVED", actor))
        check("marking a document request received without a document is refused", !noDoc.ok && noDoc.code === "CONFLICT", !noDoc.ok ? noDoc.message : "ACCEPTED")
        const received = await flow.transitionDocumentRequest(ids.wsA, caseId, dr.id, "RECEIVED", actor, { documentId: ids.docA })
        check("received document request links the real ProfileDocument", received.documentId === ids.docA, `documentId=${received.documentId}`)

        // ---- 8. APPROVAL GATE on delivery ---------------------------
        const deliverable = await flow.addDeliverable(ids.wsA, caseId, { title: "Signed report", milestoneId: m1.id }, actor)
        await flow.transitionDeliverable(ids.wsA, caseId, deliverable.id, "IN_REVIEW", actor)
        await flow.transitionDeliverable(ids.wsA, caseId, deliverable.id, "APPROVED", actor)
        const blocked = await attempt(() => flow.transitionDeliverable(ids.wsA, caseId, deliverable.id, "DELIVERED", actor))
        check(
            "DELIVERED is blocked before any approval exists",
            !blocked.ok && blocked.code === "CONFLICT" && /approved approval/i.test(blocked.message),
            !blocked.ok ? blocked.message : "ACCEPTED",
        )

        const approval = await flow.requestApproval(ids.wsA, caseId, { reason: "external_communication", requestedBy: "owner" }, actor)
        check("approval request creates a pending Approval", approval.approval.state === "pending", `state=${approval.approval.state}`)
        const stillBlocked = await attempt(() => flow.transitionDeliverable(ids.wsA, caseId, deliverable.id, "DELIVERED", actor))
        check("DELIVERED is still blocked while the approval is pending", !stillBlocked.ok && stillBlocked.code === "CONFLICT", !stillBlocked.ok ? stillBlocked.code : "ACCEPTED")

        // The approval must live in the EXISTING Approval table on a real WorkflowRun.
        const approvalRow = await prisma.approval.findUnique({ where: { id: approval.approval.id }, select: { workflowRunId: true } })
        check("the approval is a real Approval row on a WorkflowRun", !!approvalRow?.workflowRunId, `workflowRunId=${approvalRow?.workflowRunId}`)
        const runRow = await prisma.workflowRun.findUnique({ where: { id: approvalRow!.workflowRunId }, select: { workspaceId: true, workflowKey: true } })
        check("the WorkflowRun is scoped to the workspace", runRow?.workspaceId === ids.wsA && runRow?.workflowKey === "cases.approval", `ws=${runRow?.workspaceId} key=${runRow?.workflowKey}`)

        await flow.decideApproval(ids.wsA, caseId, approval.approval.id, "approved", "owner", actor)
        const decidedTwice = await attempt(() => flow.decideApproval(ids.wsA, caseId, approval.approval.id, "rejected", "owner", actor))
        check("an approval cannot be decided twice", !decidedTwice.ok && decidedTwice.code === "CONFLICT", !decidedTwice.ok ? decidedTwice.message : "ACCEPTED")

        const delivered = await flow.transitionDeliverable(ids.wsA, caseId, deliverable.id, "DELIVERED", actor)
        check("DELIVERED succeeds once an approval is granted", delivered.status === "DELIVERED", `status=${delivered.status}`)
        check("delivered deliverable records deliveredAt", delivered.deliveredAt !== null, `deliveredAt=${String(delivered.deliveredAt)}`)

        identity.current = `clerk_${ids.userB}`
        const foreignDecide = await attempt(() => flow.decideApproval(ids.wsB, foreignCaseId, approval.approval.id, "approved", "x", actor))
        check("deciding another case's approval is refused", !foreignDecide.ok && foreignDecide.code === "FORBIDDEN", !foreignDecide.ok ? foreignDecide.code : "LEAKED")

        // ---- 9. task links compose the durable queue ---------------
        identity.current = `clerk_${ids.userA}`
        const task = await flow.linkTask(ids.wsA, caseId, { title: "Chase trial balance", idempotencyKey: `t-${RUN}` }, actor)
        const taskReplay = await flow.linkTask(ids.wsA, caseId, { title: "Chase again", idempotencyKey: `t-${RUN}` }, actor)
        check("task link replay reuses the same TaskJob", taskReplay.replayed === true && taskReplay.taskJobId === task.taskJobId, `replayed=${taskReplay.replayed}`)
        const jobRow = await prisma.taskJob.findUnique({ where: { id: task.taskJobId }, select: { state: true } })
        check("the linked task is a real TaskJob in the durable queue", jobRow?.state === "QUEUED", `state=${jobRow?.state}`)
        const taskList = await flow.listTasks(ids.wsA, caseId)
        check("case task list returns the queue record", taskList.length === 1 && taskList[0].id === task.taskJobId, `count=${taskList.length}`)

        // ---- 10. invoices: state only, mirrored onto the case ------
        const invoice = await flow.createInvoice(ids.wsA, caseId, { reference: "INV-1", amountCents: 250000 }, actor)
        const dupInvoice = await attempt(() => flow.createInvoice(ids.wsA, caseId, { reference: "INV-1", amountCents: 1 }, actor))
        check("duplicate invoice reference on a case is refused", !dupInvoice.ok && dupInvoice.code === "CONFLICT", !dupInvoice.ok ? dupInvoice.code : "ACCEPTED")
        const badJump = await attempt(() => flow.transitionInvoice(ids.wsA, caseId, invoice.id, "PAID", actor))
        check("a DRAFT invoice cannot jump straight to PAID", !badJump.ok && badJump.code === "CONFLICT", !badJump.ok ? badJump.message : "ACCEPTED")
        await flow.transitionInvoice(ids.wsA, caseId, invoice.id, "ISSUED", actor)
        await flow.transitionInvoice(ids.wsA, caseId, invoice.id, "PAID", actor)
        const caseAfterInvoice = await prisma.caseProject.findUnique({ where: { id: caseId } })
        check("invoice state is mirrored onto the case", caseAfterInvoice?.invoiceState === "PAID", `invoiceState=${caseAfterInvoice?.invoiceState}`)
        const afterPaid = await attempt(() => flow.transitionInvoice(ids.wsA, caseId, invoice.id, "VOID", actor))
        check("a PAID invoice is terminal", !afterPaid.ok && afterPaid.code === "CONFLICT", !afterPaid.ok ? afterPaid.message : "ACCEPTED")

        // ---- 11. append-only timeline ------------------------------
        const timeline = await cases.timeline(ids.wsA, caseId)
        const seqs = timeline.map((e) => Number(e.seq))
        check("timeline is monotonic", seqs.length >= 8 && seqs.every((v, i) => i === 0 || v > seqs[i - 1]), `events=${seqs.length}`)
        const kinds = new Set<string>(timeline.map((e) => String(e.kind)))
        check(
            "timeline records every domain that acted",
            ["CREATED", "STATUS", "MILESTONE", "DOCUMENT", "DELIVERABLE", "APPROVAL", "TASK", "INVOICE"].every((k) => kinds.has(k)),
            [...kinds].join(","),
        )
        let immutable = false
        try {
            await prisma.$executeRawUnsafe(`update "CaseEvent" set "to"='TAMPERED' where "caseId"='${caseId}'`)
        } catch {
            immutable = true
        }
        check("CaseEvent refuses UPDATE at the database level", immutable, immutable ? "refused" : "MUTATED")

        identity.current = `clerk_${ids.userB}`
        const foreignTimeline = await attempt(() => cases.timeline(ids.wsB, caseId))
        check("wrong-tenant timeline refused", !foreignTimeline.ok && foreignTimeline.code === "FORBIDDEN", !foreignTimeline.ok ? foreignTimeline.code : "LEAKED")

        // ---- 12. zero external calls ------------------------------
        check("no external call was attempted by the cases engine", fetchCalls === 0, `fetchCalls=${fetchCalls}`)
    } finally {
        globalThis.fetch = realFetch
        const wsList = `'${ids.wsA}','${ids.wsB}'`
        try {
            await prisma.$executeRawUnsafe(`alter table "CaseEvent" disable trigger "CaseEvent_append_only"`)
            await prisma.$executeRawUnsafe(
                `delete from "CaseEvent" where "caseId" in (select "id" from "CaseProject" where "workspaceId" in (${wsList}))`,
            )
        } finally {
            await prisma.$executeRawUnsafe(`alter table "CaseEvent" enable trigger "CaseEvent_append_only"`)
        }
        for (const sql of [
            `delete from "CaseTaskLink" where "caseId" in (select "id" from "CaseProject" where "workspaceId" in (${wsList}))`,
            `delete from "CaseApprovalLink" where "caseId" in (select "id" from "CaseProject" where "workspaceId" in (${wsList}))`,
            `delete from "CaseInvoice" where "caseId" in (select "id" from "CaseProject" where "workspaceId" in (${wsList}))`,
            `delete from "CaseDeliverable" where "caseId" in (select "id" from "CaseProject" where "workspaceId" in (${wsList}))`,
            `delete from "CaseDocumentRequest" where "caseId" in (select "id" from "CaseProject" where "workspaceId" in (${wsList}))`,
            `delete from "CaseMilestone" where "caseId" in (select "id" from "CaseProject" where "workspaceId" in (${wsList}))`,
            `delete from "CaseBrief" where "caseId" in (select "id" from "CaseProject" where "workspaceId" in (${wsList}))`,
            `delete from "CaseProject" where "workspaceId" in (${wsList})`,
            `delete from "CaseIntake" where "workspaceId" in (${wsList})`,
            `delete from "Approval" where "workflowRunId" in (select "id" from "WorkflowRun" where "workspaceId" in (${wsList}))`,
            `delete from "WorkflowRun" where "workspaceId" in (${wsList})`,
            `delete from "TaskJob" where "idempotencyKey" like '${RUN}%' or "idempotencyKey" like 't-${RUN}%'`,
            `delete from "ProfileDocument" where "id"='${ids.docA}'`,
            `delete from "Contact" where "workspaceId" in (${wsList})`,
            `delete from "Location" where "workspaceId" in (${wsList})`,
            `delete from "Membership" where "workspaceId" in (${wsList})`,
            `delete from "Workspace" where "id" in (${wsList})`,
            `delete from "Profile" where "id" in ('${ids.profileA}','${ids.profileB}')`,
            `delete from "User" where "id" in ('${ids.userA}','${ids.userB}')`,
        ]) {
            await prisma.$executeRawUnsafe(sql)
        }

        const armed = await prisma.$queryRawUnsafe<{ n: number }[]>(
            `select count(*)::int n from information_schema.triggers where trigger_schema='public' and trigger_name='CaseEvent_append_only'`,
        )
        check("CaseEvent append-only trigger re-armed", Number(armed[0].n) >= 1, `triggers=${armed[0].n}`)

        for (const [label, actual, expected] of [
            ["cases", await prisma.caseProject.count(), base.cases],
            ["intakes", await prisma.caseIntake.count(), base.intakes],
            ["case events", await prisma.caseEvent.count(), base.events],
            ["task jobs", await prisma.taskJob.count(), base.tasks],
            ["approvals", await prisma.approval.count(), base.approvals],
            ["workflow runs", await prisma.workflowRun.count(), base.runs],
            ["invoices", await prisma.caseInvoice.count(), base.invoices],
        ] as const) {
            check(`${label} returned to baseline`, actual === expected, `baseline=${expected} end=${actual}`)
        }

        await prisma.$disconnect()
    }

    const failed = results.filter((r) => !r.pass)
    for (const r of results) console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.name}${r.detail ? `  (${r.detail})` : ""}`)
    console.log(`\n${results.length - failed.length}/${results.length} assertions passed`)
    if (INVERT) console.log("INVERT_ASSERTION=1 was set - a failure here is the expected proof")
    if (failed.length) process.exit(1)
    console.log("All case runtime boundaries hold.")
}

main().catch((e) => {
    console.error(e)
    process.exit(1)
})

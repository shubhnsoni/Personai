/**
 * Wave C / C3 cases HTTP boundary harness.
 *
 * Invokes the REAL CaseApiService — the same object the route files under
 * src/app/api/platform/cases/** and /case-intakes/** re-export — with a controlled
 * identity, and asserts status, envelope and body for every principal class.
 *
 * Negative claims are measured, not asserted in prose:
 *   - a refusal writes no row and appends no CaseEvent (counts before/after)
 *   - a refusal reaches no external service (globalThis.fetch is replaced by a
 *     counting blocker for the whole run; any call is both counted and thrown)
 *   - a foreign case and a nonexistent case produce byte-identical responses
 *
 * Set INVERT_ASSERTION=1 to flip one expectation and prove the harness fails loudly.
 *
 *   ts-node -r tsconfig-paths/register scripts/one-off/check-case-routes.ts
 */
import { PrismaClient } from "@prisma/client"

import { CaseIntakeService, CaseProjectService } from "../../src/lib/cases/engine"
import { CaseApiService } from "../../src/lib/cases/http"
import { CaseContext } from "../../src/lib/cases/shared"
import { CaseWorkflowService } from "../../src/lib/cases/workflow"
import { PersistedTenancy, type PlatformIdentity } from "../../src/lib/persistence/tenancy"
import { assertDisposableTarget, parseDatabaseName } from "../lib/disposable-db"

const AUTHORIZED_TARGET = "personalink_phase0_rehearsal_20260826_210704"
const INVERT = process.env.INVERT_ASSERTION === "1"
const RUN = `wc3_${Date.now()}_${Math.floor(Math.random() * 1e6)}`
const CASES = "http://127.0.0.1/api/platform/cases"
const INTAKES = "http://127.0.0.1/api/platform/case-intakes"

const results: Array<{ name: string; pass: boolean; detail: string }> = []
function check(name: string, pass: boolean, detail = "") {
    results.push({ name, pass, detail })
}

class ControlledIdentity implements PlatformIdentity {
    current: string | null = null
    async userId(): Promise<string | null> {
        return this.current
    }
}

/** Any outbound HTTP during this run is a defect, so it is counted AND refused. */
let fetchCalls = 0
const realFetch = globalThis.fetch
globalThis.fetch = (async (...args: unknown[]) => {
    fetchCalls += 1
    throw new Error(`external fetch is forbidden in this harness: ${String(args[0])}`)
}) as unknown as typeof globalThis.fetch

type Seen = { status: number; body: unknown; text: string }
async function call(res: Promise<Response>): Promise<Seen> {
    const r = await res
    const text = await r.text()
    let body: unknown = null
    try {
        body = JSON.parse(text)
    } catch {
        body = null
    }
    return { status: r.status, body, text }
}

function asRecord(v: unknown): Record<string, unknown> {
    return v !== null && typeof v === "object" ? (v as Record<string, unknown>) : {}
}
function pick(v: unknown, ...path: readonly string[]): unknown {
    let cur: unknown = v
    for (const k of path) cur = asRecord(cur)[k]
    return cur
}
function pickString(v: unknown, ...path: readonly string[]): string {
    const f = pick(v, ...path)
    return typeof f === "string" ? f : ""
}
function pickArray(v: unknown, ...path: readonly string[]): readonly unknown[] {
    const f = pick(v, ...path)
    return Array.isArray(f) ? f : []
}
function keys(v: unknown): string {
    return Object.keys(asRecord(v)).sort().join(",")
}

const get = (url: string) => new Request(url)
const send = (url: string, payload: unknown, method = "POST") =>
    new Request(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(payload) })
const malformed = (url: string, method = "POST") =>
    new Request(url, { method, headers: { "content-type": "application/json" }, body: "{not json" })

async function main() {
    const url = process.env.DATABASE_URL
    const dbName = parseDatabaseName(url)
    assertDisposableTarget(url)
    if (dbName !== AUTHORIZED_TARGET) {
        console.error(`ABORT: harness only runs against ${AUTHORIZED_TARGET}, got ${dbName}`)
        process.exit(1)
    }

    const prisma = new PrismaClient()
    const identity = new ControlledIdentity()
    const tenancy = new PersistedTenancy(prisma, identity)
    const ctx = new CaseContext(prisma, tenancy)
    const api = new CaseApiService(
        new CaseIntakeService(ctx),
        new CaseProjectService(ctx),
        new CaseWorkflowService(ctx),
    )

    const live = await prisma.$queryRawUnsafe<{ db: string }[]>("select current_database() as db")
    if (live[0].db !== AUTHORIZED_TARGET) {
        console.error(`ABORT: connected to ${live[0].db}`)
        process.exit(1)
    }

    const ids = {
        userA: `${RUN}_ua`, userB: `${RUN}_ub`, userC: `${RUN}_uc`,
        profileA: `${RUN}_pa`, profileB: `${RUN}_pb`,
        wsA: `${RUN}_wa`, wsB: `${RUN}_wb`,
        contactA: `${RUN}_ca`, contactB: `${RUN}_cb`,
        locA: `${RUN}_la`,
        docA: `${RUN}_da`,
    }
    const wsList = `'${ids.wsA}','${ids.wsB}'`
    const base = { cases: 0, intakes: 0, events: 0, invoices: 0, approvals: 0, tasks: 0 }
    let caseId = ""
    let foreignCaseId = ""

    try {
        base.cases = await prisma.caseProject.count()
        base.intakes = await prisma.caseIntake.count()
        base.events = await prisma.caseEvent.count()
        base.invoices = await prisma.caseInvoice.count()
        base.approvals = await prisma.approval.count()
        base.tasks = await prisma.taskJob.count()

        // ---- seed: two tenants, plus a provisioned user with no membership ----
        for (const [u, p, w, c] of [
            [ids.userA, ids.profileA, ids.wsA, ids.contactA],
            [ids.userB, ids.profileB, ids.wsB, ids.contactB],
        ]) {
            await prisma.user.create({ data: { id: u, clerkId: `clerk_${u}`, email: `${u}@example.test` } })
            await prisma.profile.create({ data: { id: p, userId: u, slug: `slug-${p}`, displayName: `P ${p}` } })
            await prisma.workspace.create({ data: { id: w, profileId: p, name: `WS ${w}`, slug: `ws-${w}` } })
            await prisma.membership.create({ data: { workspaceId: w, userId: u, role: "OWNER" } })
            await prisma.contact.create({ data: { id: c, workspaceId: w, displayName: "Client", confidence: "CONFIRMED" } })
        }
        await prisma.location.create({ data: { id: ids.locA, workspaceId: ids.wsA, name: "Office A" } })
        await prisma.user.create({ data: { id: ids.userC, clerkId: `clerk_${ids.userC}`, email: `${ids.userC}@example.test` } })
        await prisma.profileDocument.create({
            data: { id: ids.docA, profileId: ids.profileA, type: "OTHER", title: "Signed letter", sourceType: "UPLOAD" },
        })

        // ---- 1. anonymous: 401 on every endpoint, zero writes ------------
        identity.current = null
        const beforeCases = await prisma.caseProject.count()
        const beforeEvents = await prisma.caseEvent.count()
        const anonFetch = fetchCalls
        const anon = {
            list: await call(api.list(get(`${CASES}?workspaceId=${ids.wsA}`))),
            create: await call(api.create(send(CASES, { workspaceId: ids.wsA, reference: "X", title: "X" }))),
            intakeList: await call(api.listIntakes(get(`${INTAKES}?workspaceId=${ids.wsA}`))),
            intakeCreate: await call(api.createIntake(send(INTAKES, { workspaceId: ids.wsA, source: "web", summary: "s" }))),
            getOne: await call(api.get("whatever", get(`${CASES}/whatever?workspaceId=${ids.wsA}`))),
            patch: await call(api.transition("whatever", send(`${CASES}/whatever`, { workspaceId: ids.wsA, status: "ACTIVE" }, "PATCH"))),
            brief: await call(api.getBrief("whatever", get(`${CASES}/whatever/brief?workspaceId=${ids.wsA}`))),
            timeline: await call(api.timeline("whatever", get(`${CASES}/whatever/timeline?workspaceId=${ids.wsA}`))),
            milestones: await call(api.listMilestones("whatever", get(`${CASES}/whatever/milestones?workspaceId=${ids.wsA}`))),
            documents: await call(api.listDocumentRequests("whatever", get(`${CASES}/whatever/documents?workspaceId=${ids.wsA}`))),
            deliverables: await call(api.listDeliverables("whatever", get(`${CASES}/whatever/deliverables?workspaceId=${ids.wsA}`))),
            tasks: await call(api.listTasks("whatever", get(`${CASES}/whatever/tasks?workspaceId=${ids.wsA}`))),
            approvals: await call(api.listApprovals("whatever", get(`${CASES}/whatever/approvals?workspaceId=${ids.wsA}`))),
            invoices: await call(api.listInvoices("whatever", get(`${CASES}/whatever/invoices?workspaceId=${ids.wsA}`))),
            contact: await call(api.assignContact("whatever", send(`${CASES}/whatever/contact`, { workspaceId: ids.wsA, contactId: null }, "PUT"))),
            convert: await call(api.convertIntake("whatever", send(`${INTAKES}/whatever/convert`, { workspaceId: ids.wsA, reference: "R", title: "T" }))),
        }
        const anonStatuses = Object.entries(anon).map(([k, v]) => `${k}=${v.status}`)
        check(
            "anonymous is 401 on all 16 case endpoints",
            Object.values(anon).every((r) => r.status === 401),
            anonStatuses.filter((s) => !s.endsWith("=401")).join(" ") || "all 401",
        )
        check("anonymous refusal wrote zero cases", beforeCases === (await prisma.caseProject.count()), `before=${beforeCases}`)
        check("anonymous refusal appended zero events", beforeEvents === (await prisma.caseEvent.count()), `before=${beforeEvents}`)
        check("anonymous refusal made zero external calls", fetchCalls === anonFetch, `calls=${fetchCalls - anonFetch}`)
        check("anonymous body is an error envelope with no data key", pick(anon.list.body, "ok") === false && pick(anon.list.body, "data") === undefined, anon.list.text.slice(0, 90))

        // ---- 2. authenticated but not a member of the workspace: 403 -----
        identity.current = `clerk_${ids.userC}`
        const outsider = await call(api.list(get(`${CASES}?workspaceId=${ids.wsA}`)))
        const outsiderWrite = await call(api.create(send(CASES, { workspaceId: ids.wsA, reference: "Y", title: "Y" })))
        check("authenticated non-member list is 403", outsider.status === 403, `status=${outsider.status}`)
        check("authenticated non-member create is 403", outsiderWrite.status === 403, `status=${outsiderWrite.status}`)
        check("non-member refusal wrote zero cases", beforeCases === (await prisma.caseProject.count()), `before=${beforeCases}`)

        // ---- 3. valid member: intake -> accept -> convert ----------------
        identity.current = `clerk_${ids.userA}`
        const created = await call(api.createIntake(send(INTAKES, {
            workspaceId: ids.wsA, source: "referral", summary: "Statutory audit", contactId: ids.contactA, idempotencyKey: `${RUN}-i1`,
        })))
        check("intake create is 201", created.status === 201, `status=${created.status}`)
        check("intake create returns a NEW intake", pickString(created.body, "data", "intake", "status") === "NEW", pickString(created.body, "data", "intake", "status"))
        const intakeId = pickString(created.body, "data", "intake", "id")

        const replay = await call(api.createIntake(send(INTAKES, {
            workspaceId: ids.wsA, source: "other", summary: "different", idempotencyKey: `${RUN}-i1`,
        })))
        check("idempotent intake replay is 200 not 201", replay.status === 200, `status=${replay.status}`)
        check("idempotent intake replay returns the original id and flags replayed", pickString(replay.body, "data", "intake", "id") === intakeId && pick(replay.body, "data", "replayed") === true, `id=${pickString(replay.body, "data", "intake", "id")}`)

        const earlyConvert = await call(api.convertIntake(intakeId, send(`${INTAKES}/${intakeId}/convert`, { workspaceId: ids.wsA, reference: "C-1", title: "Audit" })))
        check("converting a NEW intake is 409", earlyConvert.status === 409, `status=${earlyConvert.status}`)

        const badIntakeStatus = await call(api.transitionIntake(intakeId, send(`${INTAKES}/${intakeId}`, { workspaceId: ids.wsA, status: "NOT_A_STATUS" }, "PATCH")))
        check("an unknown intake status is 400 not 409", badIntakeStatus.status === 400, `status=${badIntakeStatus.status}`)
        const illegalIntake = await call(api.transitionIntake(intakeId, send(`${INTAKES}/${intakeId}`, { workspaceId: ids.wsA, status: "CONVERTED" }, "PATCH")))
        check("a known-but-illegal intake status is 409", illegalIntake.status === 409, `status=${illegalIntake.status}`)

        await call(api.transitionIntake(intakeId, send(`${INTAKES}/${intakeId}`, { workspaceId: ids.wsA, status: "QUALIFYING" }, "PATCH")))
        const accepted = await call(api.transitionIntake(intakeId, send(`${INTAKES}/${intakeId}`, { workspaceId: ids.wsA, status: "ACCEPTED" }, "PATCH")))
        check("intake reaches ACCEPTED", pickString(accepted.body, "data", "intake", "status") === "ACCEPTED", pickString(accepted.body, "data", "intake", "status"))

        const converted = await call(api.convertIntake(intakeId, send(`${INTAKES}/${intakeId}/convert`, {
            workspaceId: ids.wsA, reference: `${RUN}-C1`, title: "Statutory audit", locationId: ids.locA,
        })))
        check("conversion is 201", converted.status === 201, `status=${converted.status}`)
        caseId = pickString(converted.body, "data", "case", "id")
        check("converted case starts at INTAKE and inherits the contact", pickString(converted.body, "data", "case", "status") === "INTAKE" && pickString(converted.body, "data", "case", "contactId") === ids.contactA, pickString(converted.body, "data", "case", "status"))

        // ---- 4. scoped reads only see this workspace --------------------
        const listA = await call(api.list(get(`${CASES}?workspaceId=${ids.wsA}`)))
        check("member list is 200", listA.status === 200, `status=${listA.status}`)
        check("member list contains only this workspace's cases", pickArray(listA.body, "data", "cases").every((c) => pickString(c, "workspaceId") === ids.wsA), `n=${pickArray(listA.body, "data", "cases").length}`)
        const missingParam = await call(api.list(get(CASES)))
        check("a missing workspaceId query parameter is 400", missingParam.status === 400, `status=${missingParam.status}`)
        const badBody = await call(api.create(malformed(CASES)))
        check("a malformed JSON body is 400", badBody.status === 400, `status=${badBody.status}`)

        // ---- 5. case lifecycle over HTTP -------------------------------
        const brief = await call(api.putBrief(caseId, send(`${CASES}/${caseId}/brief`, {
            workspaceId: ids.wsA, objectives: "File FY26 accounts", scope: "Statutory only", agreed: true,
        }, "PUT")))
        check("brief capture is 200", brief.status === 200, `status=${brief.status}`)
        check("brief records agreement", pickString(brief.body, "data", "brief", "agreedAt") !== "", pickString(brief.body, "data", "brief", "agreedAt"))

        const illegalCase = await call(api.transition(caseId, send(`${CASES}/${caseId}`, { workspaceId: ids.wsA, status: "CLOSED" }, "PATCH")))
        check("INTAKE to CLOSED is 409", illegalCase.status === 409, `status=${illegalCase.status}`)
        const unknownCase = await call(api.transition(caseId, send(`${CASES}/${caseId}`, { workspaceId: ids.wsA, status: "MADE_UP" }, "PATCH")))
        check("an unknown case status is 400", unknownCase.status === 400, `status=${unknownCase.status}`)
        await call(api.transition(caseId, send(`${CASES}/${caseId}`, { workspaceId: ids.wsA, status: "BRIEFED" }, "PATCH")))
        const active = await call(api.transition(caseId, send(`${CASES}/${caseId}`, { workspaceId: ids.wsA, status: "ACTIVE" }, "PATCH")))
        check("BRIEFED to ACTIVE is 200 and stamps openedAt", active.status === 200 && pickString(active.body, "data", "case", "openedAt") !== "", `status=${active.status} openedAt=${pickString(active.body, "data", "case", "openedAt")}`)
        check(
            "the case carries server-computed allowedTransitions so the UI cannot invent one",
            pickArray(active.body, "data", "case", "allowedTransitions").slice().sort().join(",") === "CANCELLED,DELIVERED,ON_HOLD",
            pickArray(active.body, "data", "case", "allowedTransitions").join(","),
        )

        // ---- 6. milestones ---------------------------------------------
        const milestone = await call(api.addMilestone(caseId, send(`${CASES}/${caseId}/milestones`, { workspaceId: ids.wsA, title: "Fieldwork", ordinal: 1 })))
        check("milestone create is 201", milestone.status === 201, `status=${milestone.status}`)
        const milestoneId = pickString(milestone.body, "data", "milestone", "id")
        const skipDone = await call(api.transitionMilestone(caseId, milestoneId, send(`${CASES}/${caseId}/milestones/${milestoneId}`, { workspaceId: ids.wsA, status: "DONE" }, "PATCH")))
        check("PENDING to DONE on a milestone is 409", skipDone.status === 409, `status=${skipDone.status}`)
        const inProgress = await call(api.transitionMilestone(caseId, milestoneId, send(`${CASES}/${caseId}/milestones/${milestoneId}`, { workspaceId: ids.wsA, status: "IN_PROGRESS" }, "PATCH")))
        check("PENDING to IN_PROGRESS is 200", inProgress.status === 200, `status=${inProgress.status}`)

        // ---- 7. document requests --------------------------------------
        const docRequest = await call(api.requestDocument(caseId, send(`${CASES}/${caseId}/documents`, { workspaceId: ids.wsA, title: "Trial balance" })))
        check("document request create is 201", docRequest.status === 201, `status=${docRequest.status}`)
        const requestId = pickString(docRequest.body, "data", "request", "id")
        const emptyReceipt = await call(api.transitionDocumentRequest(caseId, requestId, send(`${CASES}/${caseId}/documents/${requestId}`, { workspaceId: ids.wsA, status: "RECEIVED" }, "PATCH")))
        check("RECEIVED without a documentId is 409", emptyReceipt.status === 409, `status=${emptyReceipt.status}`)
        const received = await call(api.transitionDocumentRequest(caseId, requestId, send(`${CASES}/${caseId}/documents/${requestId}`, { workspaceId: ids.wsA, status: "RECEIVED", documentId: ids.docA }, "PATCH")))
        check("RECEIVED with a real document is 200 and links it", received.status === 200 && pickString(received.body, "data", "request", "documentId") === ids.docA, pickString(received.body, "data", "request", "documentId"))

        // ---- 8. deliverable delivery is approval-gated -----------------
        const deliverable = await call(api.addDeliverable(caseId, send(`${CASES}/${caseId}/deliverables`, { workspaceId: ids.wsA, title: "Signed accounts", milestoneId })))
        const deliverableId = pickString(deliverable.body, "data", "deliverable", "id")
        check("deliverable create is 201", deliverable.status === 201, `status=${deliverable.status}`)
        const jumpDelivered = await call(api.transitionDeliverable(caseId, deliverableId, send(`${CASES}/${caseId}/deliverables/${deliverableId}`, { workspaceId: ids.wsA, status: "DELIVERED" }, "PATCH")))
        check("DRAFT to DELIVERED is 409", jumpDelivered.status === 409, `status=${jumpDelivered.status}`)
        await call(api.transitionDeliverable(caseId, deliverableId, send(`${CASES}/${caseId}/deliverables/${deliverableId}`, { workspaceId: ids.wsA, status: "IN_REVIEW" }, "PATCH")))
        await call(api.transitionDeliverable(caseId, deliverableId, send(`${CASES}/${caseId}/deliverables/${deliverableId}`, { workspaceId: ids.wsA, status: "APPROVED" }, "PATCH")))
        const ungated = await call(api.transitionDeliverable(caseId, deliverableId, send(`${CASES}/${caseId}/deliverables/${deliverableId}`, { workspaceId: ids.wsA, status: "DELIVERED" }, "PATCH")))
        check("delivery before approval is 409", ungated.status === 409, `status=${ungated.status}`)

        const approval = await call(api.requestApproval(caseId, send(`${CASES}/${caseId}/approvals`, {
            workspaceId: ids.wsA, reason: "Release signed accounts", requestedBy: ids.userA, idempotencyKey: `${RUN}-a1`,
        })))
        check("approval request is 201", approval.status === 201, `status=${approval.status}`)
        const approvalId = pickString(approval.body, "data", "approval", "id")
        const approvalReplay = await call(api.requestApproval(caseId, send(`${CASES}/${caseId}/approvals`, {
            workspaceId: ids.wsA, reason: "Different reason", requestedBy: ids.userA, idempotencyKey: `${RUN}-a1`,
        })))
        check("approval replay is 200 and returns the original", approvalReplay.status === 200 && pickString(approvalReplay.body, "data", "approval", "id") === approvalId, `status=${approvalReplay.status}`)
        const badDecision = await call(api.decideApproval(caseId, approvalId, send(`${CASES}/${caseId}/approvals/${approvalId}`, { workspaceId: ids.wsA, decision: "maybe", decidedBy: ids.userA }, "PATCH")))
        check("an unknown approval decision is 400", badDecision.status === 400, `status=${badDecision.status}`)
        const decided = await call(api.decideApproval(caseId, approvalId, send(`${CASES}/${caseId}/approvals/${approvalId}`, { workspaceId: ids.wsA, decision: "approved", decidedBy: ids.userA }, "PATCH")))
        check("approval decision is 200", decided.status === 200, `status=${decided.status}`)
        const delivered = await call(api.transitionDeliverable(caseId, deliverableId, send(`${CASES}/${caseId}/deliverables/${deliverableId}`, { workspaceId: ids.wsA, status: "DELIVERED" }, "PATCH")))
        check("delivery after approval is 200", delivered.status === 200, `status=${delivered.status}`)
        check("delivery stamps deliveredAt", pickString(delivered.body, "data", "deliverable", "deliveredAt") !== "", pickString(delivered.body, "data", "deliverable", "deliveredAt"))

        // ---- 9. tasks compose the existing TaskJob queue ---------------
        const task = await call(api.linkTask(caseId, send(`${CASES}/${caseId}/tasks`, { workspaceId: ids.wsA, title: "Send filing", idempotencyKey: `${RUN}-t1` })))
        check("task link is 201", task.status === 201, `status=${task.status}`)
        const taskReplay = await call(api.linkTask(caseId, send(`${CASES}/${caseId}/tasks`, { workspaceId: ids.wsA, title: "Send filing", idempotencyKey: `${RUN}-t1` })))
        check("task link replay is 200 and returns the same TaskJob", taskReplay.status === 200 && pickString(taskReplay.body, "data", "taskJobId") === pickString(task.body, "data", "taskJobId"), `status=${taskReplay.status}`)
        const taskList = await call(api.listTasks(caseId, get(`${CASES}/${caseId}/tasks?workspaceId=${ids.wsA}`)))
        check("linked tasks are real TaskJob rows", pickArray(taskList.body, "data", "tasks").length === 1 && pickString(pickArray(taskList.body, "data", "tasks")[0], "id") === pickString(task.body, "data", "taskJobId"), `n=${pickArray(taskList.body, "data", "tasks").length}`)

        // ---- 10. billing state ----------------------------------------
        const invoice = await call(api.createInvoice(caseId, send(`${CASES}/${caseId}/invoices`, { workspaceId: ids.wsA, reference: `${RUN}-INV1`, amountCents: 250000, currency: "INR" })))
        check("invoice create is 201 at DRAFT", invoice.status === 201 && pickString(invoice.body, "data", "invoice", "state") === "DRAFT", `status=${invoice.status} state=${pickString(invoice.body, "data", "invoice", "state")}`)
        const invoiceId = pickString(invoice.body, "data", "invoice", "id")
        const zeroInvoice = await call(api.createInvoice(caseId, send(`${CASES}/${caseId}/invoices`, { workspaceId: ids.wsA, reference: `${RUN}-INV0`, amountCents: 0 })))
        check("a non-positive invoice amount is 409", zeroInvoice.status === 409, `status=${zeroInvoice.status}`)
        const draftToPaid = await call(api.transitionInvoice(caseId, invoiceId, send(`${CASES}/${caseId}/invoices/${invoiceId}`, { workspaceId: ids.wsA, state: "PAID" }, "PATCH")))
        check("DRAFT to PAID is 409", draftToPaid.status === 409, `status=${draftToPaid.status}`)
        const badState = await call(api.transitionInvoice(caseId, invoiceId, send(`${CASES}/${caseId}/invoices/${invoiceId}`, { workspaceId: ids.wsA, state: "SETTLED" }, "PATCH")))
        check("an unknown invoice state is 400", badState.status === 400, `status=${badState.status}`)
        const issued = await call(api.transitionInvoice(caseId, invoiceId, send(`${CASES}/${caseId}/invoices/${invoiceId}`, { workspaceId: ids.wsA, state: "ISSUED" }, "PATCH")))
        check("DRAFT to ISSUED is 200", issued.status === 200, `status=${issued.status}`)
        const afterIssue = await call(api.get(caseId, get(`${CASES}/${caseId}?workspaceId=${ids.wsA}`)))
        check("the case mirrors the invoice state", pickString(afterIssue.body, "data", "case", "invoiceState") === "ISSUED", pickString(afterIssue.body, "data", "case", "invoiceState"))

        // ---- 11. timeline is append-only and ordered ------------------
        const timeline = await call(api.timeline(caseId, get(`${CASES}/${caseId}/timeline?workspaceId=${ids.wsA}`)))
        const events = pickArray(timeline.body, "data", "events")
        const seqs = events.map((e) => Number(pickString(e, "seq")))
        check("timeline returns events for the case", events.length >= 8, `n=${events.length}`)
        check("timeline sequence is strictly increasing", seqs.every((v, i) => i === 0 || v > seqs[i - 1]), seqs.join(","))
        check("timeline seq serialises as a string not a BigInt", events.every((e) => typeof pick(e, "seq") === "string"), typeof pick(events[0], "seq"))

        // ---- 12. wrong tenant is indistinguishable from nonexistent ---
        identity.current = `clerk_${ids.userB}`
        const bCase = await call(api.create(send(CASES, { workspaceId: ids.wsB, reference: `${RUN}-B1`, title: "Bee" })))
        foreignCaseId = pickString(bCase.body, "data", "case", "id")
        const beforeForeign = await prisma.caseEvent.count()
        const foreignFetch = fetchCalls
        const foreign = await call(api.get(caseId, get(`${CASES}/${caseId}?workspaceId=${ids.wsB}`)))
        const absent = await call(api.get(`${RUN}_does_not_exist`, get(`${CASES}/${RUN}_does_not_exist?workspaceId=${ids.wsB}`)))
        check("wrong-tenant get is 403", foreign.status === 403, `status=${foreign.status}`)
        // This is the single inverted assertion.
        const identical = INVERT
            ? foreign.text !== absent.text
            : foreign.status === absent.status && foreign.text === absent.text
        check("a foreign case and a nonexistent case are byte-identical", identical, `foreign=${foreign.status}:${foreign.text} absent=${absent.status}:${absent.text}`)
        const foreignPatch = await call(api.transition(caseId, send(`${CASES}/${caseId}`, { workspaceId: ids.wsB, status: "ON_HOLD" }, "PATCH")))
        const absentPatch = await call(api.transition(`${RUN}_nope`, send(`${CASES}/${RUN}_nope`, { workspaceId: ids.wsB, status: "ON_HOLD" }, "PATCH")))
        check("a foreign mutation and a nonexistent mutation are byte-identical", foreignPatch.status === absentPatch.status && foreignPatch.text === absentPatch.text, `${foreignPatch.status}/${absentPatch.status}`)
        check("cross-tenant refusal appended zero events", beforeForeign === (await prisma.caseEvent.count()), `before=${beforeForeign}`)
        check("cross-tenant refusal made zero external calls", fetchCalls === foreignFetch, `calls=${fetchCalls - foreignFetch}`)
        const crossContact = await call(api.assignContact(foreignCaseId, send(`${CASES}/${foreignCaseId}/contact`, { workspaceId: ids.wsB, contactId: ids.contactA }, "PUT")))
        check("assigning another workspace's contact is 403", crossContact.status === 403, `status=${crossContact.status}`)
        const listB = await call(api.list(get(`${CASES}?workspaceId=${ids.wsB}`)))
        check("tenant B's list never contains tenant A's case", !pickArray(listB.body, "data", "cases").some((c) => pickString(c, "id") === caseId), `n=${pickArray(listB.body, "data", "cases").length}`)

        // ---- 13. dependency failure is 503 with no leak ---------------
        identity.current = `clerk_${ids.userA}`
        const brokenPrisma = {
            caseProject: {
                findMany: async () => {
                    throw new Error("SECRET_DETAIL postgres://u:p@h/d")
                },
            },
        } as unknown as PrismaClient
        const brokenApi = new CaseApiService(
            new CaseIntakeService(new CaseContext(brokenPrisma, tenancy)),
            new CaseProjectService(new CaseContext(brokenPrisma, tenancy)),
            new CaseWorkflowService(new CaseContext(brokenPrisma, tenancy)),
        )
        const broken = await call(brokenApi.list(get(`${CASES}?workspaceId=${ids.wsA}`)))
        check("dependency failure is 503", broken.status === 503, `status=${broken.status}`)
        check("dependency failure leaks no internal detail", !/SECRET_DETAIL/.test(broken.text) && !/postgres:\/\//.test(broken.text), broken.text.slice(0, 120))

        // ---- 14. envelope agrees with the platform contract ----------
        check("success envelope keys are exactly ok,data", keys(listA.body) === "data,ok", keys(listA.body))
        check("error envelope keys are exactly error,ok", keys(anon.list.body) === "error,ok", keys(anon.list.body))
        check("every error envelope carries a code and a message", [anon.list, outsider, foreign, illegalCase, unknownCase, broken].every((r) => pickString(r.body, "error", "code") !== "" && pickString(r.body, "error", "message") !== ""), "codes present")

        // ---- 15. whole-run external call tally ----------------------
        check("no external call was EVER made in this run", fetchCalls === 0, `calls=${fetchCalls}`)
    } finally {
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
            `delete from "TaskJob" where "idempotencyKey" like '%${RUN}%'`,
            `delete from "ProfileDocument" where "id"='${ids.docA}'`,
            `delete from "Contact" where "workspaceId" in (${wsList})`,
            `delete from "Location" where "workspaceId" in (${wsList})`,
            `delete from "Membership" where "workspaceId" in (${wsList})`,
            `delete from "Workspace" where "id" in (${wsList})`,
            `delete from "Profile" where "id" in ('${ids.profileA}','${ids.profileB}')`,
            `delete from "User" where "id" in ('${ids.userA}','${ids.userB}','${ids.userC}')`,
        ]) {
            await prisma.$executeRawUnsafe(sql)
        }

        const armed = await prisma.$queryRawUnsafe<{ n: number }[]>(
            `select count(*)::int n from information_schema.triggers where trigger_schema='public' and trigger_name='CaseEvent_append_only'`,
        )
        check("CaseEvent append-only trigger re-armed", Number(armed[0].n) >= 1, `triggers=${armed[0].n}`)

        for (const [label, expected, actual] of [
            ["CaseProject rows", base.cases, await prisma.caseProject.count()],
            ["CaseIntake rows", base.intakes, await prisma.caseIntake.count()],
            ["CaseEvent rows", base.events, await prisma.caseEvent.count()],
            ["CaseInvoice rows", base.invoices, await prisma.caseInvoice.count()],
            ["Approval rows", base.approvals, await prisma.approval.count()],
            ["TaskJob rows", base.tasks, await prisma.taskJob.count()],
        ] as Array<[string, number, number]>) {
            check(`${label} returned to baseline`, actual === expected, `baseline=${expected} end=${actual}`)
        }
        await prisma.$disconnect()
        globalThis.fetch = realFetch
    }

    const failed = results.filter((r) => !r.pass)
    for (const r of results) {
        console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.name}${r.detail ? `  (${r.detail})` : ""}`)
    }
    console.log(`\n${results.length - failed.length}/${results.length} assertions passed`)
    if (INVERT) console.log("INVERT_ASSERTION=1 was set - a failure here is the expected proof")
    if (failed.length) process.exit(1)
    console.log("All case route boundaries hold.")
}

main().catch((e) => {
    console.error(e)
    process.exit(1)
})

/**
 * Wave G5: retainer route harness.
 *
 * Drives the REAL CaseApiService - the same object the route files re-export - with hand-built
 * Request objects, against the authorized disposable rehearsal database.
 *
 * The claims worth measuring rather than trusting:
 *   * NON-ENUMERATION. A foreign retainer and a nonexistent one must produce BYTE-IDENTICAL
 *     responses, compared by serializing both bodies rather than by asserting two 403s.
 *   * 400 IS NOT 409. An unrecognised enum value is a bad request; a recognised value in the
 *     wrong order is a conflict. Both are exercised on the same field.
 *   * A 409 KEEPS ITS NUMBERS. An overdraw refusal and an over-credit refusal have to carry the
 *     figure the caller needs, not just a status code.
 *   * A DEPENDENCY FAILURE LEAKS NOTHING. A broken client produces 503 with a fixed message and
 *     no internal detail, proven with a fake DSN in the underlying error.
 *   * NO PAYMENT ROUTE EXISTS. The Payment row count is captured and re-checked after the whole
 *     billing lifecycle has been driven through HTTP.
 *
 * Set INVERT_ASSERTION=1 to flip one expectation and prove the harness fails loudly.
 *
 *   ts-node -r tsconfig-paths/register scripts/one-off/check-retainer-routes.ts
 */
import { PrismaClient } from "@prisma/client"

import { CaseProjectService } from "../../src/lib/cases/engine"
import { CaseApiService } from "../../src/lib/cases/http"
import { CaseRetainerService } from "../../src/lib/cases/retainers"
import { CaseContext } from "../../src/lib/cases/shared"
import { CaseIntakeService } from "../../src/lib/cases/engine"
import { CaseWorkflowService } from "../../src/lib/cases/workflow"
import { PersistedTenancy, type PlatformIdentity } from "../../src/lib/persistence/tenancy"
import { assertDisposableTarget, parseDatabaseName } from "../lib/disposable-db"

const AUTHORIZED_TARGET = "personalink_phase0_rehearsal_20260826_210704"
const INVERT = process.env.INVERT_ASSERTION === "1"
const RUN = `wg5_${Date.now()}_${Math.floor(Math.random() * 1e6)}`
const API = "http://127.0.0.1/api/platform"

const results: Array<{ name: string; pass: boolean; detail: string }> = []
function check(name: string, pass: boolean, detail = "") {
    results.push({ name, pass, detail })
}
/** Flipped individually by INVERT_ASSERTION=1; identical to checkInvertible() otherwise. */
function checkInvertible(name: string, pass: boolean, detail = "") {
    results.push({ name, pass: INVERT ? !pass : pass, detail })
}

class ControlledIdentity implements PlatformIdentity {
    current: string | null = null
    async userId(): Promise<string | null> {
        return this.current
    }
}

type Called = { status: number; body: Record<string, unknown>; raw: string }
async function call(p: Promise<Response>): Promise<Called> {
    const res = await p
    const raw = await res.text()
    let body: Record<string, unknown> = {}
    try {
        body = JSON.parse(raw) as Record<string, unknown>
    } catch {
        body = {}
    }
    return { status: res.status, body, raw }
}
function get(url: string): Request {
    return new Request(url, { method: "GET" })
}
function send(url: string, payload: unknown, method = "POST"): Request {
    return new Request(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(payload) })
}
function malformed(url: string, method = "POST"): Request {
    return new Request(url, { method, headers: { "content-type": "application/json" }, body: "{ not json" })
}
function errCode(c: Called): string {
    const e = (c.body as { error?: { code?: string } }).error
    return e?.code ?? "NONE"
}
function errMessage(c: Called): string {
    const e = (c.body as { error?: { message?: string } }).error
    return e?.message ?? ""
}
function dataOf(c: Called): Record<string, unknown> {
    return ((c.body as { data?: Record<string, unknown> }).data ?? {}) as Record<string, unknown>
}
/** The refusal envelope, status included, so non-enumeration is compared byte for byte. */
function refusal(c: Called): string {
    return `${c.status}:${c.raw}`
}

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
    const tenancy = new PersistedTenancy(prisma, identity)
    const ctx = new CaseContext(prisma, tenancy)
    const api = new CaseApiService(
        new CaseIntakeService(ctx),
        new CaseProjectService(ctx),
        new CaseWorkflowService(ctx),
        new CaseRetainerService(ctx),
    )
    const cases = new CaseProjectService(ctx)

    const live = await prisma.$queryRawUnsafe<{ db: string }[]>("select current_database() as db")
    if (live[0].db !== AUTHORIZED_TARGET) {
        console.error(`ABORT: connected to ${live[0].db}`)
        process.exit(1)
    }

    const ids = {
        userA: `${RUN}_ua`,
        userB: `${RUN}_ub`,
        profileA: `${RUN}_pa`,
        profileB: `${RUN}_pb`,
        wsA: `${RUN}_wa`,
        wsB: `${RUN}_wb`,
    }
    const base = { retainers: 0, periods: 0, draws: 0, links: 0, events: 0, cases: 0, payments: 0 }
    const RET = `${API}/retainers`

    try {
        base.retainers = await prisma.caseRetainer.count()
        base.periods = await prisma.caseRetainerPeriod.count()
        base.draws = await prisma.caseRetainerDraw.count()
        base.links = await prisma.caseRetainerCaseLink.count()
        base.events = await prisma.caseRetainerEvent.count()
        base.cases = await prisma.caseProject.count()
        base.payments = await prisma.payment.count()

        for (const [u, p, w] of [
            [ids.userA, ids.profileA, ids.wsA],
            [ids.userB, ids.profileB, ids.wsB],
        ]) {
            await prisma.user.create({ data: { id: u, clerkId: `clerk_${u}`, email: `${u}@example.test` } })
            await prisma.profile.create({ data: { id: p, userId: u, slug: `slug-${p}`, displayName: `P ${p}` } })
            await prisma.workspace.create({ data: { id: w, profileId: p, name: `WS ${w}`, slug: `ws-${w}` } })
            await prisma.membership.create({ data: { workspaceId: w, userId: u, role: "OWNER" } })
        }

        // ---- 1. anonymous ---------------------------------------------------
        identity.current = null
        const anonList = await call(api.listRetainers(get(`${RET}?workspaceId=${ids.wsA}`)))
        const anonCreate = await call(
            api.createRetainer(send(RET, { workspaceId: ids.wsA, reference: "R", title: "T", basis: "UNITS", includedUnits: 10 })),
        )
        checkInvertible("anonymous list is 401", anonList.status === 401, `status=${anonList.status}`)
        checkInvertible("anonymous create is 401", anonCreate.status === 401, `status=${anonCreate.status}`)
        checkInvertible("the 401 body is the shared envelope", errCode(anonList) === "UNAUTHORIZED", errCode(anonList))
        checkInvertible("anonymous wrote nothing", (await prisma.caseRetainer.count()) === base.retainers)

        // ---- 2. shape errors are 400 at the boundary -----------------------
        identity.current = `clerk_${ids.userA}`
        const noBody = await call(api.createRetainer(malformed(RET)))
        checkInvertible("malformed JSON is 400", noBody.status === 400, `status=${noBody.status}`)
        const noWorkspace = await call(api.createRetainer(send(RET, { reference: "R", title: "T", basis: "UNITS" })))
        checkInvertible("a missing workspaceId is 400 with the field named", noWorkspace.status === 400 && /workspaceId/.test(errMessage(noWorkspace)), errMessage(noWorkspace))
        const noQueryParam = await call(api.listRetainers(get(RET)))
        checkInvertible("a read with no workspaceId query param is 400", noQueryParam.status === 400, `status=${noQueryParam.status}`)
        const badBasis = await call(
            api.createRetainer(send(RET, { workspaceId: ids.wsA, reference: "R", title: "T", basis: "HOURS", includedUnits: 5 })),
        )
        checkInvertible(
            "MEASURED: an unrecognised enum value is 400, not 409 - the vocabulary check happens before the state machine",
            badBasis.status === 400 && /basis/.test(errMessage(badBasis)),
            `${badBasis.status} ${errMessage(badBasis)}`,
        )
        const badInt = await call(
            api.createRetainer(send(RET, { workspaceId: ids.wsA, reference: "R", title: "T", basis: "UNITS", includedUnits: 1.5 })),
        )
        checkInvertible("a non-integer allowance is 400", badInt.status === 400, `${badInt.status} ${errMessage(badInt)}`)
        const badBool = await call(
            api.createRetainer(
                send(RET, { workspaceId: ids.wsA, reference: "R", title: "T", basis: "UNITS", includedUnits: 5, rolloverAllowed: "yes" }),
            ),
        )
        checkInvertible("a non-boolean flag is 400", badBool.status === 400, `${badBool.status} ${errMessage(badBool)}`)

        // ---- 3. create, replay, and semantic conflicts ---------------------
        const created = await call(
            api.createRetainer(
                send(RET, {
                    workspaceId: ids.wsA,
                    reference: "RET-1",
                    title: "Monthly advisory",
                    basis: "UNITS",
                    includedUnits: 20,
                    idempotencyKey: "k1",
                }),
            ),
        )
        checkInvertible("create is 201", created.status === 201, `status=${created.status}`)
        const retainerId = String((dataOf(created).retainer as { id: string }).id)
        const replay = await call(
            api.createRetainer(
                send(RET, { workspaceId: ids.wsA, reference: "RET-OTHER", title: "x", basis: "VALUE", includedValueCents: 9, idempotencyKey: "k1" }),
            ),
        )
        checkInvertible("a replayed create is 200 with replayed true", replay.status === 200 && dataOf(replay).replayed === true, `status=${replay.status}`)
        checkInvertible("and it returns the original record", (dataOf(replay).retainer as { id: string }).id === retainerId)

        const bothBases = await call(
            api.createRetainer(
                send(RET, { workspaceId: ids.wsA, reference: "RET-BAD", title: "x", basis: "UNITS", includedUnits: 5, includedValueCents: 500 }),
            ),
        )
        checkInvertible(
            "MEASURED: a recognised but contradictory payload is 409, not 400 - the value was understood and refused",
            bothBases.status === 409,
            `${bothBases.status} ${errMessage(bothBases)}`,
        )

        // ---- 4. NON-ENUMERATION, byte for byte ----------------------------
        const foreignRetainer = await call(api.getRetainer(retainerId, get(`${RET}/${retainerId}?workspaceId=${ids.wsB}`)))
        const ghostRetainer = await call(api.getRetainer(`${RUN}_ghost`, get(`${RET}/${RUN}_ghost?workspaceId=${ids.wsB}`)))
        checkInvertible("reading someone else's retainer is 403", foreignRetainer.status === 403, `status=${foreignRetainer.status}`)
        checkInvertible(
            "MEASURED: a foreign retainer and a nonexistent retainer are BYTE-IDENTICAL, status and body",
            refusal(foreignRetainer) === refusal(ghostRetainer),
            `${refusal(foreignRetainer)} vs ${refusal(ghostRetainer)}`,
        )
        identity.current = `clerk_${ids.userB}`
        const otherTenantRead = await call(api.getRetainer(retainerId, get(`${RET}/${retainerId}?workspaceId=${ids.wsB}`)))
        const otherTenantGhost = await call(api.getRetainer(`${RUN}_ghost2`, get(`${RET}/${RUN}_ghost2?workspaceId=${ids.wsB}`)))
        checkInvertible(
            "the same holds for a genuinely different signed-in tenant",
            refusal(otherTenantRead) === refusal(otherTenantGhost) && otherTenantRead.status === 403,
            refusal(otherTenantRead),
        )
        const bList = await call(api.listRetainers(get(`${RET}?workspaceId=${ids.wsB}`)))
        checkInvertible(
            "the other tenant's list is 200 and empty, not a filtered page of somebody else's rows",
            bList.status === 200 && (dataOf(bList).retainers as unknown[]).length === 0,
        )
        identity.current = `clerk_${ids.userA}`

        // ---- 5. state machine over HTTP ----------------------------------
        const badState = await call(api.transitionRetainer(retainerId, send(`${RET}/${retainerId}`, { workspaceId: ids.wsA, state: "SLEEPING" }, "PATCH")))
        checkInvertible("an unknown state is 400", badState.status === 400, `${badState.status} ${errMessage(badState)}`)
        const illegalState = await call(
            api.transitionRetainer(retainerId, send(`${RET}/${retainerId}`, { workspaceId: ids.wsA, state: "PAUSED" }, "PATCH")),
        )
        checkInvertible(
            "a known state in the wrong order is 409 - the same field produces 400 and 409 for different reasons",
            illegalState.status === 409,
            `${illegalState.status} ${errMessage(illegalState)}`,
        )
        const activated = await call(
            api.transitionRetainer(retainerId, send(`${RET}/${retainerId}`, { workspaceId: ids.wsA, state: "ACTIVE" }, "PATCH")),
        )
        checkInvertible("activating is 200", activated.status === 200, `status=${activated.status}`)
        checkInvertible(
            "the response exposes allowedTransitions, so a client never has to guess",
            Array.isArray((dataOf(activated).retainer as { allowedTransitions?: unknown[] }).allowedTransitions),
        )

        // ---- 6. cases ------------------------------------------------------
        const caseA = await cases.create(ids.wsA, { reference: "C-1", title: "Advisory" }, { actorType: "STAFF", actorId: null })
        const linked = await call(api.linkRetainerCase(retainerId, send(`${RET}/${retainerId}/cases`, { workspaceId: ids.wsA, caseId: caseA.record.id })))
        checkInvertible("linking a case is 201", linked.status === 201 && dataOf(linked).linked === true, `status=${linked.status}`)
        const relinked = await call(api.linkRetainerCase(retainerId, send(`${RET}/${retainerId}/cases`, { workspaceId: ids.wsA, caseId: caseA.record.id })))
        checkInvertible(
            "re-linking is 200 with linked false, matching the replay convention rather than erroring",
            relinked.status === 200 && dataOf(relinked).linked === false,
            `status=${relinked.status}`,
        )
        const foreignCaseLink = await call(
            api.linkRetainerCase(retainerId, send(`${RET}/${retainerId}/cases`, { workspaceId: ids.wsA, caseId: `${RUN}_ghostcase` })),
        )
        checkInvertible("linking a nonexistent case is 403, not 404", foreignCaseLink.status === 403, `status=${foreignCaseLink.status}`)
        const caseList = await call(api.listRetainerCases(retainerId, get(`${RET}/${retainerId}/cases?workspaceId=${ids.wsA}`)))
        checkInvertible("the case list carries the case reference and title", (dataOf(caseList).cases as Array<{ reference: string }>)[0].reference === "C-1")

        // ---- 7. periods and draws ----------------------------------------
        const period = await call(api.openRetainerPeriod(retainerId, send(`${RET}/${retainerId}/periods`, { workspaceId: ids.wsA })))
        checkInvertible("opening a period is 201", period.status === 201, `status=${period.status}`)
        const periodId = String((dataOf(period).period as { id: string }).id)
        checkInvertible(
            "the period reports remaining and overage, derived rather than stored",
            (dataOf(period).period as { remaining: number; overage: number }).remaining === 20 &&
                (dataOf(period).period as { overage: number }).overage === 0,
        )
        const secondPeriod = await call(api.openRetainerPeriod(retainerId, send(`${RET}/${retainerId}/periods`, { workspaceId: ids.wsA })))
        checkInvertible("a second open period is 409", secondPeriod.status === 409, `${secondPeriod.status} ${errMessage(secondPeriod)}`)

        const draw = await call(
            api.recordRetainerDraw(
                retainerId,
                send(`${RET}/${retainerId}/draws`, { workspaceId: ids.wsA, kind: "DRAW", units: 6, caseId: caseA.record.id, idempotencyKey: "d1" }),
            ),
        )
        checkInvertible("recording a draw is 201", draw.status === 201, `status=${draw.status}`)
        checkInvertible("the response carries both the draw and the period it moved", Boolean(dataOf(draw).draw) && Boolean(dataOf(draw).period))
        const drawReplay = await call(
            api.recordRetainerDraw(
                retainerId,
                send(`${RET}/${retainerId}/draws`, { workspaceId: ids.wsA, kind: "DRAW", units: 6, idempotencyKey: "d1" }),
            ),
        )
        checkInvertible("a replayed draw is 200 and consumes nothing further", drawReplay.status === 200 && dataOf(drawReplay).replayed === true)
        const overCredit = await call(
            api.recordRetainerDraw(retainerId, send(`${RET}/${retainerId}/draws`, { workspaceId: ids.wsA, kind: "CREDIT", units: -99 })),
        )
        checkInvertible(
            "MEASURED: an over-credit 409 carries the figure the caller needs, not just a status",
            overCredit.status === 409 && /\b6\b/.test(errMessage(overCredit)),
            `${overCredit.status} ${errMessage(overCredit)}`,
        )
        const overage = await call(
            api.recordRetainerDraw(retainerId, send(`${RET}/${retainerId}/draws`, { workspaceId: ids.wsA, kind: "DRAW", units: 30 })),
        )
        checkInvertible(
            "a draw past the allowance is ACCEPTED over HTTP and the overage is reported",
            overage.status === 201 && (dataOf(overage).period as { overage: number }).overage === 16,
            `${overage.status} overage=${(dataOf(overage).period as { overage?: number }).overage}`,
        )

        const balance = await call(api.retainerBalance(retainerId, get(`${RET}/${retainerId}/balance?workspaceId=${ids.wsA}`)))
        checkInvertible(
            "the balance route recomputes lifetime totals",
            balance.status === 200 && (dataOf(balance).balance as { lifetimeUsed: number }).lifetimeUsed === 36,
            `used=${(dataOf(balance).balance as { lifetimeUsed?: number }).lifetimeUsed}`,
        )

        const drawList = await call(api.listRetainerDraws(retainerId, get(`${RET}/${retainerId}/draws?workspaceId=${ids.wsA}&periodId=${periodId}`)))
        checkInvertible("the draw list filters by period and serialises the bigint sequence as a string", drawList.status === 200 && typeof (dataOf(drawList).draws as Array<{ seq: unknown }>)[0].seq === "string")

        // ---- 8. billing over HTTP creates no payment ---------------------
        const paymentsBefore = await prisma.payment.count()
        const badBilling = await call(
            api.setRetainerBilling(retainerId, periodId, send(`${RET}/${retainerId}/periods/${periodId}/billing`, { workspaceId: ids.wsA, billingState: "PAID" }, "PATCH")),
        )
        checkInvertible("jumping billing straight to PAID is 409", badBilling.status === 409, `${badBilling.status} ${errMessage(badBilling)}`)
        const draftBilling = await call(
            api.setRetainerBilling(retainerId, periodId, send(`${RET}/${retainerId}/periods/${periodId}/billing`, { workspaceId: ids.wsA, billingState: "DRAFT" }, "PATCH")),
        )
        checkInvertible("billing enters DRAFT with 200", draftBilling.status === 200, `status=${draftBilling.status}`)
        const invoice = await prisma.caseInvoice.create({
            data: { id: `${RUN}_inv`, caseId: caseA.record.id, reference: "INV-1", amountCents: 500000, state: "DRAFT" },
        })
        const issued = await call(
            api.setRetainerBilling(
                retainerId,
                periodId,
                send(`${RET}/${retainerId}/periods/${periodId}/billing`, { workspaceId: ids.wsA, billingState: "ISSUED", invoiceId: invoice.id }, "PATCH"),
            ),
        )
        checkInvertible("issuing records the invoice id", issued.status === 200 && (dataOf(issued).period as { invoiceId: string }).invoiceId === invoice.id)
        const paid = await call(
            api.setRetainerBilling(retainerId, periodId, send(`${RET}/${retainerId}/periods/${periodId}/billing`, { workspaceId: ids.wsA, billingState: "PAID" }, "PATCH")),
        )
        checkInvertible("billing reaches PAID", paid.status === 200)
        const paymentsAfter = await prisma.payment.count()
        checkInvertible(
            "MEASURED: the whole billing lifecycle driven over HTTP created no Payment row",
            paymentsAfter === paymentsBefore,
            `payments ${paymentsBefore} -> ${paymentsAfter}`,
        )

        // ---- 9. renewal and unlink ---------------------------------------
        const renewed = await call(
            api.transitionRetainerPeriod(retainerId, periodId, send(`${RET}/${retainerId}/periods/${periodId}`, { workspaceId: ids.wsA, state: "RENEWED" }, "PATCH")),
        )
        checkInvertible("renewing returns both the closed period and the next one", renewed.status === 200 && Boolean(dataOf(renewed).next))
        const unlink = await call(api.unlinkRetainerCase(retainerId, caseA.record.id, get(`${RET}/${retainerId}/cases/${caseA.record.id}?workspaceId=${ids.wsA}`)))
        checkInvertible(
            "unlinking a case that has drawn is 409, because the ledger names it",
            unlink.status === 409,
            `${unlink.status} ${errMessage(unlink)}`,
        )

        // ---- 10. timeline -------------------------------------------------
        const timeline = await call(api.retainerTimeline(retainerId, get(`${RET}/${retainerId}/timeline?workspaceId=${ids.wsA}`)))
        const events = dataOf(timeline).events as Array<{ subjectType: string; seq: unknown }>
        checkInvertible("the timeline is 200 and non-empty", timeline.status === 200 && events.length > 0, `n=${events.length}`)
        checkInvertible("its sequence numbers are serialised as strings, not bigints", events.every((e) => typeof e.seq === "string"))
        checkInvertible(
            "it covers the agreement, its periods, its case links, its billing and its draws",
            ["agreement", "period", "caseLink", "billing", "draw"].every((s) => events.some((e) => e.subjectType === s)),
            [...new Set(events.map((e) => e.subjectType))].join(","),
        )

        // ---- 11. dependency failure leaks nothing ------------------------
        const brokenPrisma = {
            caseRetainer: {
                findMany: async () => {
                    throw new Error("SECRET_DETAIL postgres://u:p@h/d")
                },
            },
        } as unknown as PrismaClient
        const brokenApi = new CaseApiService(
            new CaseIntakeService(new CaseContext(brokenPrisma, tenancy)),
            new CaseProjectService(new CaseContext(brokenPrisma, tenancy)),
            new CaseWorkflowService(new CaseContext(brokenPrisma, tenancy)),
            new CaseRetainerService(new CaseContext(brokenPrisma, tenancy)),
        )
        const broken = await call(brokenApi.listRetainers(get(`${RET}?workspaceId=${ids.wsA}`)))
        checkInvertible("a dependency failure is 503", broken.status === 503, `status=${broken.status}`)
        checkInvertible(
            "MEASURED: the 503 body leaks no internal detail - no DSN, no host, no driver text",
            !/SECRET_DETAIL|postgres:\/\//.test(broken.raw) && errCode(broken) === "DEPENDENCY_UNAVAILABLE",
            broken.raw.slice(0, 120),
        )

        // ---- 12. the envelope is one shape ------------------------------
        for (const [label, c] of [
            ["200", balance],
            ["201", created],
            ["400", badBasis],
            ["401", anonList],
            ["403", foreignRetainer],
            ["409", illegalState],
            ["503", broken],
        ] as Array<[string, Called]>) {
            const keys = Object.keys(c.body).sort().join(",")
            // The expectation comes from the LABEL, which is a literal, not from the observed
            // status. Deriving it from $(System.Collections.Hashtable.v).status meant a 403 regressing to a 200 flipped the
            // expectation with it and this assertion still passed.
            const expectedStatus = Number(label)
            const expected = expectedStatus < 400 ? "data,ok" : "error,ok"
            checkInvertible(
                `the ${label} response really is ${label} and uses the shared envelope shape`,
                c.status === expectedStatus && keys === expected,
                `status=${c.status} keys=${keys}`,
            )
        }
    } finally {
        const wsList = `'${ids.wsA}','${ids.wsB}'`
        try {
            await prisma.$executeRawUnsafe(`alter table "CaseRetainerEvent" disable trigger "CaseRetainerEvent_append_only"`)
            await prisma.$executeRawUnsafe(
                `delete from "CaseRetainerEvent" where "retainerId" in (select "id" from "CaseRetainer" where "workspaceId" in (${wsList}))`,
            )
            await prisma.$executeRawUnsafe(`alter table "CaseRetainerEvent" enable trigger "CaseRetainerEvent_append_only"`)
            await prisma.$executeRawUnsafe(`alter table "CaseRetainerDraw" disable trigger "CaseRetainerDraw_append_only"`)
            await prisma.$executeRawUnsafe(
                `delete from "CaseRetainerDraw" where "retainerId" in (select "id" from "CaseRetainer" where "workspaceId" in (${wsList}))`,
            )
            await prisma.$executeRawUnsafe(`alter table "CaseRetainerDraw" enable trigger "CaseRetainerDraw_append_only"`)
            await prisma.$executeRawUnsafe(`alter table "CaseEvent" disable trigger "CaseEvent_append_only"`)
            await prisma.$executeRawUnsafe(
                `delete from "CaseEvent" where "caseId" in (select "id" from "CaseProject" where "workspaceId" in (${wsList}))`,
            )
            await prisma.$executeRawUnsafe(`alter table "CaseEvent" enable trigger "CaseEvent_append_only"`)
            await prisma.$executeRawUnsafe(
                `delete from "CaseRetainerPeriod" where "retainerId" in (select "id" from "CaseRetainer" where "workspaceId" in (${wsList}))`,
            )
            await prisma.$executeRawUnsafe(
                `delete from "CaseRetainerCaseLink" where "retainerId" in (select "id" from "CaseRetainer" where "workspaceId" in (${wsList}))`,
            )
            await prisma.$executeRawUnsafe(`delete from "CaseRetainer" where "workspaceId" in (${wsList})`)
            await prisma.$executeRawUnsafe(
                `delete from "CaseInvoice" where "caseId" in (select "id" from "CaseProject" where "workspaceId" in (${wsList}))`,
            )
            await prisma.$executeRawUnsafe(`delete from "CaseProject" where "workspaceId" in (${wsList})`)
            await prisma.$executeRawUnsafe(`delete from "Membership" where "workspaceId" in (${wsList})`)
            await prisma.$executeRawUnsafe(`delete from "Workspace" where "id" in (${wsList})`)
            await prisma.$executeRawUnsafe(`delete from "Profile" where "id" in ('${ids.profileA}','${ids.profileB}')`)
            await prisma.$executeRawUnsafe(`delete from "User" where "id" in ('${ids.userA}','${ids.userB}')`)
        } catch (e) {
            console.error(`teardown warning: ${(e as Error).message.split("\n")[0]}`)
        }

        const end = {
            retainers: await prisma.caseRetainer.count(),
            periods: await prisma.caseRetainerPeriod.count(),
            draws: await prisma.caseRetainerDraw.count(),
            links: await prisma.caseRetainerCaseLink.count(),
            events: await prisma.caseRetainerEvent.count(),
            cases: await prisma.caseProject.count(),
            payments: await prisma.payment.count(),
        }
        for (const key of Object.keys(base) as Array<keyof typeof base>) {
            check(`${key} rows returned to baseline`, end[key] === base[key], `baseline=${base[key]} end=${end[key]}`)
        }
        await prisma.$disconnect()
    }

    const failed = results.filter((r) => !r.pass)
    for (const r of results) console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.name}${r.detail ? `  (${r.detail})` : ""}`)
    console.log(`\n${results.length - failed.length}/${results.length} assertions passed`)
    if (INVERT) console.log("INVERT_ASSERTION=1 was set - a failure here is the expected proof")
    if (failed.length) process.exit(1)
    console.log("All retainer route boundaries hold.")
}

main().catch((e) => {
    console.error(e)
    process.exit(1)
})

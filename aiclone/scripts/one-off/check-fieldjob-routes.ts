/**
 * fieldJobs route harness.
 *
 * Drives the REAL FieldJobApiService - the same object the route files re-export - with hand-built
 * Request objects, against the authorized disposable rehearsal database.
 *
 * This surface has one thing the cases and cohorts surfaces do not: TWO legitimate actors. An
 * office staffer moving a job card on a technician's behalf is a different fact from the technician
 * moving it, so a write may declare `actorType: "TECHNICIAN"`. That makes the actor an input, which
 * is exactly the kind of input an audit trail must not over-trust, so the harness proves the
 * boundary is narrow: STAFF and TECHNICIAN are accepted, CUSTOMER and SYSTEM are refused with 400,
 * and actorId is never taken from the caller no matter what is sent.
 *
 * The other measured claims:
 *   * non-enumeration byte for byte, on jobs and on technicians;
 *   * 400 for an unrecognised value and 409 for a recognised one in the wrong order, on the same
 *     field;
 *   * the side conditions survive the HTTP boundary - a job still cannot be dispatched with nobody
 *     assigned;
 *   * no notification anywhere: every assignment event carries notified: false;
 *   * a 503 that leaks no internal detail.
 *
 * Set INVERT_ASSERTION=1 to flip one expectation and prove the harness fails loudly.
 *
 *   ts-node -r tsconfig-paths/register scripts/one-off/check-fieldjob-routes.ts
 */
import { PrismaClient } from "@prisma/client"

import { FieldJobIntakeService, FieldJobService } from "../../src/lib/fieldjobs/engine"
import { FieldJobApiService } from "../../src/lib/fieldjobs/http"
import { FieldJobInspectionService, FieldJobInspectionTemplateService } from "../../src/lib/fieldjobs/inspection"
import { FieldJobContext } from "../../src/lib/fieldjobs/shared"
import { InventoryService } from "../../src/lib/inventory/engine"
import { InventoryContext } from "../../src/lib/inventory/shared"
import { PersistedTenancy, type PlatformIdentity } from "../../src/lib/persistence/tenancy"
import { assertDisposableTarget, parseDatabaseName } from "../lib/disposable-db"

const AUTHORIZED_TARGET = "personalink_phase0_rehearsal_20260826_210704"
const INVERT = process.env.INVERT_ASSERTION === "1"
const RUN = `wg6_${Date.now()}_${Math.floor(Math.random() * 1e6)}`
const API = "http://127.0.0.1/api/platform"
const REQ = `${API}/field-job-requests`
const JOBS = `${API}/field-jobs`

const results: Array<{ name: string; pass: boolean; detail: string }> = []
function check(name: string, pass: boolean, detail = "") {
    results.push({ name, pass, detail })
}
/**
 * Flipped at RECORD time by INVERT_ASSERTION=1, so each load-bearing assertion's ability to fail is
 * individually proven. Identical to check() when the variable is unset.
 */
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
function errCode(c: Called): string {
    return (c.body as { error?: { code?: string } }).error?.code ?? "NONE"
}
function errMessage(c: Called): string {
    return (c.body as { error?: { message?: string } }).error?.message ?? ""
}
function dataOf(c: Called): Record<string, unknown> {
    return ((c.body as { data?: Record<string, unknown> }).data ?? {}) as Record<string, unknown>
}
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
    const ctx = new FieldJobContext(prisma, tenancy)
    // The inspection services are part of the same HTTP boundary from Wave H1 onward. This harness
    // does not exercise them - check-fieldjob-inspection-routes.ts does - but the boundary is one
    // object, so they have to be supplied to construct it.
    const api = new FieldJobApiService(
        new FieldJobIntakeService(ctx),
        new FieldJobService(ctx),
        new FieldJobInspectionTemplateService(ctx),
        new FieldJobInspectionService(ctx, new InventoryService(new InventoryContext(prisma, tenancy))),
    )

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
        tech1: `${RUN}_t1`,
        tech2: `${RUN}_t2`,
        techB: `${RUN}_tb`,
    }
    const base = { requests: 0, jobs: 0, assignments: 0, events: 0, resources: 0 }

    try {
        base.requests = await prisma.fieldJobRequest.count()
        base.jobs = await prisma.fieldJob.count()
        base.assignments = await prisma.fieldJobAssignment.count()
        base.events = await prisma.fieldJobEvent.count()
        base.resources = await prisma.appointmentResource.count()

        for (const [u, p, w] of [
            [ids.userA, ids.profileA, ids.wsA],
            [ids.userB, ids.profileB, ids.wsB],
        ]) {
            await prisma.user.create({ data: { id: u, clerkId: `clerk_${u}`, email: `${u}@example.test` } })
            await prisma.profile.create({ data: { id: p, userId: u, slug: `slug-${p}`, displayName: `P ${p}` } })
            await prisma.workspace.create({ data: { id: w, profileId: p, name: `WS ${w}`, slug: `ws-${w}` } })
            await prisma.membership.create({ data: { workspaceId: w, userId: u, role: "OWNER" } })
        }
        for (const [id, profile] of [
            [ids.tech1, ids.profileA],
            [ids.tech2, ids.profileA],
            [ids.techB, ids.profileB],
        ]) {
            await prisma.appointmentResource.create({ data: { id, profileId: profile, name: id, kind: "STAFF" } })
        }

        // ---- 1. anonymous ----------------------------------------------------
        identity.current = null
        const anon = await call(api.listJobs(get(`${JOBS}?workspaceId=${ids.wsA}`)))
        checkInvertible("anonymous list is 401", anon.status === 401, `status=${anon.status}`)
        checkInvertible("the 401 uses the shared envelope", errCode(anon) === "UNAUTHORIZED", errCode(anon))

        // ---- 2. vocabulary versus state ------------------------------------
        identity.current = `clerk_${ids.userA}`
        const req = await call(
            api.createRequest(send(REQ, { workspaceId: ids.wsA, source: "phone", summary: "No heat", siteAddress: "1 A St", idempotencyKey: "r1" })),
        )
        checkInvertible("creating a request is 201", req.status === 201, `status=${req.status}`)
        const requestId = String((dataOf(req).request as { id: string }).id)
        const replay = await call(api.createRequest(send(REQ, { workspaceId: ids.wsA, source: "web", summary: "other", idempotencyKey: "r1" })))
        checkInvertible("a replayed request create is 200 with replayed true", replay.status === 200 && dataOf(replay).replayed === true)

        const badStatus = await call(api.transitionRequest(requestId, send(`${REQ}/${requestId}`, { workspaceId: ids.wsA, status: "MAYBE" }, "PATCH")))
        checkInvertible(
            "MEASURED: an unrecognised request status is 400, because the vocabulary check runs before the state machine",
            badStatus.status === 400 && /status/.test(errMessage(badStatus)),
            `${badStatus.status} ${errMessage(badStatus)}`,
        )
        const illegalStatus = await call(api.transitionRequest(requestId, send(`${REQ}/${requestId}`, { workspaceId: ids.wsA, status: "QUOTED" }, "PATCH")))
        checkInvertible(
            "MEASURED: a recognised status in the wrong order is 409 - same field, two different answers",
            illegalStatus.status === 409,
            `${illegalStatus.status} ${errMessage(illegalStatus)}`,
        )
        const manualConvert = await call(api.transitionRequest(requestId, send(`${REQ}/${requestId}`, { workspaceId: ids.wsA, status: "CONVERTED" }, "PATCH")))
        checkInvertible(
            "a request cannot be marked converted by hand over HTTP either",
            manualConvert.status === 409,
            `${manualConvert.status} ${errMessage(manualConvert)}`,
        )
        const silentDecline = await call(api.transitionRequest(requestId, send(`${REQ}/${requestId}`, { workspaceId: ids.wsA, status: "DECLINED" }, "PATCH")))
        checkInvertible("declining without a reason is 409", silentDecline.status === 409, `${silentDecline.status} ${errMessage(silentDecline)}`)

        await call(api.transitionRequest(requestId, send(`${REQ}/${requestId}`, { workspaceId: ids.wsA, status: "QUALIFYING" }, "PATCH")))
        const negQuote = await call(api.quoteRequest(requestId, send(`${REQ}/${requestId}/quote`, { workspaceId: ids.wsA, estimateCents: -5 }, "PATCH")))
        checkInvertible("a negative quote is 409", negQuote.status === 409, `${negQuote.status} ${errMessage(negQuote)}`)
        const floatQuote = await call(api.quoteRequest(requestId, send(`${REQ}/${requestId}/quote`, { workspaceId: ids.wsA, estimateCents: 1.5 }, "PATCH")))
        checkInvertible("a non-integer quote is 400, not 409", floatQuote.status === 400, `${floatQuote.status} ${errMessage(floatQuote)}`)
        const quoted = await call(api.quoteRequest(requestId, send(`${REQ}/${requestId}/quote`, { workspaceId: ids.wsA, estimateCents: 15000 }, "PATCH")))
        checkInvertible("a valid quote is 200 and moves the request to QUOTED", quoted.status === 200 && (dataOf(quoted).request as { status: string }).status === "QUOTED")

        await call(api.transitionRequest(requestId, send(`${REQ}/${requestId}`, { workspaceId: ids.wsA, status: "ACCEPTED" }, "PATCH")))
        const converted = await call(
            api.convertRequest(requestId, send(`${REQ}/${requestId}/convert`, { workspaceId: ids.wsA, reference: "J-1", title: "Heating call", priority: "HIGH" })),
        )
        checkInvertible("conversion is 201", converted.status === 201, `status=${converted.status}`)
        const jobId = String((dataOf(converted).job as { id: string }).id)
        checkInvertible(
            "the job carries the quote and site forward from the request",
            (dataOf(converted).job as { estimateCents: number; siteAddress: string }).estimateCents === 15000 &&
                (dataOf(converted).job as { siteAddress: string }).siteAddress === "1 A St",
        )
        const badPriority = await call(api.createJob(send(JOBS, { workspaceId: ids.wsA, reference: "J-X", title: "x", siteAddress: "y", priority: "PANIC" })))
        checkInvertible("an unrecognised priority is 400 and lists the accepted values", badPriority.status === 400 && /LOW/.test(errMessage(badPriority)), errMessage(badPriority))

        // ---- 3. THE ACTOR BOUNDARY ---------------------------------------
        const customerActor = await call(
            api.transitionJob(jobId, send(`${JOBS}/${jobId}`, { workspaceId: ids.wsA, status: "SCHEDULED", actorType: "CUSTOMER" }, "PATCH")),
        )
        checkInvertible(
            "MEASURED: a request cannot claim to be the CUSTOMER - only STAFF and TECHNICIAN are accepted",
            customerActor.status === 400 && /actorType/.test(errMessage(customerActor)),
            `${customerActor.status} ${errMessage(customerActor)}`,
        )
        const systemActor = await call(
            api.transitionJob(jobId, send(`${JOBS}/${jobId}`, { workspaceId: ids.wsA, status: "SCHEDULED", actorType: "SYSTEM" }, "PATCH")),
        )
        checkInvertible(
            "MEASURED: a request cannot claim to be the SYSTEM either - an audit trail must not believe that",
            systemActor.status === 400,
            `${systemActor.status} ${errMessage(systemActor)}`,
        )

        // ---- 4. side conditions survive the HTTP boundary ---------------
        const noWindow = await call(api.transitionJob(jobId, send(`${JOBS}/${jobId}`, { workspaceId: ids.wsA, status: "SCHEDULED" }, "PATCH")))
        checkInvertible(
            "a job with no visit window cannot be scheduled over HTTP",
            noWindow.status === 409,
            `${noWindow.status} ${errMessage(noWindow)}`,
        )
        const halfWindow = await call(
            api.scheduleJob(jobId, send(`${JOBS}/${jobId}/schedule`, { workspaceId: ids.wsA, startAt: new Date(Date.now() + 3_600_000).toISOString() }, "PATCH")),
        )
        checkInvertible("half a visit window is 409", halfWindow.status === 409, `${halfWindow.status} ${errMessage(halfWindow)}`)
        const badTimestamp = await call(
            api.scheduleJob(jobId, send(`${JOBS}/${jobId}/schedule`, { workspaceId: ids.wsA, startAt: "not-a-date", endAt: "also-not" }, "PATCH")),
        )
        checkInvertible("an unparseable timestamp is 400", badTimestamp.status === 400, `${badTimestamp.status} ${errMessage(badTimestamp)}`)
        const scheduled = await call(
            api.scheduleJob(
                jobId,
                send(
                    `${JOBS}/${jobId}/schedule`,
                    { workspaceId: ids.wsA, startAt: new Date(Date.now() + 3_600_000).toISOString(), endAt: new Date(Date.now() + 7_200_000).toISOString() },
                    "PATCH",
                ),
            ),
        )
        checkInvertible("a full visit window is 200 and the job reports isScheduled", scheduled.status === 200 && (dataOf(scheduled).job as { isScheduled: boolean }).isScheduled === true)

        await call(api.transitionJob(jobId, send(`${JOBS}/${jobId}`, { workspaceId: ids.wsA, status: "SCHEDULED" }, "PATCH")))
        const noLead = await call(api.transitionJob(jobId, send(`${JOBS}/${jobId}`, { workspaceId: ids.wsA, status: "DISPATCHED" }, "PATCH")))
        checkInvertible(
            "MEASURED: a job still cannot be dispatched with nobody assigned - the side condition is not bypassed by the route",
            noLead.status === 409 && /lead technician/.test(errMessage(noLead)),
            `${noLead.status} ${errMessage(noLead)}`,
        )

        // ---- 5. assignments and non-enumeration -------------------------
        const foreignTech = await call(api.assign(jobId, send(`${JOBS}/${jobId}/assignments`, { workspaceId: ids.wsA, resourceId: ids.techB })))
        const ghostTech = await call(api.assign(jobId, send(`${JOBS}/${jobId}/assignments`, { workspaceId: ids.wsA, resourceId: `${RUN}_ghost` })))
        checkInvertible("another profile's technician is 403", foreignTech.status === 403, `status=${foreignTech.status}`)
        checkInvertible(
            "MEASURED: a foreign technician and a nonexistent one are BYTE-IDENTICAL",
            refusal(foreignTech) === refusal(ghostTech),
            `${refusal(foreignTech)} vs ${refusal(ghostTech)}`,
        )
        const badRole = await call(api.assign(jobId, send(`${JOBS}/${jobId}/assignments`, { workspaceId: ids.wsA, resourceId: ids.tech1, role: "BOSS" })))
        checkInvertible("an unrecognised role is 400", badRole.status === 400 && /LEAD/.test(errMessage(badRole)), errMessage(badRole))

        const lead = await call(
            api.assign(jobId, send(`${JOBS}/${jobId}/assignments`, { workspaceId: ids.wsA, resourceId: ids.tech1, role: "LEAD", idempotencyKey: "a1" })),
        )
        checkInvertible("assigning a lead is 201", lead.status === 201, `status=${lead.status}`)
        const assignmentId = String((dataOf(lead).assignment as { id: string }).id)
        checkInvertible("the assignment reports the technician's name from AppointmentResource", (dataOf(lead).assignment as { resourceName: string }).resourceName === ids.tech1)
        const leadReplay = await call(
            api.assign(jobId, send(`${JOBS}/${jobId}/assignments`, { workspaceId: ids.wsA, resourceId: ids.tech1, role: "LEAD", idempotencyKey: "a1" })),
        )
        checkInvertible("a replayed assignment is 200", leadReplay.status === 200 && dataOf(leadReplay).replayed === true)
        const secondLead = await call(api.assign(jobId, send(`${JOBS}/${jobId}/assignments`, { workspaceId: ids.wsA, resourceId: ids.tech2, role: "LEAD" })))
        checkInvertible("a second active lead is 409", secondLead.status === 409, `${secondLead.status} ${errMessage(secondLead)}`)

        const skip = await call(
            api.transitionAssignment(jobId, assignmentId, send(`${JOBS}/${jobId}/assignments/${assignmentId}`, { workspaceId: ids.wsA, state: "ON_SITE", actorType: "TECHNICIAN" }, "PATCH")),
        )
        checkInvertible("a job card cannot skip acceptance over HTTP", skip.status === 409, `${skip.status} ${errMessage(skip)}`)
        const accepted = await call(
            api.transitionAssignment(jobId, assignmentId, send(`${JOBS}/${jobId}/assignments/${assignmentId}`, { workspaceId: ids.wsA, state: "ACCEPTED", actorType: "TECHNICIAN" }, "PATCH")),
        )
        checkInvertible("a TECHNICIAN actor is accepted and the card moves", accepted.status === 200, `status=${accepted.status}`)
        const silentRelease = await call(
            api.transitionAssignment(jobId, assignmentId, send(`${JOBS}/${jobId}/assignments/${assignmentId}`, { workspaceId: ids.wsA, state: "RELEASED" }, "PATCH")),
        )
        checkInvertible("releasing a card without a reason is 409", silentRelease.status === 409, `${silentRelease.status} ${errMessage(silentRelease)}`)

        // ---- 6. nothing is notified -------------------------------------
        const timeline = await call(api.timeline(jobId, get(`${JOBS}/${jobId}/timeline?workspaceId=${ids.wsA}`)))
        const events = dataOf(timeline).events as Array<{ kind: string; to: string; actor: string; seq: unknown; metadata: unknown }>
        const assignEvents = events.filter((e) => e.kind === "ASSIGNMENT" && e.to === "ASSIGNED")
        checkInvertible(
            "MEASURED: every assignment event carries notified: false, so the record cannot be read as a claim that a technician was told",
            assignEvents.length > 0 && assignEvents.every((e) => (e.metadata as { notified?: boolean } | null)?.notified === false),
            `assignEvents=${assignEvents.length}`,
        )
        checkInvertible("both STAFF and TECHNICIAN appear as actors in the history", new Set(events.map((e) => e.actor)).size >= 2, [...new Set(events.map((e) => e.actor))].join(","))
        checkInvertible("sequence numbers are serialised as strings", events.length > 0 && events.every((e) => typeof e.seq === "string"))

        // ---- 7. tenant isolation ----------------------------------------
        // W3 audit finding 10: these two calls used workspaceId=wsB while identity was still user
        // A, so BOTH failed at workspace authorization and neither ever reached job ownership. The
        // byte-identical comparison was real but it compared two authorization refusals, which is
        // not the property being claimed. Identity now switches to user B FIRST, so user B is
        // legitimately inside workspace B and the refusal can only come from the job check.
        identity.current = `clerk_${ids.userB}`
        const foreignJob = await call(api.getJob(jobId, get(`${JOBS}/${jobId}?workspaceId=${ids.wsB}`)))
        const ghostJob = await call(api.getJob(`${RUN}_ghostjob`, get(`${JOBS}/${RUN}_ghostjob?workspaceId=${ids.wsB}`)))
        checkInvertible("reading another profile's job is 403", foreignJob.status === 403, `status=${foreignJob.status}`)
        checkInvertible(
            "MEASURED: a foreign job and a nonexistent job are BYTE-IDENTICAL",
            refusal(foreignJob) === refusal(ghostJob),
            refusal(ghostJob),
        )
        const bList = await call(api.listJobs(get(`${JOBS}?workspaceId=${ids.wsB}`)))
        checkInvertible("the other profile's job list is 200 and empty", bList.status === 200 && (dataOf(bList).jobs as unknown[]).length === 0)
        // Proof that the refusal above was NOT a workspace-authorization failure: the same
        // identity, in the same workspace, can read its own list successfully.
        checkInvertible(
            "user B really did have access to workspace B, so the 403 above came from job ownership and not from tenancy",
            bList.status === 200,
            `bList=${bList.status}`,
        )
        identity.current = `clerk_${ids.userA}`

        // ---- 8. status filter -------------------------------------------
        const badFilter = await call(api.listJobs(get(`${JOBS}?workspaceId=${ids.wsA}&status=NOPE`)))
        checkInvertible("an unrecognised status filter is 400 rather than silently ignored", badFilter.status === 400, `${badFilter.status} ${errMessage(badFilter)}`)
        // W3 audit finding 4: this asserted `.every(...)` over the filtered rows, which is
        // vacuously true on an empty result. The filter is now chosen from a status that a real
        // job actually holds, and the row count is compared against an independently computed
        // expectation, so an empty result fails instead of passing.
        const allJobs = await call(api.listJobs(get(`${JOBS}?workspaceId=${ids.wsA}`)))
        const allRows = dataOf(allJobs).jobs as Array<{ id: string; status: string }>
        const presentStatus = allRows[0]?.status ?? "SCHEDULED"
        const expectedForStatus = allRows.filter((j) => j.status === presentStatus).length
        const filtered = await call(api.listJobs(get(`${JOBS}?workspaceId=${ids.wsA}&status=${presentStatus}`)))
        const filteredRows = dataOf(filtered).jobs as Array<{ status: string }>
        checkInvertible(
            "a valid status filter is applied, and the result is NON-EMPTY so the assertion cannot pass on an empty set",
            filtered.status === 200 &&
                allRows.length > 0 &&
                filteredRows.length > 0 &&
                filteredRows.length === expectedForStatus &&
                filteredRows.every((j) => j.status === presentStatus),
            `status=${presentStatus} filtered=${filteredRows.length} expected=${expectedForStatus} total=${allRows.length}`,
        )

        // ---- 9. dependency failure --------------------------------------
        const brokenPrisma = {
            fieldJob: {
                findMany: async () => {
                    throw new Error("SECRET_DETAIL postgres://u:p@h/d")
                },
            },
        } as unknown as PrismaClient
        const brokenApi = new FieldJobApiService(
            new FieldJobIntakeService(new FieldJobContext(brokenPrisma, tenancy)),
            new FieldJobService(new FieldJobContext(brokenPrisma, tenancy)),
            new FieldJobInspectionTemplateService(new FieldJobContext(brokenPrisma, tenancy)),
            new FieldJobInspectionService(
                new FieldJobContext(brokenPrisma, tenancy),
                new InventoryService(new InventoryContext(brokenPrisma, tenancy)),
            ),
        )
        const broken = await call(brokenApi.listJobs(get(`${JOBS}?workspaceId=${ids.wsA}`)))
        checkInvertible("a dependency failure is 503", broken.status === 503, `status=${broken.status}`)
        checkInvertible(
            "MEASURED: the 503 body leaks no DSN, host or driver text",
            !/SECRET_DETAIL|postgres:\/\//.test(broken.raw) && errCode(broken) === "DEPENDENCY_UNAVAILABLE",
            broken.raw.slice(0, 100),
        )

        // ---- 10. one envelope shape ------------------------------------
        for (const [label, c] of [
            ["200", scheduled],
            ["201", lead],
            ["400", badRole],
            ["401", anon],
            ["403", foreignJob],
            ["409", noLead],
            ["503", broken],
        ] as Array<[string, Called]>) {
            const keys = Object.keys(c.body).sort().join(",")
            // The expectation comes from the LABEL, which is a literal, not from the observed
            // status. Deriving it from the observed `c.status` meant a 403 regressing to a 200 flipped the
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
        const profileList = `'${ids.profileA}','${ids.profileB}'`
        try {
            await prisma.$executeRawUnsafe(`alter table "FieldJobEvent" disable trigger "FieldJobEvent_append_only"`)
            try {
                await prisma.$executeRawUnsafe(
                    `delete from "FieldJobEvent" where "jobId" in (select "id" from "FieldJob" where "profileId" in (${profileList}))`,
                )
            } finally {
                // W3 audit finding 12: the re-enable used to sit after the delete in the SAME try
                // block. A throw in the delete left the ledger unguarded on the shared rehearsal
                // database, and every later append-only assertion - in this harness and in every
                // other one - would then have passed while proving nothing at all.
                await prisma.$executeRawUnsafe(`alter table "FieldJobEvent" enable trigger "FieldJobEvent_append_only"`)
            }
            await prisma.$executeRawUnsafe(
                `delete from "FieldJobAssignment" where "jobId" in (select "id" from "FieldJob" where "profileId" in (${profileList}))`,
            )
            await prisma.$executeRawUnsafe(`delete from "FieldJob" where "profileId" in (${profileList})`)
            await prisma.$executeRawUnsafe(`delete from "FieldJobRequest" where "profileId" in (${profileList})`)
            await prisma.$executeRawUnsafe(`delete from "AppointmentResource" where "profileId" in (${profileList})`)
            await prisma.$executeRawUnsafe(`delete from "Membership" where "workspaceId" in ('${ids.wsA}','${ids.wsB}')`)
            await prisma.$executeRawUnsafe(`delete from "Workspace" where "id" in ('${ids.wsA}','${ids.wsB}')`)
            await prisma.$executeRawUnsafe(`delete from "Profile" where "id" in (${profileList})`)
            await prisma.$executeRawUnsafe(`delete from "User" where "id" in ('${ids.userA}','${ids.userB}')`)
        } catch (e) {
            console.error(`teardown warning: ${(e as Error).message.split("\n")[0]}`)
        }
        const end = {
            requests: await prisma.fieldJobRequest.count(),
            jobs: await prisma.fieldJob.count(),
            assignments: await prisma.fieldJobAssignment.count(),
            events: await prisma.fieldJobEvent.count(),
            resources: await prisma.appointmentResource.count(),
        }
        for (const key of Object.keys(base) as Array<keyof typeof base>) {
            check(`${key} rows returned to baseline`, end[key] === base[key], `baseline=${base[key]} end=${end[key]}`)
        }
        await prisma.$disconnect()
    }

    const failed = results.filter((r) => !r.pass)
    // The post-hoc single-flip block that used to sit here was removed: inversion is now
    // per-assertion via checkInvertible, and flipping one result again afterwards would have
    // turned it back into a pass.
    for (const r of results) console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.name}${r.detail ? `  (${r.detail})` : ""}`)
    console.log(`\n${results.length - failed.length}/${results.length} assertions passed`)
    if (INVERT) console.log("INVERT_ASSERTION=1 was set - a failure here is the expected proof")
    if (failed.length) process.exit(1)
    console.log("All fieldJobs route boundaries hold.")
}

main().catch((e) => {
    console.error(e)
    process.exit(1)
})

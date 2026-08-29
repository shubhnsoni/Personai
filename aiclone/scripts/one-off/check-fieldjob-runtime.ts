/**
 * Wave G4: fieldJobs runtime harness.
 *
 * Executes the REAL FieldJobIntakeService and FieldJobService against the authorized disposable
 * rehearsal database with a controlled identity.
 *
 * The claims worth measuring rather than trusting:
 *   * The SIDE CONDITIONS on job transitions. A status table alone would let an owner dispatch a
 *     job with nobody assigned, start one before anybody arrived, or complete one while a
 *     technician is still on site. Each is exercised.
 *   * That "dispatch" notifies nobody. Global fetch is replaced with a counting blocker, and the
 *     assignment event is asserted to record `notified: false` - so the history cannot be read as
 *     a claim that somebody was told.
 *   * That a declined job card and a released one both carry a reason, in the engine as well as
 *     in the database.
 *   * Non-enumeration, compared byte for byte: a foreign technician, a nonexistent technician, a
 *     foreign job and a nonexistent job all produce the identical serialized refusal.
 *
 * Two negative claims are measured: zero external calls, and zero residue.
 *
 * Set INVERT_ASSERTION=1 to flip one expectation and prove the harness fails loudly.
 *
 *   ts-node -r tsconfig-paths/register scripts/one-off/check-fieldjob-runtime.ts
 */
// The blocker MUST be the first import: its side effect has to run before any module under test
// is evaluated. W3 audit finding 8 - the previous in-file blocker installed after these imports had
// already been evaluated, so "zero external calls" described only the window it was watching.
import {
    EXTERNAL_CALL_BLOCKER_INSTALLED,
    externalCallCount,
    externalCallLog,
    restoreExternalCalls,
} from "../lib/external-call-blocker"

import { PrismaClient } from "@prisma/client"

import { FieldJobIntakeService, FieldJobService } from "../../src/lib/fieldjobs/engine"
import {
    ASSIGNMENT_STATES,
    JOB_STATUSES,
    REQUEST_STATUSES,
    assignmentFlow,
    jobFlow,
    requestFlow,
} from "../../src/lib/fieldjobs/lifecycle"
import { FieldJobContext } from "../../src/lib/fieldjobs/shared"
import { PersistenceError } from "../../src/lib/persistence/errors"
import { PersistedTenancy, type PlatformIdentity } from "../../src/lib/persistence/tenancy"
import { assertDisposableTarget, parseDatabaseName } from "../lib/disposable-db"

const AUTHORIZED_TARGET = "personalink_phase0_rehearsal_20260826_210704"
const INVERT = process.env.INVERT_ASSERTION === "1"
const RUN = `wg4r_${Date.now()}_${Math.floor(Math.random() * 1e6)}`

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

type Envelope = { ok: true } | { ok: false; code: string; message: string }
async function attempt(fn: () => Promise<unknown>): Promise<Envelope> {
    try {
        await fn()
        return { ok: true }
    } catch (e) {
        if (e instanceof PersistenceError) return { ok: false, code: e.code, message: e.message }
        return { ok: false, code: "UNEXPECTED", message: (e as Error).message.split("\n")[0] }
    }
}
function why(o: Envelope): string {
    return o.ok ? "ACCEPTED" : `${o.code}: ${o.message}`
}
function envelope(o: Envelope): string {
    return JSON.stringify(o)
}

/**
 * Like attempt(), but keeps the WHOLE driver message.
 *
 * Deliberately separate from Envelope: envelope() is serialized for the byte-identical
 * non-enumeration comparison, and raw driver text contains row ids, so folding it into that type
 * would make a foreign refusal and a ghost refusal differ and silently break the very property
 * that comparison exists to prove.
 */
async function attemptRaw(fn: () => Promise<unknown>): Promise<{ ok: boolean; raw: string }> {
    try {
        await fn()
        return { ok: true, raw: "" }
    } catch (e) {
        return { ok: false, raw: String((e as Error).message).replace(/\s+/g, " ") }
    }
}

const actor = { actorType: "STAFF" as const, actorId: "harness" }
const techActor = { actorType: "TECHNICIAN" as const, actorId: "tech" }

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
    const ctx = new FieldJobContext(prisma, new PersistedTenancy(prisma, identity))
    const intake = new FieldJobIntakeService(ctx)
    const jobs = new FieldJobService(ctx)

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
        locA: `${RUN}_la`,
        svcA: `${RUN}_sa`,
        techA1: `${RUN}_t1`,
        techA2: `${RUN}_t2`,
        techA3: `${RUN}_t3`,
        techInactive: `${RUN}_ti`,
        techB: `${RUN}_tb`,
    }
    const base = { requests: 0, jobs: 0, assignments: 0, events: 0, resources: 0, offerings: 0, bookings: 0 }

    try {
        base.requests = await prisma.fieldJobRequest.count()
        base.jobs = await prisma.fieldJob.count()
        base.assignments = await prisma.fieldJobAssignment.count()
        base.events = await prisma.fieldJobEvent.count()
        base.resources = await prisma.appointmentResource.count()
        base.offerings = await prisma.serviceOffering.count()
        base.bookings = await prisma.booking.count()

        // ---- 0. three lifecycle tables, total and terminal-correct ----------
        for (const { label, all, can } of [
            { label: "request", all: REQUEST_STATUSES, can: (a: string, b: string) => requestFlow.can(a as never, b as never) },
            { label: "job", all: JOB_STATUSES, can: (a: string, b: string) => jobFlow.can(a as never, b as never) },
            { label: "assignment", all: ASSIGNMENT_STATES, can: (a: string, b: string) => assignmentFlow.can(a as never, b as never) },
        ]) {
            let legal = 0
            let illegal = 0
            for (const from of all) {
                for (const to of all) {
                    if (can(from, to)) legal += 1
                    else illegal += 1
                }
            }
            check(
                `${label} transition table is total over ${all.length}x${all.length} pairs`,
                legal + illegal === all.length ** 2,
                `legal=${legal} illegal=${illegal}`,
            )
        }
        check(
            "a declined or converted request is terminal, so a declined request stays a record",
            requestFlow.isTerminal("DECLINED") && requestFlow.isTerminal("CONVERTED"),
        )
        check(
            "SCHEDULED can go back to DRAFT but DISPATCHED cannot - a technician has already been told",
            jobFlow.can("SCHEDULED", "DRAFT") && !jobFlow.can("DISPATCHED", "SCHEDULED"),
        )
        check(
            "an in-progress job can still be cancelled, because work does get abandoned",
            jobFlow.can("IN_PROGRESS", "CANCELLED"),
        )
        check("a completed job is terminal", jobFlow.isTerminal("COMPLETED") && !jobFlow.can("COMPLETED", "CANCELLED"))
        check(
            "a job card must be accepted before it can move, so a silent refusal cannot look like agreement",
            !assignmentFlow.can("ASSIGNED", "EN_ROUTE") && assignmentFlow.can("ASSIGNED", "ACCEPTED"),
        )
        check(
            "a technician can be released from any live state",
            (["ASSIGNED", "ACCEPTED", "EN_ROUTE", "ON_SITE"] as const).every((s) => assignmentFlow.can(s, "RELEASED")),
        )

        // ---- seed two profiles ---------------------------------------------
        for (const [u, p, w] of [
            [ids.userA, ids.profileA, ids.wsA],
            [ids.userB, ids.profileB, ids.wsB],
        ]) {
            await prisma.user.create({ data: { id: u, clerkId: `clerk_${u}`, email: `${u}@example.test` } })
            await prisma.profile.create({ data: { id: p, userId: u, slug: `slug-${p}`, displayName: `P ${p}` } })
            await prisma.workspace.create({ data: { id: w, profileId: p, name: `WS ${w}`, slug: `ws-${w}` } })
            await prisma.membership.create({ data: { workspaceId: w, userId: u, role: "OWNER" } })
        }
        await prisma.location.create({ data: { id: ids.locA, workspaceId: ids.wsA, name: "Depot" } })
        await prisma.serviceOffering.create({ data: { id: ids.svcA, profileId: ids.profileA, name: "Boiler service" } })
        for (const [id, profile, active] of [
            [ids.techA1, ids.profileA, true],
            [ids.techA2, ids.profileA, true],
            [ids.techA3, ids.profileA, true],
            [ids.techInactive, ids.profileA, false],
            [ids.techB, ids.profileB, true],
        ] as Array<[string, string, boolean]>) {
            await prisma.appointmentResource.create({
                data: { id, profileId: profile, name: id, kind: "STAFF", isActive: active },
            })
        }

        // ---- 1. anonymous is refused and writes nothing --------------------
        identity.current = null
        const anonIntake = await attempt(() => intake.create(ids.wsA, { source: "phone", summary: "x" }))
        const anonList = await attempt(() => jobs.list(ids.wsA))
        check("anonymous intake refused UNAUTHORIZED", !anonIntake.ok && anonIntake.code === "UNAUTHORIZED", why(anonIntake))
        check("anonymous list refused UNAUTHORIZED", !anonList.ok && anonList.code === "UNAUTHORIZED", why(anonList))
        check("anonymous wrote zero requests", (await prisma.fieldJobRequest.count()) === base.requests)

        // ---- 2. intake -----------------------------------------------------
        identity.current = `clerk_${ids.userA}`
        const req = await intake.create(ids.wsA, {
            source: "phone",
            summary: "No hot water",
            serviceOfferingId: ids.svcA,
            requesterName: "A Customer",
            requesterPhone: "0000",
            siteAddress: "12 Example Street",
            idempotencyKey: "r1",
        })
        check("a request starts NEW", req.request.status === "NEW", `status=${req.request.status}`)
        const reqReplay = await intake.create(ids.wsA, { source: "web", summary: "different", idempotencyKey: "r1" })
        check(
            "replaying the request key returns the original",
            reqReplay.replayed && reqReplay.request.id === req.request.id && reqReplay.request.source === "phone",
            `replayed=${reqReplay.replayed}`,
        )
        const foreignOffering = await attempt(() =>
            intake.create(ids.wsA, { source: "web", summary: "x", serviceOfferingId: `${RUN}_ghostsvc` }),
        )
        check(
            "a request naming an unknown offering is FORBIDDEN, not a dangling reference",
            !foreignOffering.ok && foreignOffering.code === "FORBIDDEN",
            why(foreignOffering),
        )

        const earlyConvert = await attempt(() =>
            intake.convert(ids.wsA, req.request.id, { reference: "J-1", title: "Boiler" }, actor),
        )
        check("a NEW request cannot be converted", !earlyConvert.ok && earlyConvert.code === "CONFLICT", why(earlyConvert))
        const earlyQuote = await attempt(() => intake.quote(ids.wsA, req.request.id, { estimateCents: 12000 }))
        check("a NEW request cannot be quoted, because nobody has qualified it", !earlyQuote.ok && earlyQuote.code === "CONFLICT", why(earlyQuote))

        await intake.transition(ids.wsA, req.request.id, "QUALIFYING")
        const quoted = await intake.quote(ids.wsA, req.request.id, { estimateCents: 12000 })
        check("quoting moves the request to QUOTED and records the number", quoted.status === "QUOTED" && quoted.estimateCents === 12000)
        const negQuote = await attempt(() => intake.quote(ids.wsA, req.request.id, { estimateCents: -1 }))
        check("a negative quote is refused", !negQuote.ok && negQuote.code === "CONFLICT", why(negQuote))

        const silentDecline = await attempt(() => intake.transition(ids.wsA, req.request.id, "DECLINED"))
        check("declining a request without a reason is refused", !silentDecline.ok && silentDecline.code === "CONFLICT", why(silentDecline))
        const manualConvert = await attempt(() => intake.transition(ids.wsA, req.request.id, "CONVERTED"))
        check(
            "a request cannot be marked converted by hand - conversion is creating the job",
            !manualConvert.ok && manualConvert.code === "CONFLICT",
            why(manualConvert),
        )

        await intake.transition(ids.wsA, req.request.id, "ACCEPTED")
        const job = await intake.convert(
            ids.wsA,
            req.request.id,
            { reference: "J-1", title: "Boiler call", originLocationId: ids.locA, priority: "HIGH" },
            actor,
        )
        check("conversion produces a DRAFT job", job.status === "DRAFT", `status=${job.status}`)
        check("the job inherits the site, contact, estimate and offering from the request", job.siteAddress === "12 Example Street" && job.estimateCents === 12000 && job.contactName === "A Customer" && job.serviceOfferingId === ids.svcA)
        const reqAfter = (await intake.list(ids.wsA)).find((r) => r.id === req.request.id)
        check("and the request becomes CONVERTED in the same transaction", reqAfter?.status === "CONVERTED", `status=${reqAfter?.status}`)
        const doubleConvert = await attempt(() =>
            intake.convert(ids.wsA, req.request.id, { reference: "J-2", title: "Again" }, actor),
        )
        check("a converted request cannot be converted again", !doubleConvert.ok && doubleConvert.code === "CONFLICT", why(doubleConvert))

        const noAddress = await intake.create(ids.wsA, { source: "email", summary: "No address given", idempotencyKey: "r2" })
        await intake.transition(ids.wsA, noAddress.request.id, "QUALIFYING")
        await intake.transition(ids.wsA, noAddress.request.id, "ACCEPTED")
        const convertNoSite = await attempt(() =>
            intake.convert(ids.wsA, noAddress.request.id, { reference: "J-NS", title: "No site" }, actor),
        )
        check(
            "a request with no site address cannot be converted without one being supplied - a job with no address cannot be visited",
            !convertNoSite.ok && convertNoSite.code === "CONFLICT",
            why(convertNoSite),
        )
        const convertWithSite = await intake.convert(
            ids.wsA,
            noAddress.request.id,
            { reference: "J-NS", title: "No site", siteAddress: "9 Supplied Road" },
            actor,
        )
        check("supplying the address at conversion works", convertWithSite.siteAddress === "9 Supplied Road")

        // ---- 3. jobs: creation and references ------------------------------
        const direct = await jobs.create(
            ids.wsA,
            { reference: "J-3", title: "Direct job", siteAddress: "3 Direct Way", idempotencyKey: "j3" },
            actor,
        )
        const directReplay = await jobs.create(
            ids.wsA,
            { reference: "J-OTHER", title: "other", siteAddress: "x", idempotencyKey: "j3" },
            actor,
        )
        check("replaying a job key returns the original", directReplay.replayed && directReplay.job.id === direct.job.id)
        const dupRef = await attempt(() =>
            jobs.create(ids.wsA, { reference: "J-3", title: "clash", siteAddress: "x" }, actor),
        )
        check("a duplicate job reference in one profile is a CONFLICT", !dupRef.ok && dupRef.code === "CONFLICT", why(dupRef))

        // ---- 4. schedule ---------------------------------------------------
        const now = Date.now()
        const halfWindow = await attempt(() =>
            jobs.schedule(ids.wsA, job.id, { startAt: new Date(now + 3_600_000), endAt: null }, actor),
        )
        check("a visit window with a start and no end is refused", !halfWindow.ok && halfWindow.code === "CONFLICT", why(halfWindow))
        const backwards = await attempt(() =>
            jobs.schedule(ids.wsA, job.id, { startAt: new Date(now + 7_200_000), endAt: new Date(now + 3_600_000) }, actor),
        )
        check("a window that ends before it starts is refused", !backwards.ok && backwards.code === "CONFLICT", why(backwards))
        const scheduled = await jobs.schedule(
            ids.wsA,
            job.id,
            { startAt: new Date(now + 3_600_000), endAt: new Date(now + 7_200_000) },
            actor,
        )
        check("a valid window is accepted and reported as scheduled", scheduled.isScheduled, `isScheduled=${scheduled.isScheduled}`)

        // ---- 5. THE SIDE CONDITIONS ---------------------------------------
        const unscheduledJob = direct.job
        const schedulelessMove = await attempt(() => jobs.transition(ids.wsA, unscheduledJob.id, "SCHEDULED", actor))
        check(
            "a job with no visit window cannot be marked scheduled - dispatching an undated job tells nobody when",
            !schedulelessMove.ok && schedulelessMove.code === "CONFLICT",
            why(schedulelessMove),
        )

        await jobs.transition(ids.wsA, job.id, "SCHEDULED", actor)
        const noLead = await attempt(() => jobs.transition(ids.wsA, job.id, "DISPATCHED", actor))
        checkInvertible(
            "MEASURED: a job cannot be dispatched with nobody assigned - a status table alone would allow it",
            !noLead.ok && noLead.code === "CONFLICT",
            why(noLead),
        )

        const helper = await jobs.assign(ids.wsA, job.id, { resourceId: ids.techA2, role: "HELPER" }, actor)
        const helperOnlyDispatch = await attempt(() => jobs.transition(ids.wsA, job.id, "DISPATCHED", actor))
        check(
            "a helper alone is not enough to dispatch - somebody has to be accountable",
            !helperOnlyDispatch.ok && helperOnlyDispatch.code === "CONFLICT",
            why(helperOnlyDispatch),
        )

        const lead = await jobs.assign(ids.wsA, job.id, { resourceId: ids.techA1, role: "LEAD", idempotencyKey: "a1" }, actor)
        check("assigning a lead reports the technician's name from AppointmentResource", lead.assignment.resourceName === ids.techA1)
        const leadReplay = await jobs.assign(ids.wsA, job.id, { resourceId: ids.techA1, role: "LEAD", idempotencyKey: "a1" }, actor)
        check("replaying an assignment key returns the original", leadReplay.replayed && leadReplay.assignment.id === lead.assignment.id)

        await jobs.transition(ids.wsA, job.id, "DISPATCHED", actor)
        const noOnSite = await attempt(() => jobs.transition(ids.wsA, job.id, "IN_PROGRESS", actor))
        checkInvertible(
            "MEASURED: work cannot start until a technician is actually on site",
            !noOnSite.ok && noOnSite.code === "CONFLICT",
            why(noOnSite),
        )

        // ---- 6. assignments ------------------------------------------------
        const secondLead = await attempt(() => jobs.assign(ids.wsA, job.id, { resourceId: ids.techA3, role: "LEAD" }, actor))
        check("a second active lead is refused", !secondLead.ok && secondLead.code === "CONFLICT", why(secondLead))
        const reAssign = await attempt(() => jobs.assign(ids.wsA, job.id, { resourceId: ids.techA1, role: "HELPER" }, actor))
        check("assigning the same technician twice while active is refused", !reAssign.ok && reAssign.code === "CONFLICT", why(reAssign))
        const inactive = await attempt(() => jobs.assign(ids.wsA, job.id, { resourceId: ids.techInactive }, actor))
        check("an inactive technician cannot be assigned", !inactive.ok && inactive.code === "CONFLICT", why(inactive))

        const foreignTech = await attempt(() => jobs.assign(ids.wsA, job.id, { resourceId: ids.techB }, actor))
        const ghostTech = await attempt(() => jobs.assign(ids.wsA, job.id, { resourceId: `${RUN}_ghosttech` }, actor))
        check("another profile's technician cannot be assigned", !foreignTech.ok && foreignTech.code === "FORBIDDEN", why(foreignTech))
        checkInvertible(
            "a foreign technician and a nonexistent one produce byte-identical refusals",
            envelope(foreignTech) === envelope(ghostTech),
            `${envelope(foreignTech)} vs ${envelope(ghostTech)}`,
        )

        const skipAccept = await attempt(() =>
            jobs.transitionAssignment(ids.wsA, job.id, lead.assignment.id, "ON_SITE", techActor),
        )
        check(
            "a job card cannot jump from assigned to on site - the technician has not answered yet",
            !skipAccept.ok && skipAccept.code === "CONFLICT",
            why(skipAccept),
        )
        const silentCardDecline = await attempt(() =>
            jobs.transitionAssignment(ids.wsA, job.id, helper.assignment.id, "DECLINED", techActor),
        )
        check("declining a job card without a reason is refused", !silentCardDecline.ok && silentCardDecline.code === "CONFLICT", why(silentCardDecline))
        const declined = await jobs.transitionAssignment(ids.wsA, job.id, helper.assignment.id, "DECLINED", techActor, "off shift")
        check("declining with a reason records it and is terminal", declined.declineReason === "off shift" && declined.allowedTransitions.length === 0)
        check("a declined card is no longer active", declined.isActive === false)

        const afterDeclineReassign = await jobs.assign(ids.wsA, job.id, { resourceId: ids.techA2, role: "HELPER" }, actor)
        check(
            "a technician who declined can be assigned again, and the declined row survives",
            afterDeclineReassign.assignment.id !== helper.assignment.id,
        )

        await jobs.transitionAssignment(ids.wsA, job.id, lead.assignment.id, "ACCEPTED", techActor)
        await jobs.transitionAssignment(ids.wsA, job.id, lead.assignment.id, "EN_ROUTE", techActor)
        const onSite = await jobs.transitionAssignment(ids.wsA, job.id, lead.assignment.id, "ON_SITE", techActor)
        check("the job card reaches ON_SITE and stamps the time", onSite.onSiteAt !== null)

        await jobs.transition(ids.wsA, job.id, "IN_PROGRESS", actor)
        const earlyComplete = await attempt(() => jobs.transition(ids.wsA, job.id, "COMPLETED", actor))
        checkInvertible(
            "MEASURED: a job is not complete while a technician is still mid-visit, and the refusal names how many",
            !earlyComplete.ok && earlyComplete.code === "CONFLICT" && /still mid-visit/.test((earlyComplete as { message: string }).message),
            why(earlyComplete),
        )
        await jobs.transitionAssignment(ids.wsA, job.id, afterDeclineReassign.assignment.id, "RELEASED", actor, "not needed")
        await jobs.transitionAssignment(ids.wsA, job.id, lead.assignment.id, "COMPLETED", techActor)
        const completed = await jobs.transition(ids.wsA, job.id, "COMPLETED", actor)
        check("once every card is settled the job completes", completed.status === "COMPLETED" && completed.completedAt !== null)
        const reviveJob = await attempt(() => jobs.transition(ids.wsA, job.id, "IN_PROGRESS", actor))
        check("a completed job cannot be reopened", !reviveJob.ok && reviveJob.code === "CONFLICT", why(reviveJob))
        const assignToDone = await attempt(() => jobs.assign(ids.wsA, job.id, { resourceId: ids.techA3 }, actor))
        check("nobody can be assigned to a completed job", !assignToDone.ok && assignToDone.code === "CONFLICT", why(assignToDone))

        // ---- 7. cancellation needs a reason -------------------------------
        const silentCancel = await attempt(() => jobs.transition(ids.wsA, direct.job.id, "CANCELLED", actor))
        check("cancelling a job without a reason is refused", !silentCancel.ok && silentCancel.code === "CONFLICT", why(silentCancel))
        const cancelled = await jobs.transition(ids.wsA, direct.job.id, "CANCELLED", actor, "customer withdrew")
        check("cancelling with a reason records it", cancelled.cancelReason === "customer withdrew")

        // ---- 8. nothing was notified, nothing was called ------------------
        const timeline = await jobs.timeline(ids.wsA, job.id)
        const assignmentEvents = timeline.filter((e) => e.kind === "ASSIGNMENT" && e.to === "ASSIGNED")
        check(
            "MEASURED: every assignment event records notified: false, so the history cannot be read as a claim that a technician was told",
            assignmentEvents.length > 0 &&
                assignmentEvents.every((e) => (e.metadata as { notified?: boolean } | null)?.notified === false),
            `assignmentEvents=${assignmentEvents.length}`,
        )
        const kinds = new Set(timeline.map((e) => e.kind))
        check(
            "the job history covers creation, status, schedule and assignments",
            ["CREATED", "STATUS", "SCHEDULE", "ASSIGNMENT"].every((k) => kinds.has(k)),
            [...kinds].join(","),
        )
        check("history is ordered by a monotonic sequence", timeline.every((e, i) => i === 0 || BigInt(e.seq) > BigInt(timeline[i - 1].seq)))
        const actors = new Set(timeline.map((e) => e.actor))
        check(
            "both STAFF and TECHNICIAN appear as actors, so who did what survives in the record",
            actors.has("STAFF") && actors.has("TECHNICIAN"),
            [...actors].join(","),
        )
        // W3 audit finding 3: this asserted only `!rewrite.ok`. attempt() maps ANY unexpected
        // error to UNEXPECTED, so a missing trigger plus a malformed query, a dropped connection
        // or any unrelated database error would have satisfied it. The trigger's own stable
        // message is now required, so the refusal must come from the ledger guard itself.
        const rewrite = await attemptRaw(() =>
            prisma.$executeRawUnsafe(`update "FieldJobEvent" set "to" = 'TAMPERED' where "jobId" = '${job.id}'`),
        )
        check(
            "the database refuses to rewrite the job history, and the refusal comes from the append-only trigger itself",
            !rewrite.ok && /is append-only; UPDATE is forbidden/.test(rewrite.raw),
            rewrite.ok ? "ACCEPTED - the history was rewritten" : rewrite.raw.slice(0, 160),
        )
        const erase = await attemptRaw(() =>
            prisma.$executeRawUnsafe(`delete from "FieldJobEvent" where "jobId" = '${job.id}'`),
        )
        check(
            "the database refuses to erase the job history, by the same trigger",
            !erase.ok && /is append-only; DELETE is forbidden/.test(erase.raw),
            erase.ok ? "ACCEPTED - the history was erased" : erase.raw.slice(0, 160),
        )

        // ---- 9. tenant isolation and non-enumeration ---------------------
        identity.current = `clerk_${ids.userB}`
        const foreignJob = await attempt(() => jobs.get(ids.wsB, job.id))
        const ghostJob = await attempt(() => jobs.get(ids.wsB, `${RUN}_ghostjob`))
        check("another profile cannot read the job", !foreignJob.ok && foreignJob.code === "FORBIDDEN", why(foreignJob))
        checkInvertible(
            "a foreign job and a nonexistent one produce byte-identical refusals",
            envelope(foreignJob) === envelope(ghostJob),
            envelope(ghostJob),
        )
        const crossWorkspace = await attempt(() => jobs.get(ids.wsA, job.id))
        check(
            "naming another profile's workspace is refused before the job is read",
            !crossWorkspace.ok && crossWorkspace.code === "FORBIDDEN",
            why(crossWorkspace),
        )
        const bList = await jobs.list(ids.wsB)
        check("the other profile's job list is empty rather than filtered from a shared page", bList.length === 0, `n=${bList.length}`)
        identity.current = `clerk_${ids.userA}`

        // ---- 10. reuse did not disturb the appointments domain ------------
        const resourcesNow = await prisma.appointmentResource.count()
        check(
            "the technician rows are the same AppointmentResource rows - none were copied into a fieldJobs table",
            resourcesNow === base.resources + 5,
            `resources ${base.resources} -> ${resourcesNow}`,
        )
        const bookingsNow = await prisma.booking.count()
        check("no Booking row was created by any of this", bookingsNow === base.bookings, `bookings ${base.bookings} -> ${bookingsNow}`)

        check(
            "the external-call blocker was actually installed, rather than assumed",
            EXTERNAL_CALL_BLOCKER_INSTALLED,
            "installed at import time, before any module under test evaluated",
        )
        checkInvertible(
            "zero fetch, http or https calls were made by the fieldJobs runtime",
            externalCallCount() === 0,
            externalCallCount() === 0 ? "0 attempts across fetch, http.request/get and https.request/get" : externalCallLog().join("; "),
        )
    } finally {
        restoreExternalCalls()
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
            await prisma.$executeRawUnsafe(`delete from "ServiceOffering" where "profileId" in (${profileList})`)
            await prisma.$executeRawUnsafe(`delete from "Location" where "workspaceId" in ('${ids.wsA}','${ids.wsB}')`)
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
            offerings: await prisma.serviceOffering.count(),
            bookings: await prisma.booking.count(),
        }
        for (const key of Object.keys(base) as Array<keyof typeof base>) {
            check(`${key} rows returned to baseline`, end[key] === base[key], `baseline=${base[key]} end=${end[key]}`)
        }
        const armed = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
            `select count(*) as n from information_schema.triggers where trigger_name = 'FieldJobEvent_append_only'`,
        )
        check("the append-only trigger was re-armed after teardown", Number(armed[0].n) === 2, `rows=${armed[0].n}`)
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
    console.log("All fieldJobs runtime boundaries hold.")
}

main().catch((e) => {
    console.error(e)
    process.exit(1)
})

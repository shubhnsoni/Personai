/**
 * Wave D / D2 cohort runtime harness.
 *
 * Exercises the REAL CohortService, CohortWorkflowService and CohortProgressService
 * against the authorized disposable rehearsal database with a controlled identity.
 *
 * The claims that are MEASURED rather than described:
 *   - a refusal writes no row and appends no CohortEvent (counts before/after)
 *   - a refusal reaches nothing external (globalThis.fetch is replaced by a counting
 *     blocker for the whole run; total calls must be 0)
 *   - completion and certificate eligibility are recomputed from persisted records, so a
 *     caller cannot assert them; the refusal carries the reasons
 *   - REMINDED cannot be reached without a real queued TaskJob
 *   - every fixture row is removed and every touched table returns to baseline
 *
 * Set INVERT_ASSERTION=1 to flip one expectation and prove the harness fails loudly.
 *
 *   ts-node -r tsconfig-paths/register scripts/one-off/check-cohort-runtime.ts
 */
import { PrismaClient } from "@prisma/client"

import { CohortService } from "../../src/lib/cohorts/engine"
import {
    ATTENDANCE_STATUSES,
    CERTIFICATE_STATES,
    COHORT_STATUSES,
    MEMBERSHIP_STATUSES,
    RENEWAL_STATES,
    SESSION_STATUSES,
    SUBMISSION_STATES,
    certificateFlow,
    cohortFlow,
    membershipFlow,
    renewalFlow,
    sessionFlow,
    submissionFlow,
} from "../../src/lib/cohorts/lifecycle"
import { CohortProgressService } from "../../src/lib/cohorts/progress"
import { CohortContext, type CohortActor } from "../../src/lib/cohorts/shared"
import { CohortWorkflowService } from "../../src/lib/cohorts/workflow"
import { PersistenceError } from "../../src/lib/persistence/errors"
import { PersistedTenancy, type PlatformIdentity } from "../../src/lib/persistence/tenancy"
import { assertDisposableTarget, parseDatabaseName } from "../lib/disposable-db"

const AUTHORIZED_TARGET = "personalink_phase0_rehearsal_20260826_210704"
const INVERT = process.env.INVERT_ASSERTION === "1"
const RUN = `wd2_${Date.now()}_${Math.floor(Math.random() * 1e6)}`

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

type Outcome =
    | { ok: true }
    | { ok: false; code: string; message: string; details: unknown }

async function attempt(op: () => Promise<unknown>): Promise<Outcome> {
    try {
        await op()
        return { ok: true }
    } catch (e) {
        if (e instanceof PersistenceError) {
            return { ok: false, code: e.code, message: e.message, details: e.details }
        }
        return { ok: false, code: "UNKNOWN", message: e instanceof Error ? e.message : String(e), details: null }
    }
}
function why(o: Outcome): string {
    return o.ok ? "ACCEPTED" : `${o.code}: ${o.message}`.slice(0, 150)
}

const actor: CohortActor = Object.freeze({ actorType: "STAFF", actorId: null })

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
    const ctx = new CohortContext(prisma, new PersistedTenancy(prisma, identity))
    const progress = new CohortProgressService(ctx)
    const cohorts = new CohortService(ctx, progress)
    const flow = new CohortWorkflowService(ctx, progress)

    const live = await prisma.$queryRawUnsafe<{ db: string }[]>("select current_database() as db")
    if (live[0].db !== AUTHORIZED_TARGET) {
        console.error(`ABORT: connected to ${live[0].db}`)
        process.exit(1)
    }

    const ids = {
        userA: `${RUN}_ua`, userB: `${RUN}_ub`,
        profileA: `${RUN}_pa`, profileB: `${RUN}_pb`,
        wsA: `${RUN}_wa`, wsB: `${RUN}_wb`,
        courseA: `${RUN}_ca`, courseB: `${RUN}_cb`,
        modA: `${RUN}_moda`,
        locA: `${RUN}_la`, locB: `${RUN}_lb`,
        docA: `${RUN}_da`, docB: `${RUN}_db`,
    }
    const profileList = `'${ids.profileA}','${ids.profileB}'`
    const base = {
        cohorts: 0, memberships: 0, events: 0, sessions: 0, attendance: 0,
        assignments: 0, submissions: 0, certificates: 0, enrollments: 0,
        completions: 0, tasks: 0,
    }

    try {
        base.cohorts = await prisma.cohort.count()
        base.memberships = await prisma.cohortMembership.count()
        base.events = await prisma.cohortEvent.count()
        base.sessions = await prisma.cohortSession.count()
        base.attendance = await prisma.cohortAttendance.count()
        base.assignments = await prisma.cohortAssignment.count()
        base.submissions = await prisma.cohortSubmission.count()
        base.certificates = await prisma.cohortCertificate.count()
        base.enrollments = await prisma.courseEnrollment.count()
        base.completions = await prisma.lessonCompletion.count()
        base.tasks = await prisma.taskJob.count()

        // ---- 0. every lifecycle table is total and terminal-correct -------
        // Typed loosely on purpose: the six flows have different value unions, and a
        // heterogeneous tuple would collapse to `never` under inference.
        const flows: Array<{ label: string; all: readonly string[]; can: (a: string, b: string) => boolean }> = [
            { label: "cohort", all: COHORT_STATUSES, can: (a, b) => cohortFlow.can(a as never, b as never) },
            { label: "membership", all: MEMBERSHIP_STATUSES, can: (a, b) => membershipFlow.can(a as never, b as never) },
            { label: "session", all: SESSION_STATUSES, can: (a, b) => sessionFlow.can(a as never, b as never) },
            { label: "submission", all: SUBMISSION_STATES, can: (a, b) => submissionFlow.can(a as never, b as never) },
            { label: "certificate", all: CERTIFICATE_STATES, can: (a, b) => certificateFlow.can(a as never, b as never) },
            { label: "renewal", all: RENEWAL_STATES, can: (a, b) => renewalFlow.can(a as never, b as never) },
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
            check(
                `${label} transition table is total over ${all.length}x${all.length} pairs`,
                legal + illegal === all.length ** 2,
                `legal=${legal} illegal=${illegal}`,
            )
        }
        check("terminal cohort statuses allow nothing", cohortFlow.isTerminal("COMPLETED") && cohortFlow.isTerminal("CANCELLED"))
        check("a completed or withdrawn membership is terminal", membershipFlow.isTerminal("COMPLETED") && membershipFlow.isTerminal("WITHDRAWN"))
        check("a revoked certificate is terminal", certificateFlow.isTerminal("REVOKED"))
        check("attendance has exactly 4 statuses", ATTENDANCE_STATUSES.length === 4, `n=${ATTENDANCE_STATUSES.length}`)

        // ---- seed two tenants, each with a real program -------------------
        for (const [u, p, w, c, l, d] of [
            [ids.userA, ids.profileA, ids.wsA, ids.courseA, ids.locA, ids.docA],
            [ids.userB, ids.profileB, ids.wsB, ids.courseB, ids.locB, ids.docB],
        ]) {
            await prisma.user.create({ data: { id: u, clerkId: `clerk_${u}`, email: `${u}@example.test` } })
            await prisma.profile.create({ data: { id: p, userId: u, slug: `slug-${p}`, displayName: `P ${p}` } })
            await prisma.workspace.create({ data: { id: w, profileId: p, name: `WS ${w}`, slug: `ws-${w}` } })
            await prisma.membership.create({ data: { workspaceId: w, userId: u, role: "OWNER" } })
            await prisma.course.create({ data: { id: c, profileId: p, title: `Program ${c}` } })
            await prisma.location.create({ data: { id: l, workspaceId: w, name: `Room ${l}` } })
            await prisma.profileDocument.create({
                data: { id: d, profileId: p, type: "OTHER", title: "Artifact", sourceType: "UPLOAD" },
            })
        }
        await prisma.courseModule.create({ data: { id: ids.modA, courseId: ids.courseA, title: "Module 1" } })
        for (let i = 0; i < 4; i += 1) {
            await prisma.courseLesson.create({ data: { id: `${RUN}_l${i}`, moduleId: ids.modA, title: `Lesson ${i}` } })
        }

        // ---- 1. anonymous is refused and writes nothing -------------------
        identity.current = null
        const beforeCohorts = await prisma.cohort.count()
        const beforeEvents = await prisma.cohortEvent.count()
        const anonCreate = await attempt(() => cohorts.create(ids.wsA, { courseId: ids.courseA, code: "X", title: "X" }, actor))
        const anonList = await attempt(() => cohorts.list(ids.wsA))
        const anonEnrol = await attempt(() => cohorts.enrol(ids.wsA, { courseId: ids.courseA, visitorEmail: "a@b.test" }))
        check("anonymous cohort create refused UNAUTHORIZED", !anonCreate.ok && anonCreate.code === "UNAUTHORIZED", why(anonCreate))
        check("anonymous list refused UNAUTHORIZED", !anonList.ok && anonList.code === "UNAUTHORIZED", why(anonList))
        check("anonymous enrol refused UNAUTHORIZED", !anonEnrol.ok && anonEnrol.code === "UNAUTHORIZED", why(anonEnrol))
        check("anonymous wrote zero cohorts", beforeCohorts === (await prisma.cohort.count()), `before=${beforeCohorts}`)
        check("anonymous appended zero events", beforeEvents === (await prisma.cohortEvent.count()), `before=${beforeEvents}`)

        // ---- 2. valid member creates a cohort on an owned course ---------
        identity.current = `clerk_${ids.userA}`
        const created = await cohorts.create(
            ids.wsA,
            {
                courseId: ids.courseA,
                code: "B1",
                title: "Batch one",
                capacity: 2,
                attendanceThresholdPct: 50,
                requireAllAssignments: true,
                requireAllLessons: true,
                idempotencyKey: `${RUN}-k1`,
            },
            actor,
        )
        const cohortId = created.record.id
        check("cohort created PLANNED", created.record.status === "PLANNED", created.record.status)
        check("cohort exposes server-computed allowedTransitions", created.record.allowedTransitions.slice().sort().join(",") === "CANCELLED,ENROLLING", created.record.allowedTransitions.join(","))
        const replay = await cohorts.create(ids.wsA, { courseId: ids.courseA, code: "OTHER", title: "Other", idempotencyKey: `${RUN}-k1` }, actor)
        check("cohort replay returns the original id and title", replay.replayed && replay.record.id === cohortId && replay.record.title === "Batch one", `replayed=${replay.replayed}`)
        const dupCode = await attempt(() => cohorts.create(ids.wsA, { courseId: ids.courseA, code: "B1", title: "Clash" }, actor))
        check("duplicate cohort code on a program is refused", !dupCode.ok && dupCode.code === "CONFLICT", why(dupCode))

        // A cohort may only be built on a course the caller owns.
        const foreignCourse = await attempt(() => cohorts.create(ids.wsA, { courseId: ids.courseB, code: "B9", title: "Nope" }, actor))
        check("creating a cohort on another tenant's course is refused", !foreignCourse.ok && foreignCourse.code === "FORBIDDEN", why(foreignCourse))

        const badThreshold = await attempt(() => cohorts.create(ids.wsA, { courseId: ids.courseA, code: "B8", title: "T", attendanceThresholdPct: 140 }, actor))
        check("an attendance threshold above 100 is refused", !badThreshold.ok && badThreshold.code === "CONFLICT", why(badThreshold))
        const badWindow = await attempt(() =>
            cohorts.create(ids.wsA, { courseId: ids.courseA, code: "B7", title: "T", startsOn: new Date("2035-02-01T00:00:00Z"), endsOn: new Date("2035-01-01T00:00:00Z") }, actor),
        )
        check("a cohort that ends before it starts is refused", !badWindow.ok && badWindow.code === "CONFLICT", why(badWindow))

        // ---- 3. enrolment reuses the existing CourseEnrollment ----------
        const enrol1 = await cohorts.enrol(ids.wsA, { courseId: ids.courseA, visitorEmail: "one@example.test", idempotencyKey: `${RUN}-e1` })
        const enrolReplay = await cohorts.enrol(ids.wsA, { courseId: ids.courseA, visitorEmail: "changed@example.test", idempotencyKey: `${RUN}-e1` })
        check("enrolment replay returns the original enrolment", enrolReplay.replayed && enrolReplay.enrollmentId === enrol1.enrollmentId, `replayed=${enrolReplay.replayed}`)
        const enrolRow = await prisma.courseEnrollment.findUnique({ where: { id: enrol1.enrollmentId } })
        check("the enrolment is a real CourseEnrollment row on the owned course", enrolRow?.courseId === ids.courseA, `courseId=${enrolRow?.courseId}`)
        check("the replayed enrolment kept its original email", enrolRow?.visitorEmail === "one@example.test", `${enrolRow?.visitorEmail}`)

        const enrol2 = await cohorts.enrol(ids.wsA, { courseId: ids.courseA, visitorEmail: "two@example.test" })
        const enrol3 = await cohorts.enrol(ids.wsA, { courseId: ids.courseA, visitorEmail: "three@example.test" })

        // ---- 4. joining, capacity and idempotency ----------------------
        const join1 = await cohorts.join(ids.wsA, cohortId, { enrollmentId: enrol1.enrollmentId, idempotencyKey: `${RUN}-j1` }, actor)
        const membershipId = join1.membership.id
        check("membership starts INVITED", join1.membership.status === "INVITED", join1.membership.status)
        const joinReplay = await cohorts.join(ids.wsA, cohortId, { enrollmentId: enrol2.enrollmentId, idempotencyKey: `${RUN}-j1` }, actor)
        check("join replay returns the original membership", joinReplay.replayed && joinReplay.membership.id === membershipId, `replayed=${joinReplay.replayed}`)
        const rejoin = await attempt(() => cohorts.join(ids.wsA, cohortId, { enrollmentId: enrol1.enrollmentId }, actor))
        check("the same enrolment cannot join twice", !rejoin.ok && rejoin.code === "CONFLICT", why(rejoin))

        const join2 = await cohorts.join(ids.wsA, cohortId, { enrollmentId: enrol2.enrollmentId }, actor)
        const overCapacity = await attempt(() => cohorts.join(ids.wsA, cohortId, { enrollmentId: enrol3.enrollmentId }, actor))
        check("a full cohort refuses another member", !overCapacity.ok && overCapacity.code === "CONFLICT", why(overCapacity))

        // Withdrawing frees a seat, because capacity counts live members.
        await cohorts.transitionMembership(ids.wsA, cohortId, join2.membership.id, "WITHDRAWN", actor, "changed mind")
        let renewalTarget = ""
        let seatFreed = false
        try {
            const rejoined = await cohorts.join(ids.wsA, cohortId, { enrollmentId: enrol3.enrollmentId }, actor)
            renewalTarget = rejoined.membership.id
            seatFreed = true
        } catch {
            seatFreed = false
        }
        check("withdrawing frees a seat", seatFreed, `membership=${renewalTarget || "none"}`)

        // ---- 5. cohort lifecycle ---------------------------------------
        const skipToCompleted = await attempt(() => cohorts.transition(ids.wsA, cohortId, "COMPLETED", actor))
        check("PLANNED to COMPLETED is refused", !skipToCompleted.ok && skipToCompleted.code === "CONFLICT", why(skipToCompleted))
        await cohorts.transition(ids.wsA, cohortId, "ENROLLING", actor)
        const running = await cohorts.transition(ids.wsA, cohortId, "RUNNING", actor)
        check("ENROLLING to RUNNING is accepted", running.status === "RUNNING", running.status)

        // ---- 6. sessions and attendance --------------------------------
        const session1 = await flow.addSession(
            ids.wsA,
            cohortId,
            { ordinal: 1, title: "Kickoff", startsAt: new Date("2035-03-01T10:00:00Z"), endsAt: new Date("2035-03-01T11:00:00Z"), locationId: ids.locA },
            actor,
        )
        check("session records the reused Location", session1.locationId === ids.locA, `${session1.locationId}`)
        const dupOrdinal = await attempt(() =>
            flow.addSession(ids.wsA, cohortId, { ordinal: 1, title: "Clash", startsAt: new Date("2035-03-02T10:00:00Z"), endsAt: new Date("2035-03-02T11:00:00Z") }, actor),
        )
        check("session ordinal is unique within a cohort", !dupOrdinal.ok && dupOrdinal.code === "CONFLICT", why(dupOrdinal))
        const backwards = await attempt(() =>
            flow.addSession(ids.wsA, cohortId, { ordinal: 2, title: "Bad", startsAt: new Date("2035-03-02T11:00:00Z"), endsAt: new Date("2035-03-02T10:00:00Z") }, actor),
        )
        check("a session that ends before it starts is refused", !backwards.ok && backwards.code === "CONFLICT", why(backwards))
        const foreignLocation = await attempt(() =>
            flow.addSession(ids.wsA, cohortId, { ordinal: 3, title: "Bad venue", startsAt: new Date("2035-03-03T10:00:00Z"), endsAt: new Date("2035-03-03T11:00:00Z"), locationId: ids.locB }, actor),
        )
        check("another tenant's Location cannot be used as a venue", !foreignLocation.ok && foreignLocation.code === "FORBIDDEN", why(foreignLocation))

        const earlyAttendance = await attempt(() =>
            flow.recordAttendance(ids.wsA, cohortId, session1.id, { membershipId, status: "PRESENT" }, actor),
        )
        check("attendance for a SCHEDULED session is refused", !earlyAttendance.ok && earlyAttendance.code === "CONFLICT", why(earlyAttendance))

        await flow.transitionSession(ids.wsA, cohortId, session1.id, "IN_PROGRESS", actor)
        const badStatus = await attempt(() =>
            flow.recordAttendance(ids.wsA, cohortId, session1.id, { membershipId, status: "MAYBE" }, actor),
        )
        check("an unknown attendance status is BAD_REQUEST not CONFLICT", !badStatus.ok && badStatus.code === "BAD_REQUEST", why(badStatus))
        const att = await flow.recordAttendance(ids.wsA, cohortId, session1.id, { membershipId, status: "PRESENT" }, actor)
        check("attendance recorded once the session has started", att.status === "PRESENT", att.status)
        const corrected = await flow.recordAttendance(ids.wsA, cohortId, session1.id, { membershipId, status: "LATE" }, actor)
        check("a correction updates the same attendance row", corrected.id === att.id && corrected.status === "LATE", `${corrected.id === att.id} ${corrected.status}`)
        const attRows = await prisma.cohortAttendance.count({ where: { sessionId: session1.id, membershipId } })
        check("a correction does not create a second attendance row", attRows === 1, `rows=${attRows}`)

        const session2 = await flow.addSession(
            ids.wsA,
            cohortId,
            { ordinal: 4, title: "Second", startsAt: new Date("2035-03-04T10:00:00Z"), endsAt: new Date("2035-03-04T11:00:00Z") },
            actor,
        )
        await flow.transitionSession(ids.wsA, cohortId, session2.id, "CANCELLED", actor, "venue lost")
        const cancelledAttendance = await attempt(() =>
            flow.recordAttendance(ids.wsA, cohortId, session2.id, { membershipId, status: "PRESENT" }, actor),
        )
        check("attendance for a CANCELLED session is refused", !cancelledAttendance.ok && cancelledAttendance.code === "CONFLICT", why(cancelledAttendance))

        // ---- 7. assignments and submissions ---------------------------
        const assignment = await flow.addAssignment(ids.wsA, cohortId, { ordinal: 1, title: "Case study", maxPoints: 50 }, actor)
        const dupAssignment = await attempt(() => flow.addAssignment(ids.wsA, cohortId, { ordinal: 1, title: "Clash" }, actor))
        check("assignment ordinal is unique within a cohort", !dupAssignment.ok && dupAssignment.code === "CONFLICT", why(dupAssignment))

        const sub = await flow.openSubmission(ids.wsA, cohortId, assignment.id, { membershipId, idempotencyKey: `${RUN}-s1` }, actor)
        check("a new submission starts DRAFT", sub.submission.state === "DRAFT", sub.submission.state)
        const subReplay = await flow.openSubmission(ids.wsA, cohortId, assignment.id, { membershipId, idempotencyKey: `${RUN}-s1` }, actor)
        check("submission replay returns the original", subReplay.replayed && subReplay.submission.id === sub.submission.id, `replayed=${subReplay.replayed}`)

        const emptySubmit = await attempt(() =>
            flow.transitionSubmission(ids.wsA, cohortId, assignment.id, sub.submission.id, "SUBMITTED", actor),
        )
        check("submitting with no document and no notes is refused", !emptySubmit.ok && emptySubmit.code === "CONFLICT", why(emptySubmit))
        const foreignDoc = await attempt(() =>
            flow.transitionSubmission(ids.wsA, cohortId, assignment.id, sub.submission.id, "SUBMITTED", actor, { documentId: ids.docB }),
        )
        check("another tenant's ProfileDocument cannot be attached", !foreignDoc.ok && foreignDoc.code === "FORBIDDEN", why(foreignDoc))
        const submitted = await flow.transitionSubmission(ids.wsA, cohortId, assignment.id, sub.submission.id, "SUBMITTED", actor, { documentId: ids.docA })
        check("submitting with a real ProfileDocument is accepted and stamped", submitted.documentId === ids.docA && submitted.submittedAt !== null, `${submitted.documentId}`)
        const skipState = await attempt(() =>
            flow.transitionSubmission(ids.wsA, cohortId, assignment.id, sub.submission.id, "DRAFT", actor),
        )
        check("SUBMITTED cannot go back to DRAFT", !skipState.ok && skipState.code === "CONFLICT", why(skipState))
        const tooManyPoints = await attempt(() =>
            flow.transitionSubmission(ids.wsA, cohortId, assignment.id, sub.submission.id, "ACCEPTED", actor, { points: 500 }),
        )
        check("points above the assignment maximum are BAD_REQUEST", !tooManyPoints.ok && tooManyPoints.code === "BAD_REQUEST", why(tooManyPoints))

        // ---- 8. progress is derived, not stored ------------------------
        for (let i = 0; i < 3; i += 1) {
            await prisma.lessonCompletion.create({
                data: { id: `${RUN}_lc${i}`, enrollmentId: enrol1.enrollmentId, lessonId: `${RUN}_l${i}` },
            })
        }
        const partial = await cohorts.progressFor(ids.wsA, cohortId, membershipId)
        check("lesson progress is 3 of 4 lessons at 75%", partial.lessons.totalLessons === 4 && partial.lessons.completedLessons === 3 && partial.lessons.percent === 75, `${partial.lessons.completedLessons}/${partial.lessons.totalLessons} = ${partial.lessons.percent}%`)
        check("a cancelled session is excluded from attendance", partial.attendance.attendableSessions === 1, `attendable=${partial.attendance.attendableSessions}`)
        check("LATE counts towards the attendance threshold", partial.attendance.percent === 100, `attendance=${partial.attendance.percent}%`)
        check("an unaccepted assignment counts as outstanding", partial.assignments.outstandingAssignments === 1, `outstanding=${partial.assignments.outstandingAssignments}`)
        check("the learner is not yet eligible, with reasons given", !partial.eligible && partial.reasons.length === 2, `reasons=${partial.reasons.join(" | ")}`)

        // ---- 9. completion and certificates are policy-gated ----------
        await cohorts.transitionMembership(ids.wsA, cohortId, membershipId, "ACTIVE", actor)
        const earlyComplete = await attempt(() => cohorts.transitionMembership(ids.wsA, cohortId, membershipId, "COMPLETED", actor))
        check("completing a learner who fails the policy is refused", !earlyComplete.ok && earlyComplete.code === "CONFLICT", why(earlyComplete))
        check("the completion refusal names the unmet requirements", !earlyComplete.ok && /lessons are not complete/.test(earlyComplete.message) && /assignments have no accepted submission/.test(earlyComplete.message), why(earlyComplete))

        const earlyEligible = await attempt(() => flow.transitionCertificate(ids.wsA, cohortId, membershipId, "ELIGIBLE", actor))
        check("marking an unqualified learner ELIGIBLE is refused", !earlyEligible.ok && earlyEligible.code === "CONFLICT", why(earlyEligible))
        const certBefore = await prisma.cohortCertificate.count({ where: { membershipId } })
        check("a refused eligibility claim created no certificate row", certBefore === 0, `rows=${certBefore}`)

        // Satisfy the policy for real, then the same calls succeed.
        await prisma.lessonCompletion.create({
            data: { id: `${RUN}_lc3`, enrollmentId: enrol1.enrollmentId, lessonId: `${RUN}_l3` },
        })
        await flow.transitionSubmission(ids.wsA, cohortId, assignment.id, sub.submission.id, "ACCEPTED", actor, { points: 45, reviewedBy: ids.userA })
        const full = await cohorts.progressFor(ids.wsA, cohortId, membershipId)
        check("the learner is now eligible with no reasons", full.eligible && full.reasons.length === 0, `reasons=${full.reasons.join(" | ")}`)

        const jumpToIssued = await attempt(() => flow.transitionCertificate(ids.wsA, cohortId, membershipId, "ISSUED", actor))
        check("issuing before eligibility is recorded is refused", !jumpToIssued.ok && jumpToIssued.code === "CONFLICT", why(jumpToIssued))
        const eligible = await flow.transitionCertificate(ids.wsA, cohortId, membershipId, "ELIGIBLE", actor)
        check("eligibility is recorded with no serial and no issue date", eligible.state === "ELIGIBLE" && eligible.serial === null && eligible.issuedAt === null, `${eligible.state}/${eligible.serial}`)
        const issued = await flow.transitionCertificate(ids.wsA, cohortId, membershipId, "ISSUED", actor, { documentId: ids.docA })
        check("issuing mints a server-side serial and stamps issuedAt", issued.state === "ISSUED" && !!issued.serial && issued.issuedAt !== null, `${issued.state}/${issued.serial}`)
        check("the serial is derived from the cohort code, not caller input", (issued.serial ?? "").startsWith("B1-"), `${issued.serial}`)
        const completed = await cohorts.transitionMembership(ids.wsA, cohortId, membershipId, "COMPLETED", actor)
        check("completion is accepted once the policy is met and stamps completedAt", completed.status === "COMPLETED" && completed.completedAt !== null, `${completed.status}`)
        const revoked = await flow.transitionCertificate(ids.wsA, cohortId, membershipId, "REVOKED", actor, { reason: "issued in error" })
        check("a certificate can be revoked", revoked.state === "REVOKED" && revoked.revokedAt !== null, revoked.state)
        const afterRevoke = await attempt(() => flow.transitionCertificate(ids.wsA, cohortId, membershipId, "ISSUED", actor))
        check("a revoked certificate is terminal", !afterRevoke.ok && afterRevoke.code === "CONFLICT", why(afterRevoke))

        // ---- 10. renewal reminders compose TaskJob --------------------
        const remindWithoutTask = await attempt(() => flow.transitionRenewal(ids.wsA, cohortId, renewalTarget, "REMINDED", actor))
        check("renewal cannot start at REMINDED", !remindWithoutTask.ok && remindWithoutTask.code === "CONFLICT", why(remindWithoutTask))

        const noTaskSchedule = await flow.scheduleRenewal(ids.wsA, cohortId, renewalTarget, { dueAt: new Date("2035-06-01T00:00:00Z") }, actor)
        check("a renewal can be scheduled without a reminder", noTaskSchedule.renewalState === "SCHEDULED" && noTaskSchedule.renewalTaskJobId === null, `${noTaskSchedule.renewalState}`)
        const remindNoTask = await attempt(() => flow.transitionRenewal(ids.wsA, cohortId, renewalTarget, "REMINDED", actor))
        check("REMINDED is refused while no reminder task exists", !remindNoTask.ok && remindNoTask.code === "CONFLICT", why(remindNoTask))

        const backwardsReminder = await attempt(() =>
            flow.scheduleRenewal(ids.wsA, cohortId, renewalTarget, { dueAt: new Date("2035-06-01T00:00:00Z"), remindAt: new Date("2035-07-01T00:00:00Z") }, actor),
        )
        check("a reminder after the due date is refused", !backwardsReminder.ok && backwardsReminder.code === "CONFLICT", why(backwardsReminder))

        await cohorts.transitionMembership(ids.wsA, cohortId, renewalTarget, "ACTIVE", actor)
        await flow.transitionRenewal(ids.wsA, cohortId, renewalTarget, "RENEWED", actor)
        const withTask = await flow.scheduleRenewal(
            ids.wsA,
            cohortId,
            renewalTarget,
            { dueAt: new Date("2035-06-01T00:00:00Z"), remindAt: new Date("2035-05-25T00:00:00Z"), idempotencyKey: `${RUN}-r1` },
            actor,
        )
        check("scheduling with a reminder links a TaskJob", withTask.renewalTaskJobId !== null, `${withTask.renewalTaskJobId}`)
        const task = await prisma.taskJob.findUnique({ where: { id: withTask.renewalTaskJobId ?? "" } })
        check("the linked reminder is a real QUEUED TaskJob row", task?.state === "QUEUED", `state=${task?.state}`)
        check("the reminder task fires at the requested time, not now", task?.nextAttemptAt.toISOString() === "2035-05-25T00:00:00.000Z", `${task?.nextAttemptAt.toISOString()}`)
        check("the reminder task carries the cohort workflow key", /cohorts\.renewal\.reminder/.test(task?.payload ?? ""), (task?.payload ?? "").slice(0, 60))
        const reminded = await flow.transitionRenewal(ids.wsA, cohortId, renewalTarget, "REMINDED", actor)
        check("REMINDED is accepted once a reminder task exists", reminded.renewalState === "REMINDED", reminded.renewalState)

        const tasksBefore = await prisma.taskJob.count()
        await flow.transitionRenewal(ids.wsA, cohortId, renewalTarget, "RENEWED", actor)
        await flow.scheduleRenewal(
            ids.wsA,
            cohortId,
            renewalTarget,
            { dueAt: new Date("2036-06-01T00:00:00Z"), remindAt: new Date("2036-05-25T00:00:00Z"), idempotencyKey: `${RUN}-r1` },
            actor,
        )
        check("rescheduling with the same key reuses the existing TaskJob", (await prisma.taskJob.count()) === tasksBefore, `before=${tasksBefore} after=${await prisma.taskJob.count()}`)

        // ---- 11. wrong tenant: foreign is indistinguishable from missing
        identity.current = `clerk_${ids.userB}`
        const beforeCross = await prisma.cohortEvent.count()
        const crossFetch = fetchCalls
        const foreignGet = await attempt(() => cohorts.get(ids.wsB, cohortId))
        const missingGet = await attempt(() => cohorts.get(ids.wsB, `${RUN}_absent`))
        check("wrong-tenant get refused FORBIDDEN", !foreignGet.ok && foreignGet.code === "FORBIDDEN", why(foreignGet))
        // This is the single inverted assertion.
        const identical = INVERT
            ? why(foreignGet) !== why(missingGet)
            : !foreignGet.ok && !missingGet.ok && why(foreignGet) === why(missingGet)
        check("a foreign cohort and a missing cohort refuse identically", identical, `${why(foreignGet)} vs ${why(missingGet)}`)
        const foreignMutate = await attempt(() => cohorts.transition(ids.wsB, cohortId, "CANCELLED", actor))
        const missingMutate = await attempt(() => cohorts.transition(ids.wsB, `${RUN}_absent`, "CANCELLED", actor))
        check("a foreign mutation and a missing mutation refuse identically", why(foreignMutate) === why(missingMutate), `${why(foreignMutate)}`)
        const foreignMembership = await attempt(() => cohorts.listMemberships(ids.wsB, cohortId))
        check("wrong-tenant membership list refused", !foreignMembership.ok && foreignMembership.code === "FORBIDDEN", why(foreignMembership))
        const foreignEnrolJoin = await attempt(() => cohorts.join(ids.wsB, cohortId, { enrollmentId: enrol1.enrollmentId }, actor))
        check("wrong-tenant join refused", !foreignEnrolJoin.ok && foreignEnrolJoin.code === "FORBIDDEN", why(foreignEnrolJoin))
        check("cross-tenant refusals appended zero events", beforeCross === (await prisma.cohortEvent.count()), `before=${beforeCross}`)
        check("cross-tenant refusals made zero external calls", fetchCalls === crossFetch, `calls=${fetchCalls - crossFetch}`)
        const listB = await cohorts.list(ids.wsB)
        check("tenant B's list never contains tenant A's cohort", !listB.some((c) => c.id === cohortId), `n=${listB.length}`)

        // A workspace with no linked profile owns no programs.
        identity.current = `clerk_${ids.userA}`
        const orphanWs = `${RUN}_orphan`
        await prisma.workspace.create({ data: { id: orphanWs, name: "Orphan", slug: `ws-${orphanWs}` } })
        await prisma.membership.create({ data: { workspaceId: orphanWs, userId: ids.userA, role: "OWNER" } })
        const orphan = await attempt(() => cohorts.list(orphanWs))
        check("a workspace with no profile is refused, not silently empty", !orphan.ok && orphan.code === "FORBIDDEN", why(orphan))

        // ---- 12. append-only timeline ---------------------------------
        const timeline = await cohorts.timeline(ids.wsA, cohortId)
        const seqs = timeline.map((e) => Number(e.seq))
        check("the cohort timeline recorded every accepted change", timeline.length >= 20, `events=${timeline.length}`)
        check("timeline seq is strictly increasing", seqs.every((v, i) => i === 0 || v > seqs[i - 1]), `n=${seqs.length}`)
        const kinds = new Set<string>(timeline.map((e) => String(e.kind)))
        for (const kind of ["CREATED", "STATUS", "MEMBERSHIP", "SESSION", "ATTENDANCE", "ASSIGNMENT", "SUBMISSION", "CERTIFICATE", "RENEWAL"]) {
            check(`timeline contains a ${kind} event`, kinds.has(kind), [...kinds].join(","))
        }
        let appendOnly = false
        let appendDetail = ""
        try {
            await prisma.$executeRawUnsafe(`update "CohortEvent" set "to"='TAMPERED' where "cohortId"='${cohortId}'`)
        } catch (e) {
            appendOnly = true
            appendDetail = String((e as Error).message).split("\n").find((l) => /append-only/.test(l))?.trim() ?? "refused"
        }
        check("the database refuses to rewrite cohort history", appendOnly, appendDetail || "NO ERROR")

        // ---- 13. a failed transaction leaves no residue ---------------
        {
            const beforeSessions = await prisma.cohortSession.count()
            const beforeEvts = await prisma.cohortEvent.count()
            const rolled = await attempt(async () => {
                await prisma.$transaction(async (tx) => {
                    await tx.cohortSession.create({
                        data: { cohortId, ordinal: 99, title: "Doomed", startsAt: new Date("2035-09-01T10:00:00Z"), endsAt: new Date("2035-09-01T11:00:00Z") },
                    })
                    await tx.cohortEvent.create({ data: { cohortId, kind: "SESSION", to: "SCHEDULED", actor: "STAFF" } })
                    throw new PersistenceError("CONFLICT", "deliberate abort")
                })
            })
            check("a deliberately aborted transaction reports failure", !rolled.ok, why(rolled))
            check("the aborted transaction left no session", beforeSessions === (await prisma.cohortSession.count()), `before=${beforeSessions}`)
            check("the aborted transaction left no event", beforeEvts === (await prisma.cohortEvent.count()), `before=${beforeEvts}`)
        }

        // ---- 14. whole-run external call tally -----------------------
        check("no external call was EVER made in this run", fetchCalls === 0, `calls=${fetchCalls}`)
    } finally {
        try {
            await prisma.$executeRawUnsafe(`alter table "CohortEvent" disable trigger "CohortEvent_append_only"`)
            await prisma.$executeRawUnsafe(
                `delete from "CohortEvent" where "cohortId" in (select "id" from "Cohort" where "profileId" in (${profileList}))`,
            )
        } finally {
            await prisma.$executeRawUnsafe(`alter table "CohortEvent" enable trigger "CohortEvent_append_only"`)
        }
        const cohortScope = `select "id" from "Cohort" where "profileId" in (${profileList})`
        const membershipScope = `select "id" from "CohortMembership" where "cohortId" in (${cohortScope})`
        for (const sql of [
            `delete from "CohortAttendance" where "membershipId" in (${membershipScope})`,
            `delete from "CohortSubmission" where "membershipId" in (${membershipScope})`,
            `delete from "CohortCertificate" where "membershipId" in (${membershipScope})`,
            `delete from "CohortAssignment" where "cohortId" in (${cohortScope})`,
            `delete from "CohortSession" where "cohortId" in (${cohortScope})`,
            `delete from "CohortMembership" where "cohortId" in (${cohortScope})`,
            `delete from "Cohort" where "profileId" in (${profileList})`,
            `delete from "LessonCompletion" where "id" like '${RUN}%'`,
            `delete from "CourseEnrollment" where "courseId" in (select "id" from "Course" where "profileId" in (${profileList}))`,
            `delete from "CourseLesson" where "id" like '${RUN}%'`,
            `delete from "CourseModule" where "id" like '${RUN}%'`,
            `delete from "Course" where "profileId" in (${profileList})`,
            `delete from "TaskJob" where "idempotencyKey" like '%${RUN}%' or "payload" like '%${RUN}%'`,
            `delete from "ProfileDocument" where "profileId" in (${profileList})`,
            `delete from "Location" where "workspaceId" in ('${ids.wsA}','${ids.wsB}')`,
            `delete from "Membership" where "workspaceId" in ('${ids.wsA}','${ids.wsB}','${RUN}_orphan')`,
            `delete from "Workspace" where "id" in ('${ids.wsA}','${ids.wsB}','${RUN}_orphan')`,
            `delete from "Profile" where "id" in (${profileList})`,
            `delete from "User" where "id" in ('${ids.userA}','${ids.userB}')`,
        ]) {
            await prisma.$executeRawUnsafe(sql)
        }

        const armed = await prisma.$queryRawUnsafe<{ n: number }[]>(
            `select count(*)::int n from information_schema.triggers where trigger_schema='public' and trigger_name='CohortEvent_append_only'`,
        )
        check("CohortEvent append-only trigger re-armed", Number(armed[0].n) >= 1, `triggers=${armed[0].n}`)

        for (const [label, expected, actual] of [
            ["Cohort rows", base.cohorts, await prisma.cohort.count()],
            ["CohortMembership rows", base.memberships, await prisma.cohortMembership.count()],
            ["CohortEvent rows", base.events, await prisma.cohortEvent.count()],
            ["CohortSession rows", base.sessions, await prisma.cohortSession.count()],
            ["CohortAttendance rows", base.attendance, await prisma.cohortAttendance.count()],
            ["CohortAssignment rows", base.assignments, await prisma.cohortAssignment.count()],
            ["CohortSubmission rows", base.submissions, await prisma.cohortSubmission.count()],
            ["CohortCertificate rows", base.certificates, await prisma.cohortCertificate.count()],
            ["CourseEnrollment rows", base.enrollments, await prisma.courseEnrollment.count()],
            ["LessonCompletion rows", base.completions, await prisma.lessonCompletion.count()],
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
    console.log("All cohort runtime boundaries hold.")
}

main().catch((e) => {
    console.error(e)
    process.exit(1)
})

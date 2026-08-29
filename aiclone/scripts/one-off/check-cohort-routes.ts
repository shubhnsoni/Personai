/**
 * Wave D / D3 cohort HTTP boundary harness.
 *
 * Invokes the REAL CohortApiService — the same object the route files under
 * src/app/api/platform/cohorts/** and /course-enrollments re-export — with a controlled
 * identity, and asserts status, envelope and body for every principal class.
 *
 * Negative claims are measured, not asserted in prose:
 *   - a refusal writes no row and appends no CohortEvent (counts before/after)
 *   - a refusal reaches no external service (globalThis.fetch is replaced by a counting
 *     blocker for the whole run; any call is both counted and thrown)
 *   - a foreign cohort and a nonexistent cohort produce byte-identical responses
 *
 * Set INVERT_ASSERTION=1 to flip one expectation and prove the harness fails loudly.
 *
 *   ts-node -r tsconfig-paths/register scripts/one-off/check-cohort-routes.ts
 */
import { PrismaClient } from "@prisma/client"

import { CourseAccessService } from "../../src/lib/cohorts/access"
import { CohortService } from "../../src/lib/cohorts/engine"
import { CohortApiService } from "../../src/lib/cohorts/http"
import { CohortProgressService } from "../../src/lib/cohorts/progress"
import { CohortContext } from "../../src/lib/cohorts/shared"
import { CohortWorkflowService } from "../../src/lib/cohorts/workflow"
import { PersistedTenancy, type PlatformIdentity } from "../../src/lib/persistence/tenancy"
import { assertDisposableTarget, parseDatabaseName } from "../lib/disposable-db"

const AUTHORIZED_TARGET = "personalink_phase0_rehearsal_20260826_210704"
const INVERT = process.env.INVERT_ASSERTION === "1"
const RUN = `wd3_${Date.now()}_${Math.floor(Math.random() * 1e6)}`
const COHORTS = "http://127.0.0.1/api/platform/cohorts"
const ENROLLMENTS = "http://127.0.0.1/api/platform/course-enrollments"

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
function pickNumber(v: unknown, ...path: readonly string[]): number {
    const f = pick(v, ...path)
    return typeof f === "number" ? f : Number.NaN
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
    const ctx = new CohortContext(prisma, tenancy)
    const progress = new CohortProgressService(ctx)
    const api = new CohortApiService(
        new CohortService(ctx, progress),
        new CohortWorkflowService(ctx, progress),
        new CourseAccessService(ctx),
        identity,
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
        courseA: `${RUN}_ca`, courseB: `${RUN}_cb`,
        modA: `${RUN}_moda`,
        locA: `${RUN}_la`,
        docA: `${RUN}_da`,
    }
    const profileList = `'${ids.profileA}','${ids.profileB}'`
    const base = { cohorts: 0, memberships: 0, events: 0, enrollments: 0, tasks: 0 }
    let cohortId = ""

    try {
        base.cohorts = await prisma.cohort.count()
        base.memberships = await prisma.cohortMembership.count()
        base.events = await prisma.cohortEvent.count()
        base.enrollments = await prisma.courseEnrollment.count()
        base.tasks = await prisma.taskJob.count()

        // ---- seed: two tenants, plus a provisioned user with no membership ----
        for (const [u, p, w, c] of [
            [ids.userA, ids.profileA, ids.wsA, ids.courseA],
            [ids.userB, ids.profileB, ids.wsB, ids.courseB],
        ]) {
            await prisma.user.create({ data: { id: u, clerkId: `clerk_${u}`, email: `${u}@example.test` } })
            await prisma.profile.create({ data: { id: p, userId: u, slug: `slug-${p}`, displayName: `P ${p}` } })
            await prisma.workspace.create({ data: { id: w, profileId: p, name: `WS ${w}`, slug: `ws-${w}` } })
            await prisma.membership.create({ data: { workspaceId: w, userId: u, role: "OWNER" } })
            await prisma.course.create({ data: { id: c, profileId: p, title: `Program ${c}` } })
        }
        await prisma.location.create({ data: { id: ids.locA, workspaceId: ids.wsA, name: "Room A" } })
        await prisma.profileDocument.create({
            data: { id: ids.docA, profileId: ids.profileA, type: "OTHER", title: "Assignment", sourceType: "UPLOAD" },
        })
        await prisma.courseModule.create({ data: { id: ids.modA, courseId: ids.courseA, title: "Module 1" } })
        for (let i = 0; i < 2; i += 1) {
            await prisma.courseLesson.create({ data: { id: `${RUN}_l${i}`, moduleId: ids.modA, title: `Lesson ${i}` } })
        }
        await prisma.user.create({
            data: { id: ids.userC, clerkId: `clerk_${ids.userC}`, email: `${ids.userC}@example.test` },
        })

        // ---- 1. anonymous: 401 on every endpoint, zero writes -------------
        identity.current = null
        const beforeCohorts = await prisma.cohort.count()
        const beforeEvents = await prisma.cohortEvent.count()
        const anonFetch = fetchCalls
        const q = `workspaceId=${ids.wsA}`
        const anon = {
            list: await call(api.list(get(`${COHORTS}?${q}`))),
            create: await call(api.create(send(COHORTS, { workspaceId: ids.wsA, courseId: ids.courseA, code: "X", title: "X" }))),
            enrol: await call(api.enrol(send(ENROLLMENTS, { workspaceId: ids.wsA, courseId: ids.courseA, visitorEmail: "a@b.test" }))),
            getOne: await call(api.get("whatever", get(`${COHORTS}/whatever?${q}`))),
            patch: await call(api.transition("whatever", send(`${COHORTS}/whatever`, { workspaceId: ids.wsA, status: "ENROLLING" }, "PATCH"))),
            timeline: await call(api.timeline("whatever", get(`${COHORTS}/whatever/timeline?${q}`))),
            members: await call(api.listMemberships("whatever", get(`${COHORTS}/whatever/memberships?${q}`))),
            join: await call(api.join("whatever", send(`${COHORTS}/whatever/memberships`, { workspaceId: ids.wsA, enrollmentId: "e" }))),
            memberPatch: await call(api.transitionMembership("whatever", "m", send(`${COHORTS}/whatever/memberships/m`, { workspaceId: ids.wsA, status: "ACTIVE" }, "PATCH"))),
            progress: await call(api.progress("whatever", "m", get(`${COHORTS}/whatever/memberships/m/progress?${q}`))),
            sessions: await call(api.listSessions("whatever", get(`${COHORTS}/whatever/sessions?${q}`))),
            addSession: await call(api.addSession("whatever", send(`${COHORTS}/whatever/sessions`, { workspaceId: ids.wsA, ordinal: 1, title: "S", startsAt: "2035-01-01T10:00:00Z", endsAt: "2035-01-01T11:00:00Z" }))),
            sessionPatch: await call(api.transitionSession("whatever", "s", send(`${COHORTS}/whatever/sessions/s`, { workspaceId: ids.wsA, status: "IN_PROGRESS" }, "PATCH"))),
            attendanceList: await call(api.listAttendance("whatever", "s", get(`${COHORTS}/whatever/sessions/s/attendance?${q}`))),
            attendancePut: await call(api.recordAttendance("whatever", "s", send(`${COHORTS}/whatever/sessions/s/attendance`, { workspaceId: ids.wsA, membershipId: "m", status: "PRESENT" }, "PUT"))),
            assignments: await call(api.listAssignments("whatever", get(`${COHORTS}/whatever/assignments?${q}`))),
            addAssignment: await call(api.addAssignment("whatever", send(`${COHORTS}/whatever/assignments`, { workspaceId: ids.wsA, ordinal: 1, title: "A" }))),
            submissions: await call(api.listSubmissions("whatever", "a", get(`${COHORTS}/whatever/assignments/a/submissions?${q}`))),
            openSubmission: await call(api.openSubmission("whatever", "a", send(`${COHORTS}/whatever/assignments/a/submissions`, { workspaceId: ids.wsA, membershipId: "m" }))),
            submissionPatch: await call(api.transitionSubmission("whatever", "a", "s", send(`${COHORTS}/whatever/assignments/a/submissions/s`, { workspaceId: ids.wsA, state: "SUBMITTED" }, "PATCH"))),
            certificate: await call(api.getCertificate("whatever", "m", get(`${COHORTS}/whatever/memberships/m/certificate?${q}`))),
            certificatePatch: await call(api.transitionCertificate("whatever", "m", send(`${COHORTS}/whatever/memberships/m/certificate`, { workspaceId: ids.wsA, state: "ELIGIBLE" }, "PATCH"))),
            renewalPut: await call(api.scheduleRenewal("whatever", "m", send(`${COHORTS}/whatever/memberships/m/renewal`, { workspaceId: ids.wsA, dueAt: "2035-06-01T00:00:00Z" }, "PUT"))),
            renewalPatch: await call(api.transitionRenewal("whatever", "m", send(`${COHORTS}/whatever/memberships/m/renewal`, { workspaceId: ids.wsA, state: "REMINDED" }, "PATCH"))),
        }
        const notUnauthorized = Object.entries(anon).filter(([, v]) => v.status !== 401).map(([k, v]) => `${k}=${v.status}`)
        check(
            `anonymous is 401 on all ${Object.keys(anon).length} cohort endpoints`,
            notUnauthorized.length === 0,
            notUnauthorized.join(" ") || "all 401",
        )
        check("anonymous refusal wrote zero cohorts", beforeCohorts === (await prisma.cohort.count()), `before=${beforeCohorts}`)
        check("anonymous refusal appended zero events", beforeEvents === (await prisma.cohortEvent.count()), `before=${beforeEvents}`)
        check("anonymous refusal wrote zero enrolments", base.enrollments === (await prisma.courseEnrollment.count()), `before=${base.enrollments}`)
        check("anonymous refusal made zero external calls", fetchCalls === anonFetch, `calls=${fetchCalls - anonFetch}`)
        check("anonymous body is an error envelope with no data key", pick(anon.list.body, "ok") === false && pick(anon.list.body, "data") === undefined, anon.list.text.slice(0, 90))

        // ---- 2. authenticated but not a member of the workspace: 403 -----
        identity.current = `clerk_${ids.userC}`
        const outsider = await call(api.list(get(`${COHORTS}?${q}`)))
        const outsiderWrite = await call(api.create(send(COHORTS, { workspaceId: ids.wsA, courseId: ids.courseA, code: "Y", title: "Y" })))
        check("authenticated non-member list is 403", outsider.status === 403, `status=${outsider.status}`)
        check("authenticated non-member create is 403", outsiderWrite.status === 403, `status=${outsiderWrite.status}`)
        check("non-member refusal wrote zero cohorts", beforeCohorts === (await prisma.cohort.count()), `before=${beforeCohorts}`)

        // ---- 3. valid member: create a cohort on an owned program -------
        identity.current = `clerk_${ids.userA}`
        const created = await call(api.create(send(COHORTS, {
            workspaceId: ids.wsA,
            courseId: ids.courseA,
            code: "B1",
            title: "Batch one",
            capacity: 1,
            attendanceThresholdPct: 50,
            requireAllAssignments: true,
            requireAllLessons: true,
            idempotencyKey: `${RUN}-k1`,
        })))
        check("cohort create is 201", created.status === 201, `status=${created.status}`)
        cohortId = pickString(created.body, "data", "cohort", "id")
        check("the new cohort is PLANNED", pickString(created.body, "data", "cohort", "status") === "PLANNED", pickString(created.body, "data", "cohort", "status"))
        check(
            "the cohort carries server-computed allowedTransitions so the UI cannot invent one",
            pickArray(created.body, "data", "cohort", "allowedTransitions").slice().sort().join(",") === "CANCELLED,ENROLLING",
            pickArray(created.body, "data", "cohort", "allowedTransitions").join(","),
        )
        const replay = await call(api.create(send(COHORTS, {
            workspaceId: ids.wsA, courseId: ids.courseA, code: "OTHER", title: "Other", idempotencyKey: `${RUN}-k1`,
        })))
        check("idempotent cohort replay is 200 not 201", replay.status === 200, `status=${replay.status}`)
        check("idempotent cohort replay returns the original", pickString(replay.body, "data", "cohort", "id") === cohortId && pick(replay.body, "data", "replayed") === true, pickString(replay.body, "data", "cohort", "title"))

        const foreignCourse = await call(api.create(send(COHORTS, { workspaceId: ids.wsA, courseId: ids.courseB, code: "B9", title: "Nope" })))
        check("a cohort on another tenant's course is 403", foreignCourse.status === 403, `status=${foreignCourse.status}`)
        const badThreshold = await call(api.create(send(COHORTS, { workspaceId: ids.wsA, courseId: ids.courseA, code: "B8", title: "T", attendanceThresholdPct: 140 })))
        check("an attendance threshold above 100 is 409", badThreshold.status === 409, `status=${badThreshold.status}`)
        const nonIntCapacity = await call(api.create(send(COHORTS, { workspaceId: ids.wsA, courseId: ids.courseA, code: "B7", title: "T", capacity: "many" })))
        check("a non-integer capacity is 400", nonIntCapacity.status === 400, `status=${nonIntCapacity.status}`)
        const missingParam = await call(api.list(get(COHORTS)))
        check("a missing workspaceId query parameter is 400", missingParam.status === 400, `status=${missingParam.status}`)
        const badBody = await call(api.create(malformed(COHORTS)))
        check("a malformed JSON body is 400", badBody.status === 400, `status=${badBody.status}`)

        // ---- 4. enrolment writes the pre-existing CourseEnrollment ------
        const enrolled = await call(api.enrol(send(ENROLLMENTS, {
            workspaceId: ids.wsA, courseId: ids.courseA, visitorEmail: "one@example.test", idempotencyKey: `${RUN}-e1`,
        })))
        check("enrolment is 201", enrolled.status === 201, `status=${enrolled.status}`)
        const enrollmentId = pickString(enrolled.body, "data", "enrollmentId")
        const enrolReplay = await call(api.enrol(send(ENROLLMENTS, {
            workspaceId: ids.wsA, courseId: ids.courseA, visitorEmail: "changed@example.test", idempotencyKey: `${RUN}-e1`,
        })))
        check("enrolment replay is 200 and returns the original id", enrolReplay.status === 200 && pickString(enrolReplay.body, "data", "enrollmentId") === enrollmentId, `status=${enrolReplay.status}`)
        const enrolRow = await prisma.courseEnrollment.findUnique({ where: { id: enrollmentId } })
        check("the enrolment is a real CourseEnrollment row", enrolRow?.courseId === ids.courseA && enrolRow?.visitorEmail === "one@example.test", `${enrolRow?.visitorEmail}`)
        const enrolForeign = await call(api.enrol(send(ENROLLMENTS, { workspaceId: ids.wsA, courseId: ids.courseB, visitorEmail: "x@example.test" })))
        check("enrolling onto another tenant's course is 403", enrolForeign.status === 403, `status=${enrolForeign.status}`)

        const second = await call(api.enrol(send(ENROLLMENTS, { workspaceId: ids.wsA, courseId: ids.courseA, visitorEmail: "two@example.test" })))
        const secondEnrollmentId = pickString(second.body, "data", "enrollmentId")

        // ---- 5. memberships, capacity and idempotency -------------------
        const joined = await call(api.join(cohortId, send(`${COHORTS}/${cohortId}/memberships`, {
            workspaceId: ids.wsA, enrollmentId, idempotencyKey: `${RUN}-j1`,
        })))
        check("join is 201", joined.status === 201, `status=${joined.status}`)
        const membershipId = pickString(joined.body, "data", "membership", "id")
        check("the membership starts INVITED", pickString(joined.body, "data", "membership", "status") === "INVITED", pickString(joined.body, "data", "membership", "status"))
        const joinReplay = await call(api.join(cohortId, send(`${COHORTS}/${cohortId}/memberships`, {
            workspaceId: ids.wsA, enrollmentId: secondEnrollmentId, idempotencyKey: `${RUN}-j1`,
        })))
        check("join replay is 200 and returns the original membership", joinReplay.status === 200 && pickString(joinReplay.body, "data", "membership", "id") === membershipId, `status=${joinReplay.status}`)
        const full = await call(api.join(cohortId, send(`${COHORTS}/${cohortId}/memberships`, { workspaceId: ids.wsA, enrollmentId: secondEnrollmentId })))
        check("a full cohort is 409", full.status === 409, `status=${full.status}`)

        const badMembershipStatus = await call(api.transitionMembership(cohortId, membershipId, send(`${COHORTS}/${cohortId}/memberships/${membershipId}`, { workspaceId: ids.wsA, status: "GRADUATED" }, "PATCH")))
        check("an unknown membership status is 400 not 409", badMembershipStatus.status === 400, `status=${badMembershipStatus.status}`)
        const activated = await call(api.transitionMembership(cohortId, membershipId, send(`${COHORTS}/${cohortId}/memberships/${membershipId}`, { workspaceId: ids.wsA, status: "ACTIVE" }, "PATCH")))
        check("INVITED to ACTIVE is 200 and stamps joinedAt", activated.status === 200 && pickString(activated.body, "data", "membership", "joinedAt") !== "", pickString(activated.body, "data", "membership", "joinedAt"))

        // ---- 6. cohort lifecycle ---------------------------------------
        const illegalCohort = await call(api.transition(cohortId, send(`${COHORTS}/${cohortId}`, { workspaceId: ids.wsA, status: "COMPLETED" }, "PATCH")))
        check("PLANNED to COMPLETED is 409", illegalCohort.status === 409, `status=${illegalCohort.status}`)
        const unknownCohort = await call(api.transition(cohortId, send(`${COHORTS}/${cohortId}`, { workspaceId: ids.wsA, status: "MADE_UP" }, "PATCH")))
        check("an unknown cohort status is 400", unknownCohort.status === 400, `status=${unknownCohort.status}`)
        await call(api.transition(cohortId, send(`${COHORTS}/${cohortId}`, { workspaceId: ids.wsA, status: "ENROLLING" }, "PATCH")))
        const running = await call(api.transition(cohortId, send(`${COHORTS}/${cohortId}`, { workspaceId: ids.wsA, status: "RUNNING" }, "PATCH")))
        check("ENROLLING to RUNNING is 200", running.status === 200, `status=${running.status}`)

        // ---- 7. sessions and attendance --------------------------------
        const session = await call(api.addSession(cohortId, send(`${COHORTS}/${cohortId}/sessions`, {
            workspaceId: ids.wsA, ordinal: 1, title: "Kickoff",
            startsAt: "2035-03-01T10:00:00Z", endsAt: "2035-03-01T11:00:00Z", locationId: ids.locA,
        })))
        check("session create is 201 and reuses the Location", session.status === 201 && pickString(session.body, "data", "session", "locationId") === ids.locA, `status=${session.status}`)
        const sessionId = pickString(session.body, "data", "session", "id")
        const badTime = await call(api.addSession(cohortId, send(`${COHORTS}/${cohortId}/sessions`, {
            workspaceId: ids.wsA, ordinal: 2, title: "Bad", startsAt: "not-a-date", endsAt: "2035-03-02T11:00:00Z",
        })))
        check("an unparseable timestamp is 400", badTime.status === 400, `status=${badTime.status}`)
        const backwards = await call(api.addSession(cohortId, send(`${COHORTS}/${cohortId}/sessions`, {
            workspaceId: ids.wsA, ordinal: 2, title: "Bad", startsAt: "2035-03-02T11:00:00Z", endsAt: "2035-03-02T10:00:00Z",
        })))
        check("a session that ends before it starts is 409", backwards.status === 409, `status=${backwards.status}`)

        const earlyAttendance = await call(api.recordAttendance(cohortId, sessionId, send(`${COHORTS}/${cohortId}/sessions/${sessionId}/attendance`, { workspaceId: ids.wsA, membershipId, status: "PRESENT" }, "PUT")))
        check("attendance before the session starts is 409", earlyAttendance.status === 409, `status=${earlyAttendance.status}`)
        await call(api.transitionSession(cohortId, sessionId, send(`${COHORTS}/${cohortId}/sessions/${sessionId}`, { workspaceId: ids.wsA, status: "IN_PROGRESS" }, "PATCH")))
        const badMark = await call(api.recordAttendance(cohortId, sessionId, send(`${COHORTS}/${cohortId}/sessions/${sessionId}/attendance`, { workspaceId: ids.wsA, membershipId, status: "MAYBE" }, "PUT")))
        check("an unknown attendance status is 400", badMark.status === 400, `status=${badMark.status}`)
        const marked = await call(api.recordAttendance(cohortId, sessionId, send(`${COHORTS}/${cohortId}/sessions/${sessionId}/attendance`, { workspaceId: ids.wsA, membershipId, status: "PRESENT" }, "PUT")))
        check("attendance is 200 once the session has started", marked.status === 200, `status=${marked.status}`)
        const attendanceList = await call(api.listAttendance(cohortId, sessionId, get(`${COHORTS}/${cohortId}/sessions/${sessionId}/attendance?${q}`)))
        check("attendance list returns exactly one row for one learner", pickArray(attendanceList.body, "data", "attendance").length === 1, `n=${pickArray(attendanceList.body, "data", "attendance").length}`)

        // ---- 8. assignments and submissions ---------------------------
        const assignment = await call(api.addAssignment(cohortId, send(`${COHORTS}/${cohortId}/assignments`, { workspaceId: ids.wsA, ordinal: 1, title: "Case study", maxPoints: 50 })))
        check("assignment create is 201", assignment.status === 201, `status=${assignment.status}`)
        const assignmentId = pickString(assignment.body, "data", "assignment", "id")
        const dupAssignment = await call(api.addAssignment(cohortId, send(`${COHORTS}/${cohortId}/assignments`, { workspaceId: ids.wsA, ordinal: 1, title: "Clash" })))
        check("a duplicate assignment ordinal is 409", dupAssignment.status === 409, `status=${dupAssignment.status}`)

        const submission = await call(api.openSubmission(cohortId, assignmentId, send(`${COHORTS}/${cohortId}/assignments/${assignmentId}/submissions`, { workspaceId: ids.wsA, membershipId, idempotencyKey: `${RUN}-s1` })))
        check("submission open is 201 at DRAFT", submission.status === 201 && pickString(submission.body, "data", "submission", "state") === "DRAFT", `status=${submission.status}`)
        const submissionId = pickString(submission.body, "data", "submission", "id")
        const submissionReplay = await call(api.openSubmission(cohortId, assignmentId, send(`${COHORTS}/${cohortId}/assignments/${assignmentId}/submissions`, { workspaceId: ids.wsA, membershipId, idempotencyKey: `${RUN}-s1` })))
        check("submission replay is 200 and returns the original", submissionReplay.status === 200 && pickString(submissionReplay.body, "data", "submission", "id") === submissionId, `status=${submissionReplay.status}`)

        const emptySubmit = await call(api.transitionSubmission(cohortId, assignmentId, submissionId, send(`${COHORTS}/${cohortId}/assignments/${assignmentId}/submissions/${submissionId}`, { workspaceId: ids.wsA, state: "SUBMITTED" }, "PATCH")))
        check("submitting nothing is 409", emptySubmit.status === 409, `status=${emptySubmit.status}`)
        const badState = await call(api.transitionSubmission(cohortId, assignmentId, submissionId, send(`${COHORTS}/${cohortId}/assignments/${assignmentId}/submissions/${submissionId}`, { workspaceId: ids.wsA, state: "GRADED" }, "PATCH")))
        check("an unknown submission state is 400", badState.status === 400, `status=${badState.status}`)
        const submitted = await call(api.transitionSubmission(cohortId, assignmentId, submissionId, send(`${COHORTS}/${cohortId}/assignments/${assignmentId}/submissions/${submissionId}`, { workspaceId: ids.wsA, state: "SUBMITTED", documentId: ids.docA }, "PATCH")))
        check("submitting a real ProfileDocument is 200 and links it", submitted.status === 200 && pickString(submitted.body, "data", "submission", "documentId") === ids.docA, `status=${submitted.status}`)
        const overPoints = await call(api.transitionSubmission(cohortId, assignmentId, submissionId, send(`${COHORTS}/${cohortId}/assignments/${assignmentId}/submissions/${submissionId}`, { workspaceId: ids.wsA, state: "ACCEPTED", points: 500 }, "PATCH")))
        check("points above the assignment maximum are 400", overPoints.status === 400, `status=${overPoints.status}`)

        // ---- 9. progress and the policy gate --------------------------
        const partial = await call(api.progress(cohortId, membershipId, get(`${COHORTS}/${cohortId}/memberships/${membershipId}/progress?${q}`)))
        check("progress is 200", partial.status === 200, `status=${partial.status}`)
        check("progress reports 0 of 2 lessons", pickNumber(partial.body, "data", "progress", "lessons", "totalLessons") === 2 && pickNumber(partial.body, "data", "progress", "lessons", "completedLessons") === 0, `${pickNumber(partial.body, "data", "progress", "lessons", "completedLessons")}/${pickNumber(partial.body, "data", "progress", "lessons", "totalLessons")}`)
        check("progress reports the learner as not eligible with reasons", pick(partial.body, "data", "progress", "eligible") === false && pickArray(partial.body, "data", "progress", "reasons").length === 2, `reasons=${pickArray(partial.body, "data", "progress", "reasons").length}`)

        const earlyComplete = await call(api.transitionMembership(cohortId, membershipId, send(`${COHORTS}/${cohortId}/memberships/${membershipId}`, { workspaceId: ids.wsA, status: "COMPLETED" }, "PATCH")))
        check("completing a learner who fails the policy is 409", earlyComplete.status === 409, `status=${earlyComplete.status}`)
        check("the 409 body names the unmet requirements", /lessons are not complete/.test(earlyComplete.text), earlyComplete.text.slice(0, 120))
        const earlyEligible = await call(api.transitionCertificate(cohortId, membershipId, send(`${COHORTS}/${cohortId}/memberships/${membershipId}/certificate`, { workspaceId: ids.wsA, state: "ELIGIBLE" }, "PATCH")))
        check("claiming eligibility for an unqualified learner is 409", earlyEligible.status === 409, `status=${earlyEligible.status}`)
        const noCert = await call(api.getCertificate(cohortId, membershipId, get(`${COHORTS}/${cohortId}/memberships/${membershipId}/certificate?${q}`)))
        check("no certificate row was created by the refused claim", pick(noCert.body, "data", "certificate") === null, noCert.text.slice(0, 80))

        // Satisfy the policy, then the same calls succeed.
        for (let i = 0; i < 2; i += 1) {
            await prisma.lessonCompletion.create({
                data: { id: `${RUN}_lc${i}`, enrollmentId, lessonId: `${RUN}_l${i}` },
            })
        }
        await call(api.transitionSubmission(cohortId, assignmentId, submissionId, send(`${COHORTS}/${cohortId}/assignments/${assignmentId}/submissions/${submissionId}`, { workspaceId: ids.wsA, state: "ACCEPTED", points: 45, reviewedBy: ids.userA }, "PATCH")))
        const eligible = await call(api.transitionCertificate(cohortId, membershipId, send(`${COHORTS}/${cohortId}/memberships/${membershipId}/certificate`, { workspaceId: ids.wsA, state: "ELIGIBLE" }, "PATCH")))
        check("eligibility is 200 once the policy is met", eligible.status === 200, `status=${eligible.status}`)
        check("an eligible certificate carries no serial and no issue date", pick(eligible.body, "data", "certificate", "serial") === null && pick(eligible.body, "data", "certificate", "issuedAt") === null, eligible.text.slice(0, 120))
        const issued = await call(api.transitionCertificate(cohortId, membershipId, send(`${COHORTS}/${cohortId}/memberships/${membershipId}/certificate`, { workspaceId: ids.wsA, state: "ISSUED" }, "PATCH")))
        check("issuing is 200 and mints a server-side serial", issued.status === 200 && pickString(issued.body, "data", "certificate", "serial").startsWith("B1-"), pickString(issued.body, "data", "certificate", "serial"))
        const completed = await call(api.transitionMembership(cohortId, membershipId, send(`${COHORTS}/${cohortId}/memberships/${membershipId}`, { workspaceId: ids.wsA, status: "COMPLETED" }, "PATCH")))
        check("completion is 200 once the policy is met", completed.status === 200, `status=${completed.status}`)

        // ---- 10. renewal reminders compose TaskJob -------------------
        const remindTooEarly = await call(api.transitionRenewal(cohortId, membershipId, send(`${COHORTS}/${cohortId}/memberships/${membershipId}/renewal`, { workspaceId: ids.wsA, state: "REMINDED" }, "PATCH")))
        check("REMINDED from NONE is 409", remindTooEarly.status === 409, `status=${remindTooEarly.status}`)
        const badRenewalState = await call(api.transitionRenewal(cohortId, membershipId, send(`${COHORTS}/${cohortId}/memberships/${membershipId}/renewal`, { workspaceId: ids.wsA, state: "NOTIFIED" }, "PATCH")))
        check("an unknown renewal state is 400", badRenewalState.status === 400, `status=${badRenewalState.status}`)
        const scheduled = await call(api.scheduleRenewal(cohortId, membershipId, send(`${COHORTS}/${cohortId}/memberships/${membershipId}/renewal`, {
            workspaceId: ids.wsA, dueAt: "2035-06-01T00:00:00Z", remindAt: "2035-05-25T00:00:00Z", idempotencyKey: `${RUN}-r1`,
        }, "PUT")))
        check("scheduling a renewal is 200 and links a TaskJob", scheduled.status === 200 && pickString(scheduled.body, "data", "membership", "renewalTaskJobId") !== "", `status=${scheduled.status}`)
        const taskId = pickString(scheduled.body, "data", "membership", "renewalTaskJobId")
        const task = await prisma.taskJob.findUnique({ where: { id: taskId } })
        check("the reminder is a real QUEUED TaskJob due at the requested time", task?.state === "QUEUED" && task?.nextAttemptAt.toISOString() === "2035-05-25T00:00:00.000Z", `${task?.state} ${task?.nextAttemptAt.toISOString()}`)
        const reminded = await call(api.transitionRenewal(cohortId, membershipId, send(`${COHORTS}/${cohortId}/memberships/${membershipId}/renewal`, { workspaceId: ids.wsA, state: "REMINDED" }, "PATCH")))
        check("REMINDED is 200 once a reminder task exists", reminded.status === 200, `status=${reminded.status}`)
        const backwardsReminder = await call(api.scheduleRenewal(cohortId, membershipId, send(`${COHORTS}/${cohortId}/memberships/${membershipId}/renewal`, { workspaceId: ids.wsA, dueAt: "2035-06-01T00:00:00Z", remindAt: "2035-07-01T00:00:00Z" }, "PUT")))
        check("a reminder scheduled after the due date is 409", backwardsReminder.status === 409, `status=${backwardsReminder.status}`)

        // ---- 11. timeline ---------------------------------------------
        const timeline = await call(api.timeline(cohortId, get(`${COHORTS}/${cohortId}/timeline?${q}`)))
        const events = pickArray(timeline.body, "data", "events")
        const seqs = events.map((e) => Number(pickString(e, "seq")))
        check("timeline returns the cohort's events", events.length >= 12, `n=${events.length}`)
        check("timeline sequence is strictly increasing", seqs.every((v, i) => i === 0 || v > seqs[i - 1]), `n=${seqs.length}`)
        check("timeline seq serialises as a string not a BigInt", events.every((e) => typeof pick(e, "seq") === "string"), typeof pick(events[0], "seq"))

        // ---- 12. wrong tenant is indistinguishable from nonexistent ---
        identity.current = `clerk_${ids.userB}`
        const beforeForeign = await prisma.cohortEvent.count()
        const foreignFetch = fetchCalls
        const qb = `workspaceId=${ids.wsB}`
        const foreign = await call(api.get(cohortId, get(`${COHORTS}/${cohortId}?${qb}`)))
        const absent = await call(api.get(`${RUN}_absent`, get(`${COHORTS}/${RUN}_absent?${qb}`)))
        check("wrong-tenant get is 403", foreign.status === 403, `status=${foreign.status}`)
        // This is the single inverted assertion.
        const identical = INVERT
            ? foreign.text !== absent.text
            : foreign.status === absent.status && foreign.text === absent.text
        check("a foreign cohort and a nonexistent cohort are byte-identical", identical, `${foreign.status}:${foreign.text} vs ${absent.status}:${absent.text}`)
        const foreignPatch = await call(api.transition(cohortId, send(`${COHORTS}/${cohortId}`, { workspaceId: ids.wsB, status: "CANCELLED" }, "PATCH")))
        const absentPatch = await call(api.transition(`${RUN}_absent`, send(`${COHORTS}/${RUN}_absent`, { workspaceId: ids.wsB, status: "CANCELLED" }, "PATCH")))
        check("a foreign mutation and a nonexistent mutation are byte-identical", foreignPatch.status === absentPatch.status && foreignPatch.text === absentPatch.text, `${foreignPatch.status}/${absentPatch.status}`)
        const foreignMembers = await call(api.listMemberships(cohortId, get(`${COHORTS}/${cohortId}/memberships?${qb}`)))
        check("wrong-tenant membership list is 403", foreignMembers.status === 403, `status=${foreignMembers.status}`)
        const foreignProgress = await call(api.progress(cohortId, membershipId, get(`${COHORTS}/${cohortId}/memberships/${membershipId}/progress?${qb}`)))
        check("wrong-tenant progress is 403 and leaks no figures", foreignProgress.status === 403 && !/totalLessons/.test(foreignProgress.text), foreignProgress.text.slice(0, 80))
        check("cross-tenant refusal appended zero events", beforeForeign === (await prisma.cohortEvent.count()), `before=${beforeForeign}`)
        check("cross-tenant refusal made zero external calls", fetchCalls === foreignFetch, `calls=${fetchCalls - foreignFetch}`)
        const listB = await call(api.list(get(`${COHORTS}?${qb}`)))
        check("tenant B's list never contains tenant A's cohort", !pickArray(listB.body, "data", "cohorts").some((c) => pickString(c, "id") === cohortId), `n=${pickArray(listB.body, "data", "cohorts").length}`)

        // ---- 13. dependency failure is 503 with no leak --------------
        identity.current = `clerk_${ids.userA}`
        const brokenPrisma = {
            workspace: { findUnique: async () => ({ profileId: ids.profileA }) },
            cohort: {
                findMany: async () => {
                    throw new Error("SECRET_DETAIL postgres://u:p@h/d")
                },
            },
        } as unknown as PrismaClient
        const brokenCtx = new CohortContext(brokenPrisma, tenancy)
        const brokenProgress = new CohortProgressService(brokenCtx)
        const brokenApi = new CohortApiService(
            new CohortService(brokenCtx, brokenProgress),
            new CohortWorkflowService(brokenCtx, brokenProgress),
            new CourseAccessService(brokenCtx),
            identity,
        )
        const broken = await call(brokenApi.list(get(`${COHORTS}?${q}`)))
        check("dependency failure is 503", broken.status === 503, `status=${broken.status}`)
        check("dependency failure leaks no internal detail", !/SECRET_DETAIL/.test(broken.text) && !/postgres:\/\//.test(broken.text), broken.text.slice(0, 120))

        // ---- 14. envelope agrees with the platform contract ---------
        const listA = await call(api.list(get(`${COHORTS}?${q}`)))
        check("success envelope keys are exactly ok,data", keys(listA.body) === "data,ok", keys(listA.body))
        check("error envelope keys are exactly error,ok", keys(anon.list.body) === "error,ok", keys(anon.list.body))
        check(
            "every error envelope carries a code and a message",
            [anon.list, outsider, foreign, illegalCohort, unknownCohort, broken].every(
                (r) => pickString(r.body, "error", "code") !== "" && pickString(r.body, "error", "message") !== "",
            ),
            "codes present",
        )

        // ---- 15. whole-run external call tally ---------------------
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
            `delete from "Membership" where "workspaceId" in ('${ids.wsA}','${ids.wsB}')`,
            `delete from "Workspace" where "id" in ('${ids.wsA}','${ids.wsB}')`,
            `delete from "Profile" where "id" in (${profileList})`,
            `delete from "User" where "id" in ('${ids.userA}','${ids.userB}','${ids.userC}')`,
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
            ["CourseEnrollment rows", base.enrollments, await prisma.courseEnrollment.count()],
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
    console.log("All cohort route boundaries hold.")
}

main().catch((e) => {
    console.error(e)
    process.exit(1)
})

import { PersistenceError } from "@/lib/persistence/errors"
import type { PlatformIdentity } from "@/lib/persistence/tenancy"

import type { CourseAccessService } from "./access"
import type { CohortService } from "./engine"
import {
    ACCESS_GRANT_SOURCES,
    accessGrantFlow,
    certificateFlow,
    cohortFlow,
    membershipFlow,
    renewalFlow,
    sessionFlow,
    submissionFlow,
    type AccessGrantSourceValue,
} from "./lifecycle"
import type { CohortActor } from "./shared"
import type { CohortWorkflowService } from "./workflow"

/**
 * HTTP boundary for the cohort surface.
 *
 * The envelope mirrors PlatformService — { ok: true, data } / { ok: false, error: { code,
 * message } } with the same status map. It is restated rather than imported because that
 * file belongs to the P2-002 package; the route harness asserts both agree so drift is
 * caught by a test.
 *
 * Enum inputs are validated against the owning lifecycle flow BEFORE the engine sees
 * them, so "that is not a status" stays a 400 and "that is not a legal move from here"
 * stays a 409. Collapsing the two would leave an owner unable to tell a typo from a
 * workflow error.
 *
 * The actor is always derived server-side; no parameter lets a caller name itself.
 */

type JsonObject = Record<string, unknown>

function json(data: unknown, status = 200): Response {
    return Response.json(data, { status })
}
function success(data: unknown, status = 200): Response {
    return json({ ok: true, data }, status)
}
function failure(error: unknown): Response {
    if (error instanceof PersistenceError) {
        return json(
            {
                ok: false,
                error: {
                    code: error.code,
                    message: error.message,
                    ...(error.details ? { details: error.details } : {}),
                },
            },
            error.status,
        )
    }
    return json(
        { ok: false, error: { code: "DEPENDENCY_UNAVAILABLE", message: "Cohort persistence is temporarily unavailable" } },
        503,
    )
}

async function body(request: Request): Promise<JsonObject> {
    let value: unknown
    try {
        value = await request.json()
    } catch {
        throw new PersistenceError("BAD_REQUEST", "Request body must contain valid JSON")
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new PersistenceError("BAD_REQUEST", "A JSON object body is required")
    }
    return value as JsonObject
}

function str(value: unknown, field: string): string {
    if (typeof value !== "string" || !value.trim()) {
        throw new PersistenceError("BAD_REQUEST", `${field} is required`, { field })
    }
    return value.trim()
}
function nullableStr(value: unknown, field: string): string | null {
    if (value === null || value === undefined || value === "") return null
    if (typeof value !== "string") throw new PersistenceError("BAD_REQUEST", `${field} must be a string or null`, { field })
    return value.trim() || null
}
function int(value: unknown, field: string): number {
    if (!Number.isInteger(value)) throw new PersistenceError("BAD_REQUEST", `${field} must be an integer`, { field })
    return value as number
}
function optInt(value: unknown, field: string): number | null {
    if (value === null || value === undefined || value === "") return null
    return int(value, field)
}
function date(value: unknown, field: string): Date {
    if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
        throw new PersistenceError("BAD_REQUEST", `${field} must be an ISO-compatible timestamp`, { field })
    }
    return new Date(value)
}
function optDate(value: unknown, field: string): Date | null {
    if (value === null || value === undefined || value === "") return null
    return date(value, field)
}

/** Validates a status against the owning flow, so an unknown value is 400 not 409. */
function status<T extends string>(
    value: unknown,
    guard: (v: unknown) => v is T,
    label: string,
    field = "status",
): T {
    const raw = str(value, field)
    if (!guard(raw)) {
        throw new PersistenceError("BAD_REQUEST", `${field} is not a recognised ${label} value`, { field })
    }
    return raw
}

function isGrantSource(value: unknown): value is AccessGrantSourceValue {
    return typeof value === "string" && (ACCESS_GRANT_SOURCES as readonly string[]).includes(value)
}

/**
 * A decision is not a lifecycle state the caller may name freely: only APPROVED and REJECTED are
 * decisions. APPLIED and CANCELLED are reached through their own endpoints, so accepting them here
 * would let a caller skip the apply step that moves the entitlement.
 */
function isChangeDecision(value: unknown): value is "APPROVED" | "REJECTED" {
    return value === "APPROVED" || value === "REJECTED"
}

function serialise(value: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) {
        out[k] = v instanceof Date ? v.toISOString() : typeof v === "bigint" ? String(v) : v
    }
    return out
}
function serialiseAll(rows: readonly unknown[]): Array<Record<string, unknown>> {
    return rows.map((r) => serialise({ ...(r as Record<string, unknown>) }))
}
function param(request: Request, name: string): string {
    return str(new URL(request.url).searchParams.get(name), name)
}
function optParam(request: Request, name: string): string | null {
    const v = new URL(request.url).searchParams.get(name)
    return v && v.trim() ? v.trim() : null
}

export class CohortApiService {
    constructor(
        private readonly cohorts: CohortService,
        private readonly flow: CohortWorkflowService,
        private readonly access: CourseAccessService,
        private readonly identity: PlatformIdentity,
    ) {}

    private run(op: () => Promise<Response>): Promise<Response> {
        return op().catch(failure)
    }
    private actor(): CohortActor {
        return { actorType: "STAFF", actorId: null }
    }

    /**
     * Who decided an access change, resolved from the server session and never from the body.
     * A caller-supplied `decidedBy` would let an owner attribute their own decision to somebody
     * else, which is exactly the kind of field an audit trail must not accept from outside.
     */
    private async decidedBy(): Promise<string> {
        const userId = await this.identity.userId()
        if (!userId) {
            throw new PersistenceError("UNAUTHORIZED", "Authentication is required")
        }
        return userId
    }

    // ---- cohorts -------------------------------------------------------

    list(request: Request): Promise<Response> {
        return this.run(async () =>
            success({
                cohorts: serialiseAll(
                    await this.cohorts.list(param(request, "workspaceId"), optParam(request, "courseId")),
                ),
            }),
        )
    }

    create(request: Request): Promise<Response> {
        return this.run(async () => {
            const input = await body(request)
            const result = await this.cohorts.create(
                str(input.workspaceId, "workspaceId"),
                {
                    courseId: str(input.courseId, "courseId"),
                    code: str(input.code, "code"),
                    title: str(input.title, "title"),
                    timezone: nullableStr(input.timezone, "timezone"),
                    startsOn: optDate(input.startsOn, "startsOn"),
                    endsOn: optDate(input.endsOn, "endsOn"),
                    capacity: optInt(input.capacity, "capacity"),
                    attendanceThresholdPct: optInt(input.attendanceThresholdPct, "attendanceThresholdPct"),
                    requireAllAssignments: input.requireAllAssignments === true,
                    requireAllLessons: input.requireAllLessons === true,
                    idempotencyKey: nullableStr(input.idempotencyKey, "idempotencyKey"),
                },
                this.actor(),
            )
            return success(
                { cohort: serialise({ ...result.record }), replayed: result.replayed },
                result.replayed ? 200 : 201,
            )
        })
    }

    get(cohortId: string, request: Request): Promise<Response> {
        return this.run(async () =>
            success({ cohort: serialise({ ...(await this.cohorts.get(param(request, "workspaceId"), cohortId)) }) }),
        )
    }

    transition(cohortId: string, request: Request): Promise<Response> {
        return this.run(async () => {
            const input = await body(request)
            const record = await this.cohorts.transition(
                str(input.workspaceId, "workspaceId"),
                cohortId,
                status(input.status, cohortFlow.is, "cohort"),
                this.actor(),
                nullableStr(input.reason, "reason"),
            )
            return success({ cohort: serialise({ ...record }) })
        })
    }

    timeline(cohortId: string, request: Request): Promise<Response> {
        return this.run(async () =>
            success({ events: serialiseAll(await this.cohorts.timeline(param(request, "workspaceId"), cohortId)) }),
        )
    }

    // ---- enrolment (the pre-existing CourseEnrollment) -----------------

    enrol(request: Request): Promise<Response> {
        return this.run(async () => {
            const input = await body(request)
            const result = await this.cohorts.enrol(str(input.workspaceId, "workspaceId"), {
                courseId: str(input.courseId, "courseId"),
                visitorEmail: str(input.visitorEmail, "visitorEmail"),
                visitorName: nullableStr(input.visitorName, "visitorName"),
                memberId: nullableStr(input.memberId, "memberId"),
                idempotencyKey: nullableStr(input.idempotencyKey, "idempotencyKey"),
            })
            return success(
                { enrollmentId: result.enrollmentId, replayed: result.replayed },
                result.replayed ? 200 : 201,
            )
        })
    }

    // ---- memberships ---------------------------------------------------

    listMemberships(cohortId: string, request: Request): Promise<Response> {
        return this.run(async () =>
            success({
                memberships: serialiseAll(
                    await this.cohorts.listMemberships(param(request, "workspaceId"), cohortId),
                ),
            }),
        )
    }

    join(cohortId: string, request: Request): Promise<Response> {
        return this.run(async () => {
            const input = await body(request)
            const result = await this.cohorts.join(
                str(input.workspaceId, "workspaceId"),
                cohortId,
                {
                    enrollmentId: str(input.enrollmentId, "enrollmentId"),
                    idempotencyKey: nullableStr(input.idempotencyKey, "idempotencyKey"),
                },
                this.actor(),
            )
            return success(
                { membership: serialise({ ...result.membership }), replayed: result.replayed },
                result.replayed ? 200 : 201,
            )
        })
    }

    transitionMembership(cohortId: string, membershipId: string, request: Request): Promise<Response> {
        return this.run(async () => {
            const input = await body(request)
            const row = await this.cohorts.transitionMembership(
                str(input.workspaceId, "workspaceId"),
                cohortId,
                membershipId,
                status(input.status, membershipFlow.is, "membership"),
                this.actor(),
                nullableStr(input.reason, "reason"),
            )
            return success({ membership: serialise({ ...row }) })
        })
    }

    progress(cohortId: string, membershipId: string, request: Request): Promise<Response> {
        return this.run(async () => {
            const report = await this.cohorts.progressFor(param(request, "workspaceId"), cohortId, membershipId)
            return success({ progress: report })
        })
    }

    // ---- sessions and attendance --------------------------------------

    listSessions(cohortId: string, request: Request): Promise<Response> {
        return this.run(async () =>
            success({ sessions: serialiseAll(await this.flow.listSessions(param(request, "workspaceId"), cohortId)) }),
        )
    }

    addSession(cohortId: string, request: Request): Promise<Response> {
        return this.run(async () => {
            const input = await body(request)
            const row = await this.flow.addSession(
                str(input.workspaceId, "workspaceId"),
                cohortId,
                {
                    ordinal: int(input.ordinal, "ordinal"),
                    title: str(input.title, "title"),
                    startsAt: date(input.startsAt, "startsAt"),
                    endsAt: date(input.endsAt, "endsAt"),
                    locationId: nullableStr(input.locationId, "locationId"),
                },
                this.actor(),
            )
            return success({ session: serialise({ ...row }) }, 201)
        })
    }

    transitionSession(cohortId: string, sessionId: string, request: Request): Promise<Response> {
        return this.run(async () => {
            const input = await body(request)
            const row = await this.flow.transitionSession(
                str(input.workspaceId, "workspaceId"),
                cohortId,
                sessionId,
                status(input.status, sessionFlow.is, "session"),
                this.actor(),
                nullableStr(input.reason, "reason"),
            )
            return success({ session: serialise({ ...row }) })
        })
    }

    listAttendance(cohortId: string, sessionId: string, request: Request): Promise<Response> {
        return this.run(async () =>
            success({
                attendance: serialiseAll(
                    await this.flow.listAttendance(param(request, "workspaceId"), cohortId, sessionId),
                ),
            }),
        )
    }

    recordAttendance(cohortId: string, sessionId: string, request: Request): Promise<Response> {
        return this.run(async () => {
            const input = await body(request)
            const row = await this.flow.recordAttendance(
                str(input.workspaceId, "workspaceId"),
                cohortId,
                sessionId,
                {
                    membershipId: str(input.membershipId, "membershipId"),
                    // Validated inside the engine, which owns the attendance vocabulary.
                    status: input.status,
                    note: nullableStr(input.note, "note"),
                },
                this.actor(),
            )
            return success({ attendance: serialise({ ...row }) })
        })
    }

    // ---- assignments and submissions ----------------------------------

    listAssignments(cohortId: string, request: Request): Promise<Response> {
        return this.run(async () =>
            success({
                assignments: serialiseAll(await this.flow.listAssignments(param(request, "workspaceId"), cohortId)),
            }),
        )
    }

    addAssignment(cohortId: string, request: Request): Promise<Response> {
        return this.run(async () => {
            const input = await body(request)
            const row = await this.flow.addAssignment(
                str(input.workspaceId, "workspaceId"),
                cohortId,
                {
                    ordinal: int(input.ordinal, "ordinal"),
                    title: str(input.title, "title"),
                    instructions: nullableStr(input.instructions, "instructions"),
                    dueAt: optDate(input.dueAt, "dueAt"),
                    maxPoints: optInt(input.maxPoints, "maxPoints"),
                },
                this.actor(),
            )
            return success({ assignment: serialise({ ...row }) }, 201)
        })
    }

    listSubmissions(cohortId: string, assignmentId: string, request: Request): Promise<Response> {
        return this.run(async () =>
            success({
                submissions: serialiseAll(
                    await this.flow.listSubmissions(param(request, "workspaceId"), cohortId, assignmentId),
                ),
            }),
        )
    }

    openSubmission(cohortId: string, assignmentId: string, request: Request): Promise<Response> {
        return this.run(async () => {
            const input = await body(request)
            const result = await this.flow.openSubmission(
                str(input.workspaceId, "workspaceId"),
                cohortId,
                assignmentId,
                {
                    membershipId: str(input.membershipId, "membershipId"),
                    idempotencyKey: nullableStr(input.idempotencyKey, "idempotencyKey"),
                },
                this.actor(),
            )
            return success(
                { submission: serialise({ ...result.submission }), replayed: result.replayed },
                result.replayed ? 200 : 201,
            )
        })
    }

    transitionSubmission(
        cohortId: string,
        assignmentId: string,
        submissionId: string,
        request: Request,
    ): Promise<Response> {
        return this.run(async () => {
            const input = await body(request)
            const row = await this.flow.transitionSubmission(
                str(input.workspaceId, "workspaceId"),
                cohortId,
                assignmentId,
                submissionId,
                status(input.state, submissionFlow.is, "submission", "state"),
                this.actor(),
                {
                    documentId: nullableStr(input.documentId, "documentId"),
                    notes: nullableStr(input.notes, "notes"),
                    points: optInt(input.points, "points"),
                    feedback: nullableStr(input.feedback, "feedback"),
                    reviewedBy: nullableStr(input.reviewedBy, "reviewedBy"),
                },
            )
            return success({ submission: serialise({ ...row }) })
        })
    }

    // ---- certificates --------------------------------------------------

    getCertificate(cohortId: string, membershipId: string, request: Request): Promise<Response> {
        return this.run(async () => {
            const row = await this.flow.getCertificate(param(request, "workspaceId"), cohortId, membershipId)
            return success({ certificate: row ? serialise({ ...row }) : null })
        })
    }

    transitionCertificate(cohortId: string, membershipId: string, request: Request): Promise<Response> {
        return this.run(async () => {
            const input = await body(request)
            const row = await this.flow.transitionCertificate(
                str(input.workspaceId, "workspaceId"),
                cohortId,
                membershipId,
                status(input.state, certificateFlow.is, "certificate", "state"),
                this.actor(),
                {
                    documentId: nullableStr(input.documentId, "documentId"),
                    reason: nullableStr(input.reason, "reason"),
                },
            )
            return success({ certificate: serialise({ ...row }) })
        })
    }

    // ---- renewal -------------------------------------------------------

    scheduleRenewal(cohortId: string, membershipId: string, request: Request): Promise<Response> {
        return this.run(async () => {
            const input = await body(request)
            const row = await this.flow.scheduleRenewal(
                str(input.workspaceId, "workspaceId"),
                cohortId,
                membershipId,
                {
                    dueAt: date(input.dueAt, "dueAt"),
                    remindAt: optDate(input.remindAt, "remindAt"),
                    idempotencyKey: nullableStr(input.idempotencyKey, "idempotencyKey"),
                },
                this.actor(),
            )
            return success({ membership: serialise({ ...row }) })
        })
    }

    transitionRenewal(cohortId: string, membershipId: string, request: Request): Promise<Response> {
        return this.run(async () => {
            const input = await body(request)
            const row = await this.flow.transitionRenewal(
                str(input.workspaceId, "workspaceId"),
                cohortId,
                membershipId,
                status(input.state, renewalFlow.is, "renewal", "state"),
                this.actor(),
                nullableStr(input.reason, "reason"),
            )
            return success({ membership: serialise({ ...row }) })
        })
    }

    // ====================================================================
    // Course access levels (G3/G6 owner surface)
    //
    // These endpoints are the OWNER path only. They all route through
    // CourseAccessService, which composes CohortContext, so tenancy is the same profileId
    // bridge as every other method above and a foreign resource is refused identically to
    // one that does not exist.
    //
    // The learner path is deliberately absent from this class. LearnerAccessService takes
    // no workspaceId and is reached from the library page with a Member cookie; exposing it
    // here would put a learner behind the workspace-scoped tenancy bridge and hand them a
    // probe for other tenants.
    // ====================================================================

    // ---- tiers ---------------------------------------------------------

    listAccessLevels(request: Request): Promise<Response> {
        return this.run(async () =>
            success({
                levels: serialiseAll(
                    await this.access.listLevels(param(request, "workspaceId"), param(request, "courseId")),
                ),
            }),
        )
    }

    defineAccessLevel(request: Request): Promise<Response> {
        return this.run(async () => {
            const input = await body(request)
            const record = await this.access.defineLevel(
                str(input.workspaceId, "workspaceId"),
                {
                    courseId: str(input.courseId, "courseId"),
                    key: str(input.key, "key"),
                    label: str(input.label, "label"),
                    rank: int(input.rank, "rank"),
                    description: nullableStr(input.description, "description"),
                    priceCents: optInt(input.priceCents, "priceCents"),
                },
                this.actor(),
            )
            return success({ level: serialise({ ...record }) }, 201)
        })
    }

    retireAccessLevel(accessLevelId: string, request: Request): Promise<Response> {
        return this.run(async () => {
            const record = await this.access.deactivateLevel(
                param(request, "workspaceId"),
                param(request, "courseId"),
                accessLevelId,
                this.actor(),
            )
            return success({ level: serialise({ ...record }) })
        })
    }

    // ---- lesson visibility rules ---------------------------------------

    listAccessLessonRules(request: Request): Promise<Response> {
        return this.run(async () =>
            success({
                rules: serialiseAll(
                    await this.access.listLessonRules(param(request, "workspaceId"), param(request, "courseId")),
                ),
            }),
        )
    }

    setAccessLessonRule(request: Request): Promise<Response> {
        return this.run(async () => {
            const input = await body(request)
            const rule = await this.access.setLessonRule(
                str(input.workspaceId, "workspaceId"),
                {
                    courseId: str(input.courseId, "courseId"),
                    lessonId: str(input.lessonId, "lessonId"),
                    // Null is meaningful: it removes the rule and returns the lesson to being
                    // visible to everybody, so it must not be conflated with "missing".
                    accessLevelId: nullableStr(input.accessLevelId, "accessLevelId"),
                },
                this.actor(),
            )
            return success({ rule: serialise({ ...rule }) })
        })
    }

    // ---- entitlements --------------------------------------------------

    getAccessGrant(request: Request): Promise<Response> {
        return this.run(async () =>
            success({
                grant: serialise({
                    ...(await this.access.getGrant(
                        param(request, "workspaceId"),
                        param(request, "courseId"),
                        param(request, "enrollmentId"),
                    )),
                }),
            }),
        )
    }

    createAccessGrant(request: Request): Promise<Response> {
        return this.run(async () => {
            const input = await body(request)
            const result = await this.access.grant(
                str(input.workspaceId, "workspaceId"),
                {
                    courseId: str(input.courseId, "courseId"),
                    enrollmentId: str(input.enrollmentId, "enrollmentId"),
                    accessLevelId: str(input.accessLevelId, "accessLevelId"),
                    source:
                        input.source === undefined || input.source === null || input.source === ""
                            ? null
                            : status(input.source, isGrantSource, "grant source", "source"),
                    expiresAt: optDate(input.expiresAt, "expiresAt"),
                    paymentId: nullableStr(input.paymentId, "paymentId"),
                },
                this.actor(),
            )
            // One grant per enrolment, so a repeat is a replay of the same row rather than a
            // refusal or a duplicate; 200 distinguishes it from the 201 that created it.
            return success(
                { grant: serialise({ ...result.grant }), replayed: result.replayed },
                result.replayed ? 200 : 201,
            )
        })
    }

    transitionAccessGrant(grantId: string, request: Request): Promise<Response> {
        return this.run(async () => {
            const input = await body(request)
            const record = await this.access.transitionGrant(
                str(input.workspaceId, "workspaceId"),
                str(input.courseId, "courseId"),
                grantId,
                status(input.state, accessGrantFlow.is, "access grant", "state"),
                this.actor(),
                nullableStr(input.reason, "reason"),
            )
            return success({ grant: serialise({ ...record }) })
        })
    }

    // ---- upgrades and downgrades ---------------------------------------

    listAccessChanges(grantId: string, request: Request): Promise<Response> {
        return this.run(async () =>
            success({
                changes: serialiseAll(
                    await this.access.listChanges(
                        param(request, "workspaceId"),
                        param(request, "courseId"),
                        grantId,
                    ),
                ),
            }),
        )
    }

    requestAccessChange(grantId: string, request: Request): Promise<Response> {
        return this.run(async () => {
            const input = await body(request)
            // The direction is derived from the ranks by the engine, never taken from the caller,
            // so a downgrade cannot be presented as an upgrade.
            const result = await this.access.requestChange(
                str(input.workspaceId, "workspaceId"),
                str(input.courseId, "courseId"),
                grantId,
                {
                    toAccessLevelId: str(input.toAccessLevelId, "toAccessLevelId"),
                    reason: nullableStr(input.reason, "reason"),
                    idempotencyKey: nullableStr(input.idempotencyKey, "idempotencyKey"),
                },
                this.actor(),
            )
            return success(
                { change: serialise({ ...result.change }), replayed: result.replayed },
                result.replayed ? 200 : 201,
            )
        })
    }

    decideAccessChange(changeId: string, request: Request): Promise<Response> {
        return this.run(async () => {
            const input = await body(request)
            const decision = status(input.decision, isChangeDecision, "decision", "decision")
            const record = await this.access.decideChange(
                str(input.workspaceId, "workspaceId"),
                str(input.courseId, "courseId"),
                changeId,
                decision,
                await this.decidedBy(),
                this.actor(),
                nullableStr(input.note, "note"),
            )
            return success({ change: serialise({ ...record }) })
        })
    }

    applyAccessChange(changeId: string, request: Request): Promise<Response> {
        return this.run(async () => {
            const input = await body(request)
            // NOTHING HERE TAKES A PAYMENT. invoiceRef and paymentId are strings an owner may
            // record after settling up elsewhere; no Payment row is read or written.
            const result = await this.access.applyChange(
                str(input.workspaceId, "workspaceId"),
                str(input.courseId, "courseId"),
                changeId,
                this.actor(),
                {
                    invoiceRef: nullableStr(input.invoiceRef, "invoiceRef"),
                    paymentId: nullableStr(input.paymentId, "paymentId"),
                },
            )
            return success({
                change: serialise({ ...result.change }),
                grant: serialise({ ...result.grant }),
            })
        })
    }

    // ---- owner views ---------------------------------------------------

    listAccessCourses(request: Request): Promise<Response> {
        return this.run(async () =>
            success({ courses: serialiseAll(await this.access.listCourses(param(request, "workspaceId"))) }),
        )
    }

    /**
     * One read that returns the lesson tree with every lesson's current rule and the enrolments
     * with their current entitlement. The rule editor needs the lessons that have NO rule, which
     * is exactly what the reporting endpoint omits.
     */
    accessConsole(request: Request): Promise<Response> {
        return this.run(async () => {
            const console_ = await this.access.courseConsole(
                param(request, "workspaceId"),
                param(request, "courseId"),
            )
            return success({
                console: {
                    courseId: console_.courseId,
                    courseTitle: console_.courseTitle,
                    modules: console_.modules.map((module) => ({
                        ...module,
                        lessons: module.lessons.map((lesson) => ({ ...lesson })),
                    })),
                    enrolments: console_.enrolments.map((enrolment) => ({
                        ...enrolment,
                        grant: enrolment.grant ? serialise({ ...enrolment.grant }) : null,
                    })),
                },
            })
        })
    }

    accessVisibility(request: Request): Promise<Response> {
        return this.run(async () => {
            const report = await this.access.visibilityFor(
                param(request, "workspaceId"),
                param(request, "courseId"),
                param(request, "enrollmentId"),
            )
            return success({
                visibility: {
                    ...report,
                    lessons: report.lessons.map((lesson) => ({ ...lesson })),
                },
            })
        })
    }

    accessTimeline(request: Request): Promise<Response> {
        return this.run(async () =>
            success({
                events: serialiseAll(
                    await this.access.timeline(param(request, "workspaceId"), param(request, "courseId")),
                ),
            }),
        )
    }
}

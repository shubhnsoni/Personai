import { PersistenceError } from "@/lib/persistence/errors"

import {
    ARTIFACT_REQUIRED_SUBMISSION_STATES,
    ATTENDABLE_SESSION_STATUSES,
    TASK_REQUIRED_RENEWAL_STATES,
    certificateFlow,
    isAttendanceStatus,
    renewalFlow,
    sessionFlow,
    submissionFlow,
    type AttendanceStatusValue,
    type CertificateStateValue,
    type RenewalStateValue,
    type SessionStatusValue,
    type SubmissionStateValue,
} from "./lifecycle"
import type { CohortProgressService } from "./progress"
import type { CohortActor, CohortContext } from "./shared"

/**
 * Sessions, attendance, assignments, submissions, certificates and renewal state.
 *
 * Composition, not duplication:
 *   - a session venue is an existing Location
 *   - a submitted or certified file is an existing ProfileDocument
 *   - a renewal reminder is an existing TaskJob; the REMINDED state cannot be reached
 *     without one, so the state is never a claim with nothing behind it
 *
 * There is no external call anywhere in this file. Scheduling a reminder enqueues a
 * TaskJob row; it does not send anything.
 */

const REMINDER_WORKFLOW_KEY = "cohorts.renewal.reminder"

export class CohortWorkflowService {
    constructor(
        private readonly ctx: CohortContext,
        private readonly progress: CohortProgressService,
    ) {}

    // ---- sessions ------------------------------------------------------

    async listSessions(workspaceId: string, cohortId: string) {
        const profileId = await this.ctx.requireProfile(workspaceId, "profile.read")
        const cohort = await this.ctx.ownedCohort(profileId, cohortId)
        const rows = await this.ctx.db.cohortSession.findMany({
            where: { cohortId: cohort.id },
            orderBy: [{ ordinal: "asc" }, { id: "asc" }],
        })
        return Object.freeze(
            rows.map((r) =>
                Object.freeze({ ...r, allowedTransitions: sessionFlow.allowedFrom(r.status as SessionStatusValue) }),
            ),
        )
    }

    async addSession(
        workspaceId: string,
        cohortId: string,
        input: Readonly<{ ordinal: number; title: string; startsAt: Date; endsAt: Date; locationId?: string | null }>,
        actor: CohortActor,
    ) {
        const profileId = await this.ctx.requireProfile(workspaceId, "profile.update")
        const cohort = await this.ctx.ownedCohort(profileId, cohortId)
        const title = this.ctx.required(input.title, "title")
        if (!Number.isInteger(input.ordinal) || input.ordinal < 1) {
            this.ctx.conflict("ordinal must be a positive integer")
        }
        if (input.endsAt.getTime() <= input.startsAt.getTime()) {
            this.ctx.conflict("a session must end after it starts")
        }
        const locationId = await this.ctx.assertLocation(profileId, input.locationId?.trim() || null)

        try {
            return await this.ctx.db.$transaction(async (tx) => {
                const row = await tx.cohortSession.create({
                    data: {
                        cohortId: cohort.id,
                        ordinal: input.ordinal,
                        title,
                        startsAt: input.startsAt,
                        endsAt: input.endsAt,
                        locationId,
                    },
                })
                await this.ctx.appendEvent(tx, cohort.id, "SESSION", null, "SCHEDULED", actor, { sessionId: row.id })
                return row
            })
        } catch (error) {
            this.ctx.rethrowUnique(error, `Session ${input.ordinal} already exists in this cohort`)
        }
    }

    async transitionSession(
        workspaceId: string,
        cohortId: string,
        sessionId: string,
        to: SessionStatusValue,
        actor: CohortActor,
        reason?: string | null,
    ) {
        const profileId = await this.ctx.requireProfile(workspaceId, "profile.update")
        const { cohort, session } = await this.ctx.ownedSession(profileId, cohortId, sessionId)

        if (sessionFlow.isTerminal(session.status as SessionStatusValue)) {
            this.ctx.conflict(`This session is already ${session.status.toLowerCase()} and cannot change`)
        }
        if (!sessionFlow.can(session.status as SessionStatusValue, to)) {
            this.ctx.conflict(`Cannot move a ${session.status.toLowerCase()} session to ${to.toLowerCase()}`)
        }

        return this.ctx.db.$transaction(async (tx) => {
            const row = await tx.cohortSession.update({
                where: { id: session.id },
                data: {
                    status: to,
                    ...(to === "HELD" ? { heldAt: new Date() } : {}),
                    ...(to === "CANCELLED" ? { cancelReason: reason?.trim() || null } : {}),
                },
            })
            await this.ctx.appendEvent(tx, cohort.id, "SESSION", session.status, to, actor, { sessionId: session.id })
            return row
        })
    }

    // ---- attendance ----------------------------------------------------

    async listAttendance(workspaceId: string, cohortId: string, sessionId: string) {
        const profileId = await this.ctx.requireProfile(workspaceId, "profile.read")
        const { session } = await this.ctx.ownedSession(profileId, cohortId, sessionId)
        return Object.freeze(
            await this.ctx.db.cohortAttendance.findMany({
                where: { sessionId: session.id },
                orderBy: [{ recordedAt: "asc" }, { id: "asc" }],
            }),
        )
    }

    /**
     * Records or corrects attendance. Only a session that has started can have
     * attendance, because attendance against a future or cancelled meeting would be a
     * fabricated record. A correction is an upsert, and both paths append an event.
     */
    async recordAttendance(
        workspaceId: string,
        cohortId: string,
        sessionId: string,
        input: Readonly<{ membershipId: string; status: unknown; note?: string | null }>,
        actor: CohortActor,
    ) {
        const profileId = await this.ctx.requireProfile(workspaceId, "profile.update")
        const { cohort, session } = await this.ctx.ownedSession(profileId, cohortId, sessionId)
        const { membership } = await this.ctx.ownedMembership(profileId, cohortId, input.membershipId)

        if (!isAttendanceStatus(input.status)) {
            throw new PersistenceError("BAD_REQUEST", "status is not a recognised attendance value", { field: "status" })
        }
        const status: AttendanceStatusValue = input.status

        if (!ATTENDABLE_SESSION_STATUSES.includes(session.status as SessionStatusValue)) {
            this.ctx.conflict(
                `Attendance cannot be recorded for a ${session.status.toLowerCase()} session; start the session first`,
            )
        }
        if (membership.status === "WITHDRAWN") {
            this.ctx.conflict("A withdrawn member cannot be marked as attending")
        }

        return this.ctx.db.$transaction(async (tx) => {
            const existing = await tx.cohortAttendance.findUnique({
                where: { sessionId_membershipId: { sessionId: session.id, membershipId: membership.id } },
                select: { status: true },
            })
            const row = await tx.cohortAttendance.upsert({
                where: { sessionId_membershipId: { sessionId: session.id, membershipId: membership.id } },
                create: {
                    sessionId: session.id,
                    membershipId: membership.id,
                    status,
                    note: input.note?.trim() || null,
                },
                update: { status, note: input.note?.trim() || null },
            })
            await this.ctx.appendEvent(tx, cohort.id, "ATTENDANCE", existing?.status ?? null, status, actor, {
                sessionId: session.id,
                membershipId: membership.id,
            })
            return row
        })
    }

    // ---- assignments ---------------------------------------------------

    async listAssignments(workspaceId: string, cohortId: string) {
        const profileId = await this.ctx.requireProfile(workspaceId, "profile.read")
        const cohort = await this.ctx.ownedCohort(profileId, cohortId)
        return Object.freeze(
            await this.ctx.db.cohortAssignment.findMany({
                where: { cohortId: cohort.id },
                orderBy: [{ ordinal: "asc" }, { id: "asc" }],
            }),
        )
    }

    async addAssignment(
        workspaceId: string,
        cohortId: string,
        input: Readonly<{
            ordinal: number
            title: string
            instructions?: string | null
            dueAt?: Date | null
            maxPoints?: number | null
        }>,
        actor: CohortActor,
    ) {
        const profileId = await this.ctx.requireProfile(workspaceId, "profile.update")
        const cohort = await this.ctx.ownedCohort(profileId, cohortId)
        const title = this.ctx.required(input.title, "title")
        if (!Number.isInteger(input.ordinal) || input.ordinal < 1) {
            this.ctx.conflict("ordinal must be a positive integer")
        }
        const maxPoints = input.maxPoints ?? 100
        if (!Number.isInteger(maxPoints) || maxPoints <= 0) {
            this.ctx.conflict("maxPoints must be a positive integer")
        }

        try {
            return await this.ctx.db.$transaction(async (tx) => {
                const row = await tx.cohortAssignment.create({
                    data: {
                        cohortId: cohort.id,
                        ordinal: input.ordinal,
                        title,
                        instructions: input.instructions?.trim() || null,
                        dueAt: input.dueAt ?? null,
                        maxPoints,
                    },
                })
                await this.ctx.appendEvent(tx, cohort.id, "ASSIGNMENT", null, "CREATED", actor, { assignmentId: row.id })
                return row
            })
        } catch (error) {
            this.ctx.rethrowUnique(error, `Assignment ${input.ordinal} already exists in this cohort`)
        }
    }

    // ---- submissions ---------------------------------------------------

    async listSubmissions(workspaceId: string, cohortId: string, assignmentId: string) {
        const profileId = await this.ctx.requireProfile(workspaceId, "profile.read")
        const { assignment } = await this.ctx.ownedAssignment(profileId, cohortId, assignmentId)
        const rows = await this.ctx.db.cohortSubmission.findMany({
            where: { assignmentId: assignment.id },
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        })
        return Object.freeze(
            rows.map((r) =>
                Object.freeze({
                    ...r,
                    allowedTransitions: submissionFlow.allowedFrom(r.state as SubmissionStateValue),
                }),
            ),
        )
    }

    /** Opens a submission slot for a learner. Idempotent on (assignment, key). */
    async openSubmission(
        workspaceId: string,
        cohortId: string,
        assignmentId: string,
        input: Readonly<{ membershipId: string; idempotencyKey?: string | null }>,
        actor: CohortActor,
    ) {
        const profileId = await this.ctx.requireProfile(workspaceId, "profile.update")
        const { cohort, assignment } = await this.ctx.ownedAssignment(profileId, cohortId, assignmentId)
        const { membership } = await this.ctx.ownedMembership(profileId, cohortId, input.membershipId)
        const idempotencyKey = input.idempotencyKey?.trim() || null

        if (idempotencyKey) {
            const existing = await this.ctx.db.cohortSubmission.findUnique({
                where: { assignmentId_idempotencyKey: { assignmentId: assignment.id, idempotencyKey } },
            })
            if (existing) return { submission: existing, replayed: true }
        }

        try {
            const created = await this.ctx.db.$transaction(async (tx) => {
                const row = await tx.cohortSubmission.create({
                    data: { assignmentId: assignment.id, membershipId: membership.id, idempotencyKey },
                })
                await this.ctx.appendEvent(tx, cohort.id, "SUBMISSION", null, "DRAFT", actor, {
                    submissionId: row.id,
                    assignmentId: assignment.id,
                    membershipId: membership.id,
                })
                return row
            })
            return { submission: created, replayed: false }
        } catch (error) {
            this.ctx.rethrowUnique(error, "This learner already has a submission for that assignment")
        }
    }

    /**
     * Moves a submission through its lifecycle.
     *
     * SUBMITTED requires an actual artifact - either an uploaded ProfileDocument or
     * written notes. Accepting an empty submission would record work that was never
     * handed in. ACCEPTED validates points against the assignment's own maximum.
     */
    async transitionSubmission(
        workspaceId: string,
        cohortId: string,
        assignmentId: string,
        submissionId: string,
        to: SubmissionStateValue,
        actor: CohortActor,
        options?: Readonly<{
            documentId?: string | null
            notes?: string | null
            points?: number | null
            feedback?: string | null
            reviewedBy?: string | null
        }>,
    ) {
        const profileId = await this.ctx.requireProfile(workspaceId, "profile.update")
        const { cohort, assignment } = await this.ctx.ownedAssignment(profileId, cohortId, assignmentId)
        const id = this.ctx.required(submissionId, "submissionId")
        const current = await this.ctx.db.cohortSubmission.findUnique({ where: { id } })
        if (!current || current.assignmentId !== assignment.id) this.ctx.denied()

        if (submissionFlow.isTerminal(current.state as SubmissionStateValue)) {
            this.ctx.conflict(`This submission is already ${current.state.toLowerCase()} and cannot change`)
        }
        if (!submissionFlow.can(current.state as SubmissionStateValue, to)) {
            this.ctx.conflict(`Cannot move a ${current.state.toLowerCase()} submission to ${to.toLowerCase()}`)
        }

        const documentId = await this.ctx.assertDocument(profileId, options?.documentId?.trim() || null)
        const notes = options?.notes?.trim() || null

        if (ARTIFACT_REQUIRED_SUBMISSION_STATES.includes(to)) {
            const hasArtifact = Boolean(documentId ?? current.documentId) || Boolean(notes ?? current.notes)
            if (!hasArtifact) {
                this.ctx.conflict("Submitting requires either an uploaded document or written notes")
            }
        }

        let points: number | null = null
        if (to === "ACCEPTED") {
            points = options?.points ?? null
            if (points !== null && (!Number.isInteger(points) || points < 0 || points > assignment.maxPoints)) {
                throw new PersistenceError(
                    "BAD_REQUEST",
                    `points must be an integer between 0 and ${assignment.maxPoints}`,
                    { field: "points" },
                )
            }
        }

        return this.ctx.db.$transaction(async (tx) => {
            const row = await tx.cohortSubmission.update({
                where: { id },
                data: {
                    state: to,
                    ...(documentId ? { documentId } : {}),
                    ...(notes ? { notes } : {}),
                    ...(to === "SUBMITTED" ? { submittedAt: new Date() } : {}),
                    ...(to === "ACCEPTED" || to === "REJECTED" || to === "RETURNED"
                        ? {
                              reviewedAt: new Date(),
                              reviewedBy: options?.reviewedBy?.trim() || null,
                              feedback: options?.feedback?.trim() || null,
                              ...(to === "ACCEPTED" ? { points } : {}),
                          }
                        : {}),
                },
            })
            await this.ctx.appendEvent(tx, cohort.id, "SUBMISSION", current.state, to, actor, { submissionId: id })
            return row
        })
    }

    // ---- certificates --------------------------------------------------

    async getCertificate(workspaceId: string, cohortId: string, membershipId: string) {
        const profileId = await this.ctx.requireProfile(workspaceId, "profile.read")
        const { membership } = await this.ctx.ownedMembership(profileId, cohortId, membershipId)
        const row = await this.ctx.db.cohortCertificate.findUnique({ where: { membershipId: membership.id } })
        return row
            ? Object.freeze({
                  ...row,
                  allowedTransitions: certificateFlow.allowedFrom(row.state as CertificateStateValue),
              })
            : null
    }

    /**
     * Moves a certificate through its lifecycle, creating the record on first use.
     *
     * ELIGIBLE is not a claim the caller may make: it is recomputed from persisted
     * records against the cohort's published policy, and refused with reasons if the
     * learner does not actually qualify. ISSUED generates the serial server-side, so a
     * caller cannot choose or collide with one.
     */
    async transitionCertificate(
        workspaceId: string,
        cohortId: string,
        membershipId: string,
        to: CertificateStateValue,
        actor: CohortActor,
        options?: Readonly<{ documentId?: string | null; reason?: string | null }>,
    ) {
        const profileId = await this.ctx.requireProfile(workspaceId, "profile.update")
        const { cohort, membership } = await this.ctx.ownedMembership(profileId, cohortId, membershipId)
        const documentId = await this.ctx.assertDocument(profileId, options?.documentId?.trim() || null)

        const existing = await this.ctx.db.cohortCertificate.findUnique({ where: { membershipId: membership.id } })
        const from: CertificateStateValue = (existing?.state as CertificateStateValue) ?? "INELIGIBLE"

        if (certificateFlow.isTerminal(from)) {
            this.ctx.conflict(`This certificate is already ${from.toLowerCase()} and cannot change`)
        }
        if (!certificateFlow.can(from, to)) {
            this.ctx.conflict(`Cannot move a ${from.toLowerCase()} certificate to ${to.toLowerCase()}`)
        }

        if (to === "ELIGIBLE") {
            const report = await this.progress.evaluate(cohort, membership)
            if (!report.eligible) {
                throw new PersistenceError(
                    "CONFLICT",
                    `This learner is not eligible: ${report.reasons.join("; ")}`,
                    { reasons: report.reasons },
                )
            }
        }

        // A serial is minted only at issue, and only from data the server controls.
        const serial =
            to === "ISSUED" ? `${cohort.code}-${membership.id.slice(-8).toUpperCase()}` : null

        return this.ctx.db.$transaction(async (tx) => {
            const row = await tx.cohortCertificate.upsert({
                where: { membershipId: membership.id },
                create: {
                    membershipId: membership.id,
                    state: to,
                    ...(serial ? { serial, issuedAt: new Date() } : {}),
                    ...(documentId ? { documentId } : {}),
                    reason: options?.reason?.trim() || null,
                },
                update: {
                    state: to,
                    ...(serial ? { serial, issuedAt: new Date() } : {}),
                    ...(to === "REVOKED" ? { revokedAt: new Date() } : {}),
                    ...(documentId ? { documentId } : {}),
                    ...(options?.reason !== undefined ? { reason: options.reason?.trim() || null } : {}),
                },
            })
            await this.ctx.appendEvent(tx, cohort.id, "CERTIFICATE", from, to, actor, {
                membershipId: membership.id,
                ...(serial ? { serial } : {}),
            })
            return row
        })
    }

    // ---- renewal and reminders ----------------------------------------

    /**
     * Schedules a renewal and, when a remind time is given, enqueues a real TaskJob to
     * carry the reminder. Nothing is sent here: the TaskJob is a queued row, and the
     * membership records that it exists. This is why REMINDED cannot be reached without
     * a linked TaskJob - the state would otherwise assert a delivery that never happened.
     */
    async scheduleRenewal(
        workspaceId: string,
        cohortId: string,
        membershipId: string,
        input: Readonly<{ dueAt: Date; remindAt?: Date | null; idempotencyKey?: string | null }>,
        actor: CohortActor,
    ) {
        const profileId = await this.ctx.requireProfile(workspaceId, "profile.update")
        const { cohort, membership } = await this.ctx.ownedMembership(profileId, cohortId, membershipId)

        const from = membership.renewalState as RenewalStateValue
        if (!renewalFlow.can(from, "SCHEDULED")) {
            this.ctx.conflict(`Cannot schedule a renewal from ${from.toLowerCase()}`)
        }
        if (input.remindAt && input.remindAt.getTime() > input.dueAt.getTime()) {
            this.ctx.conflict("a reminder cannot be scheduled after the renewal is due")
        }

        const idempotencyKey = input.idempotencyKey?.trim() || `${REMINDER_WORKFLOW_KEY}:${membership.id}`

        return this.ctx.db.$transaction(async (tx) => {
            let taskJobId: string | null = null
            if (input.remindAt) {
                const existing = await tx.taskJob.findUnique({ where: { idempotencyKey }, select: { id: true } })
                taskJobId =
                    existing?.id ??
                    (
                        await tx.taskJob.create({
                            data: {
                                payload: JSON.stringify({
                                    workflowKey: REMINDER_WORKFLOW_KEY,
                                    cohortId: cohort.id,
                                    membershipId: membership.id,
                                }),
                                state: "QUEUED",
                                maxAttempts: 3,
                                nextAttemptAt: input.remindAt,
                                idempotencyKey,
                            },
                            select: { id: true },
                        })
                    ).id
            }

            const row = await tx.cohortMembership.update({
                where: { id: membership.id },
                data: {
                    renewalState: "SCHEDULED",
                    renewalDueAt: input.dueAt,
                    renewalRemindAt: input.remindAt ?? null,
                    renewalTaskJobId: taskJobId,
                },
            })
            await this.ctx.appendEvent(tx, cohort.id, "RENEWAL", from, "SCHEDULED", actor, {
                membershipId: membership.id,
                ...(taskJobId ? { taskJobId } : {}),
            })
            return row
        })
    }

    async transitionRenewal(
        workspaceId: string,
        cohortId: string,
        membershipId: string,
        to: RenewalStateValue,
        actor: CohortActor,
        reason?: string | null,
    ) {
        const profileId = await this.ctx.requireProfile(workspaceId, "profile.update")
        const { cohort, membership } = await this.ctx.ownedMembership(profileId, cohortId, membershipId)
        const from = membership.renewalState as RenewalStateValue

        if (renewalFlow.isTerminal(from)) {
            this.ctx.conflict(`Renewal is already ${from.toLowerCase()} and cannot change`)
        }
        if (!renewalFlow.can(from, to)) {
            this.ctx.conflict(`Cannot move renewal from ${from.toLowerCase()} to ${to.toLowerCase()}`)
        }
        if (TASK_REQUIRED_RENEWAL_STATES.includes(to) && !membership.renewalTaskJobId) {
            this.ctx.conflict("A reminder cannot be marked sent without a queued reminder task")
        }

        return this.ctx.db.$transaction(async (tx) => {
            const row = await tx.cohortMembership.update({
                where: { id: membership.id },
                data: {
                    renewalState: to,
                    ...(to === "SCHEDULED" ? {} : {}),
                },
            })
            await this.ctx.appendEvent(tx, cohort.id, "RENEWAL", from, to, actor, {
                membershipId: membership.id,
                ...(reason ? { reason } : {}),
            })
            return row
        })
    }
}

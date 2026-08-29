import {
    ATTENDANCE_CREDITED,
    ATTENDANCE_EXEMPT,
    ATTENDABLE_SESSION_STATUSES,
} from "./lifecycle"
import type { CohortContext } from "./shared"

/**
 * Progress and certificate eligibility, DERIVED from persisted rows.
 *
 * Nothing here is cached. There is deliberately no progress column anywhere in the
 * cohort schema: lesson progress comes from the pre-existing LessonCompletion rows,
 * assignment progress from CohortSubmission, and attendance from CohortAttendance. A
 * cached percentage would be a second source of truth that can silently disagree with
 * the records it summarises, and the schema harness fails if one appears.
 *
 * Percentages are integers, floored. A learner who has done 2 of 3 lessons is 66%, not
 * 67%: rounding up would overstate what they actually completed.
 */

export type LessonProgress = Readonly<{
    totalLessons: number
    completedLessons: number
    percent: number
}>

export type AssignmentProgress = Readonly<{
    totalAssignments: number
    acceptedSubmissions: number
    outstandingAssignments: number
}>

export type AttendanceProgress = Readonly<{
    attendableSessions: number
    creditedSessions: number
    exemptSessions: number
    percent: number
}>

export type CohortPolicy = Readonly<{
    attendanceThresholdPct: number
    requireAllAssignments: boolean
    requireAllLessons: boolean
}>

export type EligibilityReport = Readonly<{
    eligible: boolean
    reasons: readonly string[]
    lessons: LessonProgress
    assignments: AssignmentProgress
    attendance: AttendanceProgress
    policy: CohortPolicy
}>

function percent(part: number, whole: number): number {
    if (whole <= 0) return 0
    return Math.floor((part / whole) * 100)
}

export class CohortProgressService {
    constructor(private readonly ctx: CohortContext) {}

    /** Lesson progress for one enrolment, over the lessons its course actually has. */
    async lessons(courseId: string, enrollmentId: string): Promise<LessonProgress> {
        const totalLessons = await this.ctx.db.courseLesson.count({ where: { module: { courseId } } })
        const completedLessons = await this.ctx.db.lessonCompletion.count({ where: { enrollmentId } })
        return Object.freeze({ totalLessons, completedLessons, percent: percent(completedLessons, totalLessons) })
    }

    /** Assignment progress: only an ACCEPTED submission counts as done. */
    async assignments(cohortId: string, membershipId: string): Promise<AssignmentProgress> {
        const totalAssignments = await this.ctx.db.cohortAssignment.count({ where: { cohortId } })
        const acceptedSubmissions = await this.ctx.db.cohortSubmission.count({
            where: { membershipId, state: "ACCEPTED", assignment: { cohortId } },
        })
        return Object.freeze({
            totalAssignments,
            acceptedSubmissions,
            outstandingAssignments: Math.max(0, totalAssignments - acceptedSubmissions),
        })
    }

    /**
     * Attendance over sessions that actually happened. A SCHEDULED session is excluded
     * because nobody can have attended it yet, and a CANCELLED one because it never
     * occurred — counting either would penalise a learner for the cohort's own schedule.
     * EXCUSED absences are removed from the denominator rather than counted as credit.
     */
    async attendance(cohortId: string, membershipId: string): Promise<AttendanceProgress> {
        const attendableSessions = await this.ctx.db.cohortSession.count({
            where: { cohortId, status: { in: [...ATTENDABLE_SESSION_STATUSES] } },
        })
        const rows = await this.ctx.db.cohortAttendance.findMany({
            where: { membershipId, session: { cohortId, status: { in: [...ATTENDABLE_SESSION_STATUSES] } } },
            select: { status: true },
        })
        const creditedSessions = rows.filter((r) => (ATTENDANCE_CREDITED as readonly string[]).includes(r.status)).length
        const exemptSessions = rows.filter((r) => (ATTENDANCE_EXEMPT as readonly string[]).includes(r.status)).length
        const denominator = Math.max(0, attendableSessions - exemptSessions)
        return Object.freeze({
            attendableSessions,
            creditedSessions,
            exemptSessions,
            percent: percent(creditedSessions, denominator),
        })
    }

    /**
     * Evaluates the cohort's published policy against the learner's persisted records.
     * Returns the reasons a learner is NOT eligible, so a refusal can say why instead of
     * only saying no.
     */
    async evaluate(
        cohort: Readonly<{
            id: string
            courseId: string
            attendanceThresholdPct: number
            requireAllAssignments: boolean
            requireAllLessons: boolean
        }>,
        membership: Readonly<{ id: string; enrollmentId: string }>,
    ): Promise<EligibilityReport> {
        const [lessons, assignments, attendance] = await Promise.all([
            this.lessons(cohort.courseId, membership.enrollmentId),
            this.assignments(cohort.id, membership.id),
            this.attendance(cohort.id, membership.id),
        ])

        const policy: CohortPolicy = Object.freeze({
            attendanceThresholdPct: cohort.attendanceThresholdPct,
            requireAllAssignments: cohort.requireAllAssignments,
            requireAllLessons: cohort.requireAllLessons,
        })

        const reasons: string[] = []
        if (policy.requireAllLessons && lessons.completedLessons < lessons.totalLessons) {
            reasons.push(`${lessons.totalLessons - lessons.completedLessons} of ${lessons.totalLessons} lessons are not complete`)
        }
        if (policy.requireAllAssignments && assignments.outstandingAssignments > 0) {
            reasons.push(`${assignments.outstandingAssignments} of ${assignments.totalAssignments} assignments have no accepted submission`)
        }
        if (policy.attendanceThresholdPct > 0 && attendance.percent < policy.attendanceThresholdPct) {
            reasons.push(`attendance is ${attendance.percent}% against a ${policy.attendanceThresholdPct}% requirement`)
        }

        return Object.freeze({
            eligible: reasons.length === 0,
            reasons: Object.freeze(reasons),
            lessons,
            assignments,
            attendance,
            policy,
        })
    }
}

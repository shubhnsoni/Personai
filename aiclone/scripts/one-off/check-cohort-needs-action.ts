import { readFileSync } from "node:fs"
import { join } from "node:path"

import { PrismaClient } from "@prisma/client"

import {
    COHORT_NEEDS_ACTION_COVERAGE,
    COHORT_NEEDS_ACTION_DOMAIN,
    COHORT_NEEDS_ACTION_NOT_COVERED,
    COHORT_NEEDS_ACTION_SCOPE,
    resolveCohortNeedsAction,
} from "../../src/lib/cohorts/needs-action"
import {
    ATTENDANCE_CREDITED,
    ATTENDABLE_SESSION_STATUSES,
    certificateFlow,
    membershipFlow,
    renewalFlow,
    submissionFlow,
} from "../../src/lib/cohorts/lifecycle"
import { assertDisposableTarget, parseDatabaseName } from "../lib/disposable-db"

const AUTHORIZED_TARGET = "personalink_phase0_rehearsal_20260826_210704"
const INVERT = process.env.INVERT_ASSERTION === "1"
const RUN = `s3b_${process.pid}_${Date.now()}_${Math.floor(Math.random() * 1e9)}`
const AS_OF = new Date("2035-06-15T12:00:00.000Z")
const APP_ROOT = join(__dirname, "../..")

const results: Array<{ name: string; pass: boolean; detail: string }> = []
function check(name: string, pass: boolean, detail = "") {
    results.push({ name, pass, detail })
}
function checkInvertible(name: string, pass: boolean, detail = "") {
    results.push({ name, pass: INVERT ? !pass : pass, detail })
}

class Rollback extends Error {}
type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0]

type Ids = Readonly<{
    profileA: string
    profileB: string
    submitted: string
    returned: string
    accepted: string
    completedMemberSubmission: string
    cancelledCohortSubmission: string
    heldAbsent: string
    heldLate: string
    scheduledAbsent: string
    renewalScheduled: string
    renewalReminded: string
    renewalLapsed: string
    renewalNone: string
    renewalRenewed: string
    renewalCancelled: string
    completedMembership: string
    eligibleCertificate: string
    issuedCertificate: string
    tenantBSubmission: string
}>

function executableSource(source: string): string {
    return source
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .split("\n")
        .map((line) => line.replace(/\/\/.*$/, "").trim())
        .filter(Boolean)
        .join("\n")
}

async function seed(tx: Tx): Promise<Ids> {
    const q = (suffix: string) => `${RUN}_${suffix}`
    for (const side of ["a", "b"] as const) {
        const userId = q(`user_${side}`)
        const profileId = q(`profile_${side}`)
        const courseId = q(`course_${side}`)
        await tx.user.create({
            data: { id: userId, clerkId: q(`clerk_${side}`), email: `${q(`email_${side}`)}@example.test` },
        })
        await tx.profile.create({ data: { id: profileId, userId, slug: q(`slug_${side}`), displayName: `Tenant ${side}` } })
        await tx.course.create({ data: { id: courseId, profileId, title: `Course ${side}` } })
        await tx.cohort.create({
            data: { id: q(`cohort_${side}`), profileId, courseId, code: q(`code_${side}`), title: `Cohort ${side}`, status: "RUNNING" },
        })
    }
    await tx.cohort.create({
        data: {
            id: q("cohort_cancelled"),
            profileId: q("profile_a"),
            courseId: q("course_a"),
            code: q("code_cancelled"),
            title: "Cancelled cohort",
            status: "CANCELLED",
        },
    })

    let enrollmentOrdinal = 0
    async function membership(
        suffix: string,
        options: Readonly<{
            tenant?: "a" | "b"
            cohort?: "running" | "cancelled"
            status?: "ACTIVE" | "COMPLETED"
            renewalState?: "NONE" | "SCHEDULED" | "REMINDED" | "RENEWED" | "LAPSED" | "CANCELLED"
            renewalDueAt?: Date | null
        }> = {},
    ) {
        const tenant = options.tenant ?? "a"
        enrollmentOrdinal += 1
        const enrollmentId = q(`enrollment_${enrollmentOrdinal}`)
        await tx.courseEnrollment.create({
            data: {
                id: enrollmentId,
                courseId: q(`course_${tenant}`),
                visitorEmail: `${q(`learner_${enrollmentOrdinal}`)}@example.test`,
                status: "ACTIVE",
            },
        })
        const id = q(`membership_${suffix}`)
        await tx.cohortMembership.create({
            data: {
                id,
                cohortId: options.cohort === "cancelled" ? q("cohort_cancelled") : q(`cohort_${tenant}`),
                enrollmentId,
                status: options.status ?? "ACTIVE",
                renewalState: options.renewalState ?? "NONE",
                renewalDueAt: options.renewalDueAt ?? null,
            },
        })
        return id
    }

    const mainMember = await membership("main")
    const completedMember = await membership("completed", {
        status: "COMPLETED",
        renewalState: "SCHEDULED",
        renewalDueAt: new Date("2035-06-20T12:00:00.000Z"),
    })
    const cancelledMember = await membership("cancelled_cohort", { cohort: "cancelled" })
    const tenantBMember = await membership("tenant_b", { tenant: "b" })
    const renewalScheduled = await membership("renewal_scheduled", {
        renewalState: "SCHEDULED",
        renewalDueAt: new Date("2035-06-20T12:00:00.000Z"),
    })
    const renewalReminded = await membership("renewal_reminded", {
        renewalState: "REMINDED",
        renewalDueAt: new Date("2035-06-18T12:00:00.000Z"),
    })
    const renewalLapsed = await membership("renewal_lapsed", {
        renewalState: "LAPSED",
        renewalDueAt: new Date("2035-06-01T12:00:00.000Z"),
    })
    const renewalNone = await membership("renewal_none")
    const renewalRenewed = await membership("renewal_renewed", { renewalState: "RENEWED" })
    const renewalCancelled = await membership("renewal_cancelled", { renewalState: "CANCELLED" })
    const certificateMember = await membership("certificate_completed", { status: "COMPLETED" })
    const issuedCertificateMember = await membership("certificate_issued", { status: "COMPLETED" })

    async function assignment(suffix: string, cohortId = q("cohort_a")) {
        const id = q(`assignment_${suffix}`)
        await tx.cohortAssignment.create({
            data: { id, cohortId, ordinal: enrollmentOrdinal + Math.floor(Math.random() * 1e6), title: `Assignment ${suffix}`, dueAt: new Date("2035-06-10T12:00:00.000Z") },
        })
        return id
    }
    async function submission(
        suffix: string,
        memberId: string,
        state: "SUBMITTED" | "RETURNED" | "ACCEPTED",
        cohortId = q("cohort_a"),
    ) {
        const assignmentId = await assignment(suffix, cohortId)
        const id = q(`submission_${suffix}`)
        await tx.cohortSubmission.create({
            data: {
                id,
                assignmentId,
                membershipId: memberId,
                state,
                notes: "Fixture",
                submittedAt: new Date("2035-06-11T12:00:00.000Z"),
                ...(state === "SUBMITTED" ? {} : { reviewedAt: new Date("2035-06-12T12:00:00.000Z") }),
            },
        })
        return id
    }

    const submitted = await submission("submitted", mainMember, "SUBMITTED")
    const returned = await submission("returned", mainMember, "RETURNED")
    const accepted = await submission("accepted", mainMember, "ACCEPTED")
    const completedMemberSubmission = await submission("completed_member", completedMember, "SUBMITTED")
    const cancelledCohortSubmission = await submission("cancelled_cohort", cancelledMember, "SUBMITTED", q("cohort_cancelled"))
    const tenantBSubmission = await submission("tenant_b", tenantBMember, "SUBMITTED", q("cohort_b"))

    async function session(suffix: string, status: "HELD" | "SCHEDULED") {
        const id = q(`session_${suffix}`)
        await tx.cohortSession.create({
            data: {
                id,
                cohortId: q("cohort_a"),
                ordinal: enrollmentOrdinal + Math.floor(Math.random() * 1e6),
                title: `Session ${suffix}`,
                startsAt: new Date("2035-06-10T10:00:00.000Z"),
                endsAt: new Date("2035-06-10T11:00:00.000Z"),
                status,
                heldAt: status === "HELD" ? new Date("2035-06-10T11:00:00.000Z") : null,
            },
        })
        return id
    }
    async function attendance(suffix: string, sessionId: string, status: "ABSENT" | "LATE") {
        const id = q(`attendance_${suffix}`)
        await tx.cohortAttendance.create({ data: { id, sessionId, membershipId: mainMember, status } })
        return id
    }
    const heldAbsent = await attendance("held_absent", await session("held_absent", "HELD"), "ABSENT")
    const heldLate = await attendance("held_late", await session("held_late", "HELD"), "LATE")
    const scheduledAbsent = await attendance("scheduled_absent", await session("scheduled_absent", "SCHEDULED"), "ABSENT")

    const eligibleCertificate = q("certificate_eligible")
    const issuedCertificate = q("certificate_issued")
    await tx.cohortCertificate.create({ data: { id: eligibleCertificate, membershipId: certificateMember, state: "ELIGIBLE" } })
    await tx.cohortCertificate.create({
        data: { id: issuedCertificate, membershipId: issuedCertificateMember, state: "ISSUED", serial: q("serial"), issuedAt: new Date("2035-06-12T12:00:00.000Z") },
    })

    return {
        profileA: q("profile_a"),
        profileB: q("profile_b"),
        submitted,
        returned,
        accepted,
        completedMemberSubmission,
        cancelledCohortSubmission,
        heldAbsent,
        heldLate,
        scheduledAbsent,
        renewalScheduled,
        renewalReminded,
        renewalLapsed,
        renewalNone,
        renewalRenewed,
        renewalCancelled,
        completedMembership: completedMember,
        eligibleCertificate,
        issuedCertificate,
        tenantBSubmission,
    }
}

async function main() {
    const url = process.env.DATABASE_URL
    const dbName = parseDatabaseName(url)
    assertDisposableTarget(url)
    if (dbName !== AUTHORIZED_TARGET) {
        console.error(`ABORT: harness only runs against ${AUTHORIZED_TARGET}, got ${dbName}`)
        process.exit(1)
    }

    const source = readFileSync(join(APP_ROOT, "src/lib/cohorts/needs-action.ts"), "utf8")
    const code = executableSource(source)
    const queriedDelegates = [...code.matchAll(/db\.(cohort\w*)\.findMany\(/g)].map((match) => match[1]).sort()
    const declaredDelegates = COHORT_NEEDS_ACTION_COVERAGE.map(
        (model) => `${model[0].toLowerCase()}${model.slice(1)}`,
    ).sort()
    checkInvertible(
        "declared coverage matches every queried Prisma model",
        queriedDelegates.join(",") === declaredDelegates.join(",") && new Set(queriedDelegates).size === queriedDelegates.length,
        `declared=${declaredDelegates.join(",")} queried=${queriedDelegates.join(",")}`,
    )
    checkInvertible("cohort attention declares profile scope", COHORT_NEEDS_ACTION_SCOPE === "profile")
    checkInvertible("cohort attention emits the consumer-ready domain", COHORT_NEEDS_ACTION_DOMAIN === "cohortTasks")
    checkInvertible(
        "not-covered concerns are explicit and reasoned",
        Object.keys(COHORT_NEEDS_ACTION_NOT_COVERED).length >= 4 && Object.values(COHORT_NEEDS_ACTION_NOT_COVERED).every((reason) => reason.length > 60),
    )

    const forbidden = ["fetch(", "nodemailer", "resend", "stripe", "twilio", "scheduler", "mailer", "setinterval", "settimeout", "enqueue", "publish("]
    const foundForbidden = forbidden.filter((needle) => code.toLowerCase().includes(needle))
    checkInvertible(
        "executable lines contain no provider, scheduler or mailer identifier",
        foundForbidden.length === 0,
        foundForbidden.join(",") || `checked ${forbidden.length} identifiers after stripping comments`,
    )
    checkInvertible(
        "resolver contains no write or transaction call",
        !/\.(create|createMany|update|updateMany|delete|deleteMany|upsert)\(|\$transaction|\$executeRaw|\$queryRaw/.test(code),
    )

    checkInvertible("RETURNED is learner-owned according to the real transition table", submissionFlow.can("RETURNED", "SUBMITTED"))
    checkInvertible("LATE is credited by the real progress policy", ATTENDANCE_CREDITED.includes("LATE"))
    checkInvertible("SCHEDULED is not attendable according to the real session policy", !ATTENDABLE_SESSION_STATUSES.includes("SCHEDULED"))
    checkInvertible("ELIGIBLE can become ISSUED according to the real certificate flow", certificateFlow.can("ELIGIBLE", "ISSUED"))
    checkInvertible("LAPSED is a real renewal state that can re-enter scheduling", renewalFlow.can("LAPSED", "SCHEDULED"))
    checkInvertible("COMPLETED membership is terminal according to the real flow", membershipFlow.isTerminal("COMPLETED"))

    const prisma = new PrismaClient()
    const prefixLike = `${RUN}%`
    const before = await prisma.$queryRawUnsafe<Array<{ n: number }>>(
        `select count(*)::int n from "User" where "id" like $1`,
        prefixLike,
    )
    check("unique run prefix has no pre-existing residue", Number(before[0]?.n ?? -1) === 0, `rows=${before[0]?.n}`)

    try {
        await prisma.$transaction(async (tx) => {
            const ids = await seed(tx)
            const fixtureCounts = {
                submitted: await tx.cohortSubmission.count({ where: { id: ids.submitted, state: "SUBMITTED" } }),
                returned: await tx.cohortSubmission.count({ where: { id: ids.returned, state: "RETURNED" } }),
                heldAbsent: await tx.cohortAttendance.count({ where: { id: ids.heldAbsent, status: "ABSENT", session: { status: "HELD" } } }),
                heldLate: await tx.cohortAttendance.count({ where: { id: ids.heldLate, status: "LATE", session: { status: "HELD" } } }),
                scheduledAbsent: await tx.cohortAttendance.count({ where: { id: ids.scheduledAbsent, status: "ABSENT", session: { status: "SCHEDULED" } } }),
                tenantB: await tx.cohortSubmission.count({ where: { id: ids.tenantBSubmission, assignment: { cohort: { profileId: ids.profileB } } } }),
            }
            checkInvertible(
                "positive and negative fixtures materially exist before classification",
                Object.values(fixtureCounts).every((count) => count === 1),
                JSON.stringify(fixtureCounts),
            )

            const items = await resolveCohortNeedsAction(tx, ids.profileA, AS_OF)
            const itemIds = new Set(items.map((entry) => entry.id))
            const reasons = new Map(items.map((entry) => [entry.id, entry.reason] as const))

            checkInvertible("SUBMITTED assignment is positive owner work", itemIds.has(ids.submitted), reasons.get(ids.submitted) ?? "missing")
            checkInvertible("RETURNED assignment is negative because it went back to the learner", !itemIds.has(ids.returned))
            checkInvertible("HELD ABSENT is a positive finalized attendance exception", itemIds.has(ids.heldAbsent), reasons.get(ids.heldAbsent) ?? "missing")
            checkInvertible("HELD LATE is negative because late attendance receives credit", !itemIds.has(ids.heldLate))
            checkInvertible("SCHEDULED ABSENT is negative because the session has not happened", !itemIds.has(ids.scheduledAbsent))
            checkInvertible("SCHEDULED renewal is positive upcoming work", itemIds.has(ids.renewalScheduled))
            checkInvertible("REMINDED renewal is positive outstanding work", itemIds.has(ids.renewalReminded))
            checkInvertible("LAPSED renewal is positive and overdue", itemIds.has(ids.renewalLapsed) && items.find((entry) => entry.id === ids.renewalLapsed)?.overdue === true)
            checkInvertible("NONE renewal is negative", !itemIds.has(ids.renewalNone))
            checkInvertible("ELIGIBLE certificate is positive issuance work", itemIds.has(ids.eligibleCertificate))
            checkInvertible("ISSUED certificate is negative completed work", !itemIds.has(ids.issuedCertificate))

            const completedIds = [
                ids.accepted,
                ids.renewalRenewed,
                ids.renewalCancelled,
                ids.completedMembership,
                ids.cancelledCohortSubmission,
                ids.issuedCertificate,
            ]
            checkInvertible(
                "genuinely completed or cancelled work does not appear",
                completedIds.every((id) => !itemIds.has(id)),
                completedIds.filter((id) => itemIds.has(id)).join(",") || "all excluded",
            )
            checkInvertible(
                "completed-work exclusion has open controls that do appear",
                [ids.submitted, ids.renewalScheduled, ids.eligibleCertificate].every((id) => itemIds.has(id)),
            )
            checkInvertible("second tenant work never appears in tenant A", !itemIds.has(ids.tenantBSubmission))

            const tenantBItems = await resolveCohortNeedsAction(tx, ids.profileB, AS_OF)
            checkInvertible("second tenant fixture is independently visible in tenant B", tenantBItems.some((entry) => entry.id === ids.tenantBSubmission))
            checkInvertible("tenant B never sees tenant A's submitted assignment", !tenantBItems.some((entry) => entry.id === ids.submitted))

            throw new Rollback("deliberate whole-harness rollback")
        })
        check("whole-harness transaction deliberately rolled back", false, "transaction unexpectedly committed")
    } catch (error) {
        check("whole-harness transaction deliberately rolled back", error instanceof Rollback, String(error))
    } finally {
        const residue = await prisma.$queryRawUnsafe<Array<{ n: number }>>(
            `select count(*)::int n from "User" where "id" like $1`,
            prefixLike,
        )
        check("whole-harness rollback leaves zero database residue", Number(residue[0]?.n ?? -1) === 0, `rows=${residue[0]?.n}`)
        await prisma.$disconnect()
    }

    const failed = results.filter((result) => !result.pass)
    for (const result of results) {
        console.log(`${result.pass ? "PASS" : "FAIL"}  ${result.name}${result.detail ? `  (${result.detail})` : ""}`)
    }
    console.log(`\n${results.length - failed.length}/${results.length} assertions passed`)
    if (INVERT) console.log("INVERT_ASSERTION=1 was set - a non-zero exit is the expected proof")
    if (failed.length > 0) process.exit(1)
    console.log("Cohort needs-action declaration holds.")
}

main().catch((error) => {
    console.error(error)
    process.exit(1)
})

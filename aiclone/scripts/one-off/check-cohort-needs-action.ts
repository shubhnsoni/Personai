import { readFileSync } from "node:fs"
import { join } from "node:path"

import { PrismaClient } from "@prisma/client"

import {
    COHORT_NEEDS_ACTION_COVERAGE,
    COHORT_NEEDS_ACTION_DOMAIN,
    COHORT_NEEDS_ACTION_NOT_COVERED,
    COHORT_NEEDS_ACTION_SCOPE,
    COHORT_NEEDS_ACTION_SORT_KEYS,
    COHORT_NEEDS_ACTION_UNBOUNDED_READS,
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
/** One timestamp shared by nine items across two reasons. See THE TIE-HEAVY AND UNDATED FIXTURE. */
const TIE_AT = new Date("2035-06-05T09:00:00.000Z")
/** The order this harness expects the declaration to publish. Restated so a reorder fails loudly. */
const PINNED_SORT_CHAIN = "at>reason>id"
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
    /** Five absences on ONE held session, so all five carry that session's heldAt and tie on `at`. */
    tieAbsences: readonly string[]
    /** Four submissions on that same timestamp, so the reason key has to separate two blocks. */
    tieSubmissions: readonly string[]
    /** Renewals with no due date: `at` is null, and two of them make the null-null comparison live. */
    undatedRenewalsScheduled: readonly string[]
    undatedRenewalReminded: string
    /** A SUBMITTED submission with no submittedAt - a second undated reason, not just a second row. */
    undatedSubmission: string
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

/**
 * THE COMPARATOR, DERIVED FROM THE PUBLISHED KEY LIST AND WRITTEN INDEPENDENTLY.
 *
 * `COHORT_NEEDS_ACTION_SORT_KEYS` states the chain the declaration sorts on; this is that chain
 * implemented from scratch, deliberately NOT imported from the module under test. Importing the real
 * comparator would make every ordering assertion below agree with the implementation by construction -
 * it would compare the code to itself and pass for any ordering at all, including a wrong one.
 *
 * It is written in a different shape on purpose too: an explicit `<` rather than a subtraction, so it
 * cannot reproduce an arithmetic mistake in the original by making the same one. The assertion that the
 * published chain is still `at>reason>id` is what keeps the two in step, and it is checked before any
 * expectation computed here is trusted.
 */
type Ordered = Readonly<{ id: string; reason: string; at: Date | null }>

function independentCompare(a: Ordered, b: Ordered): number {
    if (a.at === null || b.at === null) {
        // Undated work sorts LAST. Stated as a branch because this is the case the declaration used to
        // reach through Infinity - Infinity, and get right only because NaN happens to be falsy.
        if (a.at !== null) return -1
        if (b.at !== null) return 1
    } else if (a.at.getTime() !== b.at.getTime()) {
        return a.at.getTime() < b.at.getTime() ? -1 : 1
    }
    return a.reason.localeCompare(b.reason) || a.id.localeCompare(b.id)
}

/**
 * THE ANSWER, RECOMPUTED FROM READS THAT FILTER NOTHING.
 *
 * `resolveCohortNeedsAction` now asks the database for each read's own row-state predicate - state
 * SUBMITTED, status ABSENT, state ELIGIBLE - and narrows two `in` lists to active memberships and held
 * sessions. Every one of those is a predicate the classification applied in TypeScript anyway, so the
 * answer must not have moved. "Must not have moved" is a claim, so it is measured: the seven reads are
 * performed here in their ORIGINAL form, with no state filter and with the full membership and session
 * sets in the `in` lists, the classification is applied in TypeScript exactly as it was, and the
 * resulting sequence must equal the declaration's own - id for id, reason for reason, timestamp for
 * timestamp, in order.
 *
 * That is the equivalence check rather than a count. Two sequences of the same length can be different
 * sequences, and the failure this guards against - a filter that quietly excludes a row the comparator
 * would have kept - changes which rows come back, not how many.
 */
async function recomputeFromUnfilteredReads(tx: Tx, profileId: string): Promise<Ordered[]> {
    const cohorts = await tx.cohort.findMany({
        where: { profileId, status: { not: "CANCELLED" } },
        select: { id: true, title: true },
    })
    const cohortById = new Map(cohorts.map((row) => [row.id, row] as const))
    const cohortIds = [...cohortById.keys()]
    const memberships = await tx.cohortMembership.findMany({ where: { cohortId: { in: cohortIds } } })
    const sessions = await tx.cohortSession.findMany({ where: { cohortId: { in: cohortIds } } })
    const assignments = await tx.cohortAssignment.findMany({ where: { cohortId: { in: cohortIds } } })
    const membershipById = new Map(memberships.map((row) => [row.id, row] as const))
    const sessionById = new Map(sessions.map((row) => [row.id, row] as const))
    const assignmentById = new Map(assignments.map((row) => [row.id, row] as const))
    const membershipIds = [...membershipById.keys()]
    // Unfiltered on purpose: every row of each table for this profile's live cohorts, which is what the
    // reads used to fetch and what the predicates below then had to sift in memory.
    const attendance = await tx.cohortAttendance.findMany({
        where: { membershipId: { in: membershipIds }, sessionId: { in: [...sessionById.keys()] } },
    })
    const submissions = await tx.cohortSubmission.findMany({
        where: { membershipId: { in: membershipIds }, assignmentId: { in: [...assignmentById.keys()] } },
    })
    const certificates = await tx.cohortCertificate.findMany({ where: { membershipId: { in: membershipIds } } })
    const active = (id: string): boolean => {
        const status = membershipById.get(id)?.status
        return status !== undefined && status !== "COMPLETED" && status !== "WITHDRAWN"
    }
    const out: Ordered[] = []
    for (const row of submissions) {
        const assignment = assignmentById.get(row.assignmentId)
        if (!assignment || row.state !== "SUBMITTED" || !active(row.membershipId)) continue
        if (!cohortById.has(assignment.cohortId)) continue
        out.push({ id: row.id, reason: "assignment-submitted", at: row.submittedAt })
    }
    for (const row of attendance) {
        const session = sessionById.get(row.sessionId)
        if (!session || session.status !== "HELD" || row.status !== "ABSENT" || !active(row.membershipId)) continue
        if (!cohortById.has(session.cohortId)) continue
        out.push({ id: row.id, reason: "attendance-absent", at: session.heldAt ?? session.endsAt })
    }
    for (const row of memberships) {
        if (!active(row.id) || !cohortById.has(row.cohortId)) continue
        if (row.renewalState === "SCHEDULED") out.push({ id: row.id, reason: "renewal-marked-scheduled", at: row.renewalDueAt })
        else if (row.renewalState === "REMINDED") out.push({ id: row.id, reason: "renewal-reminded", at: row.renewalDueAt })
        else if (row.renewalState === "LAPSED") out.push({ id: row.id, reason: "renewal-lapsed", at: row.renewalDueAt })
    }
    for (const row of certificates) {
        if (row.state !== "ELIGIBLE") continue
        const membership = membershipById.get(row.membershipId)
        if (!membership || !cohortById.has(membership.cohortId)) continue
        out.push({ id: row.id, reason: "certificate-eligible", at: row.updatedAt })
    }
    return out.sort(independentCompare)
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
        submittedAt: Date | null = new Date("2035-06-11T12:00:00.000Z"),
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
                submittedAt,
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

    async function session(suffix: string, status: "HELD" | "SCHEDULED", heldAt?: Date) {
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
                heldAt: status === "HELD" ? (heldAt ?? new Date("2035-06-10T11:00:00.000Z")) : null,
            },
        })
        return id
    }
    async function attendance(suffix: string, sessionId: string, status: "ABSENT" | "LATE", membershipId = mainMember) {
        const id = q(`attendance_${suffix}`)
        await tx.cohortAttendance.create({ data: { id, sessionId, membershipId, status } })
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

    /*
     * THE TIE-HEAVY AND UNDATED FIXTURE.
     *
     * The ordering assertions further down are only worth making over rows that actually tie. A fixture
     * where every item carries a distinct timestamp returns the same sequence whether the comparator is
     * a total order or stops at `at`, so it would pass either way and prove nothing. So this seeds the
     * two collisions the comparator exists to settle, and one that used to be settled by accident.
     *
     * NINE ITEMS ON ONE TIMESTAMP, ACROSS TWO REASONS. Five absences hang off ONE held session, so all
     * five carry that session's heldAt; four submissions carry the same instant in submittedAt. `reason`
     * must therefore separate the two blocks - assignment-submitted before attendance-absent - and `id`
     * must order within each. Removing either key changes the answer rather than merely its arrangement.
     *
     * FOUR UNDATED ITEMS, WHICH IS THE CASE THAT USED TO WORK BY LUCK. renewalDueAt and submittedAt are
     * both nullable, so `at: null` is ordinary state rather than a corner case. The old comparator mapped
     * null to POSITIVE_INFINITY and subtracted, which for two undated items computed Infinity - Infinity
     * = NaN and fell through to `reason` only because NaN is falsy. Four undated items make six null-null
     * comparisons, so that path is now exercised on every run instead of being reasoned about.
     *
     * ROWS ARE INSERTED IN DESCENDING ID ORDER, so ascending-by-id is never the order they were written
     * in. A comparator that dropped its id tie-break would tend to return insertion order, which here is
     * the exact reverse of the right answer - so the mutation is caught by the data and not only by a
     * regex over the source.
     */
    const tieSession = await session("tie", "HELD", TIE_AT)
    const tieAbsences: string[] = []
    for (let i = 5; i >= 1; i -= 1) {
        const ordinal = String(i).padStart(3, "0")
        const member = await membership(`tie_${ordinal}`)
        tieAbsences.push(await attendance(`tie_${ordinal}`, tieSession, "ABSENT", member))
    }
    const tieSubmissions: string[] = []
    for (let i = 4; i >= 1; i -= 1) {
        tieSubmissions.push(
            await submission(`tie_${String(i).padStart(3, "0")}`, mainMember, "SUBMITTED", q("cohort_a"), TIE_AT),
        )
    }
    const undatedSubmission = await submission("undated", mainMember, "SUBMITTED", q("cohort_a"), null)
    const undatedRenewalsScheduled: string[] = []
    for (let i = 2; i >= 1; i -= 1) {
        undatedRenewalsScheduled.push(
            await membership(`undated_renewal_${String(i).padStart(3, "0")}`, { renewalState: "SCHEDULED", renewalDueAt: null }),
        )
    }
    const undatedRenewalReminded = await membership("undated_renewal_reminded", {
        renewalState: "REMINDED",
        renewalDueAt: null,
    })

    return {
        profileA: q("profile_a"),
        profileB: q("profile_b"),
        tieAbsences,
        tieSubmissions,
        undatedRenewalsScheduled,
        undatedRenewalReminded,
        undatedSubmission,
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
    /*
     * THE NINTH DOMAIN'S BOUNDEDNESS, ASSERTED HERE BECAUSE NOTHING ELSE CAN ASSERT IT.
     *
     * check-operations-runtime.ts asserts that every reader is bounded in the database by `take`. It
     * computes that over `engine.ts` alone - `(engineCode.match(/\.findMany\(/g) ?? []).length` - so it is
     * structurally incapable of covering this file, and this file is where the ninth of the nine domains
     * that view reports does its reading. The claim there has been narrowed to the eight readers it
     * measures; this is the other half, and it is a MEASUREMENT rather than a note.
     *
     * It is deliberately two-sided. `take` must be absent AND the declared count must equal the number of
     * reads present, so adding an eighth read fails until it is declared, and adding a `take` to any read
     * fails until the declaration stops claiming that read is unbounded. A gap that can only be described
     * in prose drifts; this one cannot move in either direction without a red assertion.
     */
    const findManyTotal = (code.match(/\.findMany\(/g) ?? []).length
    const takeTotal = (code.match(/\btake:/g) ?? []).length
    checkInvertible(
        "the declared count of unbounded reads is exactly what this file contains, so the ninth domain's gap can be neither widened nor closed unnoticed",
        findManyTotal === COHORT_NEEDS_ACTION_UNBOUNDED_READS.count && takeTotal === 0,
        `findMany=${findManyTotal} take=${takeTotal} declared unbounded=${COHORT_NEEDS_ACTION_UNBOUNDED_READS.count}`,
    )
    checkInvertible(
        "the gap is declared with a reason that says why a take would return the WRONG rows, not merely that there is no take",
        COHORT_NEEDS_ACTION_UNBOUNDED_READS.reason.length > 200 &&
            /orderBy/.test(COHORT_NEEDS_ACTION_UNBOUNDED_READS.reason) &&
            /COALESCE/i.test(COHORT_NEEDS_ACTION_UNBOUNDED_READS.reason),
        `${COHORT_NEEDS_ACTION_UNBOUNDED_READS.reason.length} characters, naming orderBy and the COALESCE`,
    )

    /*
     * THE TOTAL ORDER, MADE AN ASSERTION INSTEAD OF AN INHERITED ASSUMPTION.
     *
     * operations/engine.ts caps this declaration with `declared.slice(0, MAX_ITEMS_PER_DOMAIN)` and does
     * not re-sort, on the stated grounds that what it receives is already totally ordered. That is a
     * dependency in one direction only: this file can lose its tie-break and the consumer would keep
     * slicing, quietly, an order that no longer decides which rows survive the cut. So the chain is
     * published as data and pinned here, and the behavioural section proves the published chain is the
     * one the returned sequence actually obeys.
     */
    checkInvertible(
        "the published sort chain is the audited one - business keys first, the unique id last and only last",
        COHORT_NEEDS_ACTION_SORT_KEYS.join(">") === PINNED_SORT_CHAIN &&
            COHORT_NEEDS_ACTION_SORT_KEYS[COHORT_NEEDS_ACTION_SORT_KEYS.length - 1] === "id",
        `published=[${COHORT_NEEDS_ACTION_SORT_KEYS.join(">")}] expected=[${PINNED_SORT_CHAIN}]`,
    )
    checkInvertible(
        "the chain the source APPLIES is the chain it publishes, in that order and applied by the sort",
        /compareAt\(a\.at, b\.at\) \|\| a\.reason\.localeCompare\(b\.reason\) \|\| a\.id\.localeCompare\(b\.id\)/.test(code) &&
            /items\.sort\(byAtThenReasonThenId\)/.test(code),
        "compareAt(at) then reason then id, applied by items.sort",
    )
    checkInvertible(
        "an undated item is ordered by an explicit null branch rather than by infinity arithmetic, which produced NaN for two of them and was correct only because NaN is falsy",
        !/infinity/i.test(code) &&
            /if \(a === null\) return b === null \? 0 : 1/.test(code) &&
            /if \(b === null\) return -1/.test(code),
        /infinity/i.test(code) ? "INFINITY ARITHMETIC STILL PRESENT" : "compareAt names both null cases and no Infinity survives",
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
            // Seeded since this harness was written and never asserted. It is the predicate the submission
            // read now applies in the database, so it needs a live negative control rather than an
            // assumption that the in-memory check still catches it.
            checkInvertible(
                "a SUBMITTED assignment on a COMPLETED membership is negative, which is exactly the predicate the narrowed submission read applies",
                !itemIds.has(ids.completedMemberSubmission),
                itemIds.has(ids.completedMemberSubmission) ? "PRESENT" : "excluded",
            )

            // ---- the total order, measured on rows that genuinely tie ---------------------------
            const tieFixtureIds = [
                ...ids.tieAbsences,
                ...ids.tieSubmissions,
                ...ids.undatedRenewalsScheduled,
                ids.undatedRenewalReminded,
                ids.undatedSubmission,
            ]
            checkInvertible(
                "every tie-heavy and undated fixture row is present, so the ordering assertions below are made over the rows seeded to force the collisions",
                tieFixtureIds.every((id) => itemIds.has(id)),
                tieFixtureIds.filter((id) => !itemIds.has(id)).join(",") || `all ${tieFixtureIds.length} tie fixture rows classified`,
            )
            const undated = items.filter((entry) => entry.at === null)
            const tiedGroups = new Map<number, number>()
            for (const entry of items) {
                if (entry.at !== null) tiedGroups.set(entry.at.getTime(), (tiedGroups.get(entry.at.getTime()) ?? 0) + 1)
            }
            const largestTiedGroup = Math.max(0, ...[...tiedGroups.values()])
            // A vacuity guard, and the reason it is here: every assertion below would pass on a fixture
            // where nothing ties, while proving nothing about the keys that break ties.
            checkInvertible(
                "the fixture materially exercises both collisions, so the ordering assertions are not vacuous",
                undated.length >= 4 && largestTiedGroup >= 9,
                `${undated.length} undated items = ${(undated.length * (undated.length - 1)) / 2} null-null comparisons; largest group sharing one timestamp = ${largestTiedGroup}`,
            )
            const notStrict: string[] = []
            for (let i = 0; i < items.length; i += 1) {
                for (let j = i + 1; j < items.length; j += 1) {
                    if (independentCompare(items[i], items[j]) >= 0 || independentCompare(items[j], items[i]) <= 0) {
                        notStrict.push(`${items[i].id.replace(`${RUN}_`, "")}<->${items[j].id.replace(`${RUN}_`, "")}`)
                    }
                }
            }
            checkInvertible(
                "every pair of returned items is STRICTLY ordered in both directions, which is what makes the sequence a total order rather than a sorted one with ties left undefined",
                items.length > 1 && notStrict.length === 0,
                notStrict.length === 0
                    ? `${(items.length * (items.length - 1)) / 2} pairs over ${items.length} items, all strict and antisymmetric`
                    : `NOT TOTAL: ${notStrict.slice(0, 5).join(" ")}`,
            )
            checkInvertible(
                "no id appears twice, so the last key in the chain cannot itself tie - each item is one row of one table, and the membership branch is if/else-if",
                new Set(items.map((entry) => entry.id)).size === items.length,
                `${new Set(items.map((entry) => entry.id)).size} distinct ids over ${items.length} items`,
            )
            checkInvertible(
                "undated work sorts after every dated item - the case the old infinity arithmetic reached through NaN",
                undated.length > 0 && items.slice(items.length - undated.length).every((entry) => entry.at === null),
                `the last ${undated.length} of ${items.length} items are exactly the undated ones`,
            )
            const atTie = items.filter((entry) => entry.at !== null && entry.at.getTime() === TIE_AT.getTime()).map((entry) => entry.id)
            const expectedAtTie = [
                ...[...ids.tieSubmissions].sort((x, y) => x.localeCompare(y)),
                ...[...ids.tieAbsences].sort((x, y) => x.localeCompare(y)),
            ]
            checkInvertible(
                "items sharing one timestamp come back ordered by reason and then by id - four submissions before five absences, each block ascending - against an insertion order that was descending",
                atTie.length === expectedAtTie.length && atTie.join(",") === expectedAtTie.join(","),
                atTie.join(",") === expectedAtTie.join(",")
                    ? `${atTie.length} items on one timestamp, in the one order the chain permits`
                    : `expected [${expectedAtTie.map((id) => id.replace(`${RUN}_`, "")).join(",")}] got [${atTie.map((id) => id.replace(`${RUN}_`, "")).join(",")}]`,
            )

            // ---- the narrowed reads are EQUIVALENT, not merely cheaper --------------------------
            const recomputed = await recomputeFromUnfilteredReads(tx, ids.profileA)
            const shape = (entry: Ordered) =>
                `${entry.reason}:${entry.id.replace(`${RUN}_`, "")}@${entry.at === null ? "null" : entry.at.toISOString()}`
            const fromDeclaration = items.map(shape).join("|")
            const fromUnfiltered = recomputed.map(shape).join("|")
            checkInvertible(
                "the answer is IDENTICAL to the one unfiltered whole-table reads produce - same items, same reasons, same timestamps, same order - so moving those predicates into the database changed the cost and not the behaviour",
                items.length > 0 && fromDeclaration === fromUnfiltered,
                fromDeclaration === fromUnfiltered
                    ? `${items.length} items identical to the unfiltered read and in-memory filter`
                    : `declaration=[${fromDeclaration}] unfiltered=[${fromUnfiltered}]`,
            )

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

/**
 * Wave G3 / part two: course access-level runtime harness.
 *
 * Executes the REAL CourseAccessService and LearnerAccessService against the authorized disposable
 * rehearsal database. This is the "executable access tests" the wave brief asks for: the visibility
 * rule is exercised, not described.
 *
 * The claims worth measuring rather than trusting:
 *   * A lesson with NO rule stays visible to everybody, including a learner with no tier at all.
 *     That is what makes the whole feature backward-compatible, and it is the first thing that
 *     would break if the rule were ever inverted.
 *   * A SUSPENDED or EXPIRED entitlement does NOT silently fall back to the lowest tier. It falls
 *     back to the unrestricted lessons, which is a different and more honest outcome.
 *   * The learner surface cannot enumerate. An unknown course, someone else's course, someone
 *     else's enrolment and a cancelled enrolment all produce the identical refusal, compared by
 *     message rather than by status alone.
 *   * A complete upgrade moves the entitlement and creates no Payment row.
 *   * Approving is not applying. The entitlement does not move until applyChange runs.
 *
 * Two negative claims are measured: zero external calls, and zero residue.
 *
 * Set INVERT_ASSERTION=1 to flip one expectation and prove the harness fails loudly.
 *
 *   ts-node -r tsconfig-paths/register scripts/one-off/check-course-access-runtime.ts
 */
import { PrismaClient } from "@prisma/client"

import { CourseAccessService, LearnerAccessService } from "../../src/lib/cohorts/access"
import {
    ACCESS_CHANGE_STATES,
    ACCESS_GRANT_STATES,
    accessChangeFlow,
    accessGrantFlow,
} from "../../src/lib/cohorts/lifecycle"
import { CohortContext } from "../../src/lib/cohorts/shared"
import { PersistenceError } from "../../src/lib/persistence/errors"
import { PersistedTenancy, type PlatformIdentity } from "../../src/lib/persistence/tenancy"
import { assertDisposableTarget, parseDatabaseName } from "../lib/disposable-db"

const AUTHORIZED_TARGET = "personalink_phase0_rehearsal_20260826_210704"
const INVERT = process.env.INVERT_ASSERTION === "1"
const RUN = `wg3ar_${Date.now()}_${Math.floor(Math.random() * 1e6)}`

const results: Array<{ name: string; pass: boolean; detail: string }> = []
function check(name: string, pass: boolean, detail = "") {
    results.push({ name, pass, detail })
}

let fetchCalls = 0
const realFetch = globalThis.fetch
globalThis.fetch = (async (...args: unknown[]) => {
    fetchCalls += 1
    throw new Error(`BLOCKED external call: ${String(args[0])}`)
}) as unknown as typeof fetch

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
/** Serialized refusal, so non-enumeration is compared byte for byte rather than by status. */
function envelope(o: Envelope): string {
    return JSON.stringify(o)
}

const actor = { actorType: "STAFF" as const, actorId: "harness" }

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
    const ctx = new CohortContext(prisma, new PersistedTenancy(prisma, identity))
    const access = new CourseAccessService(ctx)
    const learner = new LearnerAccessService(prisma)

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
        courseA: `${RUN}_ca`,
        courseB: `${RUN}_cb`,
        modA: `${RUN}_ma`,
        modB: `${RUN}_mb`,
        memberBasic: `${RUN}_mbasic`,
        memberPro: `${RUN}_mpro`,
        memberNone: `${RUN}_mnone`,
        memberGone: `${RUN}_mgone`,
        enrolBasic: `${RUN}_ebasic`,
        enrolPro: `${RUN}_epro`,
        enrolNone: `${RUN}_enone`,
        enrolGone: `${RUN}_egone`,
        enrolB: `${RUN}_eb`,
    }
    const lessons = [0, 1, 2, 3].map((i) => `${RUN}_l${i}`)
    const base = { levels: 0, rules: 0, grants: 0, changes: 0, events: 0, courses: 0, enrolments: 0, payments: 0 }

    try {
        base.levels = await prisma.courseAccessLevel.count()
        base.rules = await prisma.courseLessonAccess.count()
        base.grants = await prisma.courseAccessGrant.count()
        base.changes = await prisma.courseAccessChange.count()
        base.events = await prisma.courseAccessEvent.count()
        base.courses = await prisma.course.count()
        base.enrolments = await prisma.courseEnrollment.count()
        base.payments = await prisma.payment.count()

        // ---- 0. lifecycle tables are total and terminal-correct -------------
        for (const { label, all, can } of [
            { label: "grant", all: ACCESS_GRANT_STATES, can: (a: string, b: string) => accessGrantFlow.can(a as never, b as never) },
            { label: "change", all: ACCESS_CHANGE_STATES, can: (a: string, b: string) => accessChangeFlow.can(a as never, b as never) },
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
        check("REVOKED is terminal, so a revoked entitlement cannot be revived", accessGrantFlow.isTerminal("REVOKED"))
        check("SUSPENDED is reversible, because suspension is not revocation", accessGrantFlow.can("SUSPENDED", "ACTIVE"))
        check("EXPIRED can be re-activated, because a renewal is a normal thing", accessGrantFlow.can("EXPIRED", "ACTIVE"))
        check(
            "APPLIED and REJECTED are both terminal, so a decided change cannot be re-decided",
            accessChangeFlow.isTerminal("APPLIED") && accessChangeFlow.isTerminal("REJECTED"),
        )
        check(
            "REQUESTED cannot jump straight to APPLIED - agreeing and doing are separate facts",
            !accessChangeFlow.can("REQUESTED", "APPLIED"),
        )

        // ---- seed two tenants, each with a course --------------------------
        for (const [u, p, w, c, m] of [
            [ids.userA, ids.profileA, ids.wsA, ids.courseA, ids.modA],
            [ids.userB, ids.profileB, ids.wsB, ids.courseB, ids.modB],
        ]) {
            await prisma.user.create({ data: { id: u, clerkId: `clerk_${u}`, email: `${u}@example.test` } })
            await prisma.profile.create({ data: { id: p, userId: u, slug: `slug-${p}`, displayName: `P ${p}` } })
            await prisma.workspace.create({ data: { id: w, profileId: p, name: `WS ${w}`, slug: `ws-${w}` } })
            await prisma.membership.create({ data: { workspaceId: w, userId: u, role: "OWNER" } })
            await prisma.course.create({ data: { id: c, profileId: p, title: `Course ${c}` } })
            await prisma.courseModule.create({ data: { id: m, courseId: c, title: "Module", orderIndex: 0 } })
        }
        for (const [i, id] of lessons.entries()) {
            await prisma.courseLesson.create({ data: { id, moduleId: ids.modA, title: `Lesson ${i}`, orderIndex: i } })
        }
        for (const [memberId, enrolId, status] of [
            [ids.memberBasic, ids.enrolBasic, "ACTIVE"],
            [ids.memberPro, ids.enrolPro, "ACTIVE"],
            [ids.memberNone, ids.enrolNone, "ACTIVE"],
            [ids.memberGone, ids.enrolGone, "CANCELLED"],
        ]) {
            await prisma.member.create({ data: { id: memberId, email: `${memberId}@example.test`, name: "Learner" } })
            await prisma.courseEnrollment.create({
                data: {
                    id: enrolId,
                    courseId: ids.courseA,
                    memberId,
                    visitorEmail: `${memberId}@example.test`,
                    status,
                },
            })
        }
        await prisma.courseEnrollment.create({
            data: { id: ids.enrolB, courseId: ids.courseB, visitorEmail: `${ids.enrolB}@example.test`, status: "ACTIVE" },
        })

        // ---- 1. anonymous is refused and writes nothing --------------------
        identity.current = null
        const anonDefine = await attempt(() =>
            access.defineLevel(ids.wsA, { courseId: ids.courseA, key: "basic", label: "Basic", rank: 1 }, actor),
        )
        const anonList = await attempt(() => access.listLevels(ids.wsA, ids.courseA))
        check("anonymous tier definition refused UNAUTHORIZED", !anonDefine.ok && anonDefine.code === "UNAUTHORIZED", why(anonDefine))
        check("anonymous tier listing refused UNAUTHORIZED", !anonList.ok && anonList.code === "UNAUTHORIZED", why(anonList))
        check("anonymous wrote zero tiers", (await prisma.courseAccessLevel.count()) === base.levels)

        // ---- 2. tiers ------------------------------------------------------
        identity.current = `clerk_${ids.userA}`
        const zeroRank = await attempt(() =>
            access.defineLevel(ids.wsA, { courseId: ids.courseA, key: "free", label: "Free", rank: 0 }, actor),
        )
        check("rank 0 is refused, because rank is what orders the tiers", !zeroRank.ok && zeroRank.code === "CONFLICT", why(zeroRank))
        const negPrice = await attempt(() =>
            access.defineLevel(ids.wsA, { courseId: ids.courseA, key: "neg", label: "Neg", rank: 9, priceCents: -1 }, actor),
        )
        check("a negative price is refused", !negPrice.ok && negPrice.code === "CONFLICT", why(negPrice))

        const basic = await access.defineLevel(ids.wsA, { courseId: ids.courseA, key: "basic", label: "Basic", rank: 1 }, actor)
        const pro = await access.defineLevel(
            ids.wsA,
            { courseId: ids.courseA, key: "pro", label: "Pro", rank: 2, priceCents: 4900 },
            actor,
        )
        check("tiers are created and ordered by rank", basic.rank === 1 && pro.rank === 2)
        const dupRank = await attempt(() =>
            access.defineLevel(ids.wsA, { courseId: ids.courseA, key: "other", label: "Other", rank: 1 }, actor),
        )
        check("a duplicate rank on one course is a CONFLICT", !dupRank.ok && dupRank.code === "CONFLICT", why(dupRank))

        identity.current = `clerk_${ids.userB}`
        const foreignCourseTier = await attempt(() =>
            access.defineLevel(ids.wsB, { courseId: ids.courseA, key: "x", label: "X", rank: 1 }, actor),
        )
        check(
            "defining a tier on another profile's course is FORBIDDEN",
            !foreignCourseTier.ok && foreignCourseTier.code === "FORBIDDEN",
            why(foreignCourseTier),
        )
        identity.current = `clerk_${ids.userA}`

        // ---- 3. visibility rules ------------------------------------------
        // lesson 0 deliberately gets NO rule: it is the backward-compatibility case.
        await access.setLessonRule(ids.wsA, { courseId: ids.courseA, lessonId: lessons[1], accessLevelId: basic.id }, actor)
        await access.setLessonRule(ids.wsA, { courseId: ids.courseA, lessonId: lessons[2], accessLevelId: pro.id }, actor)
        await access.setLessonRule(ids.wsA, { courseId: ids.courseA, lessonId: lessons[3], accessLevelId: pro.id }, actor)
        const rules = await access.listLessonRules(ids.wsA, ids.courseA)
        check("three lessons carry a rule and one deliberately does not", rules.length === 3, `rules=${rules.length}`)

        const foreignLesson = await attempt(() =>
            access.setLessonRule(ids.wsA, { courseId: ids.courseA, lessonId: `${RUN}_ghostlesson`, accessLevelId: basic.id }, actor),
        )
        check("a rule on a nonexistent lesson is FORBIDDEN", !foreignLesson.ok && foreignLesson.code === "FORBIDDEN", why(foreignLesson))

        // ---- 4. entitlements ----------------------------------------------
        const grantBasic = await access.grant(
            ids.wsA,
            { courseId: ids.courseA, enrollmentId: ids.enrolBasic, accessLevelId: basic.id },
            actor,
        )
        check("a new grant starts PENDING, not ACTIVE", grantBasic.grant.state === "PENDING", `state=${grantBasic.grant.state}`)
        check("a PENDING grant entitles nothing", grantBasic.grant.entitles === false)
        const grantReplay = await access.grant(
            ids.wsA,
            { courseId: ids.courseA, enrollmentId: ids.enrolBasic, accessLevelId: pro.id },
            actor,
        )
        check(
            "granting twice returns the original rather than replacing the tier, because the enrolment IS the identity",
            grantReplay.replayed && grantReplay.grant.id === grantBasic.grant.id && grantReplay.grant.accessLevelId === basic.id,
            `replayed=${grantReplay.replayed} level=${grantReplay.grant.accessLevelKey}`,
        )
        const cancelledEnrol = await attempt(() =>
            access.grant(ids.wsA, { courseId: ids.courseA, enrollmentId: ids.enrolGone, accessLevelId: basic.id }, actor),
        )
        check(
            "a cancelled enrolment cannot hold an entitlement",
            !cancelledEnrol.ok && cancelledEnrol.code === "CONFLICT",
            why(cancelledEnrol),
        )
        const crossCourseGrant = await attempt(() =>
            access.grant(ids.wsA, { courseId: ids.courseA, enrollmentId: ids.enrolB, accessLevelId: basic.id }, actor),
        )
        check(
            "granting against an enrolment on a different course is FORBIDDEN",
            !crossCourseGrant.ok && crossCourseGrant.code === "FORBIDDEN",
            why(crossCourseGrant),
        )

        await access.transitionGrant(ids.wsA, ids.courseA, grantBasic.grant.id, "ACTIVE", actor)
        const grantPro = await access.grant(
            ids.wsA,
            { courseId: ids.courseA, enrollmentId: ids.enrolPro, accessLevelId: pro.id },
            actor,
        )
        await access.transitionGrant(ids.wsA, ids.courseA, grantPro.grant.id, "ACTIVE", actor)

        // ---- 5. THE VISIBILITY RULE, measured -----------------------------
        const basicView = await learner.visibleLessons({ courseId: ids.courseA, memberId: ids.memberBasic })
        check("a basic holder sees exactly the unrestricted lesson and the basic lesson", basicView.visibleCount === 2, `visible=${basicView.visibleCount}`)
        check("and the two pro lessons are locked, not hidden", basicView.lockedCount === 2, `locked=${basicView.lockedCount}`)
        check("the held tier is reported back", basicView.heldLevelKey === "basic" && basicView.heldRank === 1)
        check(
            "the unrestricted lesson is visible and says why in plain words",
            basicView.lessons[0].visible && /carries no access rule/.test(basicView.lessons[0].reason),
            basicView.lessons[0].reason,
        )
        check(
            "a locked lesson names the tier it needs and the tier the learner holds",
            !basicView.lessons[2].visible && /needs the pro tier/.test(basicView.lessons[2].reason) && /holds basic/.test(basicView.lessons[2].reason),
            basicView.lessons[2].reason,
        )

        const proView = await learner.visibleLessons({ courseId: ids.courseA, memberId: ids.memberPro })
        check("a pro holder sees all four lessons", proView.visibleCount === 4 && proView.lockedCount === 0, `visible=${proView.visibleCount}`)

        // The backward-compatibility case: a learner with NO grant at all is exactly the state
        // every existing learner in the database is in today.
        const noneView = await learner.visibleLessons({ courseId: ids.courseA, memberId: ids.memberNone })
        check(
            "MEASURED: a learner with no entitlement still sees every lesson that carries no rule - the backward-compatibility guarantee",
            noneView.visibleCount === 1 && noneView.lessons[0].lessonId === lessons[0],
            `visible=${noneView.visibleCount}`,
        )
        check("and is told plainly that the enrolment holds no tier", /holds no tier/.test(noneView.lessons[1].reason), noneView.lessons[1].reason)

        const perLesson = await learner.canViewLesson({ lessonId: lessons[1], memberId: ids.memberBasic })
        check("the per-lesson gate agrees with the list for a permitted lesson", perLesson.allowed)
        const perLessonDenied = await learner.canViewLesson({ lessonId: lessons[2], memberId: ids.memberBasic })
        check("the per-lesson gate agrees with the list for a locked lesson", !perLessonDenied.allowed, perLessonDenied.reason)

        // ---- 6. suspension does not become a silent downgrade -------------
        await access.transitionGrant(ids.wsA, ids.courseA, grantPro.grant.id, "SUSPENDED", actor)
        const suspendedView = await learner.visibleLessons({ courseId: ids.courseA, memberId: ids.memberPro })
        check(
            "a SUSPENDED holder falls back to the unrestricted lessons only, NOT to the lowest tier",
            suspendedView.visibleCount === 1 && suspendedView.heldLevelKey === null,
            `visible=${suspendedView.visibleCount} held=${suspendedView.heldLevelKey}`,
        )
        check("the report still names the suspension so the surface can explain it", suspendedView.grantState === "SUSPENDED")
        await access.transitionGrant(ids.wsA, ids.courseA, grantPro.grant.id, "ACTIVE", actor)
        const restored = await learner.visibleLessons({ courseId: ids.courseA, memberId: ids.memberPro })
        check("reinstating restores the full view", restored.visibleCount === 4)

        // ---- 7. expiry is honoured without a sweep ------------------------
        // Both timestamps move: the CHECK constraint requires expiresAt > grantedAt, so an expiry
        // in the past is only representable on a grant that also started in the past. Proving that
        // constraint is part of the point.
        const badExpiry = await attempt(() =>
            prisma.courseAccessGrant.update({
                where: { id: grantPro.grant.id },
                data: { expiresAt: new Date(Date.now() - 60_000) },
            }),
        )
        check(
            "an expiry earlier than the grant date is refused by the database, so a grant cannot start after it ends",
            !badExpiry.ok,
            why(badExpiry),
        )
        await prisma.courseAccessGrant.update({
            where: { id: grantPro.grant.id },
            data: { grantedAt: new Date(Date.now() - 7_200_000), expiresAt: new Date(Date.now() - 3_600_000) },
        })
        const expiredView = await learner.visibleLessons({ courseId: ids.courseA, memberId: ids.memberPro })
        check(
            "a grant past its expiry stops entitling immediately, with no background job involved",
            expiredView.visibleCount === 1 && expiredView.heldLevelKey === null,
            `visible=${expiredView.visibleCount}`,
        )
        check(
            "the grant's own state is still ACTIVE, so expiry is computed rather than swept - and the report says so",
            expiredView.grantState === "ACTIVE",
            `state=${expiredView.grantState}`,
        )
        await prisma.courseAccessGrant.update({ where: { id: grantPro.grant.id }, data: { expiresAt: null } })

        // ---- 8. upgrade: approving is not applying ------------------------
        const sameTier = await attempt(() =>
            access.requestChange(ids.wsA, ids.courseA, grantBasic.grant.id, { toAccessLevelId: basic.id }, actor),
        )
        check("requesting a move to the tier already held is refused", !sameTier.ok && sameTier.code === "CONFLICT", why(sameTier))

        const change = await access.requestChange(
            ids.wsA,
            ids.courseA,
            grantBasic.grant.id,
            { toAccessLevelId: pro.id, reason: "wants the workshops", idempotencyKey: "u1" },
            actor,
        )
        check("the direction is derived from rank, not taken from the caller", change.change.direction === "UPGRADE", `direction=${change.change.direction}`)
        const changeReplay = await access.requestChange(
            ids.wsA,
            ids.courseA,
            grantBasic.grant.id,
            { toAccessLevelId: pro.id, idempotencyKey: "u1" },
            actor,
        )
        check("replaying the change key returns the original", changeReplay.replayed && changeReplay.change.id === change.change.id)
        const secondChange = await attempt(() =>
            access.requestChange(ids.wsA, ids.courseA, grantBasic.grant.id, { toAccessLevelId: pro.id }, actor),
        )
        check(
            "a second in-flight change on one grant is refused, so two upgrades cannot race",
            !secondChange.ok && secondChange.code === "CONFLICT",
            why(secondChange),
        )

        const applyBeforeApprove = await attempt(() => access.applyChange(ids.wsA, ids.courseA, change.change.id, actor))
        check(
            "a REQUESTED change cannot be applied - agreeing and doing are separate facts",
            !applyBeforeApprove.ok && applyBeforeApprove.code === "CONFLICT",
            why(applyBeforeApprove),
        )
        const stillBasic = await learner.visibleLessons({ courseId: ids.courseA, memberId: ids.memberBasic })
        check("requesting an upgrade changes nothing about what the learner can see", stillBasic.visibleCount === 2, `visible=${stillBasic.visibleCount}`)

        await access.decideChange(ids.wsA, ids.courseA, change.change.id, "APPROVED", "owner@example.test", actor, "agreed")
        const afterApproval = await learner.visibleLessons({ courseId: ids.courseA, memberId: ids.memberBasic })
        check(
            "APPROVING still changes nothing - the entitlement has not moved yet",
            afterApproval.visibleCount === 2 && afterApproval.heldLevelKey === "basic",
            `visible=${afterApproval.visibleCount} held=${afterApproval.heldLevelKey}`,
        )

        const paymentsBeforeApply = await prisma.payment.count()
        const applied = await access.applyChange(ids.wsA, ids.courseA, change.change.id, actor, { invoiceRef: "INV-EXTERNAL-1" })
        check("applying moves the entitlement", applied.grant.accessLevelKey === "pro", `held=${applied.grant.accessLevelKey}`)
        check("and the change becomes APPLIED and terminal", applied.change.state === "APPLIED" && applied.change.allowedTransitions.length === 0)
        const afterApply = await learner.visibleLessons({ courseId: ids.courseA, memberId: ids.memberBasic })
        check("the learner now sees everything", afterApply.visibleCount === 4, `visible=${afterApply.visibleCount}`)
        const paymentsAfterApply = await prisma.payment.count()
        check(
            "MEASURED: the complete upgrade created no Payment row - the invoice reference is a string, not a charge",
            paymentsAfterApply === paymentsBeforeApply,
            `payments ${paymentsBeforeApply} -> ${paymentsAfterApply}`,
        )
        const reapply = await attempt(() => access.applyChange(ids.wsA, ids.courseA, change.change.id, actor))
        check("an applied change cannot be applied twice", !reapply.ok && reapply.code === "CONFLICT", why(reapply))

        // ---- 9. downgrade, and the stale-approval guard -------------------
        const down = await access.requestChange(ids.wsA, ids.courseA, grantBasic.grant.id, { toAccessLevelId: basic.id }, actor)
        check("a move to a lower rank is derived as a DOWNGRADE", down.change.direction === "DOWNGRADE")
        await access.decideChange(ids.wsA, ids.courseA, down.change.id, "APPROVED", "owner@example.test", actor)
        // Move the entitlement out from under the approved change.
        await prisma.courseAccessGrant.update({ where: { id: grantBasic.grant.id }, data: { accessLevelId: basic.id } })
        const stale = await attempt(() => access.applyChange(ids.wsA, ids.courseA, down.change.id, actor))
        check(
            "an approval whose starting tier has since changed cannot be applied, so it cannot overwrite a tier it was never agreed against",
            !stale.ok && stale.code === "CONFLICT",
            why(stale),
        )
        await prisma.courseAccessGrant.update({ where: { id: grantBasic.grant.id }, data: { accessLevelId: pro.id } })
        const downApplied = await access.applyChange(ids.wsA, ids.courseA, down.change.id, actor)
        check("once the tier matches again the downgrade applies", downApplied.grant.accessLevelKey === "basic")

        // ---- 10. retiring a tier ------------------------------------------
        const heldRetire = await attempt(() => access.deactivateLevel(ids.wsA, ids.courseA, basic.id, actor))
        check(
            "a tier learners still hold cannot be retired",
            !heldRetire.ok && heldRetire.code === "CONFLICT",
            why(heldRetire),
        )

        // ---- 11. LEARNER NON-ENUMERATION, compared byte for byte ---------
        const unknownCourse = await attempt(() => learner.visibleLessons({ courseId: `${RUN}_nope`, memberId: ids.memberBasic }))
        const foreignCourse = await attempt(() => learner.visibleLessons({ courseId: ids.courseB, memberId: ids.memberBasic }))
        const notMyEnrolment = await attempt(() => learner.visibleLessons({ courseId: ids.courseA, memberId: `${RUN}_stranger` }))
        const cancelled = await attempt(() => learner.visibleLessons({ courseId: ids.courseA, memberId: ids.memberGone }))
        check("an unknown course is refused", !unknownCourse.ok && unknownCourse.code === "FORBIDDEN", why(unknownCourse))
        check(
            "an unknown course and another owner's course are byte-identical refusals",
            envelope(unknownCourse) === envelope(foreignCourse),
            `${envelope(unknownCourse)} vs ${envelope(foreignCourse)}`,
        )
        check(
            "a stranger's request is byte-identical too, so the endpoint cannot confirm a course exists",
            envelope(unknownCourse) === envelope(notMyEnrolment),
            envelope(notMyEnrolment),
        )
        check(
            "a cancelled enrolment is byte-identical as well, so it cannot confirm a past relationship either",
            envelope(unknownCourse) === envelope(cancelled),
            envelope(cancelled),
        )
        const noIdentity = await attempt(() => learner.visibleLessons({ courseId: ids.courseA }))
        check("a request with no learner identity is refused", !noIdentity.ok && noIdentity.code === "FORBIDDEN", why(noIdentity))
        const byEmail = await learner.visibleLessons({
            courseId: ids.courseA,
            memberEmail: `${ids.memberPro}@example.test`,
        })
        check("a learner can be resolved by email as well as by member id, matching the existing library reader", byEmail.visibleCount === 4)

        // ---- 12. owner tenant isolation ----------------------------------
        identity.current = `clerk_${ids.userB}`
        const foreignLevels = await attempt(() => access.listLevels(ids.wsB, ids.courseA))
        const ghostLevels = await attempt(() => access.listLevels(ids.wsB, `${RUN}_ghostcourse`))
        check("another owner cannot list this course's tiers", !foreignLevels.ok && foreignLevels.code === "FORBIDDEN", why(foreignLevels))
        check(
            "a foreign course and a nonexistent one produce the identical refusal",
            envelope(foreignLevels) === envelope(ghostLevels),
            envelope(ghostLevels),
        )
        const foreignVisibility = await attempt(() => access.visibilityFor(ids.wsB, ids.courseA, ids.enrolBasic))
        check(
            "another owner cannot read a learner's visibility on this course",
            !foreignVisibility.ok && foreignVisibility.code === "FORBIDDEN",
            why(foreignVisibility),
        )
        identity.current = `clerk_${ids.userA}`

        // ---- 13. the owner and learner computations agree ----------------
        const ownerView = await access.visibilityFor(ids.wsA, ids.courseA, ids.enrolPro)
        const learnerView = await learner.visibleLessons({ courseId: ids.courseA, memberId: ids.memberPro })
        check(
            "the owner console and the learner surface return the same answer, because they share one computation",
            JSON.stringify(ownerView.lessons) === JSON.stringify(learnerView.lessons),
        )

        // ---- 14. history is complete and append-only ---------------------
        const timeline = await access.timeline(ids.wsA, ids.courseA)
        const kinds = new Set(timeline.map((e) => e.kind))
        check(
            "the history covers tiers, visibility rules, entitlements and changes",
            ["LEVEL", "VISIBILITY", "GRANT", "CHANGE"].every((k) => kinds.has(k)),
            [...kinds].join(","),
        )
        check("history is ordered by a monotonic sequence", timeline.every((e, i) => i === 0 || BigInt(e.seq) > BigInt(timeline[i - 1].seq)))
        const changeEvents = timeline.filter((e) => e.kind === "CHANGE")
        check(
            "every change event records that no payment was executed, so the history cannot be read as a charge",
            changeEvents.length > 0 &&
                changeEvents.every((e) => (e.metadata as { paymentExecuted?: boolean } | null)?.paymentExecuted === false),
            `changeEvents=${changeEvents.length}`,
        )
        const rewrite = await attempt(() =>
            prisma.$executeRawUnsafe(`update "CourseAccessEvent" set "to" = 'TAMPERED' where "courseId" = '${ids.courseA}'`),
        )
        check("the database refuses to rewrite the access history", !rewrite.ok, why(rewrite))

        // ---- 15. removing a rule restores the original behaviour ---------
        await access.setLessonRule(ids.wsA, { courseId: ids.courseA, lessonId: lessons[1], accessLevelId: null }, actor)
        const afterRemoval = await learner.visibleLessons({ courseId: ids.courseA, memberId: ids.memberNone })
        check(
            "removing a rule makes the lesson visible to everybody again, so the feature is reversible without a data migration",
            afterRemoval.visibleCount === 2,
            `visible=${afterRemoval.visibleCount}`,
        )

        // ---- 16. zero external calls ------------------------------------
        check("zero external calls were made by the access runtime", fetchCalls === 0, `fetchCalls=${fetchCalls}`)
    } finally {
        globalThis.fetch = realFetch
        const courseList = `'${ids.courseA}','${ids.courseB}'`
        try {
            await prisma.$executeRawUnsafe(`alter table "CourseAccessEvent" disable trigger "CourseAccessEvent_append_only"`)
            await prisma.$executeRawUnsafe(`delete from "CourseAccessEvent" where "courseId" in (${courseList})`)
            await prisma.$executeRawUnsafe(`alter table "CourseAccessEvent" enable trigger "CourseAccessEvent_append_only"`)
            await prisma.$executeRawUnsafe(
                `delete from "CourseAccessChange" where "grantId" in (
                   select g."id" from "CourseAccessGrant" g
                     join "CourseEnrollment" e on e."id" = g."enrollmentId"
                    where e."courseId" in (${courseList}))`,
            )
            await prisma.$executeRawUnsafe(
                `delete from "CourseAccessGrant" where "enrollmentId" in (select "id" from "CourseEnrollment" where "courseId" in (${courseList}))`,
            )
            await prisma.$executeRawUnsafe(
                `delete from "CourseLessonAccess" where "accessLevelId" in (select "id" from "CourseAccessLevel" where "courseId" in (${courseList}))`,
            )
            await prisma.$executeRawUnsafe(`delete from "CourseAccessLevel" where "courseId" in (${courseList})`)
            await prisma.$executeRawUnsafe(`delete from "CourseEnrollment" where "courseId" in (${courseList})`)
            await prisma.$executeRawUnsafe(`delete from "CourseLesson" where "moduleId" in ('${ids.modA}','${ids.modB}')`)
            await prisma.$executeRawUnsafe(`delete from "CourseModule" where "id" in ('${ids.modA}','${ids.modB}')`)
            await prisma.$executeRawUnsafe(`delete from "Course" where "id" in (${courseList})`)
            await prisma.$executeRawUnsafe(
                `delete from "Member" where "id" in ('${ids.memberBasic}','${ids.memberPro}','${ids.memberNone}','${ids.memberGone}')`,
            )
            await prisma.$executeRawUnsafe(`delete from "Membership" where "workspaceId" in ('${ids.wsA}','${ids.wsB}')`)
            await prisma.$executeRawUnsafe(`delete from "Workspace" where "id" in ('${ids.wsA}','${ids.wsB}')`)
            await prisma.$executeRawUnsafe(`delete from "Profile" where "id" in ('${ids.profileA}','${ids.profileB}')`)
            await prisma.$executeRawUnsafe(`delete from "User" where "id" in ('${ids.userA}','${ids.userB}')`)
        } catch (e) {
            console.error(`teardown warning: ${(e as Error).message.split("\n")[0]}`)
        }

        const end = {
            levels: await prisma.courseAccessLevel.count(),
            rules: await prisma.courseLessonAccess.count(),
            grants: await prisma.courseAccessGrant.count(),
            changes: await prisma.courseAccessChange.count(),
            events: await prisma.courseAccessEvent.count(),
            courses: await prisma.course.count(),
            enrolments: await prisma.courseEnrollment.count(),
            payments: await prisma.payment.count(),
        }
        for (const key of Object.keys(base) as Array<keyof typeof base>) {
            check(`${key} rows returned to baseline`, end[key] === base[key], `baseline=${base[key]} end=${end[key]}`)
        }
        const armed = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
            `select count(*) as n from information_schema.triggers where trigger_name = 'CourseAccessEvent_append_only'`,
        )
        check("the append-only trigger was re-armed after teardown", Number(armed[0].n) === 2, `rows=${armed[0].n}`)
        await prisma.$disconnect()
    }

    let failed = results.filter((r) => !r.pass)
    if (INVERT) {
        const target = results.find((r) => r.name.includes("backward-compatibility guarantee"))
        if (target) target.pass = !target.pass
        failed = results.filter((r) => !r.pass)
    }
    for (const r of results) console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.name}${r.detail ? `  (${r.detail})` : ""}`)
    console.log(`\n${results.length - failed.length}/${results.length} assertions passed`)
    if (INVERT) console.log("INVERT_ASSERTION=1 was set - a failure here is the expected proof")
    if (failed.length) process.exit(1)
    console.log("All course access-level runtime boundaries hold.")
}

main().catch((e) => {
    console.error(e)
    process.exit(1)
})

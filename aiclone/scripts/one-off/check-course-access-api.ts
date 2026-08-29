/**
 * Course access-level OWNER API harness (G3/G6 owner surface).
 *
 * Invokes the REAL CohortApiService — the same object the route files under
 * src/app/api/platform/course-access/** re-export — with a controlled identity, and asserts
 * status, envelope and body for every principal class.
 *
 * The engine already had its own harness (check-course-access-runtime). This one exists because
 * an engine that refuses correctly proves nothing about an HTTP boundary that forgets to ask.
 * The claims worth measuring rather than trusting:
 *
 *   * Two principals stay separate. The owner endpoints all sit behind the workspace tenancy
 *     bridge; the learner service is never reachable through them, and it still takes no
 *     workspaceId. That last one is asserted against the SOURCE, because the day someone adds
 *     the parameter the type checker will be perfectly happy.
 *   * A foreign resource and a nonexistent one are byte-identical, compared on the whole
 *     serialized response rather than on status alone.
 *   * `decidedBy` is server-derived. A body that names somebody else is ignored, not honoured.
 *   * Approving is not applying. The entitlement does not move until apply runs.
 *   * An unknown enum value is 400 and an illegal transition is 409, proved on the same field.
 *   * A decision endpoint accepts only APPROVED and REJECTED — naming APPLIED there would skip
 *     the apply step, so it must be a 400.
 *   * A replayed grant is a 200 replay of the same row, not a 409 and not a duplicate.
 *   * Refusals write nothing: no row, no event, no external call.
 *
 * Set INVERT_ASSERTION=1 to flip one expectation and prove the harness fails loudly.
 *
 *   ts-node -r tsconfig-paths/register scripts/one-off/check-course-access-api.ts
 */
import { PrismaClient } from "@prisma/client"
import { readFileSync } from "node:fs"
import { join } from "node:path"

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
const RUN = `wg6api_${Date.now()}_${Math.floor(Math.random() * 1e6)}`
const LEVELS = "http://127.0.0.1/api/platform/course-access/levels"
const RULES = "http://127.0.0.1/api/platform/course-access/lesson-rules"
const GRANTS = "http://127.0.0.1/api/platform/course-access/grants"
const CHANGES = "http://127.0.0.1/api/platform/course-access/changes"
const VISIBILITY = "http://127.0.0.1/api/platform/course-access/visibility"
const TIMELINE = "http://127.0.0.1/api/platform/course-access/timeline"
const COURSES = "http://127.0.0.1/api/platform/course-access/courses"
const CONSOLE = "http://127.0.0.1/api/platform/course-access/console"

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
const del = (url: string) => new Request(url, { method: "DELETE" })

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
        userA: `${RUN}_ua`,
        userB: `${RUN}_ub`,
        userC: `${RUN}_uc`,
        profileA: `${RUN}_pa`,
        profileB: `${RUN}_pb`,
        wsA: `${RUN}_wa`,
        wsB: `${RUN}_wb`,
        courseA: `${RUN}_ca`,
        courseB: `${RUN}_cb`,
        modA: `${RUN}_moda`,
        lessonFree: `${RUN}_lfree`,
        lessonGated: `${RUN}_lgated`,
        enrolA: `${RUN}_ea`,
        enrolB: `${RUN}_eb`,
    }
    const profileList = `'${ids.profileA}','${ids.profileB}'`
    const base = { levels: 0, grants: 0, changes: 0, events: 0, rules: 0, payments: 0 }
    let basicId = ""
    let proId = ""
    let spareId = ""
    let grantId = ""
    let changeId = ""

    try {
        base.levels = await prisma.courseAccessLevel.count()
        base.grants = await prisma.courseAccessGrant.count()
        base.changes = await prisma.courseAccessChange.count()
        base.events = await prisma.courseAccessEvent.count()
        base.rules = await prisma.courseLessonAccess.count()
        base.payments = await prisma.payment.count()

        // ---- seed: two tenants plus a provisioned user with no membership ----
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
        await prisma.user.create({
            data: { id: ids.userC, clerkId: `clerk_${ids.userC}`, email: `${ids.userC}@example.test` },
        })
        await prisma.courseModule.create({ data: { id: ids.modA, courseId: ids.courseA, title: "Module 1" } })
        await prisma.courseLesson.create({
            data: { id: ids.lessonFree, moduleId: ids.modA, title: "Intro", orderIndex: 0 },
        })
        await prisma.courseLesson.create({
            data: { id: ids.lessonGated, moduleId: ids.modA, title: "Deep dive", orderIndex: 1 },
        })
        await prisma.courseEnrollment.create({
            data: { id: ids.enrolA, courseId: ids.courseA, visitorEmail: "a@learner.test", status: "ACTIVE" },
        })
        await prisma.courseEnrollment.create({
            data: { id: ids.enrolB, courseId: ids.courseB, visitorEmail: "b@learner.test", status: "ACTIVE" },
        })

        // ---- 1. anonymous: 401 on every endpoint, zero writes -------------
        identity.current = null
        const beforeLevels = await prisma.courseAccessLevel.count()
        const beforeEvents = await prisma.courseAccessEvent.count()
        const anonFetch = fetchCalls
        const q = `workspaceId=${ids.wsA}&courseId=${ids.courseA}`
        const anon = {
            listLevels: await call(api.listAccessLevels(get(`${LEVELS}?${q}`))),
            defineLevel: await call(
                api.defineAccessLevel(
                    send(LEVELS, { workspaceId: ids.wsA, courseId: ids.courseA, key: "basic", label: "Basic", rank: 1 }),
                ),
            ),
            retireLevel: await call(api.retireAccessLevel("whatever", del(`${LEVELS}/whatever?${q}`))),
            listRules: await call(api.listAccessLessonRules(get(`${RULES}?${q}`))),
            setRule: await call(
                api.setAccessLessonRule(
                    send(
                        RULES,
                        { workspaceId: ids.wsA, courseId: ids.courseA, lessonId: ids.lessonGated, accessLevelId: null },
                        "PUT",
                    ),
                ),
            ),
            getGrant: await call(api.getAccessGrant(get(`${GRANTS}?${q}&enrollmentId=${ids.enrolA}`))),
            createGrant: await call(
                api.createAccessGrant(
                    send(GRANTS, {
                        workspaceId: ids.wsA,
                        courseId: ids.courseA,
                        enrollmentId: ids.enrolA,
                        accessLevelId: "whatever",
                    }),
                ),
            ),
            transitionGrant: await call(
                api.transitionAccessGrant(
                    "whatever",
                    send(`${GRANTS}/whatever`, { workspaceId: ids.wsA, courseId: ids.courseA, state: "ACTIVE" }, "PATCH"),
                ),
            ),
            listChanges: await call(api.listAccessChanges("whatever", get(`${GRANTS}/whatever/changes?${q}`))),
            requestChange: await call(
                api.requestAccessChange(
                    "whatever",
                    send(`${GRANTS}/whatever/changes`, {
                        workspaceId: ids.wsA,
                        courseId: ids.courseA,
                        toAccessLevelId: "whatever",
                    }),
                ),
            ),
            decideChange: await call(
                api.decideAccessChange(
                    "whatever",
                    send(
                        `${CHANGES}/whatever`,
                        { workspaceId: ids.wsA, courseId: ids.courseA, decision: "APPROVED" },
                        "PATCH",
                    ),
                ),
            ),
            applyChange: await call(
                api.applyAccessChange(
                    "whatever",
                    send(`${CHANGES}/whatever/apply`, { workspaceId: ids.wsA, courseId: ids.courseA }),
                ),
            ),
            visibility: await call(api.accessVisibility(get(`${VISIBILITY}?${q}&enrollmentId=${ids.enrolA}`))),
            timeline: await call(api.accessTimeline(get(`${TIMELINE}?${q}`))),
            courses: await call(api.listAccessCourses(get(`${COURSES}?workspaceId=${ids.wsA}`))),
            board: await call(api.accessConsole(get(`${CONSOLE}?${q}`))),
        }
        const notUnauthorized = Object.entries(anon)
            .filter(([, v]) => v.status !== 401)
            .map(([k, v]) => `${k}=${v.status}`)
        check(
            `anonymous is 401 on all ${Object.keys(anon).length} access endpoints`,
            notUnauthorized.length === 0,
            notUnauthorized.join(" ") || "all 401",
        )
        check("anonymous refusal wrote zero tiers", beforeLevels === (await prisma.courseAccessLevel.count()), `before=${beforeLevels}`)
        check("anonymous refusal appended zero access events", beforeEvents === (await prisma.courseAccessEvent.count()), `before=${beforeEvents}`)
        check("anonymous refusal made zero external calls", fetchCalls === anonFetch, `calls=${fetchCalls - anonFetch}`)
        check(
            "anonymous body is an error envelope with no data key",
            pick(anon.listLevels.body, "ok") === false && pick(anon.listLevels.body, "data") === undefined,
            anon.listLevels.text.slice(0, 90),
        )

        // ---- 2. a signed-in user with no membership is refused ------------
        identity.current = `clerk_${ids.userC}`
        const outsider = await call(api.listAccessLevels(get(`${LEVELS}?${q}`)))
        const outsiderWrite = await call(
            api.defineAccessLevel(
                send(LEVELS, { workspaceId: ids.wsA, courseId: ids.courseA, key: "x", label: "X", rank: 9 }),
            ),
        )
        check("a signed-in outsider cannot read tiers", outsider.status === 403, `status=${outsider.status}`)
        check("a signed-in outsider cannot define a tier", outsiderWrite.status === 403, `status=${outsiderWrite.status}`)
        check("outsider refusal wrote zero tiers", beforeLevels === (await prisma.courseAccessLevel.count()), `n=${await prisma.courseAccessLevel.count()}`)

        // ---- 3. the owner defines tiers -----------------------------------
        identity.current = `clerk_${ids.userA}`
        const basic = await call(
            api.defineAccessLevel(
                send(LEVELS, {
                    workspaceId: ids.wsA,
                    courseId: ids.courseA,
                    key: "basic",
                    label: "Basic",
                    rank: 1,
                    priceCents: 0,
                }),
            ),
        )
        basicId = pickString(basic.body, "data", "level", "id")
        const pro = await call(
            api.defineAccessLevel(
                send(LEVELS, {
                    workspaceId: ids.wsA,
                    courseId: ids.courseA,
                    key: "pro",
                    label: "Pro",
                    rank: 2,
                    priceCents: 4900,
                    description: "  everything  ",
                }),
            ),
        )
        proId = pickString(pro.body, "data", "level", "id")
        const spare = await call(
            api.defineAccessLevel(
                send(LEVELS, { workspaceId: ids.wsA, courseId: ids.courseA, key: "spare", label: "Spare", rank: 3 }),
            ),
        )
        spareId = pickString(spare.body, "data", "level", "id")
        check("defining a tier is 201", basic.status === 201 && pro.status === 201, `${basic.status}/${pro.status}`)
        check("a defined tier comes back with an id", basicId !== "" && proId !== "", `${basicId}|${proId}`)
        check("description is trimmed by the engine", pickString(pro.body, "data", "level", "description") === "everything", pickString(pro.body, "data", "level", "description"))
        check("currency defaults rather than being invented by the caller", pickString(pro.body, "data", "level", "currency") === "USD", pickString(pro.body, "data", "level", "currency"))

        const dupKey = await call(
            api.defineAccessLevel(
                send(LEVELS, { workspaceId: ids.wsA, courseId: ids.courseA, key: "basic", label: "Dup", rank: 7 }),
            ),
        )
        const dupRank = await call(
            api.defineAccessLevel(
                send(LEVELS, { workspaceId: ids.wsA, courseId: ids.courseA, key: "other", label: "Other", rank: 1 }),
            ),
        )
        check("a duplicate tier key is 409 not 500", dupKey.status === 409, `status=${dupKey.status}`)
        check("a duplicate tier rank is 409 not 500", dupRank.status === 409, `status=${dupRank.status}`)

        // A non-integer rank is a malformed request; a zero rank is a well-formed request the
        // domain refuses. Collapsing them would leave an owner unable to tell a typo from a rule.
        const rankType = await call(
            api.defineAccessLevel(
                send(LEVELS, { workspaceId: ids.wsA, courseId: ids.courseA, key: "k1", label: "K", rank: "two" }),
            ),
        )
        const rankZero = await call(
            api.defineAccessLevel(
                send(LEVELS, { workspaceId: ids.wsA, courseId: ids.courseA, key: "k2", label: "K", rank: 0 }),
            ),
        )
        check("a non-integer rank is 400", rankType.status === 400, `status=${rankType.status}`)
        check("a zero rank is 409, distinct from the 400", rankZero.status === 409, `status=${rankZero.status}`)
        check("a negative price is refused", (await call(api.defineAccessLevel(send(LEVELS, { workspaceId: ids.wsA, courseId: ids.courseA, key: "k3", label: "K", rank: 8, priceCents: -1 })))).status === 409, "priceCents=-1")

        const levelList = await call(api.listAccessLevels(get(`${LEVELS}?${q}`)))
        const ranks = pickArray(levelList.body, "data", "levels").map((l) => pickNumber(l, "rank"))
        check("tiers list back in rank order", ranks.length === 3 && ranks.every((v, i) => i === 0 || v > ranks[i - 1]), `ranks=${ranks.join(",")}`)

        // ---- 4. lesson visibility rules ----------------------------------
        const setRule = await call(
            api.setAccessLessonRule(
                send(RULES, { workspaceId: ids.wsA, courseId: ids.courseA, lessonId: ids.lessonGated, accessLevelId: proId }, "PUT"),
            ),
        )
        check("attaching a rule to a lesson succeeds", setRule.status === 200, `status=${setRule.status}`)
        const ruleList = await call(api.listAccessLessonRules(get(`${RULES}?${q}`)))
        check(
            "the rule lists with the lesson title and required rank",
            pickArray(ruleList.body, "data", "rules").length === 1 &&
                pickString(pickArray(ruleList.body, "data", "rules")[0], "lessonTitle") === "Deep dive" &&
                pickNumber(pickArray(ruleList.body, "data", "rules")[0], "requiredRank") === 2,
            JSON.stringify(pickArray(ruleList.body, "data", "rules")[0] ?? {}).slice(0, 120),
        )
        // Null is meaningful, so it must round-trip as a removal rather than be ignored.
        const clearRule = await call(
            api.setAccessLessonRule(
                send(RULES, { workspaceId: ids.wsA, courseId: ids.courseA, lessonId: ids.lessonGated, accessLevelId: null }, "PUT"),
            ),
        )
        const clearedList = await call(api.listAccessLessonRules(get(`${RULES}?${q}`)))
        check("passing accessLevelId null removes the rule", clearRule.status === 200 && pickArray(clearedList.body, "data", "rules").length === 0, `n=${pickArray(clearedList.body, "data", "rules").length}`)
        // Put it back, because the visibility assertions below need a gated lesson.
        await call(
            api.setAccessLessonRule(
                send(RULES, { workspaceId: ids.wsA, courseId: ids.courseA, lessonId: ids.lessonGated, accessLevelId: proId }, "PUT"),
            ),
        )
        const foreignLesson = await call(
            api.setAccessLessonRule(
                send(RULES, { workspaceId: ids.wsA, courseId: ids.courseA, lessonId: `${RUN}_nope`, accessLevelId: proId }, "PUT"),
            ),
        )
        check("a lesson outside the course cannot be given a rule", foreignLesson.status === 403, `status=${foreignLesson.status}`)

        // ---- 5. entitlement grants ---------------------------------------
        const granted = await call(
            api.createAccessGrant(
                send(GRANTS, {
                    workspaceId: ids.wsA,
                    courseId: ids.courseA,
                    enrollmentId: ids.enrolA,
                    accessLevelId: basicId,
                    source: "MANUAL",
                }),
            ),
        )
        grantId = pickString(granted.body, "data", "grant", "id")
        check("granting a tier is 201", granted.status === 201, `status=${granted.status}`)
        check("a new grant is not reported as a replay", pick(granted.body, "data", "replayed") === false, String(pick(granted.body, "data", "replayed")))
        check(
            "the grant carries server-computed allowedTransitions",
            pickArray(granted.body, "data", "grant", "allowedTransitions").length > 0,
            JSON.stringify(pick(granted.body, "data", "grant", "allowedTransitions")),
        )
        check(
            "the grant reports entitles as a computed boolean",
            typeof pick(granted.body, "data", "grant", "entitles") === "boolean",
            String(pick(granted.body, "data", "grant", "entitles")),
        )

        // One grant per enrolment, so the second ask is the same row reported as a replay.
        const replay = await call(
            api.createAccessGrant(
                send(GRANTS, {
                    workspaceId: ids.wsA,
                    courseId: ids.courseA,
                    enrollmentId: ids.enrolA,
                    accessLevelId: basicId,
                }),
            ),
        )
        check("a repeated grant is a 200 replay, not a 409", replay.status === 200, `status=${replay.status}`)
        check("the replay is flagged and returns the same row", pick(replay.body, "data", "replayed") === true && pickString(replay.body, "data", "grant", "id") === grantId, `${pick(replay.body, "data", "replayed")} ${pickString(replay.body, "data", "grant", "id")}`)
        check("the replay created no second grant row", (await prisma.courseAccessGrant.count({ where: { enrollmentId: ids.enrolA } })) === 1, "one grant")

        const badSource = await call(
            api.createAccessGrant(
                send(GRANTS, {
                    workspaceId: ids.wsA,
                    courseId: ids.courseA,
                    enrollmentId: ids.enrolA,
                    accessLevelId: basicId,
                    source: "GIFT",
                }),
            ),
        )
        check("an unknown grant source is 400", badSource.status === 400, `status=${badSource.status}`)

        // A tier from another course must not be grantable onto this enrolment.
        identity.current = `clerk_${ids.userB}`
        const foreignTier = await call(
            api.createAccessGrant(
                send(GRANTS, {
                    workspaceId: ids.wsB,
                    courseId: ids.courseB,
                    enrollmentId: ids.enrolB,
                    accessLevelId: basicId,
                }),
            ),
        )
        check("a tier from another owner's course cannot be granted", foreignTier.status === 403, `status=${foreignTier.status}`)
        identity.current = `clerk_${ids.userA}`

        // ---- 6. grant state machine --------------------------------------
        const unknownState = await call(
            api.transitionAccessGrant(
                grantId,
                send(`${GRANTS}/${grantId}`, { workspaceId: ids.wsA, courseId: ids.courseA, state: "PARTIALLY_ON" }, "PATCH"),
            ),
        )
        check("an unknown grant state is 400", unknownState.status === 400, `status=${unknownState.status}`)
        const activated = await call(
            api.transitionAccessGrant(
                grantId,
                send(`${GRANTS}/${grantId}`, { workspaceId: ids.wsA, courseId: ids.courseA, state: "ACTIVE" }, "PATCH"),
            ),
        )
        check("a legal grant transition succeeds", activated.status === 200 && pickString(activated.body, "data", "grant", "state") === "ACTIVE", `${activated.status} ${pickString(activated.body, "data", "grant", "state")}`)
        check("an active grant entitles", pick(activated.body, "data", "grant", "entitles") === true, String(pick(activated.body, "data", "grant", "entitles")))
        const illegal = await call(
            api.transitionAccessGrant(
                grantId,
                send(`${GRANTS}/${grantId}`, { workspaceId: ids.wsA, courseId: ids.courseA, state: "PENDING" }, "PATCH"),
            ),
        )
        check("an illegal grant transition is 409, distinct from the 400", illegal.status === 409, `status=${illegal.status}`)

        // ---- 7. owner visibility view ------------------------------------
        const vis = await call(api.accessVisibility(get(`${VISIBILITY}?${q}&enrollmentId=${ids.enrolA}`)))
        check("the owner can read the computed visibility report", vis.status === 200, `status=${vis.status}`)
        check(
            "an unruled lesson is visible and a gated lesson above the held tier is not",
            pickArray(vis.body, "data", "visibility", "lessons").length === 2 &&
                pickNumber(vis.body, "data", "visibility", "visibleCount") === 1 &&
                pickNumber(vis.body, "data", "visibility", "lockedCount") === 1,
            `visible=${pickNumber(vis.body, "data", "visibility", "visibleCount")} locked=${pickNumber(vis.body, "data", "visibility", "lockedCount")}`,
        )
        check("every lesson states a reason rather than leaving the UI to guess", pickArray(vis.body, "data", "visibility", "lessons").every((l) => pickString(l, "reason") !== ""), "reasons present")

        // ---- 8. upgrade: request, decide, apply --------------------------
        const requested = await call(
            api.requestAccessChange(
                grantId,
                send(`${GRANTS}/${grantId}/changes`, {
                    workspaceId: ids.wsA,
                    courseId: ids.courseA,
                    toAccessLevelId: proId,
                    reason: "learner asked to upgrade",
                    idempotencyKey: `${RUN}_idem`,
                }),
            ),
        )
        changeId = pickString(requested.body, "data", "change", "id")
        check("requesting a tier change is 201", requested.status === 201, `status=${requested.status}`)
        check("the direction is derived from the ranks, not the caller", pickString(requested.body, "data", "change", "direction") === "UPGRADE", pickString(requested.body, "data", "change", "direction"))
        const requestReplay = await call(
            api.requestAccessChange(
                grantId,
                send(`${GRANTS}/${grantId}/changes`, {
                    workspaceId: ids.wsA,
                    courseId: ids.courseA,
                    toAccessLevelId: proId,
                    idempotencyKey: `${RUN}_idem`,
                }),
            ),
        )
        check("the same idempotency key replays rather than duplicating", requestReplay.status === 200 && pick(requestReplay.body, "data", "replayed") === true && pickString(requestReplay.body, "data", "change", "id") === changeId, `${requestReplay.status} ${pick(requestReplay.body, "data", "replayed")}`)

        // APPLIED is a real lifecycle state but it is NOT a decision. Accepting it here would let
        // a caller skip the apply step that actually moves the entitlement.
        const notADecision = await call(
            api.decideAccessChange(
                changeId,
                send(`${CHANGES}/${changeId}`, { workspaceId: ids.wsA, courseId: ids.courseA, decision: "APPLIED" }, "PATCH"),
            ),
        )
        check("APPLIED is rejected as a decision with 400", notADecision.status === 400, `status=${notADecision.status}`)

        // decidedBy must come from the session. A body that names somebody else is ignored.
        const decided = await call(
            api.decideAccessChange(
                changeId,
                send(
                    `${CHANGES}/${changeId}`,
                    {
                        workspaceId: ids.wsA,
                        courseId: ids.courseA,
                        decision: "APPROVED",
                        note: "approved after settling up offline",
                        decidedBy: "somebody-else",
                    },
                    "PATCH",
                ),
            ),
        )
        check("approving succeeds", decided.status === 200 && pickString(decided.body, "data", "change", "state") === "APPROVED", `${decided.status} ${pickString(decided.body, "data", "change", "state")}`)
        check(
            "decidedBy is the server session, not the body field",
            pickString(decided.body, "data", "change", "decidedBy") === `clerk_${ids.userA}`,
            pickString(decided.body, "data", "change", "decidedBy"),
        )

        // Approving is not applying.
        const midGrant = await call(api.getAccessGrant(get(`${GRANTS}?${q}&enrollmentId=${ids.enrolA}`)))
        check(
            "approving a change does NOT move the entitlement",
            pickString(midGrant.body, "data", "grant", "accessLevelId") === basicId,
            pickString(midGrant.body, "data", "grant", "accessLevelId"),
        )

        const paymentsBeforeApply = await prisma.payment.count()
        const applied = await call(
            api.applyAccessChange(
                changeId,
                send(`${CHANGES}/${changeId}/apply`, {
                    workspaceId: ids.wsA,
                    courseId: ids.courseA,
                    invoiceRef: "INV-OFFLINE-1",
                }),
            ),
        )
        check("applying an approved change succeeds", applied.status === 200, `status=${applied.status}`)
        check("applying moves the entitlement to the new tier", pickString(applied.body, "data", "grant", "accessLevelId") === proId, pickString(applied.body, "data", "grant", "accessLevelId"))
        check("applying marks the change APPLIED", pickString(applied.body, "data", "change", "state") === "APPLIED", pickString(applied.body, "data", "change", "state"))
        check("applying an upgrade created no Payment row", (await prisma.payment.count()) === paymentsBeforeApply, `before=${paymentsBeforeApply} after=${await prisma.payment.count()}`)
        const reapply = await call(
            api.applyAccessChange(
                changeId,
                send(`${CHANGES}/${changeId}/apply`, { workspaceId: ids.wsA, courseId: ids.courseA }),
            ),
        )
        check("applying twice is 409, not a second move", reapply.status === 409, `status=${reapply.status}`)

        const afterUpgrade = await call(api.accessVisibility(get(`${VISIBILITY}?${q}&enrollmentId=${ids.enrolA}`)))
        check(
            "after the upgrade the gated lesson becomes visible",
            pickNumber(afterUpgrade.body, "data", "visibility", "visibleCount") === 2,
            `visible=${pickNumber(afterUpgrade.body, "data", "visibility", "visibleCount")}`,
        )

        const changeList = await call(api.listAccessChanges(grantId, get(`${GRANTS}/${grantId}/changes?${q}`)))
        check("the change history lists for the grant", pickArray(changeList.body, "data", "changes").length === 1, `n=${pickArray(changeList.body, "data", "changes").length}`)

        // ---- 8b. the console reads the owner UI depends on ----------------
        // The rule editor needs the lessons that have NO rule. /lesson-rules cannot supply them
        // by design, so if the console ever stops returning them the editor silently loses the
        // ability to add a first rule.
        const courseList = await call(api.listAccessCourses(get(`${COURSES}?workspaceId=${ids.wsA}`)))
        check("the owner can list the courses tiers attach to", courseList.status === 200, `status=${courseList.status}`)
        const listedCourse = pickArray(courseList.body, "data", "courses").find((c) => pickString(c, "id") === ids.courseA)
        check(
            "the course list counts lessons and enrolments from the rows",
            pickNumber(listedCourse, "lessonCount") === 2 && pickNumber(listedCourse, "enrollmentCount") === 1,
            `lessons=${pickNumber(listedCourse, "lessonCount")} enrolled=${pickNumber(listedCourse, "enrollmentCount")}`,
        )
        check(
            "the course list never contains another owner's course",
            !pickArray(courseList.body, "data", "courses").some((c) => pickString(c, "id") === ids.courseB),
            `n=${pickArray(courseList.body, "data", "courses").length}`,
        )

        const board = await call(api.accessConsole(get(`${CONSOLE}?${q}`)))
        check("the console read succeeds", board.status === 200, `status=${board.status}`)
        const boardModules = pickArray(board.body, "data", "console", "modules")
        const boardLessons = pickArray(boardModules[0], "lessons")
        check(
            "MEASURED: the console returns lessons that carry NO rule, which is what an editor needs and the reporting endpoint omits",
            boardLessons.length === 2 &&
                boardLessons.some((l) => pick(l, "accessLevelId") === null) &&
                boardLessons.some((l) => pickString(l, "requiredLevelKey") === "pro"),
            `n=${boardLessons.length} nulls=${boardLessons.filter((l) => pick(l, "accessLevelId") === null).length}`,
        )
        const boardEnrolments = pickArray(board.body, "data", "console", "enrolments")
        check(
            "the console reports the current entitlement against each enrolment",
            boardEnrolments.length === 1 && pickString(boardEnrolments[0], "grant", "accessLevelKey") === "pro",
            `n=${boardEnrolments.length} key=${pickString(boardEnrolments[0], "grant", "accessLevelKey")}`,
        )
        check(
            "the console says whether an enrolment may be granted a tier at all",
            pick(boardEnrolments[0], "entitlable") === true,
            String(pick(boardEnrolments[0], "entitlable")),
        )
        check(
            "the console reports a serialized grant, so the client never receives a raw Date",
            typeof pick(boardEnrolments[0], "grant", "grantedAt") === "string",
            typeof pick(boardEnrolments[0], "grant", "grantedAt"),
        )

        // ---- 9. retiring a tier ------------------------------------------
        const retireHeld = await call(api.retireAccessLevel(proId, del(`${LEVELS}/${proId}?${q}`)))
        check("a tier a learner still holds cannot be retired", retireHeld.status === 409, `status=${retireHeld.status}`)
        const retireSpare = await call(api.retireAccessLevel(spareId, del(`${LEVELS}/${spareId}?${q}`)))
        check("an unheld tier retires", retireSpare.status === 200 && pick(retireSpare.body, "data", "level", "isActive") === false, `${retireSpare.status} isActive=${pick(retireSpare.body, "data", "level", "isActive")}`)

        // ---- 10. append-only timeline ------------------------------------
        const timeline = await call(api.accessTimeline(get(`${TIMELINE}?${q}`)))
        const events = pickArray(timeline.body, "data", "events")
        const seqs = events.map((e) => Number(pickString(e, "seq")))
        check("the timeline returns the course's access events", events.length >= 8, `n=${events.length}`)
        check("timeline seq serialises as a string not a BigInt", events.every((e) => typeof pick(e, "seq") === "string"), typeof pick(events[0], "seq"))
        check("timeline sequence is strictly increasing", seqs.every((v, i) => i === 0 || v > seqs[i - 1]), `n=${seqs.length}`)
        const applyEvent = events.find((e) => pickString(e, "subjectType") === "change" && pickString(e, "to") === "APPLIED")
        check(
            "the apply event records paymentExecuted false, so no reader can conclude money moved",
            pick(applyEvent, "metadata", "paymentExecuted") === false,
            JSON.stringify(pick(applyEvent, "metadata") ?? {}),
        )
        const directUpdate = await prisma
            .$executeRawUnsafe(`update "CourseAccessEvent" set "to" = 'TAMPERED' where "courseId" = '${ids.courseA}'`)
            .then(() => "ACCEPTED")
            .catch((e: Error) => e.message.split("\n")[0])
        check("the database itself refuses to rewrite an access event", directUpdate !== "ACCEPTED", String(directUpdate).slice(0, 90))

        // ---- 11. foreign is indistinguishable from nonexistent -----------
        identity.current = `clerk_${ids.userB}`
        const beforeForeign = await prisma.courseAccessEvent.count()
        const foreignFetch = fetchCalls
        const qb = `workspaceId=${ids.wsB}&courseId=`
        const foreignCourse = await call(api.listAccessLevels(get(`${LEVELS}?${qb}${ids.courseA}`)))
        const absentCourse = await call(api.listAccessLevels(get(`${LEVELS}?${qb}${RUN}_absent`)))
        check("another owner's course is refused", foreignCourse.status === 403, `status=${foreignCourse.status}`)
        // This is the single inverted assertion.
        const identical = INVERT
            ? foreignCourse.text !== absentCourse.text
            : foreignCourse.status === absentCourse.status && foreignCourse.text === absentCourse.text
        check(
            "a foreign course and a nonexistent course are byte-identical",
            identical,
            `${foreignCourse.status}:${foreignCourse.text} vs ${absentCourse.status}:${absentCourse.text}`,
        )
        const foreignGrant = await call(api.getAccessGrant(get(`${GRANTS}?${qb}${ids.courseA}&enrollmentId=${ids.enrolA}`)))
        const absentGrant = await call(api.getAccessGrant(get(`${GRANTS}?${qb}${RUN}_absent&enrollmentId=${RUN}_absent`)))
        check(
            "a foreign grant and a nonexistent grant are byte-identical",
            foreignGrant.status === absentGrant.status && foreignGrant.text === absentGrant.text,
            `${foreignGrant.status}/${absentGrant.status}`,
        )
        const foreignConsole = await call(api.accessConsole(get(`${CONSOLE}?${qb}${ids.courseA}`)))
        const absentConsole = await call(api.accessConsole(get(`${CONSOLE}?${qb}${RUN}_absent`)))
        check(
            "a foreign console read and a nonexistent one are byte-identical",
            foreignConsole.status === absentConsole.status && foreignConsole.text === absentConsole.text,
            `${foreignConsole.status}/${absentConsole.status}`,
        )
        check(
            "the foreign console read leaked no lesson title",
            !/Deep dive|Intro/.test(foreignConsole.text),
            foreignConsole.text.slice(0, 80),
        )
        const foreignMutate = await call(            api.transitionAccessGrant(
                grantId,
                send(`${GRANTS}/${grantId}`, { workspaceId: ids.wsB, courseId: ids.courseA, state: "REVOKED" }, "PATCH"),
            ),
        )
        const absentMutate = await call(
            api.transitionAccessGrant(
                `${RUN}_absent`,
                send(`${GRANTS}/${RUN}_absent`, { workspaceId: ids.wsB, courseId: `${RUN}_absent`, state: "REVOKED" }, "PATCH"),
            ),
        )
        check(
            "a foreign mutation and a nonexistent mutation are byte-identical",
            foreignMutate.status === absentMutate.status && foreignMutate.text === absentMutate.text,
            `${foreignMutate.status}/${absentMutate.status}`,
        )
        check("cross-tenant refusal appended zero events", beforeForeign === (await prisma.courseAccessEvent.count()), `before=${beforeForeign}`)
        check("cross-tenant refusal made zero external calls", fetchCalls === foreignFetch, `calls=${fetchCalls - foreignFetch}`)
        check("the foreign refusal leaked no tier keys", !/basic|pro|spare/.test(foreignCourse.text), foreignCourse.text.slice(0, 80))

        // ---- 12. dependency failure is 503 with no leak ------------------
        identity.current = `clerk_${ids.userA}`
        const brokenPrisma = {
            workspace: { findUnique: async () => ({ profileId: ids.profileA }) },
            course: {
                findUnique: async () => {
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
        const broken = await call(brokenApi.listAccessLevels(get(`${LEVELS}?${q}`)))
        check("dependency failure is 503", broken.status === 503, `status=${broken.status}`)
        check(
            "dependency failure leaks no internal detail",
            !/SECRET_DETAIL/.test(broken.text) && !/postgres:\/\//.test(broken.text),
            broken.text.slice(0, 120),
        )

        // ---- 13. envelope agrees with the rest of the platform -----------
        const okList = await call(api.listAccessLevels(get(`${LEVELS}?${q}`)))
        check("success envelope keys are exactly ok,data", keys(okList.body) === "data,ok", keys(okList.body))
        check("error envelope keys are exactly error,ok", keys(anon.listLevels.body) === "error,ok", keys(anon.listLevels.body))
        check(
            "every error envelope carries a code and a message",
            [anon.listLevels, outsider, foreignCourse, illegal, unknownState, broken].every(
                (r) => pickString(r.body, "error", "code") !== "" && pickString(r.body, "error", "message") !== "",
            ),
            "codes present",
        )

        // ---- 14. the two principals stay separate ------------------------
        // Asserted against the source, because adding a workspaceId parameter to the learner
        // service would type-check perfectly and silently hand a learner a tenancy probe.
        const accessSrc = readFileSync(join(__dirname, "..", "..", "src", "lib", "cohorts", "access.ts"), "utf8")
        const learnerClass = accessSrc.slice(accessSrc.indexOf("export class LearnerAccessService"))
        check(
            "LearnerAccessService still takes no workspaceId",
            !/workspaceId/.test(learnerClass),
            learnerClass.slice(0, 60).replace(/\n/g, " "),
        )
        const httpSrc = readFileSync(join(__dirname, "..", "..", "src", "lib", "cohorts", "http.ts"), "utf8")
        // Deliberately narrow: the boundary is allowed to EXPLAIN why the learner service is
        // excluded, and a broad string ban would fail on the very comment that protects it.
        // What must never appear is a construction or an import.
        check(
            "the HTTP boundary never constructs or imports the learner service",
            !/new LearnerAccessService/.test(httpSrc) && !/import[^;]*LearnerAccessService/.test(httpSrc),
            "owner surface only",
        )
        const runtimeSrc = readFileSync(join(__dirname, "..", "..", "src", "lib", "cohorts", "runtime.ts"), "utf8")
        check(
            "the composition root wires CourseAccessService into the api",
            /new CourseAccessService\(ctx\)/.test(runtimeSrc) && /CohortApiService\(/.test(runtimeSrc),
            "wired",
        )
        check(
            "no route hands the api a caller-supplied decidedBy",
            !/decidedBy:\s*(str|nullableStr)\(/.test(httpSrc),
            "server-derived",
        )

        // ---- 15. every new route file re-exports the shared api ----------
        const routeRoot = join(__dirname, "..", "..", "src", "app", "api", "platform", "course-access")
        const routeFiles = [
            join(routeRoot, "levels", "route.ts"),
            join(routeRoot, "levels", "[levelId]", "route.ts"),
            join(routeRoot, "lesson-rules", "route.ts"),
            join(routeRoot, "grants", "route.ts"),
            join(routeRoot, "grants", "[grantId]", "route.ts"),
            join(routeRoot, "grants", "[grantId]", "changes", "route.ts"),
            join(routeRoot, "changes", "[changeId]", "route.ts"),
            join(routeRoot, "changes", "[changeId]", "apply", "route.ts"),
            join(routeRoot, "visibility", "route.ts"),
            join(routeRoot, "timeline", "route.ts"),
            join(routeRoot, "courses", "route.ts"),
            join(routeRoot, "console", "route.ts"),
        ]
        const routeSources = routeFiles.map((f) => readFileSync(f, "utf8"))
        check(
            `all ${routeFiles.length} access route files import the shared cohortApi`,
            routeSources.every((s) => /from "@\/lib\/cohorts\/runtime"/.test(s)),
            "shared runtime",
        )
        check(
            "no access route file talks to Prisma directly",
            routeSources.every((s) => !/PrismaClient|@\/lib\/prisma/.test(s)),
            "no direct db",
        )
        check(
            "every access route file pins the node runtime",
            routeSources.every((s) => /runtime = "nodejs"/.test(s)),
            "nodejs",
        )

        // ---- 16. whole-run external call tally ---------------------------
        check("no external call was EVER made in this run", fetchCalls === 0, `calls=${fetchCalls}`)
    } finally {
        try {
            await prisma.$executeRawUnsafe(`alter table "CourseAccessEvent" disable trigger "CourseAccessEvent_append_only"`)
            await prisma.$executeRawUnsafe(
                `delete from "CourseAccessEvent" where "courseId" in (select "id" from "Course" where "profileId" in (${profileList}))`,
            )
        } finally {
            await prisma.$executeRawUnsafe(`alter table "CourseAccessEvent" enable trigger "CourseAccessEvent_append_only"`)
        }
        const levelScope = `select "id" from "CourseAccessLevel" where "profileId" in (${profileList})`
        const enrolScope = `select "id" from "CourseEnrollment" where "courseId" in (select "id" from "Course" where "profileId" in (${profileList}))`
        for (const sql of [
            `delete from "CourseAccessChange" where "grantId" in (select "id" from "CourseAccessGrant" where "enrollmentId" in (${enrolScope}))`,
            `delete from "CourseAccessGrant" where "enrollmentId" in (${enrolScope})`,
            `delete from "CourseLessonAccess" where "accessLevelId" in (${levelScope})`,
            `delete from "CourseAccessLevel" where "profileId" in (${profileList})`,
            `delete from "CourseEnrollment" where "id" in ('${ids.enrolA}','${ids.enrolB}')`,
            `delete from "CourseLesson" where "id" like '${RUN}%'`,
            `delete from "CourseModule" where "id" like '${RUN}%'`,
            `delete from "Course" where "profileId" in (${profileList})`,
            `delete from "Membership" where "workspaceId" in ('${ids.wsA}','${ids.wsB}')`,
            `delete from "Workspace" where "id" in ('${ids.wsA}','${ids.wsB}')`,
            `delete from "Profile" where "id" in (${profileList})`,
            `delete from "User" where "id" in ('${ids.userA}','${ids.userB}','${ids.userC}')`,
        ]) {
            await prisma.$executeRawUnsafe(sql)
        }

        const armed = await prisma.$queryRawUnsafe<{ n: number }[]>(
            `select count(*)::int n from information_schema.triggers where trigger_schema='public' and trigger_name='CourseAccessEvent_append_only'`,
        )
        check("CourseAccessEvent append-only trigger re-armed", Number(armed[0].n) >= 1, `triggers=${armed[0].n}`)

        for (const [label, expected, actual] of [
            ["CourseAccessLevel rows", base.levels, await prisma.courseAccessLevel.count()],
            ["CourseAccessGrant rows", base.grants, await prisma.courseAccessGrant.count()],
            ["CourseAccessChange rows", base.changes, await prisma.courseAccessChange.count()],
            ["CourseAccessEvent rows", base.events, await prisma.courseAccessEvent.count()],
            ["CourseLessonAccess rows", base.rules, await prisma.courseLessonAccess.count()],
            ["Payment rows", base.payments, await prisma.payment.count()],
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
    console.log("All course access owner API boundaries hold.")
}

main().catch((e) => {
    console.error(e)
    process.exit(1)
})

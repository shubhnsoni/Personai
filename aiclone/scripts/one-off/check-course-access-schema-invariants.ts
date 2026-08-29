/**
 * Wave G3 / part two: course access-level schema invariant harness.
 *
 * Runs ONLY against the authorized disposable rehearsal database. Every write happens inside a
 * transaction that is deliberately rolled back.
 *
 * The claim this harness has to defend is unusual, so it is worth stating plainly: BEFORE this
 * migration there was NO content-visibility check anywhere in the repository. Any ACTIVE or
 * COMPLETED enrolment on a course returned every module and every lesson, and
 * CourseLesson.isFree was written by importers and enforced by nothing. So the risk is not that
 * an existing rule was broken - there was none - but that adding rules silently CHANGES what
 * existing learners can see.
 *
 * The design makes that impossible: a lesson with no CourseLessonAccess row is unrestricted.
 * No existing lesson has one, so nothing changes for anybody, and no backfill exists to get
 * wrong. This harness asserts that absence-means-unrestricted is real by measuring it in SQL
 * against a seeded three-tier course, rather than asserting it in a comment.
 *
 * It also asserts the tenancy rule the cohort domain already lives by - profileId, never
 * workspaceId - and that nothing here can execute a payment.
 *
 * Set INVERT_ASSERTION=1 to flip one expectation and prove the harness fails loudly.
 *
 *   ts-node -r tsconfig-paths/register scripts/one-off/check-course-access-schema-invariants.ts
 */
import { PrismaClient } from "@prisma/client"

import { assertDisposableTarget, parseDatabaseName } from "../lib/disposable-db"

const AUTHORIZED_TARGET = "personalink_phase0_rehearsal_20260826_210704"
const INVERT = process.env.INVERT_ASSERTION === "1"
const RUN = `wg3a_${Date.now()}_${Math.floor(Math.random() * 1e6)}`

const NEW_TABLES = [
    "CourseAccessLevel",
    "CourseLessonAccess",
    "CourseAccessGrant",
    "CourseAccessChange",
    "CourseAccessEvent",
] as const

/** Tables that must NOT exist, because the pre-existing ones already do the job. */
const FORBIDDEN_TABLES = [
    "CourseTier",
    "AccessLevel",
    "Entitlement",
    "CourseEntitlement",
    "CourseSubscription",
    "CoursePlan",
    "LessonVisibility",
    "CourseAccessPayment",
    "CourseAccessInvoice",
    "CourseAccessMember",
    "CourseAccessLearner",
    "LearnerProgress",
    "CohortProgress",
] as const

const NEW_ENUMS: Array<[string, number]> = [
    ["CourseAccessGrantState", 5],
    ["CourseAccessGrantSource", 3],
    ["CourseAccessChangeDirection", 2],
    ["CourseAccessChangeState", 5],
    ["CourseAccessEventKind", 5],
    ["CourseAccessEventActor", 3],
]

/** The reuse contract: each link must point at the PRE-EXISTING model. */
const REUSE_FKS: Array<[string, string, string]> = [
    ["CourseAccessLevel", "profileId", "Profile"],
    ["CourseAccessLevel", "courseId", "Course"],
    ["CourseLessonAccess", "lessonId", "CourseLesson"],
    ["CourseLessonAccess", "accessLevelId", "CourseAccessLevel"],
    ["CourseAccessGrant", "enrollmentId", "CourseEnrollment"],
    ["CourseAccessGrant", "accessLevelId", "CourseAccessLevel"],
    ["CourseAccessChange", "grantId", "CourseAccessGrant"],
    ["CourseAccessChange", "fromAccessLevelId", "CourseAccessLevel"],
    ["CourseAccessChange", "toAccessLevelId", "CourseAccessLevel"],
    ["CourseAccessEvent", "courseId", "Course"],
]

const CHECK_CONSTRAINTS = [
    "CourseAccessLevel_rank_positive",
    "CourseAccessLevel_priceCents_nonnegative",
    "CourseAccessChange_levels_differ",
    "CourseAccessGrant_expiry_after_grant",
] as const

const results: Array<{ name: string; pass: boolean; detail: string }> = []
function check(name: string, pass: boolean, detail = "") {
    results.push({ name, pass, detail })
}

function errLine(e: unknown): string {
    const lines = String((e as Error).message)
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
    return (
        lines.find(
            (l) =>
                l.includes("append-only") ||
                l.includes("belongs to course") ||
                l.includes("does not") ||
                l.includes("violates") ||
                l.includes("duplicate") ||
                l.includes("ERROR"),
        ) ??
        lines[0] ??
        "unknown error"
    ).slice(0, 160)
}

class Rollback extends Error {}
type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0]

type Seeded = {
    profile: string
    courseA: string
    courseB: string
    moduleA: string
    lessons: string[]
    levelBasic: string
    levelPro: string
    levelOther: string
    enrolBasic: string
    enrolPro: string
    enrolB: string
    grantBasic: string
    grantPro: string
}

/**
 * Seeds one profile with two courses. Course A has two tiers (basic rank 1, pro rank 2) and
 * three lessons: lesson 0 with NO rule, lesson 1 requiring basic, lesson 2 requiring pro. Two
 * learners are enrolled on A, one holding each tier. Course B has a tier of its own, used to
 * prove a tier cannot reach across courses.
 */
async function seed(tx: Tx, tag: string): Promise<Seeded> {
    const p = `${RUN}_${tag}`
    const q = (s: string) => `${p}_${s}`
    const mk = (sql: string) => tx.$executeRawUnsafe(sql)

    await mk(
        `insert into "User" ("id","clerkId","email","updatedAt") values ('${q("u")}','clerk_${q("u")}','${q("u")}@example.test',CURRENT_TIMESTAMP)`,
    )
    await mk(
        `insert into "Profile" ("id","userId","slug","displayName","updatedAt") values ('${q("pr")}','${q("u")}','${q("pr")}','P',CURRENT_TIMESTAMP)`,
    )
    for (const c of ["a", "b"] as const) {
        await mk(
            `insert into "Course" ("id","profileId","title","updatedAt") values ('${q(`course${c}`)}','${q("pr")}','Course ${c}',CURRENT_TIMESTAMP)`,
        )
    }
    await mk(
        `insert into "CourseModule" ("id","courseId","title","orderIndex","updatedAt") values ('${q("mod")}','${q("coursea")}','M',0,CURRENT_TIMESTAMP)`,
    )
    const lessons: string[] = []
    for (let i = 0; i < 3; i += 1) {
        const id = q(`les${i}`)
        lessons.push(id)
        await mk(
            `insert into "CourseLesson" ("id","moduleId","title","orderIndex","updatedAt") values ('${id}','${q("mod")}','L${i}',${i},CURRENT_TIMESTAMP)`,
        )
    }
    await mk(
        `insert into "CourseAccessLevel" ("id","profileId","courseId","key","label","rank","updatedAt")
         values ('${q("basic")}','${q("pr")}','${q("coursea")}','basic','Basic',1,CURRENT_TIMESTAMP)`,
    )
    await mk(
        `insert into "CourseAccessLevel" ("id","profileId","courseId","key","label","rank","priceCents","updatedAt")
         values ('${q("pro")}','${q("pr")}','${q("coursea")}','pro','Pro',2,4900,CURRENT_TIMESTAMP)`,
    )
    await mk(
        `insert into "CourseAccessLevel" ("id","profileId","courseId","key","label","rank","updatedAt")
         values ('${q("other")}','${q("pr")}','${q("courseb")}','basic','Basic',1,CURRENT_TIMESTAMP)`,
    )
    // lesson 0 deliberately has NO rule: it must stay visible to every tier.
    await mk(
        `insert into "CourseLessonAccess" ("id","lessonId","accessLevelId","updatedAt") values ('${q("la1")}','${lessons[1]}','${q("basic")}',CURRENT_TIMESTAMP)`,
    )
    await mk(
        `insert into "CourseLessonAccess" ("id","lessonId","accessLevelId","updatedAt") values ('${q("la2")}','${lessons[2]}','${q("pro")}',CURRENT_TIMESTAMP)`,
    )
    for (const [id, course] of [
        [q("enrb"), q("coursea")],
        [q("enrp"), q("coursea")],
        [q("enrbb"), q("courseb")],
    ]) {
        await mk(
            `insert into "CourseEnrollment" ("id","courseId","visitorEmail","status","enrolledAt")
             values ('${id}','${course}','${id}@example.test','ACTIVE',CURRENT_TIMESTAMP)`,
        )
    }
    await mk(
        `insert into "CourseAccessGrant" ("id","enrollmentId","accessLevelId","state","grantedAt","updatedAt")
         values ('${q("grb")}','${q("enrb")}','${q("basic")}','ACTIVE',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
    )
    await mk(
        `insert into "CourseAccessGrant" ("id","enrollmentId","accessLevelId","state","grantedAt","updatedAt")
         values ('${q("grp")}','${q("enrp")}','${q("pro")}','ACTIVE',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
    )

    return {
        profile: q("pr"),
        courseA: q("coursea"),
        courseB: q("courseb"),
        moduleA: q("mod"),
        lessons,
        levelBasic: q("basic"),
        levelPro: q("pro"),
        levelOther: q("other"),
        enrolBasic: q("enrb"),
        enrolPro: q("enrp"),
        enrolB: q("enrbb"),
        grantBasic: q("grb"),
        grantPro: q("grp"),
    }
}

let prismaRef: PrismaClient | null = null

async function refuses(tag: string, body: (tx: Tx, s: Seeded) => Promise<void>): Promise<{ refused: boolean; detail: string }> {
    let refused = false
    let detail = ""
    try {
        await prismaRef!.$transaction(async (tx) => {
            const s = await seed(tx, tag)
            try {
                await body(tx, s)
            } catch (e) {
                refused = true
                detail = errLine(e)
            }
            throw new Rollback()
        })
    } catch (e) {
        if (!(e instanceof Rollback) && !refused) {
            refused = true
            detail = errLine(e)
        }
    }
    return { refused, detail }
}

async function counts(prisma: PrismaClient): Promise<Record<string, number>> {
    const out: Record<string, number> = {}
    for (const t of [
        "CourseAccessLevel",
        "CourseLessonAccess",
        "CourseAccessGrant",
        "CourseAccessChange",
        "CourseAccessEvent",
        "Course",
        "CourseModule",
        "CourseLesson",
        "CourseEnrollment",
        "Payment",
    ]) {
        const rows = await prisma.$queryRawUnsafe<{ n: bigint }[]>(`select count(*) as n from "${t}"`)
        out[t] = Number(rows[0].n)
    }
    return out
}

async function main() {
    const url = process.env.DATABASE_URL
    const db = parseDatabaseName(url)
    assertDisposableTarget(url)
    if (db !== AUTHORIZED_TARGET) {
        console.error(`ABORT: harness only runs against ${AUTHORIZED_TARGET}, got ${db}`)
        process.exit(1)
    }

    const prisma = new PrismaClient()
    prismaRef = prisma
    try {
        const live = await prisma.$queryRawUnsafe<{ db: string }[]>("select current_database() as db")
        if (live[0].db !== AUTHORIZED_TARGET) {
            console.error(`ABORT: connected to ${live[0].db}`)
            process.exit(1)
        }
        const baseline = await counts(prisma)

        // ---- 1. tables present, forks absent -----------------------------------
        const tables = (
            await prisma.$queryRawUnsafe<{ table_name: string }[]>(
                "select table_name from information_schema.tables where table_schema='public'",
            )
        ).map((r) => r.table_name)
        const missing = NEW_TABLES.filter((t) => !tables.includes(t))
        check("all 5 access-level tables present", missing.length === 0, missing.length ? `missing: ${missing}` : "5/5")
        const forked = FORBIDDEN_TABLES.filter((t) => tables.includes(t))
        check(
            "no parallel tier, entitlement, subscription, plan, progress or access-payment table was created",
            forked.length === 0,
            forked.join(",") || "none",
        )
        for (const t of ["Course", "CourseModule", "CourseLesson", "CourseEnrollment", "LessonCompletion", "Cohort", "CohortMembership", "Member"]) {
            check(`pre-existing ${t} still exists`, tables.includes(t), tables.includes(t) ? "present" : "MISSING")
        }

        const enums = await prisma.$queryRawUnsafe<{ typname: string; enumlabel: string }[]>(
            "select t.typname, e.enumlabel from pg_type t join pg_enum e on e.enumtypid=t.oid",
        )
        for (const [name, expected] of NEW_ENUMS) {
            const n = enums.filter((e) => e.typname === name).length
            check(`enum ${name} has ${expected} labels`, n === expected, `count=${n}`)
        }
        check(
            "CourseAccessGrantState carries PENDING, so a grant is not implicitly active the moment it is created",
            enums.some((e) => e.typname === "CourseAccessGrantState" && e.enumlabel === "PENDING"),
        )
        check(
            "CourseAccessChangeState separates APPROVED from APPLIED, so deciding a change is not the same as performing it",
            enums.some((e) => e.typname === "CourseAccessChangeState" && e.enumlabel === "APPROVED") &&
                enums.some((e) => e.typname === "CourseAccessChangeState" && e.enumlabel === "APPLIED"),
        )

        // ---- 2. tenancy follows the cohort domain ------------------------------
        const cols = await prisma.$queryRawUnsafe<{ table_name: string; column_name: string; is_nullable: string; data_type: string; column_default: string | null }[]>(
            `select table_name, column_name, is_nullable, data_type, column_default from information_schema.columns where table_schema='public'`,
        )
        for (const t of NEW_TABLES) {
            const hasWorkspace = cols.some((c) => c.table_name === t && c.column_name === "workspaceId")
            check(`${t} has no workspaceId, matching the profileId tenancy the cohort domain already uses`, !hasWorkspace)
        }
        check(
            "CourseAccessLevel is profile-scoped",
            cols.some((c) => c.table_name === "CourseAccessLevel" && c.column_name === "profileId" && c.is_nullable === "NO"),
        )

        // ---- 3. the pre-existing lesson columns are untouched -----------------
        const isFree = cols.find((c) => c.table_name === "CourseLesson" && c.column_name === "isFree")
        check(
            "CourseLesson.isFree still exists exactly as it was - it was never enforced and this wave does not start reinterpreting it",
            Boolean(isFree && isFree.data_type === "boolean" && isFree.is_nullable === "NO"),
            isFree ? `${isFree.data_type} nullable=${isFree.is_nullable} default=${isFree.column_default}` : "MISSING",
        )
        const coursePrice = cols.find((c) => c.table_name === "Course" && c.column_name === "priceCents")
        check("Course.priceCents is untouched, so tier pricing did not replace course pricing", Boolean(coursePrice))
        check(
            "no visibility column was added to CourseLesson or CourseModule",
            !cols.some(
                (c) =>
                    (c.table_name === "CourseLesson" || c.table_name === "CourseModule") &&
                    ["minimumRank", "accessLevelId", "requiredTier", "visibility"].includes(c.column_name),
            ),
        )

        // ---- 4. reuse: foreign keys point at pre-existing models -------------
        const fks = await prisma.$queryRawUnsafe<{ tbl: string; col: string; ref: string }[]>(
            `select tc.table_name as tbl, kcu.column_name as col, ccu.table_name as ref
               from information_schema.table_constraints tc
               join information_schema.key_column_usage kcu on kcu.constraint_name = tc.constraint_name
               join information_schema.constraint_column_usage ccu on ccu.constraint_name = tc.constraint_name
              where tc.constraint_type = 'FOREIGN KEY' and tc.table_schema = 'public'`,
        )
        for (const [tbl, col, ref] of REUSE_FKS) {
            check(`${tbl}.${col} points at the pre-existing ${ref}`, fks.some((f) => f.tbl === tbl && f.col === col && f.ref === ref))
        }

        // ---- 5. constraints, indexes, triggers -------------------------------
        const constraints = (
            await prisma.$queryRawUnsafe<{ conname: string }[]>("select conname from pg_constraint where contype = 'c'")
        ).map((r) => r.conname)
        for (const name of CHECK_CONSTRAINTS) check(`CHECK ${name} exists`, constraints.includes(name))
        const indexes = await prisma.$queryRawUnsafe<{ indexname: string; indexdef: string }[]>(
            "select indexname, indexdef from pg_indexes where schemaname='public'",
        )
        const openIdx = indexes.find((i) => i.indexname === "CourseAccessChange_one_open_per_grant")
        check("partial unique index CourseAccessChange_one_open_per_grant exists", Boolean(openIdx))
        check(
            "it is genuinely partial - REQUESTED and APPROVED only, so history can accumulate",
            Boolean(openIdx && /WHERE/i.test(openIdx.indexdef) && /REQUESTED/.test(openIdx.indexdef) && /APPROVED/.test(openIdx.indexdef)),
            openIdx?.indexdef.slice(0, 140) ?? "absent",
        )
        check(
            "one grant per enrolment is a unique key, so there is never a question of which entitlement wins",
            indexes.some((i) => i.indexname === "CourseAccessGrant_enrollmentId_key"),
        )
        const triggers = (
            await prisma.$queryRawUnsafe<{ tgname: string }[]>("select tgname from pg_trigger where not tgisinternal")
        ).map((r) => r.tgname)
        for (const t of ["CourseAccessEvent_append_only", "CourseAccessGrant_course_guard", "CourseLessonAccess_course_guard"]) {
            check(`trigger ${t} is attached`, triggers.includes(t))
        }
        check("the pre-existing CohortEvent_append_only trigger is untouched", triggers.includes("CohortEvent_append_only"))

        // ---- 6. THE BACKWARD-COMPATIBILITY CLAIM -----------------------------
        const existingRules = await prisma.$queryRawUnsafe<{ n: bigint }[]>(`select count(*) as n from "CourseLessonAccess"`)
        check(
            "no pre-existing lesson carries an access rule, so no existing learner's visibility changed and no backfill exists to get wrong",
            Number(existingRules[0].n) === 0,
            `rules=${existingRules[0].n}`,
        )

        const visibility = await refuses("vis", async (tx, s) => {
            // The visibility rule, expressed once in SQL: a lesson is visible when it has no
            // access rule, or when the holder's rank is at least the required rank.
            const visible = async (enrollmentId: string) =>
                tx.$queryRawUnsafe<{ id: string }[]>(
                    `select les."id" as id
                       from "CourseLesson" les
                       join "CourseModule" m on m."id" = les."moduleId"
                       left join "CourseLessonAccess" la on la."lessonId" = les."id"
                       left join "CourseAccessLevel" req on req."id" = la."accessLevelId"
                      where m."courseId" = '${s.courseA}'
                        and (
                          la."id" is null
                          or req."rank" <= (
                            select lvl."rank" from "CourseAccessGrant" g
                              join "CourseAccessLevel" lvl on lvl."id" = g."accessLevelId"
                             where g."enrollmentId" = '${enrollmentId}' and g."state" = 'ACTIVE'
                          )
                        )
                      order by les."orderIndex"`,
                )
            const basic = (await visible(s.enrolBasic)).map((r) => r.id)
            const pro = (await visible(s.enrolPro)).map((r) => r.id)
            if (basic.length !== 2) throw new Error(`basic saw ${basic.length} lessons, expected 2`)
            if (pro.length !== 3) throw new Error(`pro saw ${pro.length} lessons, expected 3`)
            if (!basic.includes(s.lessons[0])) throw new Error("the unrestricted lesson was hidden from basic")
            if (basic.includes(s.lessons[2])) throw new Error("basic could see the pro-only lesson")
            throw new Error("ACCEPTED")
        })
        check(
            "measured: a basic holder sees the unrestricted lesson and the basic lesson but not the pro lesson; a pro holder sees all three",
            visibility.detail === "ACCEPTED",
            visibility.detail,
        )

        const suspended = await refuses("sus", async (tx, s) => {
            await tx.$executeRawUnsafe(
                `update "CourseAccessGrant" set "state" = 'SUSPENDED', "suspendedAt" = CURRENT_TIMESTAMP where "id" = '${s.grantPro}'`,
            )
            const rows = await tx.$queryRawUnsafe<{ id: string }[]>(
                `select les."id" as id
                   from "CourseLesson" les
                   join "CourseModule" m on m."id" = les."moduleId"
                   left join "CourseLessonAccess" la on la."lessonId" = les."id"
                   left join "CourseAccessLevel" req on req."id" = la."accessLevelId"
                  where m."courseId" = '${s.courseA}'
                    and (la."id" is null or req."rank" <= (
                      select lvl."rank" from "CourseAccessGrant" g
                        join "CourseAccessLevel" lvl on lvl."id" = g."accessLevelId"
                       where g."enrollmentId" = '${s.enrolPro}' and g."state" = 'ACTIVE'))`,
            )
            if (rows.length !== 1) throw new Error(`a suspended holder saw ${rows.length} lessons, expected only the unrestricted one`)
            throw new Error("ACCEPTED")
        })
        check(
            "a SUSPENDED grant falls back to the unrestricted lessons only - suspension is not a silent downgrade to the lowest tier",
            suspended.detail === "ACCEPTED",
            suspended.detail,
        )

        // ---- 7. direct-write refusals ----------------------------------------
        const zeroRank = await refuses("zr", async (tx, s) => {
            await tx.$executeRawUnsafe(
                `insert into "CourseAccessLevel" ("id","profileId","courseId","key","label","rank","updatedAt")
                 values ('${RUN}_zr_x','${s.profile}','${s.courseA}','free','Free',0,CURRENT_TIMESTAMP)`,
            )
        })
        check("a tier with rank 0 is refused, because rank is what makes upgrade and downgrade derivable", zeroRank.refused, zeroRank.detail)

        const negativePrice = await refuses("np", async (tx, s) => {
            await tx.$executeRawUnsafe(
                `insert into "CourseAccessLevel" ("id","profileId","courseId","key","label","rank","priceCents","updatedAt")
                 values ('${RUN}_np_x','${s.profile}','${s.courseA}','neg','Neg',3,-1,CURRENT_TIMESTAMP)`,
            )
        })
        check("a tier with a negative price is refused", negativePrice.refused, negativePrice.detail)

        const dupRank = await refuses("dr", async (tx, s) => {
            await tx.$executeRawUnsafe(
                `insert into "CourseAccessLevel" ("id","profileId","courseId","key","label","rank","updatedAt")
                 values ('${RUN}_dr_x','${s.profile}','${s.courseA}','other','Other',1,CURRENT_TIMESTAMP)`,
            )
        })
        check("two tiers sharing a rank on one course are refused, because the order would be ambiguous", dupRank.refused, dupRank.detail)

        const dupKey = await refuses("dk", async (tx, s) => {
            await tx.$executeRawUnsafe(
                `insert into "CourseAccessLevel" ("id","profileId","courseId","key","label","rank","updatedAt")
                 values ('${RUN}_dk_x','${s.profile}','${s.courseA}','basic','Duplicate',9,CURRENT_TIMESTAMP)`,
            )
        })
        check("two tiers sharing a key on one course are refused", dupKey.refused, dupKey.detail)

        const secondGrant = await refuses("sg", async (tx, s) => {
            await tx.$executeRawUnsafe(
                `insert into "CourseAccessGrant" ("id","enrollmentId","accessLevelId","state","updatedAt")
                 values ('${RUN}_sg_x','${s.enrolBasic}','${s.levelPro}','ACTIVE',CURRENT_TIMESTAMP)`,
            )
        })
        check("a second grant on one enrolment is refused, so an entitlement is single-valued", secondGrant.refused, secondGrant.detail)

        const foreignLevelGrant = await refuses("fg", async (tx, s) => {
            await tx.$executeRawUnsafe(
                `insert into "CourseAccessGrant" ("id","enrollmentId","accessLevelId","state","updatedAt")
                 values ('${RUN}_fg_x','${s.enrolB}','${s.levelBasic}','ACTIVE',CURRENT_TIMESTAMP)`,
            )
        })
        check(
            "a grant naming a tier from a different course is refused by trigger, so visibility cannot answer from the wrong catalogue",
            foreignLevelGrant.refused,
            foreignLevelGrant.detail,
        )

        const foreignLevelRule = await refuses("fr", async (tx, s) => {
            await tx.$executeRawUnsafe(
                `insert into "CourseLessonAccess" ("id","lessonId","accessLevelId","updatedAt")
                 values ('${RUN}_fr_x','${s.lessons[0]}','${s.levelOther}',CURRENT_TIMESTAMP)`,
            )
        })
        check(
            "a lesson rule naming a tier from a different course is refused by trigger, so a rule can never be unreachable",
            foreignLevelRule.refused,
            foreignLevelRule.detail,
        )

        const sameLevelChange = await refuses("sl", async (tx, s) => {
            await tx.$executeRawUnsafe(
                `insert into "CourseAccessChange" ("id","grantId","fromAccessLevelId","toAccessLevelId","direction","state","updatedAt")
                 values ('${RUN}_sl_x','${s.grantBasic}','${s.levelBasic}','${s.levelBasic}','UPGRADE','REQUESTED',CURRENT_TIMESTAMP)`,
            )
        })
        check("a change between a tier and itself is refused", sameLevelChange.refused, sameLevelChange.detail)

        const twoOpenChanges = await refuses("tc", async (tx, s) => {
            await tx.$executeRawUnsafe(
                `insert into "CourseAccessChange" ("id","grantId","fromAccessLevelId","toAccessLevelId","direction","state","updatedAt")
                 values ('${RUN}_tc_1','${s.grantBasic}','${s.levelBasic}','${s.levelPro}','UPGRADE','REQUESTED',CURRENT_TIMESTAMP)`,
            )
            await tx.$executeRawUnsafe(
                `insert into "CourseAccessChange" ("id","grantId","fromAccessLevelId","toAccessLevelId","direction","state","updatedAt")
                 values ('${RUN}_tc_2','${s.grantBasic}','${s.levelBasic}','${s.levelPro}','UPGRADE','APPROVED',CURRENT_TIMESTAMP)`,
            )
        })
        check(
            "two in-flight tier changes on one grant are refused, so two upgrades cannot race to rewrite the same entitlement",
            twoOpenChanges.refused,
            twoOpenChanges.detail,
        )

        const changeAfterApplied = await refuses("ca", async (tx, s) => {
            await tx.$executeRawUnsafe(
                `insert into "CourseAccessChange" ("id","grantId","fromAccessLevelId","toAccessLevelId","direction","state","appliedAt","updatedAt")
                 values ('${RUN}_ca_1','${s.grantBasic}','${s.levelBasic}','${s.levelPro}','UPGRADE','APPLIED',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
            )
            await tx.$executeRawUnsafe(
                `insert into "CourseAccessChange" ("id","grantId","fromAccessLevelId","toAccessLevelId","direction","state","updatedAt")
                 values ('${RUN}_ca_2','${s.grantBasic}','${s.levelPro}','${s.levelBasic}','DOWNGRADE','REQUESTED',CURRENT_TIMESTAMP)`,
            )
            throw new Error("ACCEPTED")
        })
        check(
            "a new change after an APPLIED one is accepted, because the index is partial and a learner may upgrade then downgrade",
            changeAfterApplied.detail === "ACCEPTED",
            changeAfterApplied.detail,
        )

        const badExpiry = await refuses("be", async (tx, s) => {
            await tx.$executeRawUnsafe(
                `update "CourseAccessGrant" set "expiresAt" = "grantedAt" - interval '1 day' where "id" = '${s.grantBasic}'`,
            )
        })
        check("an entitlement that expires before it was granted is refused", badExpiry.refused, badExpiry.detail)

        // ---- 8. the event stream cannot be rewritten -------------------------
        const rewrite = await refuses("aw", async (tx, s) => {
            await tx.$executeRawUnsafe(
                `insert into "CourseAccessEvent" ("id","courseId","kind","subjectType","subjectId","from","to","actor")
                 values ('${RUN}_aw_x','${s.courseA}','GRANT','grant','${s.grantBasic}',null,'ACTIVE','STAFF')`,
            )
            await tx.$executeRawUnsafe(`update "CourseAccessEvent" set "to" = 'REVOKED' where "id" = '${RUN}_aw_x'`)
        })
        check("the database refuses to rewrite an access event", rewrite.refused, rewrite.detail)

        const erase = await refuses("ae", async (tx, s) => {
            await tx.$executeRawUnsafe(
                `insert into "CourseAccessEvent" ("id","courseId","kind","subjectType","subjectId","from","to","actor")
                 values ('${RUN}_ae_x','${s.courseA}','GRANT','grant','${s.grantBasic}',null,'ACTIVE','STAFF')`,
            )
            await tx.$executeRawUnsafe(`delete from "CourseAccessEvent" where "id" = '${RUN}_ae_x'`)
        })
        check("the database refuses to erase an access event", erase.refused, erase.detail)

        // ---- 9. nothing here can charge anybody ------------------------------
        for (const forbidden of ["amountCents", "providerPaymentId", "stripeCustomerId", "chargeId", "paidAt"]) {
            check(
                `CourseAccessGrant has no ${forbidden} column, so an entitlement cannot become a payment record`,
                !cols.some((c) => c.table_name === "CourseAccessGrant" && c.column_name === forbidden),
            )
        }
        const paymentFks = fks.filter((f) => NEW_TABLES.includes(f.tbl as (typeof NEW_TABLES)[number]) && f.ref === "Payment")
        check(
            "no access-level table has a foreign key to Payment - paymentId is a bare reference by design, because Payment is profile-scoped",
            paymentFks.length === 0,
            paymentFks.map((f) => `${f.tbl}.${f.col}`).join(",") || "none",
        )
        const upgradeNoPayment = await refuses("up", async (tx, s) => {
            const before = await tx.$queryRawUnsafe<{ n: bigint }[]>(`select count(*) as n from "Payment"`)
            await tx.$executeRawUnsafe(
                `insert into "CourseAccessChange" ("id","grantId","fromAccessLevelId","toAccessLevelId","direction","state","updatedAt")
                 values ('${RUN}_up_1','${s.grantBasic}','${s.levelBasic}','${s.levelPro}','UPGRADE','REQUESTED',CURRENT_TIMESTAMP)`,
            )
            await tx.$executeRawUnsafe(
                `update "CourseAccessChange" set "state" = 'APPLIED', "appliedAt" = CURRENT_TIMESTAMP where "id" = '${RUN}_up_1'`,
            )
            await tx.$executeRawUnsafe(
                `update "CourseAccessGrant" set "accessLevelId" = '${s.levelPro}' where "id" = '${s.grantBasic}'`,
            )
            const after = await tx.$queryRawUnsafe<{ n: bigint }[]>(`select count(*) as n from "Payment"`)
            if (Number(after[0].n) !== Number(before[0].n)) throw new Error(`Payment count moved from ${before[0].n} to ${after[0].n}`)
            const rows = await tx.$queryRawUnsafe<{ lvl: string }[]>(
                `select "accessLevelId" as lvl from "CourseAccessGrant" where "id" = '${s.grantBasic}'`,
            )
            if (rows[0].lvl !== s.levelPro) throw new Error("applying the change did not move the entitlement")
            throw new Error("ACCEPTED")
        })
        check(
            "a complete upgrade - requested, applied, entitlement moved - creates no Payment row",
            upgradeNoPayment.detail === "ACCEPTED",
            upgradeNoPayment.detail,
        )

        // ---- 10. residue -----------------------------------------------------
        const after = await counts(prisma)
        const residue = Object.entries(after)
            .filter(([k, v]) => v !== baseline[k])
            .map(([k, v]) => `${k}:${baseline[k]}->${v}`)
        check("harness left zero residue", residue.length === 0, residue.join(", ") || "clean")
    } finally {
        await prisma.$disconnect()
    }

    let failed = results.filter((r) => !r.pass)
    if (INVERT) {
        // Flip the load-bearing claim: that absence of a rule means unrestricted, measured
        // rather than asserted. If the harness cannot go red, it is not evidence.
        const target = results.find((r) => r.name.startsWith("measured: a basic holder"))
        if (target) target.pass = !target.pass
        failed = results.filter((r) => !r.pass)
    }
    for (const r of results) {
        console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.name}${r.detail ? `  (${r.detail})` : ""}`)
    }
    console.log(`\n${results.length - failed.length}/${results.length} invariants passed`)
    if (INVERT) console.log("INVERT_ASSERTION=1 was set - a failure here is the expected proof")
    if (failed.length) process.exit(1)
    console.log("All course access-level schema invariants hold.")
}

main().catch((e) => {
    console.error(e)
    process.exit(1)
})

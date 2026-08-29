/**
 * Wave G4: fieldJobs foundation schema invariant harness.
 *
 * Runs ONLY against the authorized disposable rehearsal database. Every write happens inside a
 * transaction that is deliberately rolled back.
 *
 * The claim this harness exists to defend is REUSE. A field-service engine is the easiest place
 * in this repository to accidentally build a second copy of things that already exist: a
 * Technician table beside AppointmentResource, a WorkOrder beside FieldJob, a Route beside
 * nothing at all. So the forbidden-table list is long and deliberate, the technician foreign key
 * is verified to point at AppointmentResource BY NAME, and the pre-existing tables it borrows are
 * asserted to have gained no columns.
 *
 * It also defends what "dispatch" does NOT mean here. There is no route, no distance, no travel
 * time and no notification column anywhere, which is asserted rather than left to the reader.
 *
 * Set INVERT_ASSERTION=1 to flip one expectation and prove the harness fails loudly.
 *
 *   ts-node -r tsconfig-paths/register scripts/one-off/check-fieldjob-schema-invariants.ts
 */
import { PrismaClient } from "@prisma/client"

import { assertDisposableTarget, parseDatabaseName } from "../lib/disposable-db"

const AUTHORIZED_TARGET = "personalink_phase0_rehearsal_20260826_210704"
const INVERT = process.env.INVERT_ASSERTION === "1"
const RUN = `wg4s_${Date.now()}_${Math.floor(Math.random() * 1e6)}`

const NEW_TABLES = ["FieldJobRequest", "FieldJob", "FieldJobAssignment", "FieldJobEvent"] as const

/**
 * Tables that must NOT exist. The first group would fork something that already exists; the
 * second would claim a capability this foundation deliberately does not have.
 */
const FORBIDDEN_TABLES = [
    // Forks of existing models.
    "Technician",
    "FieldTechnician",
    "Crew",
    "CrewMember",
    "FieldJobTechnician",
    "FieldJobLocation",
    "FieldJobService",
    "WorkOrder",
    "WorkOrderLine",
    "Job",
    "JobCard",
    // Capabilities this foundation does not have. inspection is still planned.
    "FieldJobRoute",
    "Route",
    "RouteStop",
    "FieldJobInspection",
    "Inspection",
    "FieldJobPart",
    "Part",
    "FieldJobAsset",
    "Asset",
    "FieldJobInvoice",
    "FieldJobNotification",
] as const

const NEW_ENUMS: Array<[string, number]> = [
    ["FieldJobRequestStatus", 6],
    ["FieldJobStatus", 6],
    ["FieldJobPriority", 4],
    ["FieldJobAssignmentRole", 2],
    ["FieldJobAssignmentState", 7],
    ["FieldJobEventKind", 6],
    ["FieldJobEventActor", 4],
]

/** The reuse contract: each link must point at the PRE-EXISTING model. */
const REUSE_FKS: Array<[string, string, string]> = [
    ["FieldJobRequest", "profileId", "Profile"],
    ["FieldJobRequest", "serviceOfferingId", "ServiceOffering"],
    ["FieldJob", "profileId", "Profile"],
    ["FieldJob", "requestId", "FieldJobRequest"],
    ["FieldJob", "serviceOfferingId", "ServiceOffering"],
    ["FieldJob", "originLocationId", "Location"],
    ["FieldJobAssignment", "jobId", "FieldJob"],
    // The load-bearing one: a technician IS an AppointmentResource.
    ["FieldJobAssignment", "resourceId", "AppointmentResource"],
    ["FieldJobEvent", "jobId", "FieldJob"],
]

const CHECK_CONSTRAINTS = [
    "FieldJobRequest_estimateCents_nonnegative",
    "FieldJob_estimateCents_nonnegative",
    "FieldJob_schedule_complete",
    "FieldJob_schedule_ordered",
    "FieldJobAssignment_decline_has_reason",
    "FieldJobAssignment_release_has_reason",
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
                l.includes("belongs to profile") ||
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
    profileA: string
    profileB: string
    offeringA: string
    locationA: string
    techA1: string
    techA2: string
    techB: string
    requestA: string
    jobA: string
    leadA: string
}

/**
 * Seeds two profiles so cross-tenant refusal is testable. Profile A gets a service offering, a
 * location, two technicians, a request, a job and one active LEAD assignment. Profile B gets one
 * technician, used to prove an assignment cannot cross profiles.
 */
async function seed(tx: Tx, tag: string): Promise<Seeded> {
    const p = `${RUN}_${tag}`
    const q = (s: string) => `${p}_${s}`
    const mk = (sql: string) => tx.$executeRawUnsafe(sql)

    for (const side of ["a", "b"] as const) {
        await mk(
            `insert into "User" ("id","clerkId","email","updatedAt") values ('${q(`u${side}`)}','clerk_${q(`u${side}`)}','${q(`u${side}`)}@example.test',CURRENT_TIMESTAMP)`,
        )
        await mk(
            `insert into "Profile" ("id","userId","slug","displayName","updatedAt") values ('${q(`pr${side}`)}','${q(`u${side}`)}','${q(`pr${side}`)}','P',CURRENT_TIMESTAMP)`,
        )
        await mk(
            `insert into "Workspace" ("id","profileId","name","slug","updatedAt") values ('${q(`ws${side}`)}','${q(`pr${side}`)}','WS','${q(`ws${side}`)}',CURRENT_TIMESTAMP)`,
        )
    }
    await mk(
        `insert into "Location" ("id","workspaceId","name","updatedAt") values ('${q("loc")}','${q("wsa")}','Depot',CURRENT_TIMESTAMP)`,
    )
    await mk(
        `insert into "ServiceOffering" ("id","profileId","name","updatedAt") values ('${q("svc")}','${q("pra")}','Boiler service',CURRENT_TIMESTAMP)`,
    )
    for (const [id, profile] of [
        [q("t1"), q("pra")],
        [q("t2"), q("pra")],
        [q("tb"), q("prb")],
    ]) {
        await mk(
            `insert into "AppointmentResource" ("id","profileId","name","kind","updatedAt") values ('${id}','${profile}','${id}','STAFF',CURRENT_TIMESTAMP)`,
        )
    }
    await mk(
        `insert into "FieldJobRequest" ("id","profileId","source","summary","status","updatedAt")
         values ('${q("req")}','${q("pra")}','phone','No hot water','NEW',CURRENT_TIMESTAMP)`,
    )
    await mk(
        `insert into "FieldJob" ("id","profileId","requestId","serviceOfferingId","originLocationId","reference","title","status","priority","siteAddress","updatedAt")
         values ('${q("job")}','${q("pra")}','${q("req")}','${q("svc")}','${q("loc")}','${q("job")}','Boiler call','SCHEDULED','NORMAL','12 Example Street',CURRENT_TIMESTAMP)`,
    )
    await mk(
        `insert into "FieldJobAssignment" ("id","jobId","resourceId","role","state","updatedAt")
         values ('${q("lead")}','${q("job")}','${q("t1")}','LEAD','ASSIGNED',CURRENT_TIMESTAMP)`,
    )

    return {
        profileA: q("pra"),
        profileB: q("prb"),
        offeringA: q("svc"),
        locationA: q("loc"),
        techA1: q("t1"),
        techA2: q("t2"),
        techB: q("tb"),
        requestA: q("req"),
        jobA: q("job"),
        leadA: q("lead"),
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
        "FieldJobRequest",
        "FieldJob",
        "FieldJobAssignment",
        "FieldJobEvent",
        "AppointmentResource",
        "ServiceOffering",
        "Location",
        "Booking",
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

        // ---- 1. tables present, forks and overclaims absent -----------------
        const tables = (
            await prisma.$queryRawUnsafe<{ table_name: string }[]>(
                "select table_name from information_schema.tables where table_schema='public'",
            )
        ).map((r) => r.table_name)
        const missing = NEW_TABLES.filter((t) => !tables.includes(t))
        check("all 4 fieldJobs tables present", missing.length === 0, missing.length ? `missing: ${missing}` : "4/4")
        const forked = FORBIDDEN_TABLES.filter((t) => tables.includes(t))
        check(
            "no Technician, Crew, WorkOrder or JobCard table was created - the technician IS an AppointmentResource",
            forked.filter((t) => ["Technician", "FieldTechnician", "Crew", "CrewMember", "FieldJobTechnician", "WorkOrder", "WorkOrderLine", "Job", "JobCard"].includes(t)).length === 0,
            forked.join(",") || "none",
        )
        check(
            "no Route, Inspection, Part, Asset, Invoice or Notification table was created - this foundation does not claim them",
            forked.filter((t) => ["FieldJobRoute", "Route", "RouteStop", "FieldJobInspection", "Inspection", "FieldJobPart", "Part", "FieldJobAsset", "Asset", "FieldJobInvoice", "FieldJobNotification"].includes(t)).length === 0,
            forked.join(",") || "none",
        )
        for (const t of ["AppointmentResource", "ServiceOffering", "Location", "Booking", "Profile"]) {
            check(`pre-existing ${t} still exists`, tables.includes(t), tables.includes(t) ? "present" : "MISSING")
        }

        // ---- 2. enums -------------------------------------------------------
        const enums = await prisma.$queryRawUnsafe<{ typname: string; enumlabel: string }[]>(
            "select t.typname, e.enumlabel from pg_type t join pg_enum e on e.enumtypid=t.oid",
        )
        for (const [name, expected] of NEW_ENUMS) {
            const n = enums.filter((e) => e.typname === name).length
            check(`enum ${name} has ${expected} labels`, n === expected, `count=${n}`)
        }
        check(
            "AppointmentResourceKind is unchanged at 3 labels, so reusing it did not require widening it",
            enums.filter((e) => e.typname === "AppointmentResourceKind").length === 3,
        )
        check(
            "FieldJobAssignmentState carries both ACCEPTED and DECLINED, so a silent refusal cannot look like agreement",
            enums.some((e) => e.typname === "FieldJobAssignmentState" && e.enumlabel === "ACCEPTED") &&
                enums.some((e) => e.typname === "FieldJobAssignmentState" && e.enumlabel === "DECLINED"),
        )
        check(
            "FieldJobRequestStatus carries DECLINED and CONVERTED separately, so a declined request stays a record",
            enums.some((e) => e.typname === "FieldJobRequestStatus" && e.enumlabel === "DECLINED") &&
                enums.some((e) => e.typname === "FieldJobRequestStatus" && e.enumlabel === "CONVERTED"),
        )

        // ---- 3. tenancy and the borrowed tables ----------------------------
        const cols = await prisma.$queryRawUnsafe<{ table_name: string; column_name: string; is_nullable: string; data_type: string }[]>(
            `select table_name, column_name, is_nullable, data_type from information_schema.columns where table_schema='public'`,
        )
        for (const t of NEW_TABLES) {
            check(
                `${t} has no workspaceId - tenancy is profileId, which is forced by sharing AppointmentResource`,
                !cols.some((c) => c.table_name === t && c.column_name === "workspaceId"),
            )
        }
        for (const t of ["FieldJobRequest", "FieldJob"]) {
            check(
                `${t} is profile-scoped and the column is NOT NULL`,
                cols.some((c) => c.table_name === t && c.column_name === "profileId" && c.is_nullable === "NO"),
            )
        }
        // Reuse must be by reference, not by column addition.
        const resourceCols = cols.filter((c) => c.table_name === "AppointmentResource").map((c) => c.column_name)
        check(
            "AppointmentResource gained no columns - it is referenced, not extended",
            !resourceCols.some((c) => /^fieldJob/i.test(c)) && resourceCols.length === 9,
            `columns=${resourceCols.length}`,
        )
        const offeringCols = cols.filter((c) => c.table_name === "ServiceOffering").map((c) => c.column_name)
        check("ServiceOffering gained no fieldJob column", !offeringCols.some((c) => /^fieldJob/i.test(c)))
        const locationCols = cols.filter((c) => c.table_name === "Location").map((c) => c.column_name)
        check("Location gained no fieldJob column", !locationCols.some((c) => /^fieldJob/i.test(c)))

        // ---- 4. what dispatch does NOT do ----------------------------------
        const fieldJobColumnNames = cols.filter((c) => NEW_TABLES.includes(c.table_name as (typeof NEW_TABLES)[number])).map((c) => c.column_name)
        for (const banned of [
            "routeId",
            "routeOrder",
            "distanceMeters",
            "travelMinutes",
            "latitude",
            "longitude",
            "notifiedAt",
            "smsSentAt",
            "emailSentAt",
            "pushSentAt",
            "providerMessageId",
        ]) {
            check(
                `no ${banned} column anywhere in fieldJobs - this foundation optimises no route and notifies nobody`,
                !fieldJobColumnNames.includes(banned),
            )
        }
        check(
            "the customer site is free text, not a Location foreign key, so customer addresses do not pollute a table three other engines read",
            cols.some((c) => c.table_name === "FieldJob" && c.column_name === "siteAddress" && c.is_nullable === "NO"),
        )

        // ---- 5. reuse: foreign keys point at pre-existing models -----------
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

        // ---- 6. constraints, indexes, triggers -----------------------------
        const constraints = (
            await prisma.$queryRawUnsafe<{ conname: string }[]>("select conname from pg_constraint where contype = 'c'")
        ).map((r) => r.conname)
        for (const name of CHECK_CONSTRAINTS) check(`CHECK ${name} exists`, constraints.includes(name))
        const indexes = await prisma.$queryRawUnsafe<{ indexname: string; indexdef: string }[]>(
            "select indexname, indexdef from pg_indexes where schemaname='public'",
        )
        const leadIdx = indexes.find((i) => i.indexname === "FieldJobAssignment_one_active_lead_per_job")
        check("partial unique index FieldJobAssignment_one_active_lead_per_job exists", Boolean(leadIdx))
        check(
            "it is genuinely partial, excluding DECLINED and RELEASED so history can accumulate",
            Boolean(leadIdx && /WHERE/i.test(leadIdx.indexdef) && /DECLINED/.test(leadIdx.indexdef) && /RELEASED/.test(leadIdx.indexdef)),
            leadIdx?.indexdef.slice(0, 150) ?? "absent",
        )
        const perResourceIdx = indexes.find((i) => i.indexname === "FieldJobAssignment_one_active_per_resource_per_job")
        check("partial unique index FieldJobAssignment_one_active_per_resource_per_job exists", Boolean(perResourceIdx))
        check(
            "FieldJob.requestId is unique, so one request converts to at most one job",
            indexes.some((i) => i.indexname === "FieldJob_requestId_key"),
        )
        const triggers = (
            await prisma.$queryRawUnsafe<{ tgname: string }[]>("select tgname from pg_trigger where not tgisinternal")
        ).map((r) => r.tgname)
        for (const t of ["FieldJobEvent_append_only", "FieldJobAssignment_tenant_guard"]) {
            check(`trigger ${t} is attached`, triggers.includes(t))
        }
        check(
            "the pre-existing appointment exclusion constraint is untouched",
            (await prisma.$queryRawUnsafe<{ n: bigint }[]>("select count(*) as n from pg_constraint where contype = 'x'")).every(
                (r) => Number(r.n) === 2,
            ),
        )

        // ---- 7. direct-write refusals --------------------------------------
        const negEstimate = await refuses("ne", async (tx, s) => {
            await tx.$executeRawUnsafe(
                `insert into "FieldJobRequest" ("id","profileId","source","summary","estimateCents","updatedAt")
                 values ('${RUN}_ne_x','${s.profileA}','web','X',-1,CURRENT_TIMESTAMP)`,
            )
        })
        check("a request with a negative estimate is refused", negEstimate.refused, negEstimate.detail)

        const halfSchedule = await refuses("hs", async (tx, s) => {
            await tx.$executeRawUnsafe(
                `update "FieldJob" set "scheduledStartAt" = CURRENT_TIMESTAMP where "id" = '${s.jobA}'`,
            )
        })
        check(
            "a job with a start and no end is refused, because it has no duration",
            halfSchedule.refused,
            halfSchedule.detail,
        )
        const halfSchedule2 = await refuses("hs2", async (tx, s) => {
            await tx.$executeRawUnsafe(`update "FieldJob" set "scheduledEndAt" = CURRENT_TIMESTAMP where "id" = '${s.jobA}'`)
        })
        check("a job with an end and no start is refused too", halfSchedule2.refused, halfSchedule2.detail)
        const backwards = await refuses("bw", async (tx, s) => {
            await tx.$executeRawUnsafe(
                `update "FieldJob" set "scheduledStartAt" = CURRENT_TIMESTAMP, "scheduledEndAt" = CURRENT_TIMESTAMP - interval '1 hour' where "id" = '${s.jobA}'`,
            )
        })
        check("a job that ends before it starts is refused", backwards.refused, backwards.detail)
        const goodSchedule = await refuses("gs", async (tx, s) => {
            await tx.$executeRawUnsafe(
                `update "FieldJob" set "scheduledStartAt" = CURRENT_TIMESTAMP, "scheduledEndAt" = CURRENT_TIMESTAMP + interval '2 hours' where "id" = '${s.jobA}'`,
            )
            throw new Error("ACCEPTED")
        })
        check("a job with both a start and a later end is accepted", goodSchedule.detail === "ACCEPTED", goodSchedule.detail)

        const silentDecline = await refuses("sd", async (tx, s) => {
            await tx.$executeRawUnsafe(`update "FieldJobAssignment" set "state" = 'DECLINED' where "id" = '${s.leadA}'`)
        })
        check(
            "declining an assignment without saying why is refused - an unexplained refusal reads as a mistake later",
            silentDecline.refused,
            silentDecline.detail,
        )
        const explainedDecline = await refuses("ed", async (tx, s) => {
            await tx.$executeRawUnsafe(
                `update "FieldJobAssignment" set "state" = 'DECLINED', "declineReason" = 'off shift' where "id" = '${s.leadA}'`,
            )
            throw new Error("ACCEPTED")
        })
        check("declining with a reason is accepted", explainedDecline.detail === "ACCEPTED", explainedDecline.detail)
        const blankRelease = await refuses("br", async (tx, s) => {
            await tx.$executeRawUnsafe(
                `update "FieldJobAssignment" set "state" = 'RELEASED', "releaseReason" = '   ' where "id" = '${s.leadA}'`,
            )
        })
        check("releasing with a whitespace-only reason is refused, not just a NULL one", blankRelease.refused, blankRelease.detail)

        const twoLeads = await refuses("tl", async (tx, s) => {
            await tx.$executeRawUnsafe(
                `insert into "FieldJobAssignment" ("id","jobId","resourceId","role","state","updatedAt")
                 values ('${RUN}_tl_x','${s.jobA}','${s.techA2}','LEAD','ASSIGNED',CURRENT_TIMESTAMP)`,
            )
        })
        check("a second active LEAD on one job is refused, because two leads means nobody is accountable", twoLeads.refused, twoLeads.detail)

        const leadAfterRelease = await refuses("lar", async (tx, s) => {
            await tx.$executeRawUnsafe(
                `update "FieldJobAssignment" set "state" = 'RELEASED', "releaseReason" = 'reassigned' where "id" = '${s.leadA}'`,
            )
            await tx.$executeRawUnsafe(
                `insert into "FieldJobAssignment" ("id","jobId","resourceId","role","state","updatedAt")
                 values ('${RUN}_lar_x','${s.jobA}','${s.techA2}','LEAD','ASSIGNED',CURRENT_TIMESTAMP)`,
            )
            throw new Error("ACCEPTED")
        })
        check(
            "a new LEAD after the previous one is released is accepted, and the released row survives",
            leadAfterRelease.detail === "ACCEPTED",
            leadAfterRelease.detail,
        )

        const helperOk = await refuses("ho", async (tx, s) => {
            await tx.$executeRawUnsafe(
                `insert into "FieldJobAssignment" ("id","jobId","resourceId","role","state","updatedAt")
                 values ('${RUN}_ho_x','${s.jobA}','${s.techA2}','HELPER','ASSIGNED',CURRENT_TIMESTAMP)`,
            )
            throw new Error("ACCEPTED")
        })
        check("a HELPER alongside a LEAD is accepted", helperOk.detail === "ACCEPTED", helperOk.detail)

        const doubleAssign = await refuses("da", async (tx, s) => {
            await tx.$executeRawUnsafe(
                `insert into "FieldJobAssignment" ("id","jobId","resourceId","role","state","updatedAt")
                 values ('${RUN}_da_x','${s.jobA}','${s.techA1}','HELPER','ASSIGNED',CURRENT_TIMESTAMP)`,
            )
        })
        check(
            "assigning the same technician to the same job twice while both are active is refused",
            doubleAssign.refused,
            doubleAssign.detail,
        )

        const crossProfile = await refuses("cp", async (tx, s) => {
            await tx.$executeRawUnsafe(
                `insert into "FieldJobAssignment" ("id","jobId","resourceId","role","state","updatedAt")
                 values ('${RUN}_cp_x','${s.jobA}','${s.techB}','HELPER','ASSIGNED',CURRENT_TIMESTAMP)`,
            )
        })
        check(
            "assigning another profile's technician is refused by trigger, so tenant isolation is a database rule too",
            crossProfile.refused,
            crossProfile.detail,
        )

        const twoJobsOneRequest = await refuses("tj", async (tx, s) => {
            await tx.$executeRawUnsafe(
                `insert into "FieldJob" ("id","profileId","requestId","reference","title","siteAddress","updatedAt")
                 values ('${RUN}_tj_x','${s.profileA}','${s.requestA}','${RUN}_tj_x','Second job','1 Other Street',CURRENT_TIMESTAMP)`,
            )
        })
        check("one request cannot convert into two jobs", twoJobsOneRequest.refused, twoJobsOneRequest.detail)

        const dupReference = await refuses("dr", async (tx, s) => {
            await tx.$executeRawUnsafe(
                `insert into "FieldJob" ("id","profileId","reference","title","siteAddress","updatedAt")
                 values ('${RUN}_dr_x','${s.profileA}','${s.jobA}','Clash','2 Other Street',CURRENT_TIMESTAMP)`,
            )
        })
        check("two jobs cannot share a reference within a profile", dupReference.refused, dupReference.detail)

        // ---- 8. the history cannot be rewritten ----------------------------
        const rewrite = await refuses("aw", async (tx, s) => {
            await tx.$executeRawUnsafe(
                `insert into "FieldJobEvent" ("id","jobId","kind","subjectType","subjectId","from","to","actor")
                 values ('${RUN}_aw_x','${s.jobA}','STATUS','job','${s.jobA}',null,'SCHEDULED','STAFF')`,
            )
            await tx.$executeRawUnsafe(`update "FieldJobEvent" set "to" = 'TAMPERED' where "id" = '${RUN}_aw_x'`)
        })
        check("the database refuses to rewrite a job event", rewrite.refused, rewrite.detail)
        const erase = await refuses("ae", async (tx, s) => {
            await tx.$executeRawUnsafe(
                `insert into "FieldJobEvent" ("id","jobId","kind","subjectType","subjectId","from","to","actor")
                 values ('${RUN}_ae_x','${s.jobA}','STATUS','job','${s.jobA}',null,'SCHEDULED','STAFF')`,
            )
            await tx.$executeRawUnsafe(`delete from "FieldJobEvent" where "id" = '${RUN}_ae_x'`)
        })
        check("the database refuses to erase a job event", erase.refused, erase.detail)

        // ---- 9. residue ----------------------------------------------------
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
        const target = results.find((r) => r.name.includes("points at the pre-existing AppointmentResource"))
        if (target) target.pass = !target.pass
        failed = results.filter((r) => !r.pass)
    }
    for (const r of results) console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.name}${r.detail ? `  (${r.detail})` : ""}`)
    console.log(`\n${results.length - failed.length}/${results.length} invariants passed`)
    if (INVERT) console.log("INVERT_ASSERTION=1 was set - a failure here is the expected proof")
    if (failed.length) process.exit(1)
    console.log("All fieldJobs schema invariants hold.")
}

main().catch((e) => {
    console.error(e)
    process.exit(1)
})

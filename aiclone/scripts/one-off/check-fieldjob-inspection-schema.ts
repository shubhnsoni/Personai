/**
 * Wave H0: fieldJobs:inspection schema invariant harness.
 *
 * Runs ONLY against the authorized disposable rehearsal database. Every write happens inside a
 * transaction that is deliberately rolled back, so the harness leaves no row behind.
 *
 * WHAT THIS HARNESS EXISTS TO DEFEND
 *
 * The G4 foundation harness defended REUSE by keeping a long list of tables that must not exist -
 * and three of the names on that list described inspection. Wave H0 builds inspection, so exactly
 * one name (FieldJobInspection) left that list. This harness defends the other side of the same
 * claim: that building inspection did NOT quietly bring an asset registry, a parts catalogue, an
 * invoice, a notification channel or a routing engine with it.
 *
 *   Asset / FieldJobAsset      - an ASSET item carries the equipment's identity as COLUMNS.
 *                                Asserted absent as tables, and the identity column is asserted
 *                                mandatory for ASSET items, because an equipment check that does
 *                                not name the equipment is not an equipment check.
 *   Part / FieldJobPart        - parts point at InventoryItem. The foreign key is verified BY NAME
 *                                and the stock/location boundary is verified BEHAVIOURALLY.
 *   FieldJobInvoice / Invoice  - inspection carries a handoff FLAG. Asserted absent as tables, and
 *                                the flag is asserted unreachable before completion.
 *   Route / RouteStop / Notification - unchanged from G4 and asserted again here, including the
 *                                absence of any geo, travel-time or notified-at column.
 *
 * THE EVENT LEDGER IS ASSERTED REUSED, NOT FORKED: no FieldJobInspectionEvent table exists, and
 * FieldJobEventKind is asserted to still have exactly its six G4 values - because adding one would
 * have made the migration's rollback unable to return byte-identical catalog state.
 *
 * Set INVERT_ASSERTION=1 to flip every load-bearing expectation and prove the harness fails
 * loudly rather than passing for free.
 *
 *   ts-node -r tsconfig-paths/register scripts/one-off/check-fieldjob-inspection-schema.ts
 */
import { PrismaClient } from "@prisma/client"

import { assertDisposableTarget, parseDatabaseName } from "../lib/disposable-db"

const AUTHORIZED_TARGET = "personalink_phase0_rehearsal_20260826_210704"
const INVERT = process.env.INVERT_ASSERTION === "1"
const RUN = `wh0i_${Date.now()}_${Math.floor(Math.random() * 1e6)}`

const NEW_TABLES = [
    "FieldJobInspectionTemplate",
    "FieldJobInspectionTemplateItem",
    "FieldJobInspection",
    "FieldJobInspectionItem",
    "FieldJobInspectionPart",
] as const

/** Still forbidden, each for the reason it always had. See the migration header. */
const FORBIDDEN_TABLES = [
    "Asset",
    "FieldJobAsset",
    "Part",
    "FieldJobPart",
    "Inspection",
    "FieldJobInvoice",
    "Invoice",
    "FieldJobNotification",
    "FieldJobRoute",
    "Route",
    "RouteStop",
    "Technician",
    "WorkOrder",
    // The ledger is reused, not forked.
    "FieldJobInspectionEvent",
    "InspectionEvent",
] as const

const NEW_ENUMS: Array<[string, readonly string[]]> = [
    ["FieldJobInspectionStatus", ["DRAFT", "IN_PROGRESS", "SUBMITTED", "COMPLETED", "CANCELLED"]],
    ["FieldJobInspectionOutcome", ["PASS", "FAIL", "ADVISORY"]],
    ["FieldJobInspectionItemKind", ["CHECK", "MEASUREMENT", "ASSET"]],
    ["FieldJobInspectionItemResult", ["PENDING", "PASS", "FAIL", "NOT_APPLICABLE"]],
    ["FieldJobInvoiceHandoffState", ["NOT_READY", "READY", "HANDED_OFF", "DECLINED"]],
]

/** The reuse contract: each link must point at the named PRE-EXISTING or new-in-wave model. */
const REUSE_FKS: Array<[string, string, string]> = [
    ["FieldJobInspectionTemplate", "profileId", "Profile"],
    ["FieldJobInspectionTemplate", "serviceOfferingId", "ServiceOffering"],
    ["FieldJobInspectionTemplateItem", "templateId", "FieldJobInspectionTemplate"],
    ["FieldJobInspection", "jobId", "FieldJob"],
    ["FieldJobInspection", "profileId", "Profile"],
    ["FieldJobInspection", "templateId", "FieldJobInspectionTemplate"],
    ["FieldJobInspection", "assignmentId", "FieldJobAssignment"],
    ["FieldJobInspectionItem", "inspectionId", "FieldJobInspection"],
    ["FieldJobInspectionItem", "templateItemId", "FieldJobInspectionTemplateItem"],
    ["FieldJobInspectionPart", "inspectionId", "FieldJobInspection"],
    // The two load-bearing ones: parts compose the existing inventory engine.
    ["FieldJobInspectionPart", "inventoryItemId", "InventoryItem"],
    ["FieldJobInspectionPart", "movementId", "InventoryMovement"],
]

const CHECK_CONSTRAINTS = [
    "FieldJobInspectionTemplateItem_label_not_blank",
    "FieldJobInspectionTemplateItem_position_nonnegative",
    "FieldJobInspectionTemplateItem_measurement_has_unit",
    "FieldJobInspectionTemplateItem_range_ordered",
    "FieldJobInspection_reference_not_blank",
    "FieldJobInspection_completed_has_outcome",
    "FieldJobInspection_completed_has_notes",
    "FieldJobInspection_cancel_has_reason",
    "FieldJobInspection_handoff_requires_completion",
    "FieldJobInspection_handoff_has_timestamp",
    "FieldJobInspectionItem_label_not_blank",
    "FieldJobInspectionItem_position_nonnegative",
    "FieldJobInspectionItem_measurement_has_unit",
    "FieldJobInspectionItem_range_ordered",
    "FieldJobInspectionItem_fail_has_notes",
    "FieldJobInspectionItem_asset_has_identity",
    "FieldJobInspectionPart_qty_positive",
    "FieldJobInspectionPart_unitCost_nonnegative",
] as const

const TRIGGERS = [
    ["FieldJobInspection", "FieldJobInspection_tenant_guard"],
    ["FieldJobInspectionItem", "FieldJobInspectionItem_template_guard"],
    ["FieldJobInspectionPart", "FieldJobInspectionPart_boundary_guard"],
] as const

/**
 * Columns that must not exist anywhere in the five new tables. Each one would be a claim this
 * wave does not make.
 */
const FORBIDDEN_COLUMNS = [
    "distanceMeters",
    "travelMinutes",
    "latitude",
    "longitude",
    "notifiedAt",
    "smsSentAt",
    "emailSentAt",
    "pushSentAt",
    "providerMessageId",
    "invoiceId",
    "paymentId",
    "assetId",
    "fileUrl",
    "attachmentUrl",
    "uploadUrl",
] as const

/** Pre-existing tables that must have gained NO inspection column. */
const UNTOUCHED_TABLES = [
    "FieldJob",
    "FieldJobRequest",
    "FieldJobAssignment",
    "FieldJobEvent",
    "InventoryItem",
    "InventoryMovement",
    "Profile",
    "ServiceOffering",
    "Location",
] as const

const results: Array<{ name: string; pass: boolean; detail: string }> = []
function check(name: string, pass: boolean, detail = "") {
    results.push({ name, pass, detail })
}
/** Flipped by INVERT_ASSERTION=1, so the harness's ability to fail is itself proven. */
function checkInvertible(name: string, pass: boolean, detail = "") {
    results.push({ name, pass: INVERT ? !pass : pass, detail })
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
                l.includes("is held at location") ||
                l.includes("belongs to job") ||
                l.includes("belongs to template") ||
                l.includes("moved stock record") ||
                l.includes("violates") ||
                l.includes("duplicate") ||
                l.includes("ERROR"),
        ) ??
        lines[0] ??
        "unknown error"
    ).slice(0, 170)
}

class Rollback extends Error {}
type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0]

/**
 * The WHOLE error text, flattened. errLine() is for readable output; this is for assertions.
 * "Something threw" is a much weaker claim than "the constraint I named threw", and the
 * difference is where harnesses like this one quietly rot.
 */
function fullErr(e: unknown): string {
    return String((e as Error).message).replace(/\s+/g, " ")
}

type Seeded = {
    profileA: string
    profileB: string
    offeringA: string
    locationA: string
    locationA2: string
    jobA: string
    jobA2: string
    leadA: string
    leadA2: string
    templateA: string
    templateA2: string
    tplItemA: string
    tplItemA2: string
    itemStockA: string
    itemStockA2: string
    /** Profile A, the job's own depot, and deliberately NO movements - so only the Restrict
     *  foreign key can refuse deleting it. */
    itemStockA3: string
    itemStockB: string
    movementA: string
    movementA2: string
}

/**
 * Seeds two tenants. Profile A gets an offering, TWO locations, a technician, two jobs (the first
 * dispatched from location A), two checklist templates, and stock at both of its locations.
 * Profile B gets its own stock, which is what makes the cross-tenant part refusal testable.
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
        await mk(
            `insert into "DigitalProduct" ("id","profileId","title","updatedAt") values ('${q(`prod${side}`)}','${q(`pr${side}`)}','Pump seal',CURRENT_TIMESTAMP)`,
        )
        await mk(
            `insert into "ProductVariant" ("id","profileId","productId","title","updatedAt") values ('${q(`var${side}`)}','${q(`pr${side}`)}','${q(`prod${side}`)}','Standard',CURRENT_TIMESTAMP)`,
        )
    }
    // A second sellable unit for profile A. InventoryItem is unique on (variantId, locationId), so
    // a second stock record at the SAME depot needs a different variant - it cannot simply be a
    // duplicate row.
    await mk(
        `insert into "ProductVariant" ("id","profileId","productId","title","updatedAt") values ('${q("vara2")}','${q("pra")}','${q("proda")}','Oversize',CURRENT_TIMESTAMP)`,
    )

    // Profile A has two depots; profile B has one.
    await mk(
        `insert into "Location" ("id","workspaceId","name","updatedAt") values ('${q("loc")}','${q("wsa")}','North depot',CURRENT_TIMESTAMP)`,
    )
    await mk(
        `insert into "Location" ("id","workspaceId","name","updatedAt") values ('${q("loc2")}','${q("wsa")}','South depot',CURRENT_TIMESTAMP)`,
    )
    await mk(
        `insert into "Location" ("id","workspaceId","name","updatedAt") values ('${q("locb")}','${q("wsb")}','Their depot',CURRENT_TIMESTAMP)`,
    )
    await mk(
        `insert into "ServiceOffering" ("id","profileId","name","updatedAt") values ('${q("svc")}','${q("pra")}','Boiler service',CURRENT_TIMESTAMP)`,
    )
    for (const [id, profile] of [
        [q("t1"), q("pra")],
        [q("tb"), q("prb")],
    ]) {
        await mk(
            `insert into "AppointmentResource" ("id","profileId","name","kind","updatedAt") values ('${id}','${profile}','${id}','STAFF',CURRENT_TIMESTAMP)`,
        )
    }

    // Job 1 names an origin location, so the location boundary applies to it. Job 2 does not.
    await mk(
        `insert into "FieldJob" ("id","profileId","serviceOfferingId","originLocationId","reference","title","status","priority","siteAddress","updatedAt")
         values ('${q("job")}','${q("pra")}','${q("svc")}','${q("loc")}','${q("job")}','Boiler call','IN_PROGRESS','NORMAL','12 Example Street',CURRENT_TIMESTAMP)`,
    )
    await mk(
        `insert into "FieldJob" ("id","profileId","reference","title","status","priority","siteAddress","updatedAt")
         values ('${q("job2")}','${q("pra")}','${q("job2")}','Second call','DRAFT','NORMAL','14 Example Street',CURRENT_TIMESTAMP)`,
    )
    await mk(
        `insert into "FieldJobAssignment" ("id","jobId","resourceId","role","state","updatedAt")
         values ('${q("lead")}','${q("job")}','${q("t1")}','LEAD','ON_SITE',CURRENT_TIMESTAMP)`,
    )
    await mk(
        `insert into "FieldJobAssignment" ("id","jobId","resourceId","role","state","updatedAt")
         values ('${q("lead2")}','${q("job2")}','${q("t1")}','LEAD','ASSIGNED',CURRENT_TIMESTAMP)`,
    )

    // Two checklist templates, so citing a line from the wrong one is testable.
    for (const [tid, name] of [
        [q("tpl"), "Annual boiler check"],
        [q("tpl2"), "Unrelated checklist"],
    ]) {
        await mk(
            `insert into "FieldJobInspectionTemplate" ("id","profileId","serviceOfferingId","name","updatedAt")
             values ('${tid}','${q("pra")}','${q("svc")}','${name}',CURRENT_TIMESTAMP)`,
        )
    }
    await mk(
        `insert into "FieldJobInspectionTemplateItem" ("id","templateId","position","kind","label","updatedAt")
         values ('${q("tplitem")}','${q("tpl")}',0,'CHECK','Flue clear',CURRENT_TIMESTAMP)`,
    )
    await mk(
        `insert into "FieldJobInspectionTemplateItem" ("id","templateId","position","kind","label","updatedAt")
         values ('${q("tplitem2")}','${q("tpl2")}',0,'CHECK','Unrelated line',CURRENT_TIMESTAMP)`,
    )

    // Stock: profile A at both depots, profile B at its own. stock3 sits at A's own depot and is
    // deliberately given NO movement, so the Restrict test cannot be satisfied by the
    // InventoryMovement append-only trigger firing first on a cascade.
    for (const [id, profile, prod, variant, loc] of [
        [q("stock"), q("pra"), q("proda"), q("vara"), q("loc")],
        [q("stock2"), q("pra"), q("proda"), q("vara"), q("loc2")],
        [q("stock3"), q("pra"), q("proda"), q("vara2"), q("loc")],
        [q("stockb"), q("prb"), q("prodb"), q("varb"), q("locb")],
    ]) {
        await mk(
            `insert into "InventoryItem" ("id","profileId","productId","variantId","locationId","onHand","reserved","updatedAt")
             values ('${id}','${profile}','${prod}','${variant}','${loc}',10,0,CURRENT_TIMESTAMP)`,
        )
    }
    await mk(
        `insert into "InventoryMovement" ("id","itemId","kind","qtyDelta","reservedDelta","onHandAfter","reservedAfter")
         values ('${q("mv")}','${q("stock")}','CONSUME',-1,0,9,0)`,
    )
    await mk(
        `insert into "InventoryMovement" ("id","itemId","kind","qtyDelta","reservedDelta","onHandAfter","reservedAfter")
         values ('${q("mv2")}','${q("stock2")}','CONSUME',-1,0,9,0)`,
    )

    return {
        profileA: q("pra"),
        profileB: q("prb"),
        offeringA: q("svc"),
        locationA: q("loc"),
        locationA2: q("loc2"),
        jobA: q("job"),
        jobA2: q("job2"),
        leadA: q("lead"),
        leadA2: q("lead2"),
        templateA: q("tpl"),
        templateA2: q("tpl2"),
        tplItemA: q("tplitem"),
        tplItemA2: q("tplitem2"),
        itemStockA: q("stock"),
        itemStockA2: q("stock2"),
        itemStockA3: q("stock3"),
        itemStockB: q("stockb"),
        movementA: q("mv"),
        movementA2: q("mv2"),
    }
}

let prismaRef: PrismaClient | null = null

/** Runs body against a freshly seeded, always-rolled-back transaction. */
/**
 * Runs body against a freshly seeded, always-rolled-back transaction.
 *
 * SEED FAILURES ARE TRACKED SEPARATELY AND ON PURPOSE. If a seed error were reported as a throw,
 * every `refuses` test would pass the moment the fixtures broke - the harness would go green while
 * proving nothing at all. This exact defect appeared while writing this file: adding a second
 * stock row at one depot violated InventoryItem's (variantId, locationId) unique key, and thirteen
 * assertions changed verdict without a single rule under test changing. A seed failure now fails
 * the harness loudly instead.
 */
async function attempt(
    tag: string,
    body: (tx: Tx, s: Seeded) => Promise<unknown>,
): Promise<{ threw: boolean; detail: string; raw: string; seedFailed: boolean }> {
    let threw = false
    let seedFailed = false
    let detail = ""
    let raw = ""
    try {
        await prismaRef!.$transaction(async (tx) => {
            let s: Seeded
            try {
                s = await seed(tx, tag)
            } catch (e) {
                seedFailed = true
                detail = errLine(e)
                raw = fullErr(e)
                throw new Rollback()
            }
            try {
                await body(tx, s)
            } catch (e) {
                threw = true
                detail = errLine(e)
                raw = fullErr(e)
            }
            throw new Rollback()
        })
    } catch (e) {
        if (!(e instanceof Rollback) && !threw && !seedFailed) {
            threw = true
            detail = errLine(e)
            raw = fullErr(e)
        }
    }
    return { threw, detail, raw, seedFailed }
}

async function refuses(name: string, tag: string, body: (tx: Tx, s: Seeded) => Promise<unknown>) {
    const r = await attempt(tag, body)
    if (r.seedFailed) return check(name, false, `SEED FAILED, rule never reached: ${r.detail}`)
    checkInvertible(name, r.threw, r.threw ? r.detail : "ACCEPTED - no refusal")
}

/**
 * Refused, AND refused by the constraint named. Used wherever more than one rule could plausibly
 * have rejected the row, so the test cannot pass because something unrelated failed first.
 */
async function refusesBy(name: string, tag: string, pattern: RegExp, body: (tx: Tx, s: Seeded) => Promise<unknown>) {
    const r = await attempt(tag, body)
    if (r.seedFailed) return check(name, false, `SEED FAILED, rule never reached: ${r.detail}`)
    const matched = r.threw && pattern.test(r.raw)
    checkInvertible(
        name,
        matched,
        !r.threw ? "ACCEPTED - no refusal" : matched ? `refused by ${pattern.source}` : `WRONG REFUSAL: ${r.raw.slice(0, 150)}`,
    )
}

async function accepts(name: string, tag: string, body: (tx: Tx, s: Seeded) => Promise<unknown>) {
    const r = await attempt(tag, body)
    if (r.seedFailed) return check(name, false, `SEED FAILED: ${r.detail}`)
    checkInvertible(name, !r.threw, r.threw ? r.detail : "ACCEPTED")
}

/** A valid open inspection on job 1, used as the base for most behavioural tests. */
function insertInspection(
    tx: Tx,
    s: Seeded,
    id: string,
    overrides: Record<string, string> = {},
): Promise<number> {
    const cols: Record<string, string> = {
        id: `'${id}'`,
        jobId: `'${s.jobA}'`,
        profileId: `'${s.profileA}'`,
        templateId: `'${s.templateA}'`,
        assignmentId: `'${s.leadA}'`,
        reference: `'${id}'`,
        status: `'IN_PROGRESS'`,
        updatedAt: "CURRENT_TIMESTAMP",
        ...overrides,
    }
    const names = Object.keys(cols)
        .map((c) => `"${c}"`)
        .join(",")
    const values = Object.values(cols).join(",")
    return tx.$executeRawUnsafe(`insert into "FieldJobInspection" (${names}) values (${values})`)
}

function insertItem(tx: Tx, inspectionId: string, id: string, overrides: Record<string, string> = {}): Promise<number> {
    const cols: Record<string, string> = {
        id: `'${id}'`,
        inspectionId: `'${inspectionId}'`,
        position: "0",
        kind: `'CHECK'`,
        label: `'Flue clear'`,
        updatedAt: "CURRENT_TIMESTAMP",
        ...overrides,
    }
    const names = Object.keys(cols)
        .map((c) => `"${c}"`)
        .join(",")
    return tx.$executeRawUnsafe(
        `insert into "FieldJobInspectionItem" (${names}) values (${Object.values(cols).join(",")})`,
    )
}

function insertPart(tx: Tx, inspectionId: string, id: string, overrides: Record<string, string> = {}): Promise<number> {
    const cols: Record<string, string> = {
        id: `'${id}'`,
        inspectionId: `'${inspectionId}'`,
        qty: "1",
        updatedAt: "CURRENT_TIMESTAMP",
        ...overrides,
    }
    const names = Object.keys(cols)
        .map((c) => `"${c}"`)
        .join(",")
    return tx.$executeRawUnsafe(
        `insert into "FieldJobInspectionPart" (${names}) values (${Object.values(cols).join(",")})`,
    )
}

async function counts(prisma: PrismaClient): Promise<Record<string, number>> {
    const out: Record<string, number> = {}
    for (const t of [...NEW_TABLES, "FieldJob", "FieldJobEvent", "InventoryItem", "InventoryMovement", "Location"]) {
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

        // ---- 1. structure: present, and no fork came with it ------------------
        const tables = (
            await prisma.$queryRawUnsafe<{ table_name: string }[]>(
                "select table_name from information_schema.tables where table_schema='public'",
            )
        ).map((r) => r.table_name)

        const missing = NEW_TABLES.filter((t) => !tables.includes(t))
        check("all 5 inspection tables present", missing.length === 0, missing.length ? `missing: ${missing}` : "5/5")

        const forked = FORBIDDEN_TABLES.filter((t) => tables.includes(t))
        checkInvertible(
            "building inspection brought no Asset registry, parts catalogue, invoice, notification or route table",
            forked.length === 0,
            forked.join(",") || "none of 15",
        )
        checkInvertible(
            "the event ledger was reused, not forked - no FieldJobInspectionEvent table exists",
            !tables.includes("FieldJobInspectionEvent") && !tables.includes("InspectionEvent"),
            "absent",
        )

        // ---- 2. enums exactly as declared ------------------------------------
        const enumRows = await prisma.$queryRawUnsafe<{ typname: string; enumlabel: string; enumsortorder: number }[]>(
            "select t.typname, e.enumlabel, e.enumsortorder from pg_type t join pg_enum e on e.enumtypid=t.oid order by t.typname, e.enumsortorder",
        )
        for (const [name, labels] of NEW_ENUMS) {
            const got = enumRows.filter((r) => r.typname === name).map((r) => r.enumlabel)
            check(
                `enum ${name} has exactly ${labels.length} values in order`,
                got.length === labels.length && got.every((g, i) => g === labels[i]),
                got.join(",") || "MISSING",
            )
        }
        // The choice that made a byte-identical rollback possible.
        const eventKinds = enumRows.filter((r) => r.typname === "FieldJobEventKind").map((r) => r.enumlabel)
        checkInvertible(
            "FieldJobEventKind still has exactly its six G4 values - no ALTER TYPE ADD VALUE was needed",
            eventKinds.length === 6 &&
                ["CREATED", "STATUS", "ASSIGNMENT", "SCHEDULE", "ESTIMATE", "NOTE"].every((k) => eventKinds.includes(k)),
            eventKinds.join(","),
        )

        // ---- 3. reuse foreign keys, verified BY NAME -------------------------
        const fks = await prisma.$queryRawUnsafe<
            { table_name: string; column_name: string; foreign_table_name: string }[]
        >(`
            select tc.table_name, kcu.column_name, ccu.table_name as foreign_table_name
              from information_schema.table_constraints tc
              join information_schema.key_column_usage kcu
                on tc.constraint_name = kcu.constraint_name and tc.table_schema = kcu.table_schema
              join information_schema.constraint_column_usage ccu
                on ccu.constraint_name = tc.constraint_name and ccu.table_schema = tc.table_schema
             where tc.constraint_type = 'FOREIGN KEY' and tc.table_schema = 'public'
        `)
        for (const [table, column, target] of REUSE_FKS) {
            const hit = fks.find((f) => f.table_name === table && f.column_name === column && f.foreign_table_name === target)
            checkInvertible(`${table}.${column} points at ${target}`, Boolean(hit), hit ? "verified" : "MISSING OR WRONG TARGET")
        }

        // ---- 4. constraints, index and triggers ------------------------------
        const constraintNames = (
            await prisma.$queryRawUnsafe<{ conname: string }[]>(
                "select conname from pg_constraint where contype='c' and connamespace='public'::regnamespace",
            )
        ).map((r) => r.conname)
        const missingChecks = CHECK_CONSTRAINTS.filter((c) => !constraintNames.includes(c))
        check(
            `all ${CHECK_CONSTRAINTS.length} inspection CHECK constraints exist`,
            missingChecks.length === 0,
            missingChecks.join(",") || `${CHECK_CONSTRAINTS.length}/${CHECK_CONSTRAINTS.length}`,
        )

        const idx = await prisma.$queryRawUnsafe<{ indexname: string; indexdef: string }[]>(
            "select indexname, indexdef from pg_indexes where schemaname='public' and indexname = 'FieldJobInspection_one_open_per_job'",
        )
        checkInvertible(
            "the one-open-inspection-per-job index is UNIQUE and PARTIAL on the three open statuses",
            idx.length === 1 &&
                /UNIQUE/i.test(idx[0].indexdef) &&
                /WHERE/i.test(idx[0].indexdef) &&
                /DRAFT/.test(idx[0].indexdef) &&
                /IN_PROGRESS/.test(idx[0].indexdef) &&
                /SUBMITTED/.test(idx[0].indexdef),
            idx[0]?.indexdef?.slice(0, 150) ?? "MISSING",
        )

        const triggerRows = await prisma.$queryRawUnsafe<{ event_object_table: string; trigger_name: string }[]>(
            "select event_object_table, trigger_name from information_schema.triggers where trigger_schema='public'",
        )
        for (const [table, trigger] of TRIGGERS) {
            check(
                `trigger ${trigger} exists on ${table}`,
                triggerRows.some((t) => t.event_object_table === table && t.trigger_name === trigger),
                "present",
            )
        }
        check(
            "FieldJobEvent is still append-only, so inspection history cannot be rewritten",
            triggerRows.some((t) => t.trigger_name === "FieldJobEvent_append_only"),
            "present",
        )

        // ---- 5. no column makes a claim this wave does not ---------------------
        const cols = await prisma.$queryRawUnsafe<{ table_name: string; column_name: string }[]>(
            "select table_name, column_name from information_schema.columns where table_schema='public'",
        )
        const newCols = cols.filter((c) => (NEW_TABLES as readonly string[]).includes(c.table_name))
        const claimed = newCols.filter((c) => (FORBIDDEN_COLUMNS as readonly string[]).includes(c.column_name))
        checkInvertible(
            "no geo, travel-time, notification, invoice-id, payment-id or upload column exists on any inspection table",
            claimed.length === 0,
            claimed.map((c) => `${c.table_name}.${c.column_name}`).join(",") || `checked ${newCols.length} columns`,
        )
        const bolted = cols.filter(
            (c) => (UNTOUCHED_TABLES as readonly string[]).includes(c.table_name) && /inspection/i.test(c.column_name),
        )
        checkInvertible(
            "inspection bolted no column onto FieldJob, FieldJobEvent, InventoryItem or any other pre-existing table",
            bolted.length === 0,
            bolted.map((c) => `${c.table_name}.${c.column_name}`).join(",") || "none",
        )

        // ---- 6. tenancy and identity the database enforces itself -------------
        await refuses(
            "an inspection claiming a different profile than its job is refused by trigger",
            "t1",
            (tx, s) => insertInspection(tx, s, `${RUN}_t1_i`, { profileId: `'${s.profileB}'` }),
        )
        await refuses(
            "an inspection citing an assignment from another job is refused by trigger",
            "t2",
            (tx, s) => insertInspection(tx, s, `${RUN}_t2_i`, { assignmentId: `'${s.leadA2}'` }),
        )
        await accepts("a well-formed open inspection is accepted", "t3", (tx, s) =>
            insertInspection(tx, s, `${RUN}_t3_i`),
        )

        // ---- 7. an inspection cannot finish without saying anything -----------
        await refuses("a COMPLETED inspection with no outcome is refused", "t4", (tx, s) =>
            insertInspection(tx, s, `${RUN}_t4_i`, {
                status: `'COMPLETED'`,
                completionNotes: `'All good'`,
                completedAt: "CURRENT_TIMESTAMP",
            }),
        )
        await refuses("a COMPLETED inspection with whitespace-only notes is refused, not just a NULL one", "t5", (tx, s) =>
            insertInspection(tx, s, `${RUN}_t5_i`, {
                status: `'COMPLETED'`,
                outcome: `'PASS'`,
                completionNotes: `'   '`,
                completedAt: "CURRENT_TIMESTAMP",
            }),
        )
        await refuses("a CANCELLED inspection with no reason is refused", "t6", (tx, s) =>
            insertInspection(tx, s, `${RUN}_t6_i`, { status: `'CANCELLED'`, cancelledAt: "CURRENT_TIMESTAMP" }),
        )
        await accepts("a COMPLETED inspection with an outcome and notes is accepted", "t7", (tx, s) =>
            insertInspection(tx, s, `${RUN}_t7_i`, {
                status: `'COMPLETED'`,
                outcome: `'PASS'`,
                completionNotes: `'Flue clear, pressure nominal'`,
                completedAt: "CURRENT_TIMESTAMP",
            }),
        )

        // ---- 8. billing cannot be handed off before the work is finished ------
        await refuses("marking an unfinished inspection READY to invoice is refused", "t8", (tx, s) =>
            insertInspection(tx, s, `${RUN}_t8_i`, { invoiceHandoffState: `'READY'` }),
        )
        await refuses("HANDED_OFF without a handoff timestamp is refused", "t9", (tx, s) =>
            insertInspection(tx, s, `${RUN}_t9_i`, {
                status: `'COMPLETED'`,
                outcome: `'PASS'`,
                completionNotes: `'done'`,
                completedAt: "CURRENT_TIMESTAMP",
                invoiceHandoffState: `'HANDED_OFF'`,
            }),
        )
        await accepts("a completed inspection may be handed off with a timestamp", "t10", (tx, s) =>
            insertInspection(tx, s, `${RUN}_t10_i`, {
                status: `'COMPLETED'`,
                outcome: `'PASS'`,
                completionNotes: `'done'`,
                completedAt: "CURRENT_TIMESTAMP",
                invoiceHandoffState: `'HANDED_OFF'`,
                invoiceHandoffAt: "CURRENT_TIMESTAMP",
                invoiceHandoffReference: `'OWNER-REF-1'`,
            }),
        )

        // ---- 9. one open inspection per job -----------------------------------
        // Postgres reports the conflicting KEY COLUMNS rather than the index name, so that is what
        // is matched. Together with the structural assertion above (the index is UNIQUE and
        // PARTIAL on exactly the three open statuses) and the positive control below (a second
        // inspection IS allowed once the first completes), this pins the refusal to the partial
        // index rather than to uniqueness on jobId in general - there is no such plain key.
        await refusesBy(
            "a second OPEN inspection on the same job is refused on the jobId key",
            "t11",
            /Key \("jobId"\)=/,
            async (tx, s) => {
                await insertInspection(tx, s, `${RUN}_t11_a`)
                await insertInspection(tx, s, `${RUN}_t11_b`, { status: `'DRAFT'` })
            },
        )
        await accepts("a new inspection is allowed once the previous one is COMPLETED", "t12", async (tx, s) => {
            await insertInspection(tx, s, `${RUN}_t12_a`, {
                status: `'COMPLETED'`,
                outcome: `'FAIL'`,
                completionNotes: `'Seal perished'`,
                completedAt: "CURRENT_TIMESTAMP",
            })
            await insertInspection(tx, s, `${RUN}_t12_b`, { status: `'DRAFT'` })
        })

        // ---- 10. a line has to be answerable ----------------------------------
        await refuses("a MEASUREMENT item with no unit is refused - 12 what?", "t13", async (tx, s) => {
            await insertInspection(tx, s, `${RUN}_t13_i`)
            await insertItem(tx, `${RUN}_t13_i`, `${RUN}_t13_it`, { kind: `'MEASUREMENT'`, measuredValue: "12.5" })
        })
        await refuses("an ASSET item that does not name the equipment is refused", "t14", async (tx, s) => {
            await insertInspection(tx, s, `${RUN}_t14_i`)
            await insertItem(tx, `${RUN}_t14_i`, `${RUN}_t14_it`, { kind: `'ASSET'` })
        })
        await refuses("a FAILED item with no notes is refused - an unexplained failure reads as a mistake", "t15", async (tx, s) => {
            await insertInspection(tx, s, `${RUN}_t15_i`)
            await insertItem(tx, `${RUN}_t15_i`, `${RUN}_t15_it`, { result: `'FAIL'` })
        })
        await refuses("an expected range that ends below where it starts is refused", "t16", async (tx, s) => {
            await insertInspection(tx, s, `${RUN}_t16_i`)
            await insertItem(tx, `${RUN}_t16_i`, `${RUN}_t16_it`, {
                kind: `'MEASUREMENT'`,
                unit: `'bar'`,
                expectedMin: "3.0",
                expectedMax: "1.0",
            })
        })
        await refusesBy(
            "two items cannot occupy the same position in one inspection",
            "t17",
            /Key \("inspectionId", "position"\)=/,
            async (tx, s) => {
                await insertInspection(tx, s, `${RUN}_t17_i`)
                await insertItem(tx, `${RUN}_t17_i`, `${RUN}_t17_a`)
                await insertItem(tx, `${RUN}_t17_i`, `${RUN}_t17_b`)
            },
        )
        await refuses("an item citing a template line from a DIFFERENT template is refused by trigger", "t18", async (tx, s) => {
            await insertInspection(tx, s, `${RUN}_t18_i`)
            await insertItem(tx, `${RUN}_t18_i`, `${RUN}_t18_it`, { templateItemId: `'${s.tplItemA2}'` })
        })
        await accepts("an item citing its own template's line is accepted", "t19", async (tx, s) => {
            await insertInspection(tx, s, `${RUN}_t19_i`)
            await insertItem(tx, `${RUN}_t19_i`, `${RUN}_t19_it`, { templateItemId: `'${s.tplItemA}'` })
        })
        await accepts("a measurement with a unit, a reading and an ordered range is accepted", "t20", async (tx, s) => {
            await insertInspection(tx, s, `${RUN}_t20_i`)
            await insertItem(tx, `${RUN}_t20_i`, `${RUN}_t20_it`, {
                kind: `'MEASUREMENT'`,
                unit: `'bar'`,
                measuredValue: "1.4",
                expectedMin: "1.0",
                expectedMax: "2.0",
                result: `'PASS'`,
            })
        })

        // ---- 11. PARTS MAY NOT CROSS A TENANT OR LOCATION BOUNDARY ------------
        await refuses("a part drawn from ANOTHER TENANT'S stock is refused by trigger", "t21", async (tx, s) => {
            await insertInspection(tx, s, `${RUN}_t21_i`)
            await insertPart(tx, `${RUN}_t21_i`, `${RUN}_t21_p`, { inventoryItemId: `'${s.itemStockB}'` })
        })
        await refuses("a part drawn from a DIFFERENT LOCATION than the job's origin depot is refused by trigger", "t22", async (tx, s) => {
            await insertInspection(tx, s, `${RUN}_t22_i`)
            await insertPart(tx, `${RUN}_t22_i`, `${RUN}_t22_p`, { inventoryItemId: `'${s.itemStockA2}'` })
        })
        await accepts("a part drawn from the job's own origin depot is accepted", "t23", async (tx, s) => {
            await insertInspection(tx, s, `${RUN}_t23_i`)
            await insertPart(tx, `${RUN}_t23_i`, `${RUN}_t23_p`, { inventoryItemId: `'${s.itemStockA}'` })
        })
        await accepts(
            "when the job names NO origin depot the location rule does not apply, and the tenant rule still does",
            "t24",
            async (tx, s) => {
                await insertInspection(tx, s, `${RUN}_t24_i`, { jobId: `'${s.jobA2}'`, assignmentId: `'${s.leadA2}'` })
                await insertPart(tx, `${RUN}_t24_i`, `${RUN}_t24_p`, { inventoryItemId: `'${s.itemStockA2}'` })
            },
        )
        await refuses(
            "even with no origin depot, a part from another tenant's stock is still refused",
            "t25",
            async (tx, s) => {
                await insertInspection(tx, s, `${RUN}_t25_i`, { jobId: `'${s.jobA2}'`, assignmentId: `'${s.leadA2}'` })
                await insertPart(tx, `${RUN}_t25_i`, `${RUN}_t25_p`, { inventoryItemId: `'${s.itemStockB}'` })
            },
        )

        // ---- 12. part bookkeeping composes the existing ledger ----------------
        await refuses("a part citing a movement that moved a DIFFERENT stock record is refused by trigger", "t26", async (tx, s) => {
            await insertInspection(tx, s, `${RUN}_t26_i`)
            await insertPart(tx, `${RUN}_t26_i`, `${RUN}_t26_p`, {
                inventoryItemId: `'${s.itemStockA}'`,
                movementId: `'${s.movementA2}'`,
            })
        })
        await accepts("a part citing the movement of its own stock record is accepted", "t27", async (tx, s) => {
            await insertInspection(tx, s, `${RUN}_t27_i`)
            await insertPart(tx, `${RUN}_t27_i`, `${RUN}_t27_p`, {
                inventoryItemId: `'${s.itemStockA}'`,
                movementId: `'${s.movementA}'`,
            })
        })
        await refusesBy(
            "two part lines cannot both claim the same inventory movement",
            "t28",
            /Key \("movementId"\)=/,
            async (tx, s) => {
                await insertInspection(tx, s, `${RUN}_t28_i`)
                await insertPart(tx, `${RUN}_t28_i`, `${RUN}_t28_a`, {
                    inventoryItemId: `'${s.itemStockA}'`,
                    movementId: `'${s.movementA}'`,
                })
                await insertPart(tx, `${RUN}_t28_i`, `${RUN}_t28_b`, {
                    inventoryItemId: `'${s.itemStockA}'`,
                    movementId: `'${s.movementA}'`,
                })
            },
        )
        await refuses("using zero of a part is refused - that is not using a part", "t29", async (tx, s) => {
            await insertInspection(tx, s, `${RUN}_t29_i`)
            await insertPart(tx, `${RUN}_t29_i`, `${RUN}_t29_p`, { inventoryItemId: `'${s.itemStockA}'`, qty: "0" })
        })
        await refuses("a negative part cost is refused", "t30", async (tx, s) => {
            await insertInspection(tx, s, `${RUN}_t30_i`)
            await insertPart(tx, `${RUN}_t30_i`, `${RUN}_t30_p`, {
                inventoryItemId: `'${s.itemStockA}'`,
                unitCostCents: "-1",
            })
        })

        // ---- 13. deleting the stock record cannot orphan a part line ----------
        // stock3 has NO movements on purpose. Without that, the cascade to InventoryMovement hits
        // the append-only trigger first and this test would pass while proving nothing about the
        // foreign key it claims to be about.
        await refusesBy(
            "deleting a stock record a part line cites is refused BY the foreign key (Restrict, not Cascade)",
            "t31",
            /foreign key|violates foreign key constraint|still referenced/i,
            async (tx, s) => {
                await insertInspection(tx, s, `${RUN}_t31_i`)
                await insertPart(tx, `${RUN}_t31_i`, `${RUN}_t31_p`, { inventoryItemId: `'${s.itemStockA3}'` })
                await tx.$executeRawUnsafe(`delete from "InventoryItem" where "id" = '${s.itemStockA3}'`)
            },
        )

        // ---- 14. residue ------------------------------------------------------
        const after = await counts(prisma)
        const drifted = Object.keys(baseline).filter((k) => baseline[k] !== after[k])
        check(
            "harness left zero residue",
            drifted.length === 0,
            drifted.map((k) => `${k}: ${baseline[k]}->${after[k]}`).join(", ") || "clean",
        )
    } finally {
        await prisma.$disconnect()
    }

    const failed = results.filter((r) => !r.pass)
    for (const r of results) {
        console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.name}${r.detail ? `  (${r.detail})` : ""}`)
    }
    console.log("")
    console.log(`${results.length - failed.length}/${results.length} invariants passed`)
    if (INVERT) console.log("INVERT_ASSERTION=1 was set: failures below are the point.")
    if (failed.length > 0) {
        console.error(`${failed.length} inspection schema invariant(s) FAILED`)
        process.exit(1)
    }
    console.log("All fieldJobs:inspection schema invariants hold.")
}

main().catch((e) => {
    console.error(e)
    process.exit(1)
})

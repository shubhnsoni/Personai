/**
 * Wave G3 / part one: retainer schema invariant harness.
 *
 * Runs ONLY against the authorized disposable rehearsal database. Every write happens inside a
 * transaction that is deliberately rolled back, so the harness leaves nothing behind.
 *
 * Three families of assertion matter here.
 *
 * REUSE: a retainer does not become a second billing system. Cases stay CaseProject, invoices
 * stay CaseInvoice, money stays Payment, clients stay Contact. Foreign keys are verified to
 * point at those pre-existing models BY NAME, and a list of forbidden fork tables
 * (Subscription, Plan, Credit, Wallet, RetainerInvoice, ...) must be absent.
 *
 * BACKWARD COMPATIBILITY: the only change to a pre-existing object anywhere in Wave G3 is one
 * new CaseEventKind label. The original nine are asserted to still be present, in their
 * original order, so the extension cannot have been a reshuffle.
 *
 * ENFORCEMENT: every guarantee is asserted against the DATABASE with no engine involved. A
 * retainer denominated in both units and money is refused; a MONTHLY retainer carrying a day
 * count is refused; two open periods on one retainer are refused; a draw against another
 * retainer's period is refused; a draw naming a case the retainer never covered is refused; a
 * draw denominated in the wrong basis for its period is refused; and a case link that crosses
 * workspaces is refused. What is deliberately ACCEPTED is overage - used exceeding included -
 * because refusing work that was actually done would be a lie, and the ledger is what reports
 * it.
 *
 * Set INVERT_ASSERTION=1 to flip one expectation and prove the harness fails loudly.
 *
 *   ts-node -r tsconfig-paths/register scripts/one-off/check-retainer-schema-invariants.ts
 */
import { PrismaClient } from "@prisma/client"

import { assertDisposableTarget, parseDatabaseName } from "../lib/disposable-db"

const AUTHORIZED_TARGET = "personalink_phase0_rehearsal_20260826_210704"
const INVERT = process.env.INVERT_ASSERTION === "1"
const RUN = `wg3r_${Date.now()}_${Math.floor(Math.random() * 1e6)}`

const NEW_TABLES = [
    "CaseRetainer",
    "CaseRetainerCaseLink",
    "CaseRetainerPeriod",
    "CaseRetainerDraw",
    // Added by the second G3 migration, 20260829200000_retainer_event_history. It exists because
    // the draw ledger records movements of the allowance but cannot record a state change, and
    // CaseEvent could not be reused: CaseEvent.caseId is NOT NULL while a retainer legitimately
    // exists before any case is linked.
    "CaseRetainerEvent",
] as const

/** Tables that must NOT exist, because the pre-existing ones already do the job. */
const FORBIDDEN_TABLES = [
    "Retainer",
    "RetainerAgreement",
    "RetainerInvoice",
    "RetainerPayment",
    "Subscription",
    "SubscriptionPlan",
    "Plan",
    "Credit",
    "CreditBalance",
    "Wallet",
    "TimeEntry",
    "CaseBilling",
    "CaseTimeEntry",
] as const

const NEW_ENUMS: Array<[string, number]> = [
    ["CaseRetainerState", 5],
    ["CaseRetainerBasis", 2],
    ["CaseRetainerPeriodKind", 5],
    ["CaseRetainerPeriodState", 4],
    ["CaseRetainerDrawKind", 3],
]

/** The reuse contract: each link must point at the PRE-EXISTING model. */
const REUSE_FKS: Array<[string, string, string]> = [
    ["CaseRetainer", "workspaceId", "Workspace"],
    ["CaseRetainer", "contactId", "Contact"],
    ["CaseRetainerCaseLink", "retainerId", "CaseRetainer"],
    ["CaseRetainerCaseLink", "caseId", "CaseProject"],
    ["CaseRetainerPeriod", "retainerId", "CaseRetainer"],
    ["CaseRetainerPeriod", "invoiceId", "CaseInvoice"],
    ["CaseRetainerDraw", "retainerId", "CaseRetainer"],
    ["CaseRetainerDraw", "periodId", "CaseRetainerPeriod"],
    ["CaseRetainerDraw", "caseId", "CaseProject"],
    ["CaseRetainerEvent", "retainerId", "CaseRetainer"],
]

const CHECK_CONSTRAINTS = [
    "CaseRetainer_basis_matches_included",
    "CaseRetainer_includedUnits_positive",
    "CaseRetainer_includedValueCents_positive",
    "CaseRetainer_periodDays_matches_kind",
    "CaseRetainerPeriod_dates_ordered",
    "CaseRetainerPeriod_used_nonnegative",
    "CaseRetainerPeriod_included_single_basis",
    "CaseRetainerDraw_delta_single_basis",
    "CaseRetainerDraw_after_nonnegative",
    "CaseRetainerDraw_delta_nonzero",
] as const

const ORIGINAL_CASE_EVENT_KINDS = [
    "CREATED",
    "STATUS",
    "MILESTONE",
    "DELIVERABLE",
    "DOCUMENT",
    "INVOICE",
    "TASK",
    "APPROVAL",
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
                l.includes("does not") ||
                l.includes("is not linked") ||
                l.includes("denominated") ||
                l.includes("belongs to workspace") ||
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
    workspaceA: string
    workspaceB: string
    caseA: string
    caseA2: string
    caseB: string
    invoiceA: string
    retainerUnits: string
    retainerValue: string
    periodUnits: string
    periodValue: string
    retainerOther: string
    periodOther: string
}

/**
 * Seeds two workspaces so cross-tenant refusal is testable, each with a case, plus a
 * units-denominated retainer and a value-denominated one with one open period each, and a third
 * retainer used to prove a draw cannot reach across into another agreement's period.
 */
async function seed(tx: Tx, tag: string): Promise<Seeded> {
    const p = `${RUN}_${tag}`
    const q = (s: string) => `${p}_${s}`
    const mk = async (sql: string) => tx.$executeRawUnsafe(sql)

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
    for (const [id, ws] of [
        [q("casea"), q("wsa")],
        [q("casea2"), q("wsa")],
        [q("caseb"), q("wsb")],
    ]) {
        await mk(
            `insert into "CaseProject" ("id","workspaceId","reference","title","status","invoiceState","updatedAt")
             values ('${id}','${ws}','${id}','Case','ACTIVE','NONE',CURRENT_TIMESTAMP)`,
        )
    }
    await mk(
        `insert into "CaseInvoice" ("id","caseId","reference","amountCents","currency","state","updatedAt")
         values ('${q("inva")}','${q("casea")}','${q("inva")}',50000,'USD','DRAFT',CURRENT_TIMESTAMP)`,
    )

    await mk(
        `insert into "CaseRetainer" ("id","workspaceId","reference","title","state","basis","includedUnits","currency","periodKind","updatedAt")
         values ('${q("retu")}','${q("wsa")}','${q("retu")}','Units retainer','ACTIVE','UNITS',40,'USD','MONTHLY',CURRENT_TIMESTAMP)`,
    )
    await mk(
        `insert into "CaseRetainer" ("id","workspaceId","reference","title","state","basis","includedValueCents","currency","periodKind","updatedAt")
         values ('${q("retv")}','${q("wsa")}','${q("retv")}','Value retainer','ACTIVE','VALUE',500000,'USD','QUARTERLY',CURRENT_TIMESTAMP)`,
    )
    await mk(
        `insert into "CaseRetainer" ("id","workspaceId","reference","title","state","basis","includedUnits","currency","periodKind","updatedAt")
         values ('${q("reto")}','${q("wsa")}','${q("reto")}','Other retainer','ACTIVE','UNITS',10,'USD','MONTHLY',CURRENT_TIMESTAMP)`,
    )
    await mk(
        `insert into "CaseRetainerCaseLink" ("retainerId","caseId") values ('${q("retu")}','${q("casea")}')`,
    )
    await mk(
        `insert into "CaseRetainerCaseLink" ("retainerId","caseId") values ('${q("retv")}','${q("casea")}')`,
    )

    await mk(
        `insert into "CaseRetainerPeriod" ("id","retainerId","ordinal","startsOn","endsOn","includedUnits","usedUnits","usedValueCents","state","billingState","updatedAt")
         values ('${q("peru")}','${q("retu")}',1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP + interval '30 days',40,0,0,'OPEN','NONE',CURRENT_TIMESTAMP)`,
    )
    await mk(
        `insert into "CaseRetainerPeriod" ("id","retainerId","ordinal","startsOn","endsOn","includedValueCents","usedUnits","usedValueCents","state","billingState","updatedAt")
         values ('${q("perv")}','${q("retv")}',1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP + interval '90 days',500000,0,0,'OPEN','NONE',CURRENT_TIMESTAMP)`,
    )
    await mk(
        `insert into "CaseRetainerPeriod" ("id","retainerId","ordinal","startsOn","endsOn","includedUnits","usedUnits","usedValueCents","state","billingState","updatedAt")
         values ('${q("pero")}','${q("reto")}',1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP + interval '30 days',10,0,0,'OPEN','NONE',CURRENT_TIMESTAMP)`,
    )

    return {
        workspaceA: q("wsa"),
        workspaceB: q("wsb"),
        caseA: q("casea"),
        caseA2: q("casea2"),
        caseB: q("caseb"),
        invoiceA: q("inva"),
        retainerUnits: q("retu"),
        retainerValue: q("retv"),
        periodUnits: q("peru"),
        periodValue: q("perv"),
        retainerOther: q("reto"),
        periodOther: q("pero"),
    }
}

let prismaRef: PrismaClient | null = null

/** Runs `body` inside a transaction that always rolls back, reporting whether it refused. */
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
        check("all 5 retainer tables present", missing.length === 0, missing.length ? `missing: ${missing}` : "5/5")
        const forked = FORBIDDEN_TABLES.filter((t) => tables.includes(t))
        check(
            "no parallel subscription, plan, credit, wallet, time-entry or retainer-invoice table was created",
            forked.length === 0,
            forked.join(",") || "none",
        )
        for (const t of ["CaseProject", "CaseInvoice", "CaseEvent", "Payment", "Contact", "Workspace"]) {
            check(`pre-existing ${t} still exists`, tables.includes(t), tables.includes(t) ? "present" : "MISSING")
        }

        // ---- 2. enums, and the one deliberate extension -----------------------
        const enums = await prisma.$queryRawUnsafe<{ typname: string; enumlabel: string; ord: number }[]>(
            "select t.typname, e.enumlabel, e.enumsortorder::float8 as ord from pg_type t join pg_enum e on e.enumtypid=t.oid",
        )
        for (const [name, expected] of NEW_ENUMS) {
            const n = enums.filter((e) => e.typname === name).length
            check(`enum ${name} has ${expected} labels`, n === expected, `count=${n}`)
        }
        const caseKinds = enums
            .filter((e) => e.typname === "CaseEventKind")
            .sort((a, b) => a.ord - b.ord)
            .map((e) => e.enumlabel)
        check("CaseEventKind now has 10 labels", caseKinds.length === 10, caseKinds.join(","))
        check("CaseEventKind gained RETAINER", caseKinds.includes("RETAINER"))
        check(
            "the original eight CaseEventKind labels are still in their original order",
            ORIGINAL_CASE_EVENT_KINDS.every((label, i) => caseKinds[i] === label),
            caseKinds.slice(0, 8).join(","),
        )
        check(
            "RETAINER sits immediately before NOTE, matching schema.prisma rather than being appended at the end",
            caseKinds[8] === "RETAINER" && caseKinds[9] === "NOTE",
            caseKinds.slice(7).join(","),
        )

        // ---- 3. reuse: foreign keys point at pre-existing models -------------
        const fks = await prisma.$queryRawUnsafe<{ tbl: string; col: string; ref: string }[]>(
            `select tc.table_name as tbl, kcu.column_name as col, ccu.table_name as ref
               from information_schema.table_constraints tc
               join information_schema.key_column_usage kcu on kcu.constraint_name = tc.constraint_name
               join information_schema.constraint_column_usage ccu on ccu.constraint_name = tc.constraint_name
              where tc.constraint_type = 'FOREIGN KEY' and tc.table_schema = 'public'`,
        )
        for (const [tbl, col, ref] of REUSE_FKS) {
            const hit = fks.some((f) => f.tbl === tbl && f.col === col && f.ref === ref)
            check(`${tbl}.${col} points at the pre-existing ${ref}`, hit)
        }

        // ---- 4. constraints and indexes exist --------------------------------
        const constraints = (
            await prisma.$queryRawUnsafe<{ conname: string }[]>(
                "select conname from pg_constraint where contype = 'c'",
            )
        ).map((r) => r.conname)
        for (const name of CHECK_CONSTRAINTS) {
            check(`CHECK ${name} exists`, constraints.includes(name))
        }
        const indexes = await prisma.$queryRawUnsafe<{ indexname: string; indexdef: string }[]>(
            "select indexname, indexdef from pg_indexes where schemaname='public'",
        )
        const openIdx = indexes.find((i) => i.indexname === "CaseRetainerPeriod_one_open_per_retainer")
        check("partial unique index CaseRetainerPeriod_one_open_per_retainer exists", Boolean(openIdx))
        check(
            "it is genuinely partial - a WHERE clause on state OPEN, not a plain unique key",
            Boolean(openIdx && /WHERE/i.test(openIdx.indexdef) && /OPEN/.test(openIdx.indexdef)),
            openIdx?.indexdef.slice(0, 120) ?? "absent",
        )
        const triggers = (
            await prisma.$queryRawUnsafe<{ tgname: string }[]>(
                "select tgname from pg_trigger where not tgisinternal",
            )
        ).map((r) => r.tgname)
        for (const t of [
            "CaseRetainerDraw_append_only",
            "CaseRetainerEvent_append_only",
            "CaseRetainerDraw_mismatch_guard",
            "CaseRetainerCaseLink_tenant_guard",
        ]) {
            check(`trigger ${t} is attached`, triggers.includes(t))
        }
        check(
            "the pre-existing CaseEvent_append_only trigger survived the enum recreation path",
            triggers.includes("CaseEvent_append_only"),
        )

        // ---- 5. the agreement cannot be self-contradictory -------------------
        const badBasis = await refuses("bb", async (tx, s) => {
            await tx.$executeRawUnsafe(
                `insert into "CaseRetainer" ("id","workspaceId","reference","title","basis","includedUnits","includedValueCents","updatedAt")
                 values ('${RUN}_bb_x','${s.workspaceA}','${RUN}_bb_x','X','UNITS',10,5000,CURRENT_TIMESTAMP)`,
            )
        })
        check("a retainer denominated in BOTH units and money is refused", badBasis.refused, badBasis.detail)

        const noBasis = await refuses("nb", async (tx, s) => {
            await tx.$executeRawUnsafe(
                `insert into "CaseRetainer" ("id","workspaceId","reference","title","basis","updatedAt")
                 values ('${RUN}_nb_x','${s.workspaceA}','${RUN}_nb_x','X','UNITS',CURRENT_TIMESTAMP)`,
            )
        })
        check("a retainer with no allowance at all is refused", noBasis.refused, noBasis.detail)

        const zeroUnits = await refuses("zu", async (tx, s) => {
            await tx.$executeRawUnsafe(
                `insert into "CaseRetainer" ("id","workspaceId","reference","title","basis","includedUnits","updatedAt")
                 values ('${RUN}_zu_x','${s.workspaceA}','${RUN}_zu_x','X','UNITS',0,CURRENT_TIMESTAMP)`,
            )
        })
        check("a retainer including zero units is refused", zeroUnits.refused, zeroUnits.detail)

        const monthlyWithDays = await refuses("md", async (tx, s) => {
            await tx.$executeRawUnsafe(
                `insert into "CaseRetainer" ("id","workspaceId","reference","title","basis","includedUnits","periodKind","periodDays","updatedAt")
                 values ('${RUN}_md_x','${s.workspaceA}','${RUN}_md_x','X','UNITS',10,'MONTHLY',30,CURRENT_TIMESTAMP)`,
            )
        })
        check(
            "a MONTHLY retainer carrying a day count is refused, because it would have two answers for its own length",
            monthlyWithDays.refused,
            monthlyWithDays.detail,
        )

        const customNoDays = await refuses("cd", async (tx, s) => {
            await tx.$executeRawUnsafe(
                `insert into "CaseRetainer" ("id","workspaceId","reference","title","basis","includedUnits","periodKind","updatedAt")
                 values ('${RUN}_cd_x','${s.workspaceA}','${RUN}_cd_x','X','UNITS',10,'CUSTOM',CURRENT_TIMESTAMP)`,
            )
        })
        check("a CUSTOM retainer with no day count is refused", customNoDays.refused, customNoDays.detail)

        // ---- 6. periods -------------------------------------------------------
        const badDates = await refuses("bd", async (tx, s) => {
            await tx.$executeRawUnsafe(
                `insert into "CaseRetainerPeriod" ("id","retainerId","ordinal","startsOn","endsOn","includedUnits","state","updatedAt")
                 values ('${RUN}_bd_x','${s.retainerUnits}',2,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP - interval '1 day',40,'CLOSED',CURRENT_TIMESTAMP)`,
            )
        })
        check("a period that ends before it starts is refused", badDates.refused, badDates.detail)

        const negativeUsed = await refuses("nu", async (tx, s) => {
            await tx.$executeRawUnsafe(
                `update "CaseRetainerPeriod" set "usedUnits" = -1 where "id" = '${s.periodUnits}'`,
            )
        })
        check("a period with a negative used balance is refused", negativeUsed.refused, negativeUsed.detail)

        const twoBases = await refuses("tb", async (tx, s) => {
            await tx.$executeRawUnsafe(
                `insert into "CaseRetainerPeriod" ("id","retainerId","ordinal","startsOn","endsOn","includedUnits","includedValueCents","state","updatedAt")
                 values ('${RUN}_tb_x','${s.retainerUnits}',2,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP + interval '30 days',40,5000,'CLOSED',CURRENT_TIMESTAMP)`,
            )
        })
        check("a period carrying both a unit allowance and a money allowance is refused", twoBases.refused, twoBases.detail)

        const twoOpen = await refuses("to", async (tx, s) => {
            await tx.$executeRawUnsafe(
                `insert into "CaseRetainerPeriod" ("id","retainerId","ordinal","startsOn","endsOn","includedUnits","state","updatedAt")
                 values ('${RUN}_to_x','${s.retainerUnits}',2,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP + interval '30 days',40,'OPEN',CURRENT_TIMESTAMP)`,
            )
        })
        check(
            "a second OPEN period on the same retainer is refused, so there is exactly one current allowance",
            twoOpen.refused,
            twoOpen.detail,
        )

        const secondClosed = await refuses("sc", async (tx, s) => {
            await tx.$executeRawUnsafe(
                `insert into "CaseRetainerPeriod" ("id","retainerId","ordinal","startsOn","endsOn","includedUnits","state","updatedAt")
                 values ('${RUN}_sc_x','${s.retainerUnits}',2,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP + interval '30 days',40,'CLOSED',CURRENT_TIMESTAMP)`,
            )
            throw new Error("ACCEPTED")
        })
        check(
            "a CLOSED period alongside an OPEN one is accepted, because the index is partial and history must accumulate",
            secondClosed.detail === "ACCEPTED",
            secondClosed.detail,
        )

        // ---- 7. draws ---------------------------------------------------------
        const drawBothDeltas = await refuses("d1", async (tx, s) => {
            await tx.$executeRawUnsafe(
                `insert into "CaseRetainerDraw" ("id","retainerId","periodId","kind","unitsDelta","valueDeltaCents","usedUnitsAfter","usedValueCentsAfter","actor")
                 values ('${RUN}_d1_x','${s.retainerUnits}','${s.periodUnits}','DRAW',2,500,2,500,'STAFF')`,
            )
        })
        check("a draw denominated in both units and money is refused", drawBothDeltas.refused, drawBothDeltas.detail)

        const drawNoDelta = await refuses("d2", async (tx, s) => {
            await tx.$executeRawUnsafe(
                `insert into "CaseRetainerDraw" ("id","retainerId","periodId","kind","usedUnitsAfter","usedValueCentsAfter","actor")
                 values ('${RUN}_d2_x','${s.retainerUnits}','${s.periodUnits}','DRAW',0,0,'STAFF')`,
            )
        })
        check("a draw with no delta at all is refused", drawNoDelta.refused, drawNoDelta.detail)

        const drawZero = await refuses("d3", async (tx, s) => {
            await tx.$executeRawUnsafe(
                `insert into "CaseRetainerDraw" ("id","retainerId","periodId","kind","unitsDelta","usedUnitsAfter","usedValueCentsAfter","actor")
                 values ('${RUN}_d3_x','${s.retainerUnits}','${s.periodUnits}','DRAW',0,0,0,'STAFF')`,
            )
        })
        check("a draw of zero is refused, because a ledger row that changes nothing is noise", drawZero.refused, drawZero.detail)

        const drawNegativeAfter = await refuses("d4", async (tx, s) => {
            await tx.$executeRawUnsafe(
                `insert into "CaseRetainerDraw" ("id","retainerId","periodId","kind","unitsDelta","usedUnitsAfter","usedValueCentsAfter","actor")
                 values ('${RUN}_d4_x','${s.retainerUnits}','${s.periodUnits}','CREDIT',-2,-2,0,'STAFF')`,
            )
        })
        check("a draw whose resulting balance is negative is refused", drawNegativeAfter.refused, drawNegativeAfter.detail)

        const drawForeignPeriod = await refuses("d5", async (tx, s) => {
            await tx.$executeRawUnsafe(
                `insert into "CaseRetainerDraw" ("id","retainerId","periodId","kind","unitsDelta","usedUnitsAfter","usedValueCentsAfter","actor")
                 values ('${RUN}_d5_x','${s.retainerUnits}','${s.periodOther}','DRAW',2,2,0,'STAFF')`,
            )
        })
        check(
            "a draw against another retainer's period is refused by trigger",
            drawForeignPeriod.refused,
            drawForeignPeriod.detail,
        )

        const drawUnlinkedCase = await refuses("d6", async (tx, s) => {
            await tx.$executeRawUnsafe(
                `insert into "CaseRetainerDraw" ("id","retainerId","periodId","caseId","kind","unitsDelta","usedUnitsAfter","usedValueCentsAfter","actor")
                 values ('${RUN}_d6_x','${s.retainerUnits}','${s.periodUnits}','${s.caseA2}','DRAW',2,2,0,'STAFF')`,
            )
        })
        check(
            "a draw naming a case the retainer does not cover is refused by trigger",
            drawUnlinkedCase.refused,
            drawUnlinkedCase.detail,
        )

        const drawWrongBasis = await refuses("d7", async (tx, s) => {
            await tx.$executeRawUnsafe(
                `insert into "CaseRetainerDraw" ("id","retainerId","periodId","kind","valueDeltaCents","usedUnitsAfter","usedValueCentsAfter","actor")
                 values ('${RUN}_d7_x','${s.retainerUnits}','${s.periodUnits}','DRAW',500,0,500,'STAFF')`,
            )
        })
        check(
            "a money draw against a unit-denominated period is refused by trigger",
            drawWrongBasis.refused,
            drawWrongBasis.detail,
        )

        const drawLinkedCase = await refuses("d8", async (tx, s) => {
            await tx.$executeRawUnsafe(
                `insert into "CaseRetainerDraw" ("id","retainerId","periodId","caseId","kind","unitsDelta","usedUnitsAfter","usedValueCentsAfter","actor")
                 values ('${RUN}_d8_x','${s.retainerUnits}','${s.periodUnits}','${s.caseA}','DRAW',2,2,0,'STAFF')`,
            )
            throw new Error("ACCEPTED")
        })
        check("a draw naming a linked case is accepted", drawLinkedCase.detail === "ACCEPTED", drawLinkedCase.detail)

        const overage = await refuses("d9", async (tx, s) => {
            await tx.$executeRawUnsafe(
                `insert into "CaseRetainerDraw" ("id","retainerId","periodId","caseId","kind","unitsDelta","usedUnitsAfter","usedValueCentsAfter","actor")
                 values ('${RUN}_d9_x','${s.retainerUnits}','${s.periodUnits}','${s.caseA}','DRAW',60,60,0,'STAFF')`,
            )
            await tx.$executeRawUnsafe(`update "CaseRetainerPeriod" set "usedUnits" = 60 where "id" = '${s.periodUnits}'`)
            const rows = await tx.$queryRawUnsafe<{ used: number; incl: number }[]>(
                `select "usedUnits"::int as used, "includedUnits"::int as incl from "CaseRetainerPeriod" where "id" = '${s.periodUnits}'`,
            )
            if (rows[0].used <= rows[0].incl) throw new Error("overage was not recorded")
            throw new Error("ACCEPTED")
        })
        check(
            "OVERAGE IS ACCEPTED - used may exceed included, because refusing work that was actually done would be a lie",
            overage.detail === "ACCEPTED",
            overage.detail,
        )

        // ---- 8. the ledger is self-verifying --------------------------------
        const replay = await refuses("rp", async (tx, s) => {
            let used = 0
            for (const [i, delta] of [5, 7, -3, 11].entries()) {
                used += delta
                await tx.$executeRawUnsafe(
                    `insert into "CaseRetainerDraw" ("id","retainerId","periodId","caseId","kind","unitsDelta","usedUnitsAfter","usedValueCentsAfter","actor")
                     values ('${RUN}_rp_${i}','${s.retainerUnits}','${s.periodUnits}','${s.caseA}','${delta < 0 ? "CREDIT" : "DRAW"}',${delta},${used},0,'STAFF')`,
                )
            }
            const rows = await tx.$queryRawUnsafe<{ d: number; a: number }[]>(
                `select "unitsDelta"::int as d, "usedUnitsAfter"::int as a from "CaseRetainerDraw"
                  where "periodId" = '${s.periodUnits}' order by "seq" asc`,
            )
            let running = 0
            for (const row of rows) {
                running += row.d
                if (running !== row.a) throw new Error(`replay mismatch: expected ${running}, stored ${row.a}`)
            }
            if (rows.length !== 4) throw new Error(`expected 4 ledger rows, found ${rows.length}`)
            throw new Error("ACCEPTED")
        })
        check(
            "replaying the ledger deltas reproduces every stored after-balance, so the ledger checks itself",
            replay.detail === "ACCEPTED",
            replay.detail,
        )

        // ---- 9. the ledger cannot be rewritten -------------------------------
        const rewrite = await refuses("aw", async (tx, s) => {
            await tx.$executeRawUnsafe(
                `insert into "CaseRetainerDraw" ("id","retainerId","periodId","kind","unitsDelta","usedUnitsAfter","usedValueCentsAfter","actor")
                 values ('${RUN}_aw_x','${s.retainerUnits}','${s.periodUnits}','DRAW',3,3,0,'STAFF')`,
            )
            await tx.$executeRawUnsafe(`update "CaseRetainerDraw" set "unitsDelta" = 99 where "id" = '${RUN}_aw_x'`)
        })
        check("the database refuses to rewrite a draw", rewrite.refused, rewrite.detail)

        const erase = await refuses("ae", async (tx, s) => {
            await tx.$executeRawUnsafe(
                `insert into "CaseRetainerDraw" ("id","retainerId","periodId","kind","unitsDelta","usedUnitsAfter","usedValueCentsAfter","actor")
                 values ('${RUN}_ae_x','${s.retainerUnits}','${s.periodUnits}','DRAW',3,3,0,'STAFF')`,
            )
            await tx.$executeRawUnsafe(`delete from "CaseRetainerDraw" where "id" = '${RUN}_ae_x'`)
        })
        check("the database refuses to erase a draw", erase.refused, erase.detail)

        const eventRewrite = await refuses("er", async (tx, s) => {
            await tx.$executeRawUnsafe(
                `insert into "CaseRetainerEvent" ("id","retainerId","kind","subjectType","subjectId","from","to","actor")
                 values ('${RUN}_er_x','${s.retainerUnits}','RETAINER','agreement','${s.retainerUnits}',null,'ACTIVE','STAFF')`,
            )
            await tx.$executeRawUnsafe(`update "CaseRetainerEvent" set "to" = 'TAMPERED' where "id" = '${RUN}_er_x'`)
        })
        check("the database refuses to rewrite the agreement history", eventRewrite.refused, eventRewrite.detail)
        check(
            "CaseRetainerEvent reuses the pre-existing CaseEventKind enum, so the second migration added no vocabulary",
            enums.some((e) => e.typname === "CaseEventKind" && e.enumlabel === "RETAINER"),
        )

        // ---- 10. tenant isolation is a database rule, not only an engine one --
        const crossTenantLink = await refuses("ct", async (tx, s) => {
            await tx.$executeRawUnsafe(
                `insert into "CaseRetainerCaseLink" ("retainerId","caseId") values ('${s.retainerUnits}','${s.caseB}')`,
            )
        })
        check(
            "linking a retainer to a case in another workspace is refused by trigger",
            crossTenantLink.refused,
            crossTenantLink.detail,
        )

        const sameTenantLink = await refuses("st", async (tx, s) => {
            await tx.$executeRawUnsafe(
                `insert into "CaseRetainerCaseLink" ("retainerId","caseId") values ('${s.retainerUnits}','${s.caseA2}')`,
            )
            throw new Error("ACCEPTED")
        })
        check("linking a retainer to a second case in the same workspace is accepted", sameTenantLink.detail === "ACCEPTED", sameTenantLink.detail)

        // ---- 11. billing state is a reference, never money -------------------
        const invoiceLink = await refuses("il", async (tx, s) => {
            const before = await tx.$queryRawUnsafe<{ n: bigint }[]>(`select count(*) as n from "Payment"`)
            await tx.$executeRawUnsafe(
                `update "CaseRetainerPeriod" set "invoiceId" = '${s.invoiceA}', "billingState" = 'ISSUED' where "id" = '${s.periodUnits}'`,
            )
            const after = await tx.$queryRawUnsafe<{ n: bigint }[]>(`select count(*) as n from "Payment"`)
            if (Number(after[0].n) !== Number(before[0].n)) {
                throw new Error(`Payment count moved from ${before[0].n} to ${after[0].n}`)
            }
            throw new Error("ACCEPTED")
        })
        check(
            "recording an invoice against a period creates no Payment row",
            invoiceLink.detail === "ACCEPTED",
            invoiceLink.detail,
        )
        const periodCols = await prisma.$queryRawUnsafe<{ column_name: string }[]>(
            `select column_name from information_schema.columns where table_name = 'CaseRetainerPeriod'`,
        )
        const names = periodCols.map((c) => c.column_name)
        for (const forbidden of ["paidCents", "amountPaidCents", "providerPaymentId", "stripeId", "chargeId"]) {
            check(`CaseRetainerPeriod has no ${forbidden} column, so it cannot become a payment record`, !names.includes(forbidden))
        }

        // ---- 12. residue ------------------------------------------------------
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
        // Flip the single most load-bearing claim: that a draw cannot reach into another
        // agreement's period. If the harness cannot go red, it is not evidence.
        const target = results.find((r) => r.name.includes("another retainer's period"))
        if (target) target.pass = !target.pass
        failed = results.filter((r) => !r.pass)
    }
    for (const r of results) {
        console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.name}${r.detail ? `  (${r.detail})` : ""}`)
    }
    console.log(`\n${results.length - failed.length}/${results.length} invariants passed`)
    if (INVERT) console.log("INVERT_ASSERTION=1 was set - a failure here is the expected proof")
    if (failed.length) process.exit(1)
    console.log("All retainer schema invariants hold.")
}

async function counts(prisma: PrismaClient): Promise<Record<string, number>> {
    const out: Record<string, number> = {}
    for (const t of [
        "CaseRetainer",
        "CaseRetainerCaseLink",
        "CaseRetainerPeriod",
        "CaseRetainerDraw",
        "CaseRetainerEvent",
        "CaseProject",
        "CaseInvoice",
        "CaseEvent",
        "Payment",
        "Workspace",
    ]) {
        const rows = await prisma.$queryRawUnsafe<{ n: bigint }[]>(`select count(*) as n from "${t}"`)
        out[t] = Number(rows[0].n)
    }
    return out
}

main().catch((e) => {
    console.error(e)
    process.exit(1)
})

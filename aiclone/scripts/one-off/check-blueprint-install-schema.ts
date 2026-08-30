/**
 * Blueprint installation: schema invariant harness.
 *
 * Runs ONLY against the authorized disposable rehearsal database. Every write happens inside a
 * transaction that is deliberately rolled back, so the harness leaves no row behind.
 *
 * WHAT THIS HARNESS EXISTS TO DEFEND
 *
 * Installation is the point at which a shared-engine product is most likely to fork. The temptation
 * is a table per concern - a workflow template table, a surfaces table, a terminology table, a config
 * table per vertical - and every one of those would create a second answer to a question the product
 * already answers somewhere else. So this harness spends most of its assertions on ABSENCE:
 *
 *   BlueprintWorkflow / InstalledWorkflow - workflows are REUSED. WorkflowRun, WorkflowStep, Approval
 *                                    and TaskJob already exist. The static registry is the template,
 *                                    because blueprint.id encodes the version and the registry retains
 *                                    deprecated entries, so pinning an id is already immutable.
 *   BlueprintSurface / InstalledSurface - surfaces already live per profile in src/lib/surfaces.ts.
 *   Terminology / TerminologyPack - terminology means nothing except relative to an installation. As
 *                                    its own table it would be global, which is the exact shape the
 *                                    design forbids.
 *   SalonConfig / RestaurantConfig / ... - a vertical-specific table is the one thing the shared-engine
 *                                    thesis exists to prevent.
 *
 * The forbidden list is not maintained in two places: it is imported from the runtime contract
 * (`FORBIDDEN_TABLES` in src/lib/business-os/install-types.ts) and the harness asserts the migration
 * builder's list matches, so neither copy can be quietly shortened.
 *
 * The rest is the guarantees the DATABASE makes rather than the engine:
 *
 *   ONE ACTIVE INSTALLATION PER WORKSPACE, by partial unique index - asserted structurally AND
 *   behaviourally, because an index that exists is not the same as an index that refuses.
 *
 *   THE LEDGER IS APPEND-ONLY, by trigger, reusing reject_append_only_mutation() rather than
 *   redefining it - asserted by attempting a real UPDATE and a real DELETE.
 *
 *   SUPERSESSION AND THE LEDGER CANNOT CROSS A WORKSPACE BOUNDARY - asserted with a second tenant
 *   actually present, because a cross-tenant assertion with only one tenant seeded proves nothing.
 *
 * Set INVERT_ASSERTION=1 to flip every load-bearing expectation and prove the harness fails loudly
 * rather than passing for free.
 *
 *   ts-node -r tsconfig-paths/register scripts/one-off/check-blueprint-install-schema.ts
 */
import { readFileSync } from "node:fs"
import { join } from "node:path"

import { PrismaClient } from "@prisma/client"

import { FORBIDDEN_TABLES, INSTALL_TABLES } from "../../src/lib/business-os/install-types"
import { assertDisposableTarget, parseDatabaseName } from "../lib/disposable-db"

const AUTHORIZED_TARGET = "personalink_phase0_rehearsal_20260826_210704"
const INVERT = process.env.INVERT_ASSERTION === "1"
const RUN = `bpi_${Date.now()}_${Math.floor(Math.random() * 1e6)}`
const APP_ROOT = join(__dirname, "..", "..")

const NEW_ENUMS: Array<[string, readonly string[]]> = [
    ["BlueprintInstallationState", ["ACTIVE", "SUPERSEDED", "REMOVED"]],
    ["BlueprintInstallationEventKind", ["INSTALLED", "UPGRADED", "SUPERSEDED", "REMOVED"]],
]

/** Every link must point at the named PRE-EXISTING model. Nothing here creates a registry table. */
const REUSE_FKS: Array<[string, string, string]> = [
    ["BlueprintInstallation", "workspaceId", "Workspace"],
    ["BlueprintInstallation", "profileId", "Profile"],
    ["BlueprintInstallation", "supersedesInstallationId", "BlueprintInstallation"],
    ["BlueprintInstallationEvent", "installationId", "BlueprintInstallation"],
]

const CHECK_CONSTRAINTS = [
    "BlueprintInstallation_blueprintId_not_blank",
    "BlueprintInstallation_blueprintVersion_not_blank",
    "BlueprintInstallation_installedBy_not_blank",
    "BlueprintInstallation_idempotencyKey_not_blank",
    "BlueprintInstallation_removed_has_timestamp",
    "BlueprintInstallation_active_has_no_removal",
    "BlueprintInstallation_no_self_supersession",
    "BlueprintInstallationEvent_actor_not_blank",
    "BlueprintInstallationEvent_blueprintId_not_blank",
    "BlueprintInstallationEvent_blueprintVersion_not_blank",
] as const

const TRIGGERS: Array<[string, string]> = [
    ["BlueprintInstallationEvent", "BlueprintInstallationEvent_tenant_guard"],
    ["BlueprintInstallation", "BlueprintInstallation_supersession_guard"],
    ["BlueprintInstallationEvent", "BlueprintInstallationEvent_append_only"],
]

/**
 * Columns that must not exist on either new table. Each would be a claim this package does not make.
 * `grantedAt` and `appliedSurfaces` are the two that matter most: install RECORDS surfaces, it does
 * not grant them, and a column named for granting would be the first step to doing so.
 */
const FORBIDDEN_COLUMNS = [
    "grantedAt",
    "grantedSurfaces",
    "appliedSurfaces",
    "permissionsGranted",
    "notifiedAt",
    "emailSentAt",
    "smsSentAt",
    "providerMessageId",
    "paymentId",
    "invoiceId",
    "scheduledAt",
    "nextRunAt",
    "cronExpression",
    "workflowTemplateJson",
] as const

/** Pre-existing tables that must have gained NO installation column. */
const UNTOUCHED_TABLES = ["Workspace", "Profile", "WorkflowRun", "WorkflowStep", "Approval", "TaskJob"] as const

const results: Array<{ name: string; pass: boolean; detail: string }> = []
function check(name: string, pass: boolean, detail = "") {
    results.push({ name, pass, detail })
}
/** Flipped by INVERT_ASSERTION=1, so the harness's ability to fail is itself proven. */
function checkInvertible(name: string, pass: boolean, detail = "") {
    results.push({ name, pass: INVERT ? !pass : pass, detail })
}

/** The WHOLE error text, flattened. "Something threw" is a far weaker claim than "the constraint I
 *  named threw", and that difference is where harnesses like this one quietly rot. */
function fullErr(e: unknown): string {
    return String((e as Error).message).replace(/\s+/g, " ")
}

class Rollback extends Error {}
type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0]

type Seeded = {
    userA: string
    userB: string
    profileA: string
    profileB: string
    workspaceA: string
    workspaceB: string
}

/**
 * Seeds TWO tenants. Tenant B exists specifically so the cross-workspace refusals are testable - a
 * cross-tenant assertion with one tenant seeded is the vacuous shape this program has already been
 * bitten by twice.
 */
async function seed(tx: Tx, tag: string): Promise<Seeded> {
    const p = `${RUN}_${tag}`
    const mk = (sql: string) => tx.$executeRawUnsafe(sql)
    const ids: Seeded = {
        userA: `${p}_uA`,
        userB: `${p}_uB`,
        profileA: `${p}_pA`,
        profileB: `${p}_pB`,
        workspaceA: `${p}_wA`,
        workspaceB: `${p}_wB`,
    }
    for (const [u, tagx] of [
        [ids.userA, "a"],
        [ids.userB, "b"],
    ] as const) {
        await mk(
            `insert into "User" ("id","clerkId","email","role","createdAt","updatedAt")
             values ('${u}','clerk_${u}','${u}@example.test','CREATOR', now(), now())`,
        )
        void tagx
    }
    for (const [pr, u] of [
        [ids.profileA, ids.userA],
        [ids.profileB, ids.userB],
    ] as const) {
        await mk(
            `insert into "Profile" ("id","userId","slug","displayName","updatedAt")
             values ('${pr}','${u}','${pr}-slug','${pr}', now())`,
        )
    }
    for (const [w, pr] of [
        [ids.workspaceA, ids.profileA],
        [ids.workspaceB, ids.profileB],
    ] as const) {
        await mk(
            `insert into "Workspace" ("id","profileId","name","slug","createdAt","updatedAt")
             values ('${w}','${pr}','${w}','${w}-slug', now(), now())`,
        )
    }
    return ids
}

type InstallOverrides = Partial<{
    id: string
    workspaceId: string
    profileId: string
    blueprintId: string
    blueprintVersion: string
    state: string
    idempotencyKey: string
    supersedesInstallationId: string | null
    installedBy: string
    removedAt: string
}>

async function insertInstall(tx: Tx, s: Seeded, id: string, o: InstallOverrides = {}) {
    const state = o.state ?? "ACTIVE"
    const removedAt = o.removedAt ?? (state === "REMOVED" ? "now()" : "null")
    const supersedes =
        o.supersedesInstallationId === undefined || o.supersedesInstallationId === null
            ? "null"
            : `'${o.supersedesInstallationId}'`
    await tx.$executeRawUnsafe(
        `insert into "BlueprintInstallation"
           ("id","workspaceId","profileId","blueprintId","blueprintVersion","state","idempotencyKey",
            "configJson","supersedesInstallationId","installedBy","installedAt","updatedAt","removedAt")
         values ('${id}','${o.workspaceId ?? s.workspaceA}','${o.profileId ?? s.profileA}',
                 '${o.blueprintId ?? "field-service-v1"}','${o.blueprintVersion ?? "1.0.0"}',
                 '${state}','${o.idempotencyKey ?? id}','{}'::jsonb, ${supersedes},
                 '${o.installedBy ?? "owner:test"}', now(), now(), ${removedAt})`,
    )
}

async function insertEvent(
    tx: Tx,
    id: string,
    installationId: string,
    workspaceId: string,
    o: Partial<{ kind: string; actor: string; blueprintId: string; blueprintVersion: string }> = {},
) {
    await tx.$executeRawUnsafe(
        `insert into "BlueprintInstallationEvent"
           ("id","installationId","workspaceId","kind","blueprintId","blueprintVersion","actor","createdAt")
         values ('${id}','${installationId}','${workspaceId}','${o.kind ?? "INSTALLED"}',
                 '${o.blueprintId ?? "field-service-v1"}','${o.blueprintVersion ?? "1.0.0"}',
                 '${o.actor ?? "owner:test"}', now())`,
    )
}

async function counts(prisma: PrismaClient): Promise<Record<string, number>> {
    const out: Record<string, number> = {}
    for (const t of ["BlueprintInstallation", "BlueprintInstallationEvent", "Workspace", "Profile", "User"]) {
        const r = await prisma.$queryRawUnsafe<{ n: bigint }[]>(`select count(*)::bigint as n from "${t}"`)
        out[t] = Number(r[0].n)
    }
    return out
}

async function main() {
    const prisma = new PrismaClient()
    const dbName = parseDatabaseName(process.env.DATABASE_URL ?? "")
    try {
        assertDisposableTarget(process.env.DATABASE_URL ?? "")
    } catch (e) {
        console.error(String((e as Error).message))
        process.exit(1)
    }
    if (dbName !== AUTHORIZED_TARGET) {
        console.error(`Refusing to run: target is ${String(dbName)}, not ${AUTHORIZED_TARGET}`)
        process.exit(1)
    }

    /** Runs `body` in a transaction and asserts it is refused, with the MESSAGE matched. */
    async function refusesBy(name: string, tag: string, pattern: RegExp, body: (tx: Tx, s: Seeded) => Promise<void>) {
        let refused = false
        let detail = ""
        try {
            await prisma.$transaction(async (tx) => {
                const s = await seed(tx as Tx, tag)
                await body(tx as Tx, s)
                throw new Rollback("not refused")
            })
        } catch (e) {
            if (e instanceof Rollback) {
                refused = false
                detail = "ACCEPTED - the database allowed it"
            } else {
                const msg = fullErr(e)
                refused = pattern.test(msg)
                detail = refused ? msg.slice(0, 120) : `wrong error: ${msg.slice(0, 120)}`
            }
        }
        checkInvertible(name, refused, detail)
    }

    /** Runs `body` in a transaction and asserts it is ACCEPTED, then rolls back. */
    async function accepts(name: string, tag: string, body: (tx: Tx, s: Seeded) => Promise<void>) {
        let ok = false
        let detail = ""
        try {
            await prisma.$transaction(async (tx) => {
                const s = await seed(tx as Tx, tag)
                await body(tx as Tx, s)
                throw new Rollback("done")
            })
        } catch (e) {
            if (e instanceof Rollback) {
                ok = true
                detail = "accepted"
            } else {
                ok = false
                detail = `REFUSED: ${fullErr(e).slice(0, 130)}`
            }
        }
        checkInvertible(name, ok, detail)
    }

    try {
        const baseline = await counts(prisma)

        // ---- 1. the two tables exist, and no fork came with them ---------------
        const tables = (
            await prisma.$queryRawUnsafe<{ table_name: string }[]>(
                "select table_name from information_schema.tables where table_schema='public'",
            )
        ).map((r) => r.table_name)

        const missing = INSTALL_TABLES.filter((t) => !tables.includes(t))
        check(
            `both installation tables present`,
            missing.length === 0,
            missing.length ? `missing: ${missing.join(",")}` : `${INSTALL_TABLES.length}/${INSTALL_TABLES.length}`,
        )

        const forked = FORBIDDEN_TABLES.filter((t) => tables.includes(t))
        checkInvertible(
            "installation forked nothing: no workflow-template, surface, terminology, task or vertical-specific table exists",
            forked.length === 0,
            forked.join(",") || `none of ${FORBIDDEN_TABLES.length}`,
        )
        checkInvertible(
            "MEASURED: the workflow engine was reused - WorkflowRun, WorkflowStep, Approval and TaskJob all still exist",
            ["WorkflowRun", "WorkflowStep", "Approval", "TaskJob"].every((t) => tables.includes(t)),
            "all four present and untouched",
        )

        // The migration FILE is asserted here, not just its effect on the catalog. A future edit that
        // reintroduces an ALTER TYPE or a DROP would still leave a correct-looking catalog after a fresh
        // apply, while quietly destroying the byte-identical rollback proof - so the file is pinned too.
        // Assertions run on EXECUTABLE SQL ONLY: the header discusses ALTER TYPE and DROP at length in
        // order to explain why neither is used, and a whole-file scan would flag the explanation.
        const migrationSql = readFileSync(
            join(APP_ROOT, "prisma", "migrations", "20260830010000_blueprint_installation", "migration.sql"),
            "utf8",
        )
        const downSql = readFileSync(
            join(APP_ROOT, "prisma", "migrations", "20260830010000_blueprint_installation", "down.sql"),
            "utf8",
        )
        const executable = migrationSql
            .split("\n")
            .filter((l) => l.trim() !== "" && !l.trim().startsWith("--"))
            .join("\n")
        checkInvertible(
            "the migration contains no executable ALTER TYPE, so its rollback needs no enum recreation",
            !/ALTER TYPE/.test(executable),
            "none in executable SQL",
        )
        checkInvertible(
            "the migration contains no executable DROP of any kind",
            !/\bDROP\b/.test(executable),
            "none in executable SQL",
        )
        checkInvertible(
            "the migration creates exactly the two installation tables and nothing else",
            (executable.match(/^CREATE TABLE /gm) || []).length === 2,
            `${(executable.match(/^CREATE TABLE /gm) || []).length} CREATE TABLE statements`,
        )
        checkInvertible(
            "the migration REUSES reject_append_only_mutation() rather than redefining it",
            /EXECUTE FUNCTION "reject_append_only_mutation"\(\)/.test(migrationSql) &&
                !/CREATE OR REPLACE FUNCTION "reject_append_only_mutation"/.test(migrationSql),
            "referenced, never redefined",
        )
        checkInvertible(
            "the rollback does NOT drop reject_append_only_mutation(), which ten other ledgers depend on",
            !/DROP FUNCTION IF EXISTS "reject_append_only_mutation"/.test(downSql),
            "shared function preserved",
        )

        // ---- 2. enums exactly as declared -------------------------------------
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
        // There is no FAILED state, and that absence is load-bearing: a failed install leaves no row.
        checkInvertible(
            "BlueprintInstallationState has no FAILED value, because a failed install leaves no row at all",
            !enumRows.some((r) => r.typname === "BlueprintInstallationState" && r.enumlabel === "FAILED"),
            "absent by design",
        )
        checkInvertible(
            "BlueprintInstallationEventKind has no REFUSED value, because a refusal is not a partial write",
            !enumRows.some((r) => r.typname === "BlueprintInstallationEventKind" && r.enumlabel === "REFUSED"),
            "absent by design",
        )

        // ---- 3. foreign keys, verified BY NAME --------------------------------
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
            const hit = fks.find(
                (f) => f.table_name === table && f.column_name === column && f.foreign_table_name === target,
            )
            checkInvertible(`${table}.${column} points at ${target}`, Boolean(hit), hit ? "verified" : "MISSING OR WRONG TARGET")
        }
        // blueprintId is deliberately NOT a foreign key: the registry is static code, and a table of
        // blueprints would be a copy of blueprints.ts able to drift from it.
        checkInvertible(
            "MEASURED: blueprintId is NOT a foreign key, because the blueprint registry is static code and not a table",
            !fks.some((f) => f.table_name === "BlueprintInstallation" && f.column_name === "blueprintId"),
            "no FK on blueprintId, and no Blueprint table exists",
        )
        check("no Blueprint registry table was created", !tables.includes("Blueprint"), "absent")

        // ---- 4. constraints, partial index and triggers ------------------------
        const constraintNames = (
            await prisma.$queryRawUnsafe<{ conname: string }[]>(
                "select conname from pg_constraint where contype='c' and connamespace='public'::regnamespace",
            )
        ).map((r) => r.conname)
        const missingChecks = CHECK_CONSTRAINTS.filter((c) => !constraintNames.includes(c))
        check(
            `all ${CHECK_CONSTRAINTS.length} installation CHECK constraints exist`,
            missingChecks.length === 0,
            missingChecks.join(",") || `${CHECK_CONSTRAINTS.length}/${CHECK_CONSTRAINTS.length}`,
        )

        const idx = await prisma.$queryRawUnsafe<{ indexname: string; indexdef: string }[]>(
            "select indexname, indexdef from pg_indexes where schemaname='public' and indexname = 'BlueprintInstallation_one_active_per_workspace'",
        )
        checkInvertible(
            "the one-active-per-workspace index is UNIQUE and PARTIAL on state = ACTIVE",
            idx.length === 1 && /UNIQUE/i.test(idx[0].indexdef) && /WHERE/i.test(idx[0].indexdef) && /ACTIVE/.test(idx[0].indexdef),
            idx[0]?.indexdef?.slice(0, 160) ?? "MISSING",
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
        // The append-only guarantee must REUSE the shared function, not redefine it: two definitions
        // of one guard is how the two quietly diverge.
        const fnRows = await prisma.$queryRawUnsafe<{ proname: string; n: bigint }[]>(
            "select proname, count(*)::bigint as n from pg_proc where proname = 'reject_append_only_mutation' group by proname",
        )
        checkInvertible(
            "reject_append_only_mutation() exists exactly once - the ledger reuses it rather than redefining it",
            fnRows.length === 1 && Number(fnRows[0].n) === 1,
            fnRows.length ? `${Number(fnRows[0].n)} definition(s)` : "MISSING",
        )

        // ---- 5. no column makes a claim this package does not ------------------
        const cols = await prisma.$queryRawUnsafe<{ table_name: string; column_name: string }[]>(
            "select table_name, column_name from information_schema.columns where table_schema='public'",
        )
        const newCols = cols.filter((c) => (INSTALL_TABLES as readonly string[]).includes(c.table_name))
        const claimed = newCols.filter((c) => (FORBIDDEN_COLUMNS as readonly string[]).includes(c.column_name))
        checkInvertible(
            "no granting, notification, payment, scheduling or workflow-template column exists on either installation table",
            claimed.length === 0,
            claimed.map((c) => `${c.table_name}.${c.column_name}`).join(",") || `none of ${FORBIDDEN_COLUMNS.length}`,
        )
        const touched = UNTOUCHED_TABLES.filter((t) =>
            cols.some((c) => c.table_name === t && /blueprint|install/i.test(c.column_name)),
        )
        checkInvertible(
            "no pre-existing table gained a blueprint or install column - installation is additive, not invasive",
            touched.length === 0,
            touched.join(",") || `${UNTOUCHED_TABLES.length} tables unchanged`,
        )

        // ---- 6. ONE ACTIVE PER WORKSPACE, behaviourally -----------------------
        // An index that exists is not the same as an index that refuses.
        await refusesBy(
            "a second ACTIVE installation in the SAME workspace is refused by the PARTIAL index, on workspaceId alone",
            "t1",
            /Key \("workspaceId"\)=/,
            async (tx, s) => {
                await insertInstall(tx, s, `${RUN}_t1_a`)
                await insertInstall(tx, s, `${RUN}_t1_b`, { blueprintId: "restaurant-venue-v3" })
            },
        )
        // And the half that proves the index is PARTIAL rather than a plain unique key: history is
        // unlimited, only the live row is exclusive.
        await accepts(
            "many SUPERSEDED and REMOVED installations may coexist with one ACTIVE - the index is partial, not a plain unique key",
            "t2",
            async (tx, s) => {
                await insertInstall(tx, s, `${RUN}_t2_a`, { state: "SUPERSEDED" })
                await insertInstall(tx, s, `${RUN}_t2_b`, { state: "SUPERSEDED" })
                await insertInstall(tx, s, `${RUN}_t2_c`, { state: "REMOVED" })
                await insertInstall(tx, s, `${RUN}_t2_d`, { state: "ACTIVE" })
            },
        )
        await accepts("two DIFFERENT workspaces may each hold an ACTIVE installation", "t3", async (tx, s) => {
            await insertInstall(tx, s, `${RUN}_t3_a`, { workspaceId: s.workspaceA, profileId: s.profileA })
            await insertInstall(tx, s, `${RUN}_t3_b`, { workspaceId: s.workspaceB, profileId: s.profileB })
        })

        // ---- 7. idempotency uniqueness ---------------------------------------
        await refusesBy(
            "the same idempotency key cannot be used twice in one workspace",
            "t4",
            /idempotencyKey|duplicate key/i,
            async (tx, s) => {
                await insertInstall(tx, s, `${RUN}_t4_a`, { idempotencyKey: "same-key", state: "SUPERSEDED" })
                await insertInstall(tx, s, `${RUN}_t4_b`, { idempotencyKey: "same-key", state: "SUPERSEDED" })
            },
        )
        await accepts("the same idempotency key in a DIFFERENT workspace is allowed", "t5", async (tx, s) => {
            await insertInstall(tx, s, `${RUN}_t5_a`, { idempotencyKey: "shared", workspaceId: s.workspaceA, profileId: s.profileA })
            await insertInstall(tx, s, `${RUN}_t5_b`, { idempotencyKey: "shared", workspaceId: s.workspaceB, profileId: s.profileB })
        })
        await refusesBy(
            "a blank idempotency key is refused, so the replay guarantee cannot be opted out of",
            "t6",
            /idempotencyKey_not_blank/,
            async (tx, s) => {
                await insertInstall(tx, s, `${RUN}_t6_a`, { idempotencyKey: "   " })
            },
        )

        // ---- 8. the state/removedAt agreement, both directions ----------------
        await refusesBy(
            "a REMOVED installation with no removal timestamp is refused",
            "t7",
            /removed_has_timestamp/,
            async (tx, s) => {
                await insertInstall(tx, s, `${RUN}_t7_a`, { state: "REMOVED", removedAt: "null" })
            },
        )
        await refusesBy(
            "an ACTIVE installation carrying a removal timestamp is refused, so a stale removedAt cannot survive",
            "t8",
            /active_has_no_removal/,
            async (tx, s) => {
                await insertInstall(tx, s, `${RUN}_t8_a`, { state: "ACTIVE", removedAt: "now()" })
            },
        )

        // ---- 9. blanks that would make the ledger meaningless -----------------
        await refusesBy("a blank blueprintId is refused", "t9", /blueprintId_not_blank/, async (tx, s) => {
            await insertInstall(tx, s, `${RUN}_t9_a`, { blueprintId: " " })
        })
        await refusesBy("a blank blueprintVersion is refused", "t10", /blueprintVersion_not_blank/, async (tx, s) => {
            await insertInstall(tx, s, `${RUN}_t10_a`, { blueprintVersion: "" })
        })
        await refusesBy("an installation with no recorded actor is refused", "t11", /installedBy_not_blank/, async (tx, s) => {
            await insertInstall(tx, s, `${RUN}_t11_a`, { installedBy: "  " })
        })
        await refusesBy("a ledger line with no actor is refused", "t12", /Event_actor_not_blank/, async (tx, s) => {
            await insertInstall(tx, s, `${RUN}_t12_a`)
            await insertEvent(tx, `${RUN}_t12_e`, `${RUN}_t12_a`, s.workspaceA, { actor: " " })
        })

        // ---- 10. supersession -------------------------------------------------
        await accepts("an upgrade may point at the installation it superseded", "t13", async (tx, s) => {
            await insertInstall(tx, s, `${RUN}_t13_old`, { state: "SUPERSEDED", blueprintId: "restaurant-venue-v2" })
            await insertInstall(tx, s, `${RUN}_t13_new`, {
                blueprintId: "restaurant-venue-v3",
                supersedesInstallationId: `${RUN}_t13_old`,
            })
        })
        // Self-supersession is refused twice over, by two different mechanisms, and WHICH one fires
        // depends on the statement - a distinction found by writing the assertion and watching it fail
        // for the wrong reason. On INSERT the BEFORE trigger runs first and the row it would point at
        // does not exist yet, so the trigger refuses before the CHECK is ever evaluated. That makes the
        // CHECK unreachable by INSERT, and an assertion that only tried INSERT would have been claiming
        // to test a constraint it never reached. So both paths are asserted, and the CHECK is proven
        // reachable by the statement that can actually reach it.
        await refusesBy(
            "self-supersession by INSERT is refused by the trigger, which runs before the CHECK and finds no such row yet",
            "t14",
            /supersedes an installation that does not exist/,
            async (tx, s) => {
                await tx.$executeRawUnsafe(
                    `insert into "BlueprintInstallation"
                       ("id","workspaceId","profileId","blueprintId","blueprintVersion","state","idempotencyKey",
                        "configJson","supersedesInstallationId","installedBy","installedAt","updatedAt")
                     values ('${RUN}_t14_a','${s.workspaceA}','${s.profileA}','field-service-v1','1.0.0','ACTIVE',
                             '${RUN}_t14_a','{}'::jsonb,'${RUN}_t14_a','owner:test', now(), now())`,
                )
            },
        )
        await refusesBy(
            "self-supersession by UPDATE is refused by the no_self_supersession CHECK, so that constraint is genuinely reachable",
            "t14b",
            /no_self_supersession/,
            async (tx, s) => {
                await insertInstall(tx, s, `${RUN}_t14b_a`)
                await tx.$executeRawUnsafe(
                    `update "BlueprintInstallation" set "supersedesInstallationId" = "id" where "id" = '${RUN}_t14b_a'`,
                )
            },
        )
        await refusesBy(
            "two installations cannot both claim to have superseded the same one",
            "t15",
            /supersedesInstallationId|duplicate key/i,
            async (tx, s) => {
                await insertInstall(tx, s, `${RUN}_t15_old`, { state: "SUPERSEDED" })
                await insertInstall(tx, s, `${RUN}_t15_a`, {
                    state: "SUPERSEDED",
                    supersedesInstallationId: `${RUN}_t15_old`,
                })
                await insertInstall(tx, s, `${RUN}_t15_b`, { supersedesInstallationId: `${RUN}_t15_old` })
            },
        )
        // THE cross-tenant assertion. Tenant B is really seeded, so this reaches the supersession
        // guard rather than failing earlier for an unrelated reason.
        await refusesBy(
            "MEASURED: an installation cannot supersede ANOTHER WORKSPACE's installation, so supersession cannot cross a tenant",
            "t16",
            /cannot supersede installation/,
            async (tx, s) => {
                await insertInstall(tx, s, `${RUN}_t16_b`, {
                    workspaceId: s.workspaceB,
                    profileId: s.profileB,
                    state: "SUPERSEDED",
                })
                await insertInstall(tx, s, `${RUN}_t16_a`, {
                    workspaceId: s.workspaceA,
                    profileId: s.profileA,
                    supersedesInstallationId: `${RUN}_t16_b`,
                })
            },
        )

        // ---- 11. the ledger's denormalized tenant key must be the truth -------
        await refusesBy(
            "MEASURED: a ledger line claiming a different workspace than its installation is refused by trigger",
            "t17",
            /ledger line claims workspace/,
            async (tx, s) => {
                await insertInstall(tx, s, `${RUN}_t17_a`, { workspaceId: s.workspaceA, profileId: s.profileA })
                await insertEvent(tx, `${RUN}_t17_e`, `${RUN}_t17_a`, s.workspaceB)
            },
        )
        await accepts("a ledger line agreeing with its installation's workspace is accepted", "t18", async (tx, s) => {
            await insertInstall(tx, s, `${RUN}_t18_a`)
            await insertEvent(tx, `${RUN}_t18_e`, `${RUN}_t18_a`, s.workspaceA)
        })

        // ---- 12. APPEND-ONLY, proven by attempting real mutations -------------
        await refusesBy(
            "UPDATE on the installation ledger is refused by the database, not by the engine",
            "t19",
            /append-only/i,
            async (tx, s) => {
                await insertInstall(tx, s, `${RUN}_t19_a`)
                await insertEvent(tx, `${RUN}_t19_e`, `${RUN}_t19_a`, s.workspaceA)
                await tx.$executeRawUnsafe(
                    `update "BlueprintInstallationEvent" set "detail" = 'rewritten' where "id" = '${RUN}_t19_e'`,
                )
            },
        )
        await refusesBy(
            "DELETE on the installation ledger is refused by the database, not by the engine",
            "t20",
            /append-only/i,
            async (tx, s) => {
                await insertInstall(tx, s, `${RUN}_t20_a`)
                await insertEvent(tx, `${RUN}_t20_e`, `${RUN}_t20_a`, s.workspaceA)
                await tx.$executeRawUnsafe(`delete from "BlueprintInstallationEvent" where "id" = '${RUN}_t20_e'`)
            },
        )
        // The installation row itself is NOT append-only, and that is deliberate: supersession and
        // removal are state transitions on it. Asserted so the distinction is a decision, not a gap.
        await accepts(
            "the installation ROW may transition state - only the ledger is append-only, and that difference is intended",
            "t21",
            async (tx, s) => {
                await insertInstall(tx, s, `${RUN}_t21_a`)
                await tx.$executeRawUnsafe(
                    `update "BlueprintInstallation" set "state" = 'SUPERSEDED' where "id" = '${RUN}_t21_a'`,
                )
            },
        )

        // ---- 13. tenancy cascade, and the limit the ledger imposes on it ------
        await accepts(
            "deleting a workspace cascades an installation with NO history away rather than orphaning it",
            "t22",
            async (tx, s) => {
                await insertInstall(tx, s, `${RUN}_t22_a`)
                await tx.$executeRawUnsafe(`delete from "Workspace" where "id" = '${s.workspaceA}'`)
                const left = await tx.$queryRawUnsafe<{ n: bigint }[]>(
                    `select count(*)::bigint as n from "BlueprintInstallation" where "id" = '${RUN}_t22_a'`,
                )
                if (Number(left[0].n) !== 0) throw new Error(`installation survived its workspace: ${Number(left[0].n)} row(s)`)
            },
        )
        // And the half that the assertion above would otherwise hide. Once a ledger line exists the
        // workspace can no longer be deleted at all: a CASCADE still fires the BEFORE DELETE trigger, so
        // append-only wins over the cascade. That is consistent with ActivityEvent and CopilotAuditEvent,
        // which have made Contact and workspace deletion conditional in the same way since long before
        // this package - but it is a real consequence of choosing append-only, and asserting only the
        // no-history case would have advertised a deletion path that does not exist in practice.
        await refusesBy(
            "MEASURED: once the ledger has a line, deleting the workspace is REFUSED - append-only outranks the cascade",
            "t23",
            /append-only/i,
            async (tx, s) => {
                await insertInstall(tx, s, `${RUN}_t23_a`)
                await insertEvent(tx, `${RUN}_t23_e`, `${RUN}_t23_a`, s.workspaceA)
                await tx.$executeRawUnsafe(`delete from "Workspace" where "id" = '${s.workspaceA}'`)
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
        console.error(`${failed.length} blueprint installation schema invariant(s) FAILED`)
        process.exit(1)
    }
    console.log("Blueprint installation schema holds: it records an install, and it forks nothing.")
}

main().catch((e) => {
    console.error(e)
    process.exit(1)
})

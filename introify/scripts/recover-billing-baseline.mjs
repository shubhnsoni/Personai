import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { spawnSync } from "node:child_process"
import { createRequire } from "node:module"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { selectMigrationConnection } from "./migrate-hostinger.mjs"

const require = createRequire(import.meta.url)
export const BILLING_MIGRATION = "20260909120000_platform_billing"
const migrationFile = new URL(`../prisma/migrations/${BILLING_MIGRATION}/migration.sql`, import.meta.url)
const foundationFile = new URL("../prisma/migrations/20260909110000_ar_build_foundation/migration.sql", import.meta.url)
class RecoveryRefusal extends Error {}

/** This is a recovery for one observed first-statement failure, not a retry policy. */
export function recoveryDecision({ failures, relations, columns, schema, billingSql }) {
    if (failures.length === 0) return "not-needed"
    if (schema !== "public" || failures.length !== 1) throw new RecoveryRefusal("Recovery refused: unexpected migration state.")
    const failed = failures[0]
    const checksums = [billingSql, billingSql.replaceAll("\r\n", "\n"), billingSql.replaceAll("\r\n", "\n").replaceAll("\n", "\r\n")]
        .map(sql => createHash("sha256").update(sql).digest("hex"))
    if (failed.migration_name !== BILLING_MIGRATION || failed.applied_steps_count !== 0 || !checksums.includes(failed.checksum)
        || !failed.logs?.includes("42P01") || !failed.logs?.includes('relation "ArBuild" does not exist')) {
        throw new RecoveryRefusal("Recovery refused: failure does not match the verified missing-table incident.")
    }
    if (!billingSql.replaceAll("\r\n", "\n").trimStart().startsWith('-- DropForeignKey\nALTER TABLE "ArBuild" DROP CONSTRAINT "ArBuild_profileId_fkey";')) {
        throw new RecoveryRefusal("Recovery refused: migration entry point changed.")
    }
    const names = new Set(relations.map(row => row.name))
    const createdRelations = [
        ...[...billingSql.matchAll(/CREATE (?:TABLE|SEQUENCE|(?:UNIQUE )?INDEX) "([^"]+)"/g)].map(match => match[1]),
        ...[...billingSql.matchAll(/CONSTRAINT "([^"]+)" PRIMARY KEY/g)].map(match => match[1]),
    ]
    if (names.has("ArBuild") || createdRelations.some(name => names.has(name))) {
        throw new RecoveryRefusal("Recovery refused: migration structures already exist; manual reconciliation is required.")
    }
    for (const table of ["User", "Profile", "DigitalProduct", "Workspace", "Membership"]) {
        if (!names.has(table)) throw new RecoveryRefusal("Recovery refused: required legacy structure is missing.")
    }
    const addedColumns = [...billingSql.matchAll(/ALTER TABLE "([^"]+)"([\s\S]*?);/g)]
        .flatMap(table => [...table[2].matchAll(/ADD COLUMN\s+"([^"]+)"/g)].map(column => [table[1], column[1]]))
    if (addedColumns.some(([table, column]) => columns.some(row => row.table_name === table && row.column_name === column))) {
        throw new RecoveryRefusal("Recovery refused: billing columns were partially applied.")
    }
    return "resolve-missing-ar-build"
}

export async function recoverBillingBaseline(env = process.env, execute = spawnSync) {
    const connection = selectMigrationConnection(env)
    const billingSql = readFileSync(migrationFile, "utf8")
    // Fail before touching migration metadata if the additive prerequisite is absent.
    readFileSync(foundationFile, "utf8")
    const { PrismaClient } = require("@prisma/client")
    const prisma = new PrismaClient({ datasources: { db: { url: connection.url } }, log: [] })
    try {
        return await prisma.$transaction(async tx => {
            // Serialize this repair across build processes. Prisma retains its own
            // advisory locking for the supported resolve/deploy commands.
            await tx.$queryRawUnsafe("SELECT pg_advisory_xact_lock(19260909)::text")
            const [context] = await tx.$queryRawUnsafe("SELECT current_schema()::text AS schema, to_regclass('\"_prisma_migrations\"')::text AS migrations")
            if (!context.migrations) return "not-needed"
            const failures = await tx.$queryRawUnsafe('SELECT migration_name, checksum, logs, applied_steps_count FROM "_prisma_migrations" WHERE finished_at IS NULL AND rolled_back_at IS NULL')
            if (failures.length === 0) return "not-needed"
            const relations = await tx.$queryRawUnsafe("SELECT c.relname::text AS name FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'")
            const columns = await tx.$queryRawUnsafe("SELECT table_name::text, column_name::text FROM information_schema.columns WHERE table_schema='public'")
            const decision = recoveryDecision({ failures, relations, columns, schema: context.schema, billingSql })
            if (decision !== "resolve-missing-ar-build") return decision
            console.log("Verified billing failure occurred before any billing schema changes; resolving the missing ArBuild prerequisite incident.")
            const result = execute(process.execPath, [require.resolve("prisma/build/index.js"), "migrate", "resolve", "--rolled-back", BILLING_MIGRATION], {
                env: { ...env, DATABASE_URL: connection.url }, stdio: "pipe", maxBuffer: 65536, windowsHide: true, timeout: 60000,
            })
            if (result.error || result.status !== 0) throw new RecoveryRefusal("Recovery refused: Prisma could not resolve the verified failed record.")
            const remaining = await tx.$queryRawUnsafe('SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NULL AND rolled_back_at IS NULL')
            if (remaining.length) throw new RecoveryRefusal("Recovery refused: an unresolved migration remains.")
            console.log("Failed record resolved. Normal migration deployment will apply the additive prerequisite and billing migration.")
            return "resolved"
        }, { timeout: 90000, maxWait: 10000 })
    } finally {
        await prisma.$disconnect()
    }
}

// No dotenv load and no connection on import. Hosting supplies the environment.
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    recoverBillingBaseline().catch(error => {
        // Driver and provider errors may contain connection data; do not print them.
        console.error(error instanceof RecoveryRefusal ? error.message : "Billing baseline recovery stopped. Inspect the migration state before retrying; no reset or broad recovery is permitted.")
        process.exitCode = 1
    })
}

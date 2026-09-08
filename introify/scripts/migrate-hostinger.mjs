import { spawnSync } from "node:child_process"
import { createRequire } from "node:module"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"

const require = createRequire(import.meta.url)

// Neon documents the same endpoint with/without its -pooler suffix:
// https://neon.com/docs/connect/connection-pooling
// Limit automatic conversion to Neon's standard AWS/Azure endpoint hostnames.
const NEON_POOLED_HOST = /^(ep-[a-z0-9]+(?:-[a-z0-9]+)*)-pooler(\.(?:c-\d+\.)?[a-z0-9]+(?:-[a-z0-9]+)*\.(?:aws|azure)\.neon\.tech)$/i

function postgresUrl(value, name) {
    try {
        const url = new URL(value)
        if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname) throw new Error()
        return url
    } catch {
        // URL parsing errors can include credentials; replace them entirely.
        throw new Error(`${name} must be a valid PostgreSQL connection URL.`)
    }
}

/** @param {{ DATABASE_URL?: string, DIRECT_URL?: string }} env */
export function selectMigrationConnection(env) {
    if (env.DIRECT_URL?.trim()) {
        const direct = postgresUrl(env.DIRECT_URL, "DIRECT_URL")
        if (NEON_POOLED_HOST.test(direct.hostname)) {
            throw new Error("DIRECT_URL must use the direct Neon endpoint, without -pooler.")
        }
        direct.searchParams.delete("pgbouncer")
        return { url: direct.href, source: "DIRECT_URL" }
    }

    const database = postgresUrl(env.DATABASE_URL, "DATABASE_URL")
    const match = database.hostname.match(NEON_POOLED_HOST)
    if (!match) return { url: env.DATABASE_URL, source: "DATABASE_URL" }

    database.hostname = `${match[1]}${match[2]}`
    database.searchParams.delete("pgbouncer")
    return { url: database.href, source: "Neon direct endpoint" }
}

/**
 * Override DATABASE_URL only for the migration child. The bootstrap, Prisma
 * generation, Next build, and running app retain their original pooled URL.
 * @param {NodeJS.ProcessEnv} env
 * @param {typeof spawnSync} execute
 */
export function runMigrations(env = process.env, execute = spawnSync) {
    const connection = selectMigrationConnection(env)
    const result = execute(process.execPath, [require.resolve("prisma/build/index.js"), "migrate", "deploy"], {
        env: { ...env, DATABASE_URL: connection.url },
        stdio: "inherit",
        windowsHide: true,
    })
    if (result.error) throw new Error("Could not start Prisma migration deployment.")
    return result.status ?? 1
}

// Importing this module for tests never reads .env or starts Prisma.
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    try {
        process.exitCode = runMigrations()
    } catch {
        console.error("Migration deploy could not start. Check DATABASE_URL / DIRECT_URL and the installed Prisma CLI.")
        process.exitCode = 1
    }
}

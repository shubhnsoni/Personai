import { describe, expect, it, vi } from "vitest"
import { runMigrations, selectMigrationConnection } from "../scripts/migrate-hostinger.mjs"

const pooled = "postgresql://app:fake-password@ep-test-example-123-pooler.c-4.ap-southeast-1.aws.neon.tech/app?sslmode=require&channel_binding=require"

describe("Hostinger migration connection selection", () => {
    it("prefers an explicit DIRECT_URL, preserving its credentials, database, and TLS parameters", () => {
        const direct = "postgresql://migrator:fake%40password@direct.example.test:5433/migrations?sslmode=verify-full&sslcert=%2Fcerts%2Fclient.pem&pgbouncer=true"
        const result = selectMigrationConnection({ DATABASE_URL: pooled, DIRECT_URL: direct })
        const url = new URL(result.url!)
        expect(result.source).toBe("DIRECT_URL")
        expect(url.hostname).toBe("direct.example.test")
        expect(url.username).toBe("migrator")
        expect(url.password).toBe("fake%40password")
        expect(url.port).toBe("5433")
        expect(url.pathname).toBe("/migrations")
        expect(url.searchParams.get("sslmode")).toBe("verify-full")
        expect(url.searchParams.get("sslcert")).toBe("/certs/client.pem")
        expect(url.searchParams.has("pgbouncer")).toBe(false)
    })

    it.each([
        ["ep-test-example-123-pooler.c-4.ap-southeast-1.aws.neon.tech", "ep-test-example-123.c-4.ap-southeast-1.aws.neon.tech"],
        ["ep-test-example-123-pooler.us-east-2.aws.neon.tech", "ep-test-example-123.us-east-2.aws.neon.tech"],
        ["ep-test-example-123-pooler.eastus2.azure.neon.tech", "ep-test-example-123.eastus2.azure.neon.tech"],
    ])("converts only the pooler suffix on the standard Neon host %s", (host, directHost) => {
        const input = `postgres://fake%40user:fake%2Fpassword@${host}:5432/app?sslmode=require&channel_binding=require&schema=custom&application_name=build%20step&connect_timeout=15&pgbouncer=true`
        const result = selectMigrationConnection({ DATABASE_URL: input, DIRECT_URL: "" })
        const before = new URL(input)
        const after = new URL(result.url!)
        expect(result.source).toBe("Neon direct endpoint")
        expect(after.hostname).toBe(directHost)
        for (const property of ["protocol", "username", "password", "port", "pathname"] as const) {
            expect(after[property]).toBe(before[property])
        }
        before.searchParams.delete("pgbouncer")
        expect([...after.searchParams]).toEqual([...before.searchParams])
    })

    it.each([
        "postgresql://fake:fake@localhost:5432/local?schema=public",
        "postgresql://fake:fake@ep-test-example-123.us-east-2.aws.neon.tech/app?sslmode=require",
        "postgresql://fake:fake@db-pooler.example.test/app?pgbouncer=true",
        "postgresql://fake:fake@ep-test-example-123-pooler.us-east-2.aws.neon.tech.example.test/app",
    ])("leaves an existing direct or unrecognized connection unchanged", (url) => {
        expect(selectMigrationConnection({ DATABASE_URL: url })).toEqual({ url, source: "DATABASE_URL" })
    })

    it("rejects an explicitly pooled Neon DIRECT_URL without falling back", () => {
        expect(() => selectMigrationConnection({ DATABASE_URL: pooled, DIRECT_URL: pooled })).toThrow("DIRECT_URL must use the direct Neon endpoint")
    })

    it.each([undefined, "not-a-url-with-fake-secret", "https://fake:fake-secret@example.test/app"])("rejects missing or invalid PostgreSQL connections without exposing their values", (url) => {
        expect(() => selectMigrationConnection({ DATABASE_URL: url })).toThrow("DATABASE_URL must be a valid PostgreSQL connection URL.")
        expect(() => selectMigrationConnection({ DATABASE_URL: pooled, DIRECT_URL: url ?? "invalid-direct-fake-secret" })).toThrow("DIRECT_URL must be a valid PostgreSQL connection URL.")
    })

    it("passes the direct override only to one Prisma child and propagates its failure", () => {
        const env = Object.freeze({ DATABASE_URL: pooled, NODE_ENV: "production", EXAMPLE_SETTING: "preserve" })
        const execute = vi.fn(() => ({ status: 7, error: undefined }))
        expect(runMigrations(env, execute as never)).toBe(7)
        expect(execute).toHaveBeenCalledTimes(1)
        const [command, args, options] = execute.mock.calls[0] as unknown as [string, string[], { env: Record<string, string>; stdio: string; windowsHide: boolean }]
        expect(command).toBe(process.execPath)
        expect(args.slice(1)).toEqual(["migrate", "deploy"])
        expect(args[0].replaceAll("\\", "/")).toMatch(/\/prisma\/build\/index\.js$/)
        expect(options.stdio).toBe("inherit")
        expect(options.windowsHide).toBe(true)
        expect(new URL(options.env.DATABASE_URL).hostname).toBe("ep-test-example-123.c-4.ap-southeast-1.aws.neon.tech")
        expect(options.env).toMatchObject({ NODE_ENV: "production", EXAMPLE_SETTING: "preserve" })
        expect(env.DATABASE_URL).toBe(pooled)
        expect(options.env.PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK).toBeUndefined()
        expect(args.join(" ")).not.toContain("fake-password")
    })

    it("treats a terminated child as failure without retrying", () => {
        const execute = vi.fn(() => ({ status: null, signal: "SIGTERM" }))
        expect(runMigrations({ DATABASE_URL: pooled, NODE_ENV: "test" }, execute as never)).toBe(1)
        expect(execute).toHaveBeenCalledTimes(1)
    })
})

/**
 * Proof that a database target is disposable, per ADR-011.
 *
 * Every migration or schema command must call this and act on the result. The point is
 * that the proof comes from the *parsed connection target*, not from a variable someone
 * believes they set: the URL is parsed, the database name is extracted, and the name is
 * checked against a deny rule and an allow rule.
 *
 * Deny beats allow. `personalink` is the single live database and can never be a target,
 * even if a future allow pattern would otherwise match it.
 */

/** The live database. Never a valid target for schema work. */
export const PROTECTED_DATABASES = ["personalink"] as const

/**
 * Disposable names must be explicit and self-describing. A bare name like `test` is
 * rejected on purpose: it is too easy to point at something real by accident.
 */
export const DISPOSABLE_PATTERNS: RegExp[] = [
    /^personalink_phase0_rehearsal_\d{8}_\d{6}$/u,
    /^personalink_phase0_clean_\d{8}_\d{6}$/u,
    /^personalink_cutover_rehearsal_\d{8}_\d{6}$/u,
    /^personalink_restoretest_\d{8}_\d{6}$/u,
    /^personalink_schema_dev_\d{8}_\d{6}$/u,
]

export type DisposableVerdict =
    | { ok: true; database: string; matchedPattern: string }
    | { ok: false; database: string | null; reason: string }

/** Extracts the database name from a PostgreSQL connection URL, or null. */
export function parseDatabaseName(rawUrl: string | undefined | null): string | null {
    if (!rawUrl || typeof rawUrl !== "string" || !rawUrl.trim()) return null

    let parsed: URL
    try {
        parsed = new URL(rawUrl.trim())
    } catch {
        return null
    }

    if (parsed.protocol !== "postgresql:" && parsed.protocol !== "postgres:") return null

    // Strip the leading slash and ignore anything after a further slash. Query params
    // (?schema=public, ?sslmode=require) are already excluded by URL parsing.
    const firstSegment = parsed.pathname.replace(/^\//u, "").split("/")[0] ?? ""
    let name: string
    try {
        name = decodeURIComponent(firstSegment)
    } catch {
        return null
    }

    const trimmed = name.trim()
    return trimmed.length > 0 ? trimmed : null
}

/**
 * Returns a verdict for a connection URL. Callers must stop the database action on
 * `{ ok: false }` rather than continuing and hoping.
 */
export function verifyDisposableTarget(rawUrl: string | undefined | null): DisposableVerdict {
    const database = parseDatabaseName(rawUrl)

    if (database === null) {
        return {
            ok: false,
            database: null,
            reason: "Connection target could not be parsed as a PostgreSQL URL with a database name.",
        }
    }

    // Deny first, and compare case-insensitively: PostgreSQL folds unquoted identifiers,
    // so `PersonaLink` must not slip past a case-sensitive comparison.
    const lowered = database.toLowerCase()
    for (const protectedName of PROTECTED_DATABASES) {
        if (lowered === protectedName.toLowerCase()) {
            return {
                ok: false,
                database,
                reason: `${database} is a protected live database and is never a valid schema target.`,
            }
        }
    }

    const matched = DISPOSABLE_PATTERNS.find((pattern) => pattern.test(database))
    if (!matched) {
        return {
            ok: false,
            database,
            reason:
                `${database} does not match any approved disposable-database pattern. ` +
                "Create a uniquely named disposable database instead of reusing an existing one.",
        }
    }

    return { ok: true, database, matchedPattern: matched.source }
}

/**
 * Throws unless the target is provably disposable. Use this at the top of any script that
 * runs a migration command, before the command is constructed.
 */
export function assertDisposableTarget(rawUrl: string | undefined | null): string {
    const verdict = verifyDisposableTarget(rawUrl)
    if (!verdict.ok) {
        throw new Error(`Refusing to run a schema command: ${verdict.reason}`)
    }
    return verdict.database
}

/** Redacts credentials so a target can be logged or reported safely. */
export function redactUrl(rawUrl: string | undefined | null): string {
    if (!rawUrl) return "<unset>"
    try {
        const parsed = new URL(rawUrl.trim())
        const database = parseDatabaseName(rawUrl) ?? "<unparsed>"
        return `${parsed.protocol}//<redacted>@${parsed.hostname}:${parsed.port || "5432"}/${database}`
    } catch {
        return "<unparsable>"
    }
}

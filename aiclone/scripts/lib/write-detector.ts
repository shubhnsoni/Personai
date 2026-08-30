/**
 * write-detector.ts — evidence that a code path performed NO database write.
 *
 * WHY THIS EXISTS
 * ---------------
 * Several surfaces on this platform make a read-only promise: "requesting this writes nothing".
 * The way that promise was proven was to count rows in a hand-written list of tables before and
 * after the request and compare the totals. That proof is weaker than its name, in five separate
 * ways, and every one of them is a write it cannot see:
 *
 *   1. an UPDATE to an existing row            - the row count does not move
 *   2. an insert followed by a delete          - the count returns to where it started
 *   3. a sequence / identity advance           - no row is left behind to count at all
 *   4. a write to a table nobody listed        - this schema has 115 base tables; the list had 18
 *   5. a write that is rolled back             - erased before the comparison is taken
 *
 * It also had a sixth problem that is not about coverage but about validity: the counts were
 * GLOBAL, so a second harness seeding the same database during the window moved them, and the
 * assertion went red for a reason that had nothing to do with the code under test. A proof that
 * only holds when nothing else is running is not a proof, it is a scheduling constraint.
 *
 * THE TWO MECHANISMS, AND WHY BOTH
 * --------------------------------
 * Neither mechanism alone is sufficient, and their blind spots are complementary, so this module
 * runs both and reports which one caught what.
 *
 *   MECHANISM 1 - CALL INTERCEPTION (`instrument`). A Prisma client extension observes every model
 *   action and every raw call the instrumented client issues. A write is recorded AT THE MOMENT IT
 *   IS ISSUED, so its later fate is irrelevant: an insert that is deleted two statements later, a
 *   write inside an interactive `$transaction`, and a write inside a transaction that rolls back are
 *   all still recorded. It is also table-agnostic, which is what closes hole 4 - it does not need to
 *   know the schema, so a write to a table no list mentions is caught like any other. And because it
 *   observes only OUR client, it is completely immune to what a concurrent harness is doing.
 *     Blind spot: it sees only calls made THROUGH the instrumented client. A write issued on another
 *     connection, by a database trigger, or by a second client, is invisible to it.
 *
 *   MECHANISM 2 - INDEPENDENT CONTENT FINGERPRINTS (`fingerprintTables`). Not row counts: a digest
 *   over the CONTENT of the rows - `md5(string_agg((row)::text))` - plus the row count, plus
 *   `max(updatedAt)` where that column exists, plus every sequence's `last_value`. A digest over the
 *   whole row as text moves when ANY column of ANY row changes, which is what closes hole 1, and the
 *   sequence read closes hole 3. It is taken on a SEPARATE CONNECTION from the client under test, so
 *   the observation does not depend on the honesty of the thing being observed.
 *     Blind spot: it compares two instants. A write that is perfectly undone between them - hole 2 -
 *     leaves the fingerprint identical. Only Mechanism 1 sees that.
 *
 * WHAT THIS MODULE DELIBERATELY DOES NOT DO
 * -----------------------------------------
 * It does not wrap the measured request in a transaction that rolls back. That was the original
 * defect here: the rollback erased the write before the comparison was taken, so the assertion was
 * guaranteed to pass by its own harness. The measured request must run against COMMITTED data and
 * the fixture must be torn down explicitly. `sweepRunToken` exists to prove that teardown worked,
 * including for append-only tables whose rows cannot be deleted by the path that created them.
 *
 * CONCURRENCY
 * -----------
 * Three kinds of observation are available, and they are not equally trustworthy when other
 * harnesses share the database. Callers should prefer them in this order:
 *
 *   a. intercepted calls          - concurrency-immune, complete, and the primary evidence.
 *   b. FIXTURE-SCOPED fingerprint - pass `where` to scope a table to this run's own rows. Another
 *                                   harness's rows are not in the digest, so it cannot move it.
 *   c. GLOBAL fingerprint         - genuinely global claims ("no row anywhere changed") need this,
 *                                   and it IS shared state. `sweepRunToken` is the concurrency-safe
 *                                   way to ask the global question: it asks whether any row in any
 *                                   table mentions THIS RUN's unique token, which no concurrent
 *                                   harness can satisfy. Treat a bare global digest change as a
 *                                   signal to investigate, not as a verdict.
 *
 * USAGE
 *   const detector = await createWriteDetector({ client: prisma, runToken: RUN })
 *   await detector.begin([{ table: "FieldJob", where: `"id" like '${RUN}%'` }])
 *   ... exercise the code under test, handing it detector.client ...
 *   const verdict = await detector.end()
 *   if (!verdict.clean) console.error(verdict.summary)
 *   await detector.close()
 */
import { AsyncLocalStorage } from "node:async_hooks"

import { PrismaClient } from "@prisma/client"

/** A write the interceptor can name. Model actions keep Prisma's own verb. */
export type MutationClass =
    | "create"
    | "createMany"
    | "createManyAndReturn"
    | "update"
    | "updateMany"
    | "updateManyAndReturn"
    | "upsert"
    | "delete"
    | "deleteMany"
    | "executeRaw"
    | "raw-write"

/** Every model action Prisma exposes that changes data. Reads are everything else. */
const MODEL_WRITE_OPERATIONS: ReadonlyMap<string, MutationClass> = new Map([
    ["create", "create"],
    ["createMany", "createMany"],
    ["createManyAndReturn", "createManyAndReturn"],
    ["update", "update"],
    ["updateMany", "updateMany"],
    ["updateManyAndReturn", "updateManyAndReturn"],
    ["upsert", "upsert"],
    ["delete", "delete"],
    ["deleteMany", "deleteMany"],
])

/** The four raw entry points. `$queryRaw` is included because it can carry a write. */
const RAW_OPERATIONS: ReadonlySet<string> = new Set([
    "$queryRaw",
    "$queryRawUnsafe",
    "$executeRaw",
    "$executeRawUnsafe",
])

/**
 * SQL that changes something. Leading CTEs are skipped, because `with x as (...) insert into ...`
 * is an insert whose first keyword is `with`, and a verb-anchored regex would miss it entirely.
 *
 * `nextval`/`setval` are included on purpose: `select nextval('s')` writes no row but advances a
 * sequence, and a sequence advance is one of the classes this module exists to catch. Row locks
 * (`for update` / `for share`) are included too - they mutate no content, but they take a lock on
 * committed data and no read-only path has any business doing so.
 */
const RAW_WRITE_PATTERN =
    /\b(?:insert\s+into|update\s+(?:only\s+)?"?[a-z_]|delete\s+from|merge\s+into|truncate|copy\s+"?[a-z_][^\s]*\s+from|alter\s+|drop\s+|create\s+(?:table|index|sequence|schema|view|trigger|function|type|database|role|extension)|grant\s+|revoke\s+|reindex\b|vacuum\b|refresh\s+materialized|nextval\s*\(|setval\s*\(|\bfor\s+(?:update|no\s+key\s+update|share|key\s+share)\b)/i

/** Statement-leading comments and whitespace, stripped before classification. */
function stripLeadingNoise(sql: string): string {
    let out = sql
    let previous = ""
    while (out !== previous) {
        previous = out
        out = out.replace(/^\s+/, "").replace(/^--[^\n]*\n?/, "").replace(/^\/\*[\s\S]*?\*\//, "")
    }
    return out
}

/**
 * Pulls the SQL text out of whatever Prisma handed the hook. MEASURED, not assumed - the three
 * shapes below are what Prisma 5.22 actually passes, verified per raw method:
 *   $queryRawUnsafe / $executeRawUnsafe -> Array, [sql, ...params]
 *   $queryRaw / $executeRaw             -> a Sql instance, { strings: string[], values: unknown[] }
 * A shape this function does not recognise returns null, and a null is treated as UNCLASSIFIABLE
 * rather than as a read - see `classifyRawCall`.
 */
export function extractSql(args: unknown): string | null {
    if (typeof args === "string") return args
    if (Array.isArray(args)) {
        const first: unknown = args[0]
        if (typeof first === "string") return first
        if (first !== null && typeof first === "object") return extractSql(first)
        return null
    }
    if (args !== null && typeof args === "object") {
        const bag = args as { sql?: unknown; strings?: unknown; text?: unknown }
        if (typeof bag.sql === "string") return bag.sql
        if (typeof bag.text === "string") return bag.text
        if (Array.isArray(bag.strings) && bag.strings.every((s) => typeof s === "string")) {
            return (bag.strings as string[]).join(" ? ")
        }
    }
    return null
}

/** True when this SQL changes committed state. */
export function isWriteSql(sql: string): boolean {
    return RAW_WRITE_PATTERN.test(stripLeadingNoise(sql))
}

/**
 * Classifies a raw call. Returns the class, or null for a read.
 *
 * An UNREADABLE statement is classified as a write, not as a read. That direction is deliberate:
 * if a future Prisma changes the args shape `extractSql` knows about, the failure mode is a loud
 * false positive rather than a silent blind spot, and a detector that fails safe is the only kind
 * worth trusting with an assertion.
 */
export function classifyRawCall(operation: string, args: unknown): MutationClass | null {
    const sql = extractSql(args)
    if (sql === null) return "raw-write"
    if (isWriteSql(sql)) return "raw-write"
    // `$executeRaw*` returns an affected-row count, so it is write-shaped by intent even when the
    // statement itself is a bare select. Reported under its own class so a caller can tell the
    // difference between "issued a write" and "used the write-shaped entry point".
    if (operation === "$executeRaw" || operation === "$executeRawUnsafe") return "executeRaw"
    return null
}

/** Classifies a model action. Returns the class, or null for a read. */
export function classifyModelCall(operation: string): MutationClass | null {
    return MODEL_WRITE_OPERATIONS.get(operation) ?? null
}

/**
 * Redacts a statement so it can be printed in a report. Anything URI-shaped becomes a marker, and
 * long literals are clipped, because this text ends up in harness output and a DSN must never.
 */
export function redactStatement(sql: string, limit = 220): string {
    const cleaned = sql
        .replace(/[a-z][a-z0-9+.-]*:\/\/[^\s'"]+/gi, "<uri-redacted>")
        .replace(/'[^']{80,}'/g, "'<long-literal>'")
        .replace(/\s+/g, " ")
        .trim()
    return cleaned.length > limit ? `${cleaned.slice(0, limit)}...` : cleaned
}

/** One observed call on the instrumented client. */
export type ObservedCall = Readonly<{
    index: number
    model: string | null
    operation: string
    mutationClass: MutationClass | null
    insideTransaction: boolean
    statement: string | null
}>

/** A table to fingerprint, optionally scoped to this run's own rows. */
export type TableFingerprintSpec = Readonly<{
    table: string
    /**
     * A raw SQL predicate scoping the digest to this run's rows, e.g. `"id" like 'run123%'`.
     * TRUSTED CALLER INPUT - it is interpolated into the query. Never build it from user input.
     * Omit it for a global digest, and read the concurrency note at the top of this file first.
     */
    where?: string
}>

export type TableFingerprint = Readonly<{
    table: string
    where: string | null
    rows: number
    digest: string
    maxUpdatedAt: string | null
}>

export type Fingerprint = Readonly<{
    takenAt: string
    tables: readonly TableFingerprint[]
    sequences: Readonly<Record<string, string>>
}>

export type FingerprintDiff = Readonly<{
    kind: "table" | "sequence"
    name: string
    component: "rows" | "digest" | "maxUpdatedAt" | "lastValue" | "presence"
    before: string
    after: string
}>

export type RunTokenHit = Readonly<{ table: string; rows: number }>

export type WriteDetectorVerdict = Readonly<{
    clean: boolean
    observedCalls: readonly ObservedCall[]
    writes: readonly ObservedCall[]
    classes: readonly MutationClass[]
    fingerprintDiffs: readonly FingerprintDiff[]
    runTokenHits: readonly RunTokenHit[]
    before: Fingerprint | null
    after: Fingerprint | null
    summary: string
}>

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/

function assertIdentifier(name: string): string {
    if (!IDENTIFIER.test(name)) {
        throw new Error(`Refusing to interpolate ${JSON.stringify(name)} as an identifier.`)
    }
    return name
}

type RawRow = Record<string, unknown>

function scalar(rows: unknown, key: string): string | null {
    if (!Array.isArray(rows) || rows.length === 0) return null
    const row = rows[0] as RawRow
    const value = row[key]
    if (value === null || value === undefined) return null
    return String(value)
}

/** Every base table in the `public` schema, ordered. Read from the catalog, never hardcoded. */
export async function listBaseTables(client: PrismaClient): Promise<string[]> {
    const rows = (await client.$queryRawUnsafe(
        `select table_name from information_schema.tables
         where table_schema = 'public' and table_type = 'BASE TABLE' order by table_name`,
    )) as RawRow[]
    return rows.map((r) => String(r.table_name))
}

/** Tables carrying an `updatedAt` column, so the fingerprint can include it where it exists. */
export async function listTablesWithUpdatedAt(client: PrismaClient): Promise<Set<string>> {
    const rows = (await client.$queryRawUnsafe(
        `select table_name from information_schema.columns
         where table_schema = 'public' and column_name = 'updatedAt'`,
    )) as RawRow[]
    return new Set(rows.map((r) => String(r.table_name)))
}

/** Every sequence's `last_value`. This is what catches an identity advance with no row behind it. */
export async function sequenceSnapshot(client: PrismaClient): Promise<Record<string, string>> {
    const rows = (await client.$queryRawUnsafe(
        `select sequencename, last_value from pg_sequences where schemaname = 'public' order by sequencename`,
    )) as RawRow[]
    const out: Record<string, string> = {}
    for (const row of rows) {
        out[String(row.sequencename)] = row.last_value === null ? "unset" : String(row.last_value)
    }
    return out
}

/**
 * A content-sensitive fingerprint of the given tables.
 *
 * `(q.*)::text` renders the WHOLE ROW as text, so the digest moves when any column of any row
 * changes - which is the entire point, and the thing a row count cannot do. `string_agg` is
 * ordered by the row text so the digest does not depend on the order the rows happen to come back.
 */
export async function fingerprintTables(
    client: PrismaClient,
    specs: readonly TableFingerprintSpec[],
    updatedAtTables: ReadonlySet<string>,
): Promise<TableFingerprint[]> {
    const out: TableFingerprint[] = []
    for (const spec of specs) {
        const table = assertIdentifier(spec.table)
        const where = spec.where ? `where ${spec.where}` : ""
        const rows = (await client.$queryRawUnsafe(
            `select count(*)::text as rows,
                    coalesce(md5(string_agg(t.rowtext, '|' order by t.rowtext)), 'empty') as digest
             from (select (q.*)::text as rowtext from "${table}" q ${where}) t`,
        )) as RawRow[]
        let maxUpdatedAt: string | null = null
        if (updatedAtTables.has(table)) {
            const m = (await client.$queryRawUnsafe(
                `select max("updatedAt")::text as m from "${table}" q ${where}`,
            )) as RawRow[]
            maxUpdatedAt = scalar(m, "m")
        }
        out.push(
            Object.freeze({
                table,
                where: spec.where ?? null,
                rows: Number(scalar(rows, "rows") ?? "0"),
                digest: String(scalar(rows, "digest") ?? "empty"),
                maxUpdatedAt,
            }),
        )
    }
    return out
}

/**
 * Asks every table whether ANY row mentions `token`, by casting the whole row to text.
 *
 * This is the concurrency-safe way to ask a global question. A run token is unique to one process,
 * so a hit can only have come from this run - no concurrent harness can produce one, and no global
 * row count is consulted. It is also the residue proof: append-only tables refuse DELETE, so the
 * only way to show a fixture left nothing behind in one is to ask whether anything is there.
 */
export async function sweepRunToken(
    client: PrismaClient,
    token: string,
    tables: readonly string[],
): Promise<RunTokenHit[]> {
    if (!/^[A-Za-z0-9_]+$/.test(token)) {
        throw new Error(`Run token ${JSON.stringify(token)} must be alphanumeric to be swept safely.`)
    }
    const hits: RunTokenHit[] = []
    for (const raw of tables) {
        const table = assertIdentifier(raw)
        // The underscore is ESCAPED. In LIKE, `_` is a single-character wildcard, and run tokens here
        // look like `dwp_1756...._123456` - three of them. Unescaped, this pattern matches "dwp" plus
        // ANY character, which is how a naive sweep reports ordinary cuids containing "dwp" or "wd" as
        // residue. Root hit exactly that while verifying this harness: six tables of phantom residue,
        // all of them baseline rows. A wildcard where a literal was meant errs toward false ALARMS
        // here rather than false clean, so it was not unsafe - but it is still not what the sweep says
        // it does, and a future shorter token would make the collisions real.
        const rows = (await client.$queryRawUnsafe(
            `select count(*)::text as n from "${table}" q where (q.*)::text like '%' || replace(replace($1, '\\', '\\\\'), '_', '\\_') || '%' escape '\\'`,
            token,
        )) as RawRow[]
        const n = Number(scalar(rows, "n") ?? "0")
        if (n > 0) hits.push(Object.freeze({ table, rows: n }))
    }
    return hits
}

function diffFingerprints(before: Fingerprint, after: Fingerprint): FingerprintDiff[] {
    const diffs: FingerprintDiff[] = []
    const afterByTable = new Map(after.tables.map((t) => [`${t.table}|${t.where ?? ""}`, t]))
    for (const b of before.tables) {
        const key = `${b.table}|${b.where ?? ""}`
        const a = afterByTable.get(key)
        if (!a) {
            diffs.push(Object.freeze({ kind: "table", name: b.table, component: "presence", before: "measured", after: "missing" }))
            continue
        }
        if (a.rows !== b.rows) {
            diffs.push(Object.freeze({ kind: "table", name: b.table, component: "rows", before: String(b.rows), after: String(a.rows) }))
        }
        if (a.digest !== b.digest) {
            diffs.push(Object.freeze({ kind: "table", name: b.table, component: "digest", before: b.digest, after: a.digest }))
        }
        if ((a.maxUpdatedAt ?? "null") !== (b.maxUpdatedAt ?? "null")) {
            diffs.push(
                Object.freeze({
                    kind: "table",
                    name: b.table,
                    component: "maxUpdatedAt",
                    before: b.maxUpdatedAt ?? "null",
                    after: a.maxUpdatedAt ?? "null",
                }),
            )
        }
    }
    // The UNION of both snapshots, not just `before`. Iterating `before` alone would miss a
    // sequence that did not exist when the window opened, and `create sequence` inside the window
    // is exactly the kind of write this module is supposed to notice.
    const sequenceNames = [...new Set([...Object.keys(before.sequences), ...Object.keys(after.sequences)])].sort()
    for (const name of sequenceNames) {
        const beforeValue = before.sequences[name] ?? "absent"
        const afterValue = after.sequences[name] ?? "absent"
        if (afterValue !== beforeValue) {
            diffs.push(Object.freeze({ kind: "sequence", name, component: "lastValue", before: beforeValue, after: afterValue }))
        }
    }
    return diffs
}

export type WriteDetectorOptions = Readonly<{
    /** The client the code under test would otherwise have used. Instrumented, never mutated. */
    client: PrismaClient
    /**
     * A unique alphanumeric token every fixture row this run creates contains, so the global
     * question can be asked without consulting a global count. Omit to skip the token sweep.
     */
    runToken?: string
    /**
     * A second connection used for every fingerprint, so the observation is independent of the
     * client being observed. Omit and one is created from DATABASE_URL, and closed by `close()`.
     */
    observer?: PrismaClient
    /** Tables to sweep for the run token. Omit for every base table in the schema. */
    sweepTables?: readonly string[]
}>

export interface WriteDetector {
    /**
     * The instrumented client. Hand THIS to the code under test - it is a drop-in for the client
     * passed in, and every call it makes is recorded.
     */
    readonly client: PrismaClient
    /** Everything observed so far, reads included. */
    readonly observed: readonly ObservedCall[]
    /** The tables `sweep()` covers, so a residue proof can state its own coverage. */
    readonly sweptTables: readonly string[]
    /** Takes the BEFORE fingerprint and clears the call log. Call immediately before the request. */
    begin(specs?: readonly TableFingerprintSpec[]): Promise<void>
    /** Takes the AFTER fingerprint, sweeps for the run token, and returns the combined verdict. */
    end(): Promise<WriteDetectorVerdict>
    /** Sweeps for the run token on its own, for a residue proof after teardown. */
    sweep(): Promise<RunTokenHit[]>
    /** Closes the observer connection if this detector created it. */
    close(): Promise<void>
}

/**
 * Builds a detector. The returned `client` is a drop-in replacement for the one passed in.
 *
 * The transaction label is produced by an AsyncLocalStorage scope installed around
 * `client.$transaction`, so a write issued on the `tx` handle is reported as
 * `insideTransaction: true`. Interception itself does not depend on that scope - a
 * transaction-contained write is recorded either way; only the label would be missing.
 */
export async function createWriteDetector(options: WriteDetectorOptions): Promise<WriteDetector> {
    const transactionScope = new AsyncLocalStorage<true>()
    const observed: ObservedCall[] = []
    let index = 0

    const extended = options.client.$extends({
        query: {
            $allOperations(params) {
                const { model, operation, args, query } = params
                const isRaw = RAW_OPERATIONS.has(operation) || model === undefined || model === null
                const mutationClass = isRaw ? classifyRawCall(operation, args) : classifyModelCall(operation)
                const sql = isRaw ? extractSql(args) : null
                index += 1
                observed.push(
                    Object.freeze({
                        index,
                        model: model ?? null,
                        operation,
                        mutationClass,
                        insideTransaction: transactionScope.getStore() === true,
                        statement: sql === null ? null : redactStatement(sql),
                    }),
                )
                return query(args)
            },
        },
    })

    // A Proxy rather than a rebuilt client: everything except `$transaction` passes straight
    // through, so the object handed to the code under test stays the client it expects.
    const instrumented = new Proxy(extended, {
        get(target, property, receiver) {
            const value: unknown = Reflect.get(target, property, receiver)
            if (property !== "$transaction" || typeof value !== "function") return value
            const original = value as (...callArgs: unknown[]) => unknown
            return function wrappedTransaction(...callArgs: unknown[]): unknown {
                const first: unknown = callArgs[0]
                if (typeof first !== "function") return original.apply(target, callArgs)
                const body = first as (tx: unknown) => unknown
                return transactionScope.run(true, () =>
                    original.apply(target, [
                        (tx: unknown) => transactionScope.run(true, () => body(tx)),
                        ...callArgs.slice(1),
                    ]),
                )
            }
        },
    }) as unknown as PrismaClient

    const ownsObserver = options.observer === undefined
    const observer = options.observer ?? new PrismaClient()
    const updatedAtTables = await listTablesWithUpdatedAt(observer)
    const sweepTables = options.sweepTables ?? (await listBaseTables(observer))

    let specs: readonly TableFingerprintSpec[] = []
    let before: Fingerprint | null = null
    let after: Fingerprint | null = null

    const take = async (): Promise<Fingerprint> =>
        Object.freeze({
            takenAt: new Date().toISOString(),
            tables: Object.freeze(await fingerprintTables(observer, specs, updatedAtTables)),
            sequences: Object.freeze(await sequenceSnapshot(observer)),
        })

    const sweep = async (): Promise<RunTokenHit[]> =>
        options.runToken === undefined ? [] : sweepRunToken(observer, options.runToken, sweepTables)

    return {
        client: instrumented,
        get observed(): readonly ObservedCall[] {
            return observed
        },
        sweptTables: Object.freeze([...sweepTables]),
        async begin(nextSpecs?: readonly TableFingerprintSpec[]): Promise<void> {
            if (nextSpecs !== undefined) specs = nextSpecs
            observed.length = 0
            index = 0
            before = await take()
            after = null
        },
        async end(): Promise<WriteDetectorVerdict> {
            if (before === null) throw new Error("createWriteDetector: end() called before begin().")
            after = await take()
            const writes = observed.filter((c) => c.mutationClass !== null)
            const classes = [...new Set(writes.map((c) => c.mutationClass as MutationClass))].sort()
            const fingerprintDiffs = diffFingerprints(before, after)
            const runTokenHits = await sweep()
            const clean = writes.length === 0 && fingerprintDiffs.length === 0 && runTokenHits.length === 0
            const parts: string[] = []
            if (writes.length > 0) {
                parts.push(
                    `INTERCEPTED ${writes.length} write call(s) [${classes.join(",")}]: ` +
                        writes
                            .slice(0, 6)
                            .map(
                                (w) =>
                                    `${w.model ?? "<raw>"}.${w.operation}` +
                                    `${w.insideTransaction ? " (in $transaction)" : ""}` +
                                    `${w.statement ? ` :: ${w.statement}` : ""}`,
                            )
                            .join(" ; "),
                )
            }
            if (fingerprintDiffs.length > 0) {
                parts.push(
                    `FINGERPRINT moved on ${fingerprintDiffs.length} component(s): ` +
                        fingerprintDiffs
                            .slice(0, 8)
                            .map((d) => `${d.name}.${d.component} ${d.before} -> ${d.after}`)
                            .join(" ; "),
                )
            }
            if (runTokenHits.length > 0) {
                parts.push(
                    `RUN TOKEN found in ${runTokenHits.length} table(s): ` +
                        runTokenHits.map((h) => `${h.table}=${h.rows}`).join(","),
                )
            }
            return Object.freeze({
                clean,
                observedCalls: Object.freeze([...observed]),
                writes: Object.freeze(writes),
                classes: Object.freeze(classes),
                fingerprintDiffs: Object.freeze(fingerprintDiffs),
                runTokenHits: Object.freeze(runTokenHits),
                before,
                after,
                summary: parts.length === 0 ? "no write observed by either mechanism" : parts.join(" | "),
            })
        },
        sweep,
        async close(): Promise<void> {
            if (ownsObserver) await observer.$disconnect()
        },
    }
}

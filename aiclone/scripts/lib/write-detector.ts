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
 * THE BLIND SPOTS ABOVE ARE NOW MEASURED, NOT MERELY DECLARED
 * ----------------------------------------------------------
 * Every "blind spot" line in this file used to be a claim in a comment, and the fourteen injection
 * classes that exercised this module were all drawn from shapes it already recognises - so the
 * evidence covered its POSITIVES and said nothing about where it stops. A boundary that is only
 * asserted in prose gets quoted as if it were zero.
 *
 * Two classes in check-due-work-preview-api.ts now inject shapes this module is EXPECTED TO MISS, and
 * assert the miss:
 *
 *   gapBypassUnlistedTable   a row written on a third connection into a table absent from the
 *                            fingerprint spec, with no run token in it. Mechanism 1 cannot see the
 *                            connection, mechanism 2 does not cover the table, and the token sweep has
 *                            nothing to match. This is the third leg of blind spot 1 above.
 *   gapBypassSessionState    an advisory lock and a session GUC on a third connection. HEAD widened
 *                            RAW_WRITE_PATTERN so both CLASSIFY as writes - but classification only
 *                            runs on statements issued through the instrumented client, and neither a
 *                            content digest nor a sequence read can see a lock or a session setting,
 *                            because neither is row state.
 *
 * Both assertions require the mutation to have demonstrably happened before they will accept "not
 * caught", and both FAIL if this module ever catches them. So a widening that closes one of these gaps
 * is reported as a red assertion naming the gap, rather than leaving a stale limitation in this comment.
 * If you close one, that harness is where it is written down.
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
 * SEQUENCES ARE NOW ATTRIBUTED INSTEAD OF COMPARED GLOBALLY
 * --------------------------------------------------------
 * `pg_sequences.last_value` is shared counter state. It was read globally and any movement in it
 * was a `clean = false`, which is the same category error as comparing a global row count:
 *
 *   FALSE PASS BY CANCELLATION  our own advance is invisible if something else `setval`s the same
 *                               counter back down inside the window - two deltas, one number.
 *   FALSE FAILURE               a concurrent harness inserting one row advances the same counter, so
 *                               the verdict went red for a reason that is not a property of the code
 *                               under test. That is a scheduling constraint, not a proof.
 *   VACUOUS PASS                a schema with no sequences, or a window in which none moved, satisfied
 *                               the sequence leg without the leg ever having been able to speak.
 *
 * So a sequence advance is now ATTRIBUTED (see `SequenceAttribution`) before it is allowed anywhere
 * near the verdict, and the owning table/column comes from the CATALOG (`sequenceOwnership`), never
 * from munging the sequence's name. `clean` is false only for an advance this execution demonstrably
 * caused; an advance nothing ties to this run is REPORTED in the summary under `unattributed` and is
 * never asserted on. What this deliberately does NOT claim: an advance caused by our own code on a
 * connection we do not intercept, which left no row behind, is indistinguishable from a concurrent
 * harness's advance, and lands in `unattributed`. That residual is stated here rather than hidden,
 * because the alternative - failing on it - is the false-failure defect this replaces.
 *
 * RUN SCOPE PRIMITIVES
 * --------------------
 * `assertRunToken` / `runPrefixPredicate` / `runTokenTextPredicate` / `countRunScopedRows` are the
 * shared spelling of "rows THIS execution owns". The residue assertions in the one-off harnesses are
 * built from them so that there is exactly one definition of the scope, and so that the LIKE
 * underscore-escaping lesson recorded in `sweepRunToken` below is applied everywhere rather than
 * re-learned per harness.
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
// BOTH `AndReturn` VERBS ARE PROVEN AS FAR AS THIS PROJECT'S PRISMA ALLOWS. They were in this map from
// the day it was written and in no injection, so nothing had ever driven either through the interceptor.
// `createManyAndReturn` now has a real injection. `updateManyAndReturn` is Prisma 6.2 and this project is
// on 5.22, so no call through the client can produce that operation name; the harness measures the
// client's capability and goes RED on the upgrade that makes the injection possible.
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
/*
 * WHAT COUNTS AS A WRITE IN RAW SQL.
 *
 * Widened after an adversarial review found several state mutations classified as READS, each of them
 * inconsistent with this module's own reason for including `for update`: if taking a lock on committed
 * data has no place on a read path, then neither does changing session state, locking a table, or
 * creating an object.
 *
 *   SET / SET ROLE / SET SESSION / SET LOCAL   had no alternative at all, so
 *                                             `$queryRawUnsafe("SET ROLE admin")` was a read
 *   pg_advisory_lock / pg_try_advisory_lock    a lock on shared state - exactly what `for update` is here for
 *   LOCK TABLE                                same
 *   create TEMP/TEMPORARY/UNLOGGED table      the alternation required `create` to be followed
 *                                             immediately by the object keyword, so any modifier
 *                                             between them defeated it
 *   create OR REPLACE view/function           same cause. `refresh materialized` was matched while
 *   create MATERIALIZED view                  creating one was not
 *
 * The direction of every one of these is fail-safe: an unrecognised shape is treated as a write, so a
 * false positive costs a red run and a false negative costs the whole claim.
 */
const RAW_WRITE_PATTERN =
    /\b(?:insert\s+into|update\s+(?:only\s+)?"?[a-z_]|delete\s+from|merge\s+into|truncate|copy\s+"?[a-z_][^\s]*\s+from|alter\s+|drop\s+|create\s+(?:or\s+replace\s+)?(?:temp\s+|temporary\s+|unlogged\s+|materialized\s+|global\s+|local\s+)*(?:table|index|sequence|schema|view|trigger|function|procedure|type|database|role|extension)|grant\s+|revoke\s+|reindex\b|vacuum\b|refresh\s+materialized|nextval\s*\(|setval\s*\(|set\s+(?:role|session|local|constraints|search_path|transaction)\b|pg_(?:try_)?advisory(?:_xact)?_lock(?:_shared)?\s*\(|lock\s+(?:table\b|only\b|")|\bfor\s+(?:update|no\s+key\s+update|share|key\s+share)\b)/i

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

/**
 * Why a sequence advance is, or is not, evidence about THIS execution. Checked in this order:
 *
 *   run-named          the sequence's own name carries this run's token, so this run created it.
 *   run-written-table  an intercepted write of ours targeted the table the catalog says owns this
 *                      sequence. Survives the row being rolled back or deleted afterwards.
 *   run-scoped-row     a row matching THIS RUN's scope occupies a value inside the advanced span,
 *                      so the values consumed are provably ours.
 *   unattributed       nothing ties the movement to this execution. REPORTED, never asserted on -
 *                      a concurrent harness's insert advances the same counter, and failing on that
 *                      is the false-failure defect this attribution exists to remove.
 */
export type SequenceAttribution = "run-named" | "run-written-table" | "run-scoped-row" | "unattributed"

export type FingerprintDiff = Readonly<{
    kind: "table" | "sequence"
    name: string
    component: "rows" | "digest" | "maxUpdatedAt" | "lastValue" | "presence"
    before: string
    after: string
    /**
     * Sequence diffs only. A table diff needs no attribution: its scope is the spec's own `where`,
     * so a scoped table digest already only contains this run's rows.
     */
    attribution?: SequenceAttribution
    /** Sequence diffs only: `Table.column` the catalog says owns the sequence, when one does. */
    owner?: string
}>

export type RunTokenHit = Readonly<{ table: string; rows: number }>

export type WriteDetectorVerdict = Readonly<{
    clean: boolean
    observedCalls: readonly ObservedCall[]
    writes: readonly ObservedCall[]
    classes: readonly MutationClass[]
    fingerprintDiffs: readonly FingerprintDiff[]
    /** Sequence advances this execution demonstrably caused. These DO make the verdict unclean. */
    attributedSequenceDiffs: readonly FingerprintDiff[]
    /** Sequence advances nothing ties to this execution. Reported only - never part of `clean`. */
    unattributedSequenceDiffs: readonly FingerprintDiff[]
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

// ---------------------------------------------------------------------------
// RUN SCOPE PRIMITIVES — one definition of "rows THIS execution owns".
//
// Every residue assertion in the one-off harnesses is built from these instead of from a global
// `count(*)`. A global total cannot answer the question a residue assertion asks: our own leak can
// cancel against an unrelated concurrent delete (false pass), an unrelated concurrent insert makes a
// clean run fail (false failure), and an empty table satisfies `0 == 0` without the assertion ever
// having been able to speak (vacuous pass). A run-scoped count has none of those properties: no
// other execution can put a row in this scope, and no other execution can take one out of it.
// ---------------------------------------------------------------------------

/** A run token must be safely interpolatable, because these predicates are built by hand. */
export function assertRunToken(token: string): string {
    if (!/^[A-Za-z0-9_]+$/.test(token)) {
        throw new Error(`Run token ${JSON.stringify(token)} must be alphanumeric/underscore to be scoped safely.`)
    }
    return token
}

/**
 * Escapes a literal for use inside a LIKE pattern with `escape '\'`.
 *
 * `_` IS ESCAPED. In LIKE it is a single-character wildcard, and every run token in this repository
 * contains at least two of them (`wf3_1756..._482910`), so an unescaped prefix pattern matches
 * tokens that merely look like ours. That direction errs toward false ALARMS rather than false clean,
 * but a wildcard where a literal was meant is still not what the predicate claims to do.
 */
export function likeEscape(literal: string): string {
    return literal.replace(/\\/g, "\\\\").replace(/_/g, "\\_").replace(/%/g, "\\%")
}

/** `"column" like '<token>%' escape '\'` — rows whose column STARTS WITH this run's token. */
export function runPrefixPredicate(column: string, token: string): string {
    assertIdentifier(column)
    assertRunToken(token)
    return `"${column}" like '${likeEscape(token)}%' escape '\\'`
}

/**
 * `(<alias>.*)::text like '%<token>%' escape '\'` — rows mentioning this run's token in ANY column.
 * The whole-row cast is what makes this work for link tables and for rows whose own id is a cuid but
 * whose foreign keys point at this run's fixtures.
 */
export function runTokenTextPredicate(token: string, alias = "q"): string {
    assertIdentifier(alias)
    assertRunToken(token)
    return `(${alias}.*)::text like '%${likeEscape(token)}%' escape '\\'`
}

/** One table, and the predicate that selects the rows THIS execution owns in it. */
export type RunScopeSpec = Readonly<{
    /** Human label used in assertion detail, e.g. `InventoryMovement rows owned by this run`. */
    label: string
    table: string
    /**
     * Raw SQL predicate over alias `q`, scoping the count to this run's rows. TRUSTED CALLER INPUT.
     * Build it with `runPrefixPredicate` / `runTokenTextPredicate` rather than by hand.
     */
    where: string
}>

export type RunScopeHit = Readonly<{ label: string; table: string; rows: number }>

/**
 * Counts the rows each scope owns. EVERY spec is returned, zeros included, on purpose: a residue
 * assertion needs the zeros, and the same call taken mid-run is how a harness proves its scope can
 * actually see its own fixture instead of passing over an empty result.
 */
export async function countRunScopedRows(
    client: PrismaClient,
    specs: readonly RunScopeSpec[],
): Promise<RunScopeHit[]> {
    const out: RunScopeHit[] = []
    for (const spec of specs) {
        const table = assertIdentifier(spec.table)
        const rows = (await client.$queryRawUnsafe(
            `select count(*)::text as n from "${table}" q where ${spec.where}`,
        )) as RawRow[]
        out.push(Object.freeze({ label: spec.label, table, rows: Number(scalar(rows, "n") ?? "-1") }))
    }
    return out
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

/**
 * Every sequence's `last_value`. This is what catches an identity advance with no row behind it.
 *
 * The READ is deliberately still schema-wide: it is the evidence base attribution is computed from,
 * and reading a counter costs nothing and claims nothing. What changed is that its movement is no
 * longer compared as a global equality - see `SequenceAttribution` and `attributeSequenceDiffs`.
 * Pass `only` to narrow the read to sequences a caller has declared as its own.
 */
export async function sequenceSnapshot(
    client: PrismaClient,
    only?: readonly string[],
): Promise<Record<string, string>> {
    const rows = (await client.$queryRawUnsafe(
        `select sequencename, last_value from pg_sequences where schemaname = 'public' order by sequencename`,
    )) as RawRow[]
    const wanted = only === undefined ? null : new Set(only)
    const out: Record<string, string> = {}
    for (const row of rows) {
        const name = String(row.sequencename)
        if (wanted !== null && !wanted.has(name)) continue
        out[name] = row.last_value === null ? "unset" : String(row.last_value)
    }
    return out
}

/** The table and column a sequence backs, when it backs one. */
export type SequenceOwner = Readonly<{ table: string; column: string }>

/**
 * Which table/column each sequence belongs to, FROM THE CATALOG.
 *
 * Attribution needs this and the alternative was string-munging the sequence's name
 * (`name.replace(/_seq_seq$/, "")`), which guesses at a naming convention Postgres does not promise:
 * a renamed sequence, a sequence attached by `owned by`, or a table whose own name ends in `_seq`
 * all defeat it silently. `pg_depend` is the only source that actually knows.
 */
export async function sequenceOwnership(client: PrismaClient): Promise<Map<string, SequenceOwner>> {
    const rows = (await client.$queryRawUnsafe(
        `select s.relname as sequence, t.relname as tbl, a.attname as col
           from pg_class s
           join pg_namespace n on n.oid = s.relnamespace
           join pg_depend d on d.objid = s.oid and d.classid = 'pg_class'::regclass and d.deptype in ('a', 'i')
           join pg_class t on t.oid = d.refobjid
           join pg_attribute a on a.attrelid = t.oid and a.attnum = d.refobjsubid
          where s.relkind = 'S' and n.nspname = 'public' and d.refobjsubid > 0`,
    )) as RawRow[]
    const out = new Map<string, SequenceOwner>()
    for (const row of rows) {
        out.set(String(row.sequence), Object.freeze({ table: String(row.tbl), column: String(row.col) }))
    }
    return out
}

/** What attribution needs to know about this execution. */
export type SequenceAttributionContext = Readonly<{
    /** This run's unique token, when it has one. Without it only `run-written-table` can fire. */
    runToken?: string
    /** Catalog-derived owner per sequence. */
    owners: ReadonlyMap<string, SequenceOwner>
    /** Per-table run scope declared by the caller's fingerprint specs, keyed by table name. */
    scopeByTable: ReadonlyMap<string, string>
    /** Model names our INTERCEPTED model writes targeted, lowercased. */
    writtenTables: ReadonlySet<string>
    /**
     * The text of our intercepted RAW writes, lowercased and concatenated. A raw write names its table
     * only inside the statement, and a sequence must not become unattributable just because Prisma had
     * no model to report. Matched as a substring, which over-attributes rather than under-attributes:
     * a red run costs a look, a missed advance costs the claim.
     */
    rawWriteText?: string
}>

function numericOrNull(value: string): string | null {
    return /^-?\d+$/.test(value) ? value : null
}

/** True when one of OUR intercepted writes targeted the table this sequence belongs to. */
function ownedByOurWrites(owner: SequenceOwner, context: SequenceAttributionContext): boolean {
    const table = owner.table.toLowerCase()
    return context.writtenTables.has(table) || (context.rawWriteText ?? "").includes(table)
}

/**
 * Decides, per sequence diff, whether THIS execution caused it. See `SequenceAttribution` for the
 * order of the rules and for what deliberately lands in `unattributed`.
 *
 * `run-scoped-row` is the interesting one: it asks whether any row matching this run's scope holds a
 * value inside the span the counter moved through. If one does, those values were consumed by us and
 * no concurrent harness can be blamed for them. It needs both ends of the span to be numeric, so a
 * sequence that appeared or was reset inside the window falls through to the other rules.
 */
export async function attributeSequenceDiffs(
    observer: PrismaClient,
    diffs: readonly FingerprintDiff[],
    context: SequenceAttributionContext,
): Promise<FingerprintDiff[]> {
    const out: FingerprintDiff[] = []
    for (const diff of diffs) {
        if (diff.kind !== "sequence") {
            out.push(diff)
            continue
        }
        const owner = context.owners.get(diff.name)
        const ownerLabel = owner === undefined ? undefined : `${owner.table}.${owner.column}`
        let attribution: SequenceAttribution = "unattributed"

        if (context.runToken !== undefined && diff.name.includes(context.runToken)) {
            attribution = "run-named"
        } else if (owner !== undefined && ownedByOurWrites(owner, context)) {
            attribution = "run-written-table"
        } else if (owner !== undefined) {
            const scope = context.scopeByTable.get(owner.table) ??
                (context.runToken === undefined ? null : runTokenTextPredicate(context.runToken))
            const low = numericOrNull(diff.before)
            const high = numericOrNull(diff.after)
            if (scope !== null && low !== null && high !== null) {
                const rows = (await observer.$queryRawUnsafe(
                    `select count(*)::text as n from "${assertIdentifier(owner.table)}" q
                      where q."${assertIdentifier(owner.column)}"::numeric > ${low}::numeric
                        and q."${assertIdentifier(owner.column)}"::numeric <= ${high}::numeric
                        and (${scope})`,
                )) as RawRow[]
                if (Number(scalar(rows, "n") ?? "0") > 0) attribution = "run-scoped-row"
            }
        }
        out.push(Object.freeze({ ...diff, attribution, ...(ownerLabel === undefined ? {} : { owner: ownerLabel }) }))
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
    assertRunToken(token)
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
    // Read ONCE, from the catalog: which table/column each sequence backs. This is what lets a
    // sequence advance be attributed to this execution instead of compared as a global equality.
    const sequenceOwners = await sequenceOwnership(observer)

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

            // Which tables our own writes touched. A model write names its model; a raw write names
            // its table only inside the statement, so the statement text is handed to attribution as
            // well - otherwise a raw insert would make its sequence UNATTRIBUTABLE purely because
            // Prisma had no model to report. (An earlier version of this derived the raw-write tables
            // from `sweepTables`, which silently attributed nothing when a caller passed an empty
            // sweep list; the statement text does not depend on any caller-supplied list.)
            const writtenTables = new Set<string>()
            for (const write of writes) {
                if (write.model !== null) writtenTables.add(write.model.toLowerCase())
            }
            const rawWriteText = writes
                .filter((c) => c.model === null)
                .map((c) => (c.statement ?? "").toLowerCase())
                .join(" ; ")

            const scopeByTable = new Map<string, string>()
            for (const spec of specs) {
                if (spec.where !== undefined) scopeByTable.set(spec.table, spec.where)
            }
            const fingerprintDiffs = await attributeSequenceDiffs(observer, diffFingerprints(before, after), {
                runToken: options.runToken,
                owners: sequenceOwners,
                scopeByTable,
                writtenTables,
                rawWriteText,
            })
            const tableDiffs = fingerprintDiffs.filter((d) => d.kind === "table")
            const sequenceDiffs = fingerprintDiffs.filter((d) => d.kind === "sequence")
            const attributedSequenceDiffs = sequenceDiffs.filter((d) => d.attribution !== "unattributed")
            const unattributedSequenceDiffs = sequenceDiffs.filter((d) => d.attribution === "unattributed")

            const runTokenHits = await sweep()
            // `clean` asks about THIS execution only. An unattributed sequence advance is shared
            // counter state moved by someone else as far as any available evidence goes, and failing
            // on it is the false-failure defect this attribution exists to remove.
            const clean =
                writes.length === 0 &&
                tableDiffs.length === 0 &&
                attributedSequenceDiffs.length === 0 &&
                runTokenHits.length === 0
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
            const asserted = [...tableDiffs, ...attributedSequenceDiffs]
            if (asserted.length > 0) {
                parts.push(
                    `FINGERPRINT moved on ${asserted.length} component(s): ` +
                        asserted
                            .slice(0, 8)
                            .map(
                                (d) =>
                                    `${d.name}.${d.component} ${d.before} -> ${d.after}` +
                                    `${d.attribution === undefined ? "" : ` [${d.attribution}${d.owner === undefined ? "" : ` via ${d.owner}`}]`}`,
                            )
                            .join(" ; "),
                )
            }
            if (unattributedSequenceDiffs.length > 0) {
                parts.push(
                    `REPORT ${unattributedSequenceDiffs.length} unattributed sequence advance(s), shared counter state, NOT asserted on: ` +
                        unattributedSequenceDiffs
                            .slice(0, 8)
                            .map((d) => `${d.name} ${d.before}->${d.after}`)
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
                attributedSequenceDiffs: Object.freeze(attributedSequenceDiffs),
                unattributedSequenceDiffs: Object.freeze(unattributedSequenceDiffs),
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

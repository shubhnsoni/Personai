import {
    assertDisposableTarget,
    parseDatabaseName,
    redactUrl,
    verifyDisposableTarget,
} from "../lib/disposable-db"

/**
 * Deterministic tests for the ADR-011 safety control. Connects to nothing: the guard is a
 * pure function of the connection string, which is exactly why it can be trusted before a
 * migration command runs.
 */

const report: Record<string, unknown> = {}
const failures: string[] = []

function check(name: string, condition: unknown, detail?: string) {
    if (!condition) failures.push(detail ? `${name}: ${detail}` : name)
}

const base = "postgresql://postgres:secret@127.0.0.1:5432"

// Accepted: uniquely named disposable databases.
const accepted = [
    `${base}/personalink_phase0_rehearsal_20260826_210704`,
    `${base}/personalink_phase0_clean_20260826_221845`,
    `${base}/personalink_cutover_rehearsal_20260827_101500`,
    `${base}/personalink_schema_dev_20260827_140000`,
    `${base}/personalink_phase0_rehearsal_20260826_210704?schema=public`,
    `postgres://postgres@localhost/personalink_schema_dev_20260827_140000`,
]
for (const url of accepted) {
    const verdict = verifyDisposableTarget(url)
    check(`accepts ${parseDatabaseName(url)}`, verdict.ok, verdict.ok ? undefined : verdict.reason)
}

// Rejected: the live database, in every casing and shape that reaches the same server.
const liveVariants = [
    `${base}/personalink`,
    `${base}/PersonaLink`,
    `${base}/PERSONALINK`,
    `${base}/personalink?schema=public&sslmode=require`,
    `postgres://postgres@localhost:5432/personalink`,
]
for (const url of liveVariants) {
    const verdict = verifyDisposableTarget(url)
    check(`rejects live database in ${url.slice(url.lastIndexOf("/") + 1, url.lastIndexOf("/") + 22)}`, !verdict.ok)
    if (!verdict.ok) {
        check("live rejection names it protected", verdict.reason.includes("protected live database"), verdict.reason)
    }
}

// Rejected: anything not provably disposable.
const rejected: Array<[string, string]> = [
    ["unnamed", `${base}/`],
    ["bare test name", `${base}/test`],
    ["prod-looking", `${base}/personalink_prod`],
    ["prefix without timestamp", `${base}/personalink_phase0_rehearsal`],
    ["wrong timestamp shape", `${base}/personalink_phase0_rehearsal_2026_08_26`],
    ["substring attack", `${base}/notpersonalink_phase0_rehearsal_20260826_210704x`],
    ["mysql protocol", `mysql://root@127.0.0.1:3306/personalink_schema_dev_20260827_140000`],
    ["not a url", "definitely not a url"],
    ["empty", ""],
]
for (const [label, url] of rejected) {
    const verdict = verifyDisposableTarget(url)
    check(`rejects ${label}`, !verdict.ok, `${label} was accepted`)
}
check("rejects undefined", !verifyDisposableTarget(undefined).ok)
check("rejects null", !verifyDisposableTarget(null).ok)

// assertDisposableTarget must throw on denial and return the name on success.
let threwForLive = false
try {
    assertDisposableTarget(`${base}/personalink`)
} catch {
    threwForLive = true
}
check("assert throws for the live database", threwForLive)

let returned: string | null = null
try {
    returned = assertDisposableTarget(`${base}/personalink_schema_dev_20260827_140000`)
} catch {
    returned = null
}
check("assert returns the name for a disposable target", returned === "personalink_schema_dev_20260827_140000")

// Credentials must never appear in a reportable string.
const redacted = redactUrl(`${base}/personalink_schema_dev_20260827_140000`)
check("redaction hides the password", !redacted.includes("secret"), redacted)
check("redaction hides the user", !redacted.includes("postgres:"), redacted)
check("redaction keeps the database name", redacted.includes("personalink_schema_dev_20260827_140000"), redacted)

report.accepted = accepted.length
report.liveVariantsRejected = liveVariants.length
report.otherRejections = rejected.length + 2
report.redactedExample = redacted
report.result = failures.length === 0 ? "PASS" : "FAIL"
report.failures = failures

console.log(JSON.stringify(report, null, 2))
if (failures.length > 0) process.exitCode = 1

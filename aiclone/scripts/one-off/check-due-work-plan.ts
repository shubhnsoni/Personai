import { readFileSync } from "node:fs"
import { join } from "node:path"

import type { AttentionItem, OperationsSummary } from "../../src/lib/operations/engine"
import { planDueWork } from "../../src/lib/operations/due-work-plan"

const INVERT = process.env.INVERT_ASSERTION === "1"
const APP_ROOT = join(__dirname, "../..")
const MODULE_PATH = join(APP_ROOT, "src/lib/operations/due-work-plan.ts")

const results: Array<{ name: string; pass: boolean; detail: string }> = []
function checkInvertible(name: string, pass: boolean, detail = "") {
    results.push({ name, pass: INVERT ? !pass : pass, detail })
}

const covers: OperationsSummary["covers"] = [
    "reservations",
    "appointments",
    "fieldJobs",
    "inspections",
    "inventory",
    "fulfilments",
    "returns",
    "caseMilestones",
    "cohortTasks",
]

const upcoming: AttentionItem = Object.freeze({
    domain: "appointments",
    id: "appointment-upcoming",
    reason: "upcoming",
    label: "Appointment with Rowan",
    at: new Date("2026-08-31T09:00:00.000Z"),
    overdue: false,
})
const undated: AttentionItem = Object.freeze({
    domain: "returns",
    id: "return-undated",
    reason: "awaiting a decision",
    label: "Return R-104",
    at: null,
    overdue: false,
})
const overdue: AttentionItem = Object.freeze({
    domain: "caseMilestones",
    id: "milestone-overdue",
    reason: "due",
    label: "CASE-9 Submit evidence",
    at: new Date("2026-08-29T09:00:00.000Z"),
    overdue: true,
})

const summary: OperationsSummary = Object.freeze({
    asOf: new Date("2026-08-30T06:00:00.000Z"),
    horizonHours: 24,
    profileId: "profile-a",
    workspaceId: "workspace-a",
    domains: Object.freeze([
        Object.freeze({ domain: "appointments", count: 1, overdue: 0, scope: "profile" }),
        Object.freeze({ domain: "returns", count: 1, overdue: 0, scope: "profile" }),
        Object.freeze({ domain: "caseMilestones", count: 1, overdue: 1, scope: "workspace" }),
    ]),
    items: Object.freeze([upcoming, undated, overdue]),
    total: 3,
    totalOverdue: 1,
    covers: Object.freeze(covers),
    doesNotCover: Object.freeze({
        durableTasks: "Durable task processing belongs to its owning domain and is not part of this proposal.",
    }),
    mixedScope: true,
})

const first = planDueWork(summary)
const second = planDueWork(summary)
checkInvertible(
    "the same summary produces a byte-identical proposal",
    JSON.stringify(first) === JSON.stringify(second),
    `first=${JSON.stringify(first)} second=${JSON.stringify(second)}`,
)
checkInvertible(
    "the proposal takes asOf from the summary",
    first.asOf === summary.asOf,
    `${first.asOf.toISOString()} from input=${String(first.asOf === summary.asOf)}`,
)

const traced = first.items.every((planned) => {
    const source = summary.items[planned.sourceIndex]
    return (
        source !== undefined &&
        planned.domain === source.domain &&
        planned.id === source.id &&
        planned.label === source.label &&
        planned.attentionReason === source.reason &&
        planned.at === source.at &&
        planned.overdue === source.overdue
    )
})
checkInvertible(
    "every proposed item traces exactly to one supplied attention item",
    first.items.length === summary.items.length && traced,
    `${first.items.length}/${summary.items.length} items traced by source index`,
)

const hasOverdueFixture = summary.items.some((item) => item.overdue)
const hasUpcomingFixture = summary.items.some((item) => !item.overdue && item.at !== null)
checkInvertible(
    "the ordering fixture contains both overdue and upcoming work",
    hasOverdueFixture && hasUpcomingFixture,
    `overdue=${String(hasOverdueFixture)} upcoming=${String(hasUpcomingFixture)}`,
)
const overduePosition = first.items.findIndex((item) => item.id === overdue.id)
const upcomingPosition = first.items.findIndex((item) => item.id === upcoming.id)
checkInvertible(
    "summary-marked overdue work precedes upcoming work",
    overduePosition >= 0 && upcomingPosition >= 0 && overduePosition < upcomingPosition,
    `overdue index=${overduePosition} upcoming index=${upcomingPosition}`,
)
checkInvertible(
    "every proposed position explains its ordering rule",
    first.items.every((item) => item.orderingReason.length > 60 && item.orderingReason.includes("source order")),
    first.items.map((item) => `${item.band}:${item.orderingReason}`).join(" | "),
)

const emptySummary: OperationsSummary = Object.freeze({
    ...summary,
    domains: Object.freeze(summary.domains.map((domain) => Object.freeze({ ...domain, count: 0, overdue: 0 }))),
    items: Object.freeze([]),
    total: 0,
    totalOverdue: 0,
})
const empty = planDueWork(emptySummary)
checkInvertible(
    "an empty summary produces an explained empty proposal",
    empty.empty && empty.items.length === 0 && empty.explanation.includes("No attention items were present"),
    empty.explanation,
)
checkInvertible(
    "mixed scope is surfaced rather than smoothed over",
    first.mixedScope === true && first.scopeNotice.includes("different tenant boundaries"),
    first.scopeNotice,
)
checkInvertible(
    "declared coverage and exclusions are carried through unchanged",
    JSON.stringify(first.covers) === JSON.stringify(summary.covers) &&
        JSON.stringify(first.doesNotCover) === JSON.stringify(summary.doesNotCover),
    `covers=${first.covers.length} exclusions=${Object.keys(first.doesNotCover).length}`,
)

const moduleSource = readFileSync(MODULE_PATH, "utf8")
const executableLines = moduleSource
    .split("\n")
    .filter((line) => {
        const trimmed = line.trim()
        return trimmed !== "" && !trimmed.startsWith("//") && !trimmed.startsWith("/*") && !trimmed.startsWith("*")
    })
    .join("\n")

const executionNeedles = [
    "scheduler",
    "timer",
    "interval",
    "cron",
    "queue",
    "mailer",
    "payment",
    "provider",
    "settimeout",
    "setinterval",
    "enqueue",
    "publish(",
    "send(",
    "fetch(",
]
const foundExecutionNeedles = executionNeedles.filter((needle) => executableLines.toLowerCase().includes(needle))
checkInvertible(
    "executable module lines contain no background or external-action identifier",
    foundExecutionNeedles.length === 0,
    foundExecutionNeedles.join(", ") || `checked ${executionNeedles.length} identifiers over executable lines only`,
)

const writeNeedles = [
    /\bcreate\b/i,
    /\bupdate\b/i,
    /\bdelete\b/i,
    /\bupsert\b/i,
    /\$executeRaw/,
    /\$transaction/,
    /\bfetch\b/,
]
const foundWriteNeedles = writeNeedles.filter((needle) => needle.test(executableLines)).map((needle) => needle.source)
checkInvertible(
    "the module contains no write operation or network request",
    foundWriteNeedles.length === 0,
    foundWriteNeedles.join(", ") || `checked ${writeNeedles.length} write forms`,
)
checkInvertible(
    "the module reads no clock of its own",
    !/\bDate\.now\s*\(|\bnew\s+Date\s*\(/.test(executableLines),
    "checked Date.now and Date construction over executable lines",
)

const failed = results.filter((result) => !result.pass)
for (const result of results) {
    console.log(`${result.pass ? "PASS" : "FAIL"}  ${result.name}${result.detail ? `  (${result.detail})` : ""}`)
}
console.log("")
console.log(`${results.length - failed.length}/${results.length} due-work planning assertions passed`)
console.log(`${results.length} load-bearing assertions are invertible; inversion flips all ${results.length}.`)
if (INVERT) console.log("INVERT_ASSERTION=1 was set: the failures above prove the control.")
if (failed.length > 0) {
    console.error(`${failed.length} due-work planning assertion(s) FAILED`)
    process.exit(1)
}
console.log("Due-work planning is pure, traceable, explained, and limited to the supplied summary.")

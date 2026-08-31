import { readFileSync } from "node:fs"
import { join } from "node:path"

import { collectElements, countTextOccurrences, hasAttribute, installDom } from "../lib/dom-host"
import type { HostElement, HostNode } from "../lib/dom-host"
import type { FunctionComponent } from "react"
import { domainLabel, readableKey } from "../../src/components/business-os/operations-shared"
import { planDueWork } from "../../src/lib/operations/due-work-plan"
import {
    DUE_WORK_PREVIEW_LIMITATIONS,
    FORBIDDEN_PREVIEW_WORDS,
    REQUIRED_PREVIEW_WORDS,
    STATE_ATTRIBUTION_MARKERS,
    classifyPreviewProse,
    platformClaimsIn,
    toDueWorkPreview,
} from "../../src/lib/operations/due-work-preview-types"
import type { DueWorkPreview } from "../../src/lib/operations/due-work-preview-types"
import { OPERATIONS_DOMAIN_SCOPE, OperationsService } from "../../src/lib/operations/engine"
import type { OperationsContext } from "../../src/lib/operations/shared"

/**
 * Live component harness for the owner-facing DUE-WORK PLAN panel.
 *
 * WHY IT MOUNTS RATHER THAN READS SOURCE
 *
 * package.json declares React and ReactDOM and no test renderer, jsdom, happy-dom, linkedom or Testing
 * Library, and adding one was out of scope. So this uses the shared in-memory host in
 * scripts/lib/dom-host.ts, exactly as check-workspace-surfaces-race.ts and
 * check-commerce-panel-empty-state.ts do. `renderToStaticMarkup` would be useless here: every property
 * below lives in an effect - the request, the abort, the stale-response defences, the loading state - and
 * static rendering never runs effects. Scanning the component's SOURCE would be worse than useless for
 * the wording rule specifically, which is the next paragraph.
 *
 * THE TRAP THIS HARNESS IS BUILT AROUND, and it has caught this repository five times
 *
 * The contract (src/lib/operations/due-work-preview-types.ts) bans seven words from owner-facing copy,
 * and it BANS THEM BY NAMING THEM. The panel's own header comment quotes the ban too, in order to explain
 * it. A scan over either source file would therefore report the prohibition as the violation. So the
 * wording rule here is asserted over the RENDERED TEXT of a real mount, and nothing else.
 *
 * Two further consequences, both inherited from the contract and both easy to get wrong:
 *
 *   `limitations` are DENIALS. The first one says nothing has been *sent* or *dispatched* - it is the very
 *   sentence that makes the promise. A word ban cannot tell an assertion from a denial, so those sentences
 *   are excluded from the word scan and pinned instead by EXACT EQUALITY with the contract's own strings,
 *   which is strictly stronger: it fixes every sentence rather than the absence of seven words.
 *
 *   ENGINE-OWNED ITEM TEXT may legitimately contain a banned word - a field job's own attention reason
 *   really does talk about a scheduled start - and the panel copies it verbatim rather than editing
 *   another module's judgement. So there are two fixtures: a CLEAN one, where any banned word in the
 *   rendered text could only have come from the panel's own copy, and a DIRTY one, where the assertion is
 *   that the panel contributes NO banned word the response did not already contain.
 *
 * Only `fetch` is stubbed. The component, the UI primitives, React and the effects are all real.
 *
 * Set INVERT_ASSERTION=1 to flip every load-bearing expectation and prove this can fail.
 *
 *   $env:TS_NODE_PROJECT="scripts/tsconfig.checks.json"
 *   npx ts-node -r tsconfig-paths/register scripts/one-off/check-due-work-panel.ts
 */

const INVERT = process.env.INVERT_ASSERTION === "1"
const failures: string[] = []
let assertionCount = 0

function checkInvertible(name: string, observed: unknown, detail?: string) {
    assertionCount += 1
    const passesNormally = Boolean(observed)
    const passesThisRun = INVERT ? !passesNormally : passesNormally
    if (!passesThisRun) failures.push(detail ? `${name}: ${detail}` : name)
}

/** Reported, never asserted: a line on stdout that carries no verdict. */
const reportLines: string[] = []
function report(line: string) {
    reportLines.push(line)
}

// ---------------------------------------------------------------------------------------------------
// State markers. Each one belongs to exactly ONE state, which is what makes "these states are
// distinguishable" an observation rather than an opinion: every state is checked for its own marker AND
// against every other state's marker.
// ---------------------------------------------------------------------------------------------------
const NOT_REQUESTED_MARK = "No plan has been requested yet"
const LOADING_MARK = "Requesting a due-work plan preview"
const ERROR_MARK = "Workspace access required"
const EMPTY_MARK = "This plan is empty"
const POPULATED_MARK = "Overdue callout at 1 Example Street"

const MUTANT_LOADING = "MUTANT-WAITING"
const MUTANT_PLAN_PREFIX = "MUTANT-PLAN-FOR-"

/**
 * THE FOUR UNSAFE METHODS. Named for what they are, which this constant previously was not.
 *
 * It read `["POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]` under the name WRITE_VERBS. Under
 * RFC 9110 HEAD and OPTIONS are SAFE methods - neither asks for anything to change - so a list named for
 * write verbs that contained them was wrong in the code, and the assertion that reads it would have
 * reported a panel issuing a legitimate HEAD as having used a write verb.
 *
 * Dropping the two loses no coverage here, and that is checkable rather than asserted: the assertion
 * immediately above the one that uses this list already pins EVERY recorded call to `method === "GET"`
 * exactly, which is strictly stronger than "not one of these six". This list's job is the separate one of
 * checking the claim against a named vocabulary rather than by eye.
 */
const STATE_CHANGING_VERBS: readonly string[] = Object.freeze(["POST", "PUT", "PATCH", "DELETE"])

type Deferred<T> = Readonly<{ promise: Promise<T>; resolve(value: T): void; reject(cause: unknown): void }>

function deferred<T>(): Deferred<T> {
    let resolve!: (value: T) => void
    let reject!: (cause: unknown) => void
    const promise = new Promise<T>((resolvePromise, rejectPromise) => {
        resolve = resolvePromise
        reject = rejectPromise
    })
    return { promise, resolve, reject }
}

/** Only the part of `Response` the panel touches. Nothing here pretends to be a real Response. */
type StubResponse = Readonly<{ ok: boolean; status: number; json(): Promise<unknown> }>

type FetchCall = {
    url: string
    pathname: string
    method: string
    cache: string | undefined
    workspaceId: string | null
    horizonHours: string | null
    signal: AbortSignal | undefined
    deferred: Deferred<StubResponse>
}

/**
 * Records every call and hands back a promise the harness settles by hand.
 *
 * It DELIBERATELY IGNORES the abort signal. Transport cancellation is only the first of the panel's three
 * defences, and the other two exist precisely for a response that cannot be cancelled - so the harness
 * must be able to deliver one.
 */
function makeControlledFetch() {
    const calls: FetchCall[] = []
    const fetchStub = (input: unknown, init?: RequestInit): Promise<StubResponse> => {
        const url = String(input)
        const parsed = new URL(url, "http://due-work.test")
        const pending = deferred<StubResponse>()
        calls.push({
            url,
            pathname: parsed.pathname,
            method: typeof init?.method === "string" ? init.method : "(no method passed)",
            cache: init?.cache,
            workspaceId: parsed.searchParams.get("workspaceId"),
            horizonHours: parsed.searchParams.get("horizonHours"),
            signal: init?.signal ?? undefined,
            deferred: pending,
        })
        return pending.promise
    }
    return { calls, fetchStub }
}

function succeed(call: FetchCall, preview: DueWorkPreview) {
    call.deferred.resolve({ ok: true, status: 200, json: async () => ({ ok: true, data: preview }) })
}

function refuse(call: FetchCall, status: number, code: string, message: string) {
    call.deferred.resolve({ ok: false, status, json: async () => ({ ok: false, error: { code, message } }) })
}

function abortTransport(call: FetchCall) {
    call.deferred.reject(new DOMException("The operation was aborted.", "AbortError"))
}

// ---------------------------------------------------------------------------------------------------
// Fixtures. Every string here is the harness's own, so a banned word in the rendered text can be
// attributed: either the fixture put it there or the panel did.
// ---------------------------------------------------------------------------------------------------
const AS_OF = "2026-08-26T09:00:00.000Z"

const DOES_NOT_COVER: Readonly<Record<string, string>> = Object.freeze({
    messages: "Conversations are not read for this plan.",
    payouts: "Money movement is not read for this plan.",
})

const SCOPE_NOTICE = "The supplied summary reports one tenant boundary across its covered domains."

function item(over: Partial<DueWorkPreview["items"][number]>): DueWorkPreview["items"][number] {
    return {
        position: 1,
        sourceIndex: 0,
        domain: "fieldJobs",
        id: "job-1",
        label: POPULATED_MARK,
        attentionReason: "This callout's start time has passed and nobody has marked it done.",
        at: "2026-08-23T09:00:00.000Z",
        overdue: true,
        band: "overdue",
        orderingReason:
            "The supplied summary marked this item overdue, so it precedes work not marked overdue; source order is kept within this group.",
        ...over,
    }
}

const CLEAN_ITEMS: DueWorkPreview["items"] = Object.freeze([
    item({}),
    item({
        position: 2,
        sourceIndex: 1,
        id: "job-2",
        label: "Upcoming callout at 2 Example Street",
        attentionReason: "This callout starts inside the horizon that was asked about.",
        at: "2026-08-26T15:00:00.000Z",
        overdue: false,
        band: "upcoming",
        orderingReason:
            "The supplied summary gave this item a date and did not mark it overdue, so it follows overdue work; source order is kept within this group.",
    }),
    item({
        position: 3,
        sourceIndex: 2,
        domain: "inventory",
        id: "stock-1",
        label: "Stock record has no counted balance",
        attentionReason: "This stock record carries no counted balance, so it needs a look.",
        at: null,
        overdue: false,
        band: "undated",
        orderingReason:
            "The supplied summary gave this item no date, so it follows dated work; source order is kept within this group.",
    }),
])

/**
 * Engine-owned text that really does contain banned words. Four of the seven appear here, so the
 * "the panel adds none of its own" assertion below has something to discriminate against.
 */
const DIRTY_ITEMS: DueWorkPreview["items"] = Object.freeze([
    item({
        id: "job-dirty",
        label: "Scheduled callout at 3 Example Street",
        attentionReason: "Scheduled start is in the past and the reminder was never sent.",
        orderingReason: "This item was queued into the overdue group by the supplied summary, and dispatched work is not read here.",
    }),
])

function planFixture(workspaceId: string, items: DueWorkPreview["items"]): DueWorkPreview {
    return {
        asOf: AS_OF,
        horizonHours: 24,
        workspaceId,
        covers: ["fieldJobs", "inventory", "reservations"],
        doesNotCover: DOES_NOT_COVER,
        // False, and now a value the producer can actually emit. Under the old constant-true derivation no
        // engine-produced plan could carry `false` here, so this fixture was counterfactual; it is now
        // exactly what the engine reports for a plan whose items were all read on one boundary, which is
        // what SCOPE_NOTICE below says about it. The two agree on purpose - a fixture whose flag and whose
        // sentence contradicted each other would let the panel render an impossible combination.
        mixedScope: false,
        scopeNotice: SCOPE_NOTICE,
        empty: items.length === 0,
        explanation:
            items.length === 0
                ? "No attention items were present in the supplied operations summary, so this proposal is empty."
                : `${items.length} supplied attention items ordered by overdue state, then date presence, while keeping source order within each group.`,
        executed: false,
        sideEffects: [],
        items,
        limitations: DUE_WORK_PREVIEW_LIMITATIONS,
    }
}

// ---------------------------------------------------------------------------------------------------
// THE REAL ENGINE, driven by seeded rows.
//
// Everything above this line is a fixture: strings this harness typed, which can prove that the PANEL
// adds no forbidden word of its own but can prove nothing about what an owner actually reads, because
// the item text an owner reads is authored by the engine and copied verbatim through two layers.
//
// So section 8 below asserts the narrowed wording rule against text NOTHING HERE WROTE. The rows are
// seeded; every owner-facing string asserted is computed by src/lib/operations/engine.ts and
// src/lib/cohorts/needs-action.ts from those rows, then ordered by the real `planDueWork` and serialised
// by the real `toDueWorkPreview`. A rule proven against a literal typed in this file would prove nothing
// about the sentence that reaches a panel.
//
// The database is deliberately NOT used. Only the Prisma DELEGATES the engine calls are stubbed, and
// they return the seeded rows unfiltered; every judgement that produces a string - which statuses are
// open, what an unscheduled job means, which renewal states are owner work, how a reason reads - stays
// with the engine under test. Two consequences that matter: this harness needs no DATABASE_URL and can
// leave no residue, and it cannot perturb the global row counts that check-due-work-preview-api.ts takes
// before and after a request while another stage runs it.
// ---------------------------------------------------------------------------------------------------
const ENGINE_WORKSPACE = "engine-workspace"
const ENGINE_PROFILE = "engine-profile"

type EngineSeed = Readonly<{
    fieldJobs: readonly unknown[]
    caseMilestones: readonly unknown[]
    cohorts: readonly unknown[]
    memberships: readonly unknown[]
}>

const NO_ROWS = { findMany: async (): Promise<readonly unknown[]> => [] }

function engineDb(seed: EngineSeed) {
    return {
        reservation: NO_ROWS,
        booking: NO_ROWS,
        fieldJob: { findMany: async () => seed.fieldJobs },
        fieldJobInspection: NO_ROWS,
        // `fields` is present because the inventory reader compares two columns by field reference.
        inventoryItem: { findMany: async (): Promise<readonly unknown[]> => [], fields: { reorderPoint: {} } },
        fulfilment: NO_ROWS,
        returnRequest: NO_ROWS,
        caseMilestone: { findMany: async () => seed.caseMilestones },
        cohort: { findMany: async () => seed.cohorts },
        cohortMembership: { findMany: async () => seed.memberships },
        cohortSession: NO_ROWS,
        cohortAttendance: NO_ROWS,
        cohortAssignment: NO_ROWS,
        cohortSubmission: NO_ROWS,
        cohortCertificate: NO_ROWS,
    }
}

/** Runs the real engine, the real planner and the real serialiser over seeded rows. */
async function enginePreview(seed: EngineSeed): Promise<DueWorkPreview> {
    const service = new OperationsService({
        db: engineDb(seed),
        requireScope: async () => ({ profileId: ENGINE_PROFILE, workspaceId: ENGINE_WORKSPACE }),
    } as unknown as OperationsContext)
    return toDueWorkPreview(planDueWork(await service.summary(ENGINE_WORKSPACE)))
}

/** Every owner-facing string an ITEM carries. All of it engine-authored. */
function engineItemText(preview: DueWorkPreview): string {
    return preview.items.map((entry) => `${entry.label} ${entry.attentionReason}`).join(" ")
}

/** This surface's OWN affirmative prose, which is held to the flat ban rather than the narrowed rule. */
function surfaceProse(preview: DueWorkPreview): readonly string[] {
    return [preview.explanation, preview.scopeNotice, ...Object.values(preview.doesNotCover)]
}

// ---------------------------------------------------------------------------------------------------
// Text tools
// ---------------------------------------------------------------------------------------------------

/**
 * Removes exact known sentences before the word scan.
 *
 * Used for two categories only, both of which are pinned by a STRONGER check elsewhere: the contract's
 * limitation sentences (exact equality, below) and engine-owned strings supplied by the fixture (the
 * subset assertion, below). Nothing else is removed, so panel-authored copy cannot hide in here.
 */
function withoutPhrases(text: string, phrases: readonly string[]): string {
    let remaining = text
    for (const phrase of phrases) remaining = remaining.split(phrase).join(" ")
    return remaining
}

/**
 * The rendered text with a SEPARATOR between text nodes, and the reason this exists is a measured hole.
 *
 * `HostNode.textContent` concatenates children with no separator at all (scripts/lib/dom-host.ts line 45),
 * so a word at the end of one element abuts the first character of the next: an attention reason ending
 * "...visit marked scheduled" followed by a badge reading "Field jobs" becomes "scheduledField jobs", and
 * `\bscheduled\b` does not match that. Every word scan over raw `textContent` is therefore weaker than it
 * looks - it can MISS a banned word that is genuinely on screen, purely because of which element it landed
 * in. Measured while building section 8: three attributed occurrences were on screen and a raw
 * `textContent` scan found one of them.
 *
 * Joining text nodes with a single space is also the closer model of what an owner reads: those nodes are
 * separate paragraphs and badges on screen, not one run of prose. Used for every WORD SCAN below. The
 * state markers and ordering checks keep using raw `textContent`, because they match whole phrases that
 * live inside a single text node and are unaffected either way.
 */
function readableTextOf(root: HostNode): string {
    const parts: string[] = []
    const walk = (node: HostNode) => {
        // `directText` is where this host keeps a node's own text, for TEXT nodes and for elements alike
        // (React sets `element.textContent` directly for a single string child). Pushing it before
        // recursing reproduces `textContent`'s own order - directText, then children - with a separator.
        if (node.directText !== "") parts.push(node.directText)
        for (const child of node.childNodes) walk(child)
    }
    walk(root)
    return parts.join(" ")
}

/**
 * Source with block and line comments removed. Nothing else - the import specifiers below have to
 * survive, and they live inside quotes.
 */
function withoutComments(source: string): string {
    return source
        .replace(/\/\*[\s\S]*?\*\//g, " ")
        .split("\n")
        .map((line) => line.replace(/(^|[^:])\/\/.*$/, "$1"))
        .join("\n")
}

/**
 * Comment-free source with the CONTENTS of quoted strings emptied, so a needle scan sees code only.
 *
 * BOTH STEPS ARE LOAD-BEARING, AND SKIPPING EITHER HAS ALREADY PRODUCED A FALSE POSITIVE HERE. These
 * files name every dependency they forbid, in prose, precisely in order to forbid it - and the contract's
 * `limitations` go further and name them inside STRING LITERALS on executable lines, because the denial
 * is shipped to the caller in the response body. A comment-stripping scan alone would therefore read the
 * sentence "there is no timer, interval, cron or background worker behind this surface" as three
 * violations. That is the trap this repository has walked into five times, and the string-literal form of
 * it is the version a comment-only strip does not catch.
 *
 * Template literals are left intact on purpose: their `${...}` parts are real code, and emptying them
 * would hide a call rather than a word.
 */
function codeOnly(source: string): string {
    return withoutComments(source)
        .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
        .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
}

function importSpecifiersOf(source: string): readonly string[] {
    const code = withoutComments(source)
    const found = [
        ...[...code.matchAll(/\bfrom\s+"([^"]+)"/g)].map((match) => match[1]),
        ...[...code.matchAll(/\brequire\(\s*"([^"]+)"\s*\)/g)].map((match) => match[1]),
        ...[...code.matchAll(/\bimport\(\s*"([^"]+)"\s*\)/g)].map((match) => match[1]),
    ]
    return [...new Set(found)].sort()
}

/**
 * The only BARE package specifiers this path may import. A timer, queue, mailer, payment client or
 * carrier arrives as a dependency, so an allowlist over specifiers refuses the whole category rather
 * than the handful of names somebody thought to enumerate - and unlike a name list, it cannot be defeated
 * by choosing a different vendor. Relative and `@/` specifiers are internal and are allowed by shape.
 */
const ALLOWED_BARE_IMPORTS: readonly string[] = Object.freeze(["react", "lucide-react", "@prisma/client"])

/**
 * Call shapes that would BE a timer, a background hand-off or an outbound request. Shapes rather than
 * words, so the prohibition written in prose two paragraphs above cannot be mistaken for a violation of
 * itself, and applied to `codeOnly` output as well.
 */
const EXECUTION_CALL_NEEDLES: readonly string[] = Object.freeze([
    "setTimeout(",
    "setInterval(",
    "setImmediate(",
    "queueMicrotask(",
    "process.nextTick(",
    "requestAnimationFrame(",
    "fetch(",
    "XMLHttpRequest",
    "new Worker",
    ".enqueue(",
    ".publish(",
    ".send(",
    ".charge(",
    ".dispatch(",
])

function forbiddenWordsIn(text: string): string[] {
    return FORBIDDEN_PREVIEW_WORDS.filter((word) => new RegExp(`\\b${word}\\b`, "iu").test(text))
}

function missingRequiredWordsIn(text: string): string[] {
    return REQUIRED_PREVIEW_WORDS.filter((word) => !new RegExp(`\\b${word}`, "iu").test(text))
}

function ancestorsOf(node: HostNode): HostNode[] {
    const chain: HostNode[] = []
    let current = node.parentNode
    while (current) {
        chain.push(current)
        current = current.parentNode
    }
    return chain
}

/** True when this node or any ancestor is hidden or collapsed - a limitation nobody can read. */
function isConcealed(node: HostNode): boolean {
    return [node, ...ancestorsOf(node)].some((candidate) => {
        const element = candidate as HostElement
        if (typeof element.getAttribute !== "function") return false
        return (
            element.getAttribute("hidden") !== null ||
            element.getAttribute("aria-hidden") === "true" ||
            element.getAttribute("aria-expanded") === "false" ||
            element.getAttribute("role") === "tooltip"
        )
    })
}

async function main() {
    const document = installDom()
    const React = await import("react")
    const { act } = React
    const { createRoot } = await import("react-dom/client")
    const { DueWorkPanel } = await import("../../src/components/business-os/due-work-panel")

    const mount = () => {
        const container = document.createElement("div")
        document.body.appendChild(container)
        return { container, root: createRoot(container as never) }
    }
    type Mounted = ReturnType<typeof mount>
    type AnyComponent = FunctionComponent<{ workspaceId: string }>

    const render = async (mounted: Mounted, workspaceId: string, component: AnyComponent = DueWorkPanel) => {
        await act(async () => {
            mounted.root.render(React.createElement(component, { workspaceId }))
            await Promise.resolve()
            await Promise.resolve()
        })
    }
    const settle = async (action: () => void) => {
        await act(async () => {
            action()
            await Promise.resolve()
            await Promise.resolve()
            await Promise.resolve()
            await Promise.resolve()
        })
    }
    const unmount = async (mounted: Mounted) => {
        await act(async () => mounted.root.unmount())
    }

    /**
     * A replica of the panel's effect with ONE defence removed, so each assertion about a defence can be
     * shown to DISCRIMINATE rather than merely to pass. These are harness-local components: they prove the
     * observation would catch a panel missing that defence. They are not the shipped component, and no
     * claim about the shipped component rests on them - each defence is ALSO observed directly against the
     * real panel above.
     */
    const makeMutant = (defences: Readonly<{ abort: boolean; superseded: boolean; keyGate: boolean }>) =>
        function MutantPanel({ workspaceId }: { workspaceId: string }) {
            const [loaded, setLoaded] = React.useState<Readonly<{ key: string; value: DueWorkPreview }> | null>(null)
            React.useEffect(() => {
                const controller = new AbortController()
                let superseded = false
                const run = async () => {
                    try {
                        const response = await fetch(
                            `/api/platform/operations/due-work?workspaceId=${encodeURIComponent(workspaceId)}&horizonHours=24`,
                            { method: "GET", cache: "no-store", signal: defences.abort ? controller.signal : undefined },
                        )
                        const body = (await response.json()) as { data: DueWorkPreview }
                        if (defences.superseded && superseded) return
                        setLoaded({ key: workspaceId, value: body.data })
                    } catch (cause) {
                        void cause
                    }
                }
                if (workspaceId) void run()
                return () => {
                    superseded = true
                    if (defences.abort) controller.abort()
                }
            }, [workspaceId])
            const plan = defences.keyGate
                ? loaded !== null && loaded.key === workspaceId
                    ? loaded.value
                    : null
                : (loaded?.value ?? null)
            return React.createElement(
                "div",
                null,
                plan === null ? MUTANT_LOADING : `${MUTANT_PLAN_PREFIX}${plan.workspaceId}`,
            )
        }

    const originalFetch = (globalThis as { fetch?: unknown }).fetch
    const controlled = makeControlledFetch()
    ;(globalThis as { fetch?: unknown }).fetch = controlled.fetchStub

    /** Every state's rendered text, kept so the states can be compared against each other at the end. */
    const snapshots = new Map<string, string>()

    try {
        // =============================================================================================
        // 6. NO WORKSPACE: nothing is requested with a blank id, and the panel says it has not looked.
        // =============================================================================================
        const blank = mount()
        await render(blank, "")
        const blankText = blank.container.textContent
        snapshots.set("no-workspace", blankText)

        checkInvertible(
            "MEASURED: with no workspace NOTHING is requested - no blank workspaceId ever reaches fetch",
            controlled.calls.length === 0,
            `${controlled.calls.length} request(s): ${controlled.calls.map((call) => call.url).join(", ")}`,
        )
        checkInvertible(
            "with no workspace the panel says no plan has been requested, rather than showing an empty result",
            blankText.includes(NOT_REQUESTED_MARK),
            blankText.slice(0, 140),
        )
        checkInvertible(
            "the no-workspace state is not dressed as loading and not dressed as an error",
            !hasAttribute(blank.container, "aria-busy", "true") && !hasAttribute(blank.container, "role", "alert"),
        )
        await unmount(blank)

        // =============================================================================================
        // 5a. LOADING, then 1/2/3 on a POPULATED plan with CLEAN engine text.
        // =============================================================================================
        const populated = mount()
        await render(populated, "workspace-A")
        checkInvertible(
            "selecting a workspace issues exactly one request for that workspace",
            controlled.calls.length === 1 && controlled.calls[0].workspaceId === "workspace-A",
            `${controlled.calls.length} call(s) for ${controlled.calls.map((call) => call.workspaceId).join(",")}`,
        )
        checkInvertible(
            "the request goes to the due-work endpoint and names the horizon it asked for",
            controlled.calls[0].pathname === "/api/platform/operations/due-work" &&
                controlled.calls[0].horizonHours === "24",
            `${controlled.calls[0].pathname}?horizonHours=${controlled.calls[0].horizonHours}`,
        )
        checkInvertible(
            "the plan is requested fresh rather than from cache",
            controlled.calls[0].cache === "no-store",
            String(controlled.calls[0].cache),
        )

        const loadingText = populated.container.textContent
        snapshots.set("loading", loadingText)
        checkInvertible(
            "while the plan is pending the panel is busy and says so to assistive tech",
            hasAttribute(populated.container, "aria-busy", "true") && loadingText.includes(LOADING_MARK),
            loadingText.slice(0, 140),
        )
        checkInvertible(
            "the pending state is not an error and does not claim an empty plan",
            !hasAttribute(populated.container, "role", "alert") && !loadingText.includes(EMPTY_MARK),
        )

        await settle(() => succeed(controlled.calls[0], planFixture("workspace-A", CLEAN_ITEMS)))
        const populatedText = populated.container.textContent
        snapshots.set("populated", populatedText)

        checkInvertible(
            "the plan renders its items, in the order the response proposed",
            populatedText.indexOf(POPULATED_MARK) >= 0 &&
                populatedText.indexOf(POPULATED_MARK) < populatedText.indexOf("Upcoming callout at 2 Example Street") &&
                populatedText.indexOf("Upcoming callout at 2 Example Street") <
                    populatedText.indexOf("Stock record has no counted balance"),
            "positions 1,2,3 in document order",
        )
        checkInvertible(
            "every item's position is explained rather than asserted - the response's ordering reason is rendered",
            CLEAN_ITEMS.length > 0 && CLEAN_ITEMS.every((entry) => populatedText.includes(entry.orderingReason)),
        )
        checkInvertible(
            "every item carries the engine's own attention reason, copied not re-derived",
            CLEAN_ITEMS.length > 0 && CLEAN_ITEMS.every((entry) => populatedText.includes(entry.attentionReason)),
        )
        checkInvertible(
            "an item with no date says so rather than inventing one",
            populatedText.includes("no due date"),
        )
        checkInvertible(
            "a settled plan is no longer busy, so loading and populated are distinguishable",
            !hasAttribute(populated.container, "aria-busy", "true") && !populatedText.includes(LOADING_MARK),
        )

        // ---- 1. the wording rule, over RENDERED TEXT ------------------------------------------------
        // The limitation sentences are removed first: they are DENIALS that necessarily contain banned
        // words, and they are pinned by exact equality immediately below instead.
        const populatedProse = withoutPhrases(readableTextOf(populated.container), DUE_WORK_PREVIEW_LIMITATIONS)
        const populatedHits = forbiddenWordsIn(populatedProse)
        checkInvertible(
            "MEASURED: the panel's rendered copy contains no forbidden word, with clean engine text supplied",
            populatedHits.length === 0,
            populatedHits.length === 0 ? "none" : populatedHits.join(","),
        )
        const populatedMissing = missingRequiredWordsIn(populatedText)
        checkInvertible(
            "MEASURED: the rendered text does use the required words, so honest wording is a positive requirement too",
            populatedMissing.length === 0,
            populatedMissing.length === 0 ? "all present" : `missing ${populatedMissing.join(",")}`,
        )

        // ---- 2. the limitations, pinned by exact equality and observed to be readable ---------------
        for (const [index, limitation] of DUE_WORK_PREVIEW_LIMITATIONS.entries()) {
            const occurrences = countTextOccurrences(populated.container, limitation)
            checkInvertible(
                `MEASURED: limitation ${index + 1} of the response body is rendered, exactly once, word for word`,
                occurrences === 1,
                `counted ${occurrences}`,
            )
        }
        const limitationItems = collectElements(
            populated.container,
            (element) =>
                element.tagName === "LI" &&
                DUE_WORK_PREVIEW_LIMITATIONS.includes(element.textContent.trim()),
        )
        checkInvertible(
            "the limitations are ordinary list items an owner reads, not a tooltip or a collapsed section",
            limitationItems.length > 0 &&
                limitationItems.length === DUE_WORK_PREVIEW_LIMITATIONS.length &&
                limitationItems.every((element) => !isConcealed(element)),
            `${limitationItems.length} readable list item(s)`,
        )
        checkInvertible(
            "the limitations sit under a heading that says what they are",
            populatedText.includes("What this plan cannot tell you"),
        )

        // ---- 3. covers and doesNotCover -------------------------------------------------------------
        const coversRendered = planFixture("workspace-A", CLEAN_ITEMS).covers.filter((domain) =>
            populatedText.includes(domainLabel(domain)),
        )
        checkInvertible(
            "MEASURED: every covered domain in the response is rendered, so the count cannot be read as a total of everything",
            coversRendered.length === 3,
            `${coversRendered.length}/3 rendered`,
        )
        checkInvertible(
            "MEASURED: every stated absence is rendered with the server's own reason",
            Object.entries(DOES_NOT_COVER).length > 0 &&
                Object.entries(DOES_NOT_COVER).every(
                    ([key, reason]) => populatedText.includes(readableKey(key)) && populatedText.includes(reason),
                ),
            Object.keys(DOES_NOT_COVER).join(","),
        )
        checkInvertible(
            "the single clock reading the plan was computed against is rendered",
            populatedText.includes(new Date(AS_OF).toLocaleString()),
            new Date(AS_OF).toLocaleString(),
        )
        checkInvertible(
            "the server's scope notice is rendered rather than paraphrased",
            populatedText.includes(SCOPE_NOTICE),
        )

        // ---- the panel offers no control that could act on the work ---------------------------------
        const buttons = collectElements(populated.container, (element) => element.tagName === "BUTTON")
        checkInvertible(
            "MEASURED: the panel renders exactly one control, and it re-requests a plan rather than acting",
            buttons.length === 1 && buttons[0].textContent.trim() === "Request this plan again",
            `${buttons.length} button(s): ${buttons.map((button) => button.textContent.trim()).join(" | ")}`,
        )
        checkInvertible(
            "no control is a form submission that could reach a write path",
            buttons.every((button) => button.getAttribute("type") === "button"),
            buttons.map((button) => String(button.getAttribute("type"))).join(","),
        )
        await unmount(populated)

        // =============================================================================================
        // 1 (second half). DIRTY engine text: the panel may copy a banned word it was given, and must
        // contribute none of its own. Asserted as a SUBSET, which is what makes it discriminating.
        // =============================================================================================
        const dirty = mount()
        await render(dirty, "workspace-dirty")
        const dirtyCall = controlled.calls[controlled.calls.length - 1]
        await settle(() => succeed(dirtyCall, planFixture("workspace-dirty", DIRTY_ITEMS)))
        const dirtyText = dirty.container.textContent
        snapshots.set("populated-dirty-engine-text", dirtyText)

        const suppliedStrings = DIRTY_ITEMS.flatMap((entry) => [entry.label, entry.attentionReason, entry.orderingReason])
        const suppliedHits = forbiddenWordsIn(suppliedStrings.join(" "))
        const dirtyRenderedHits = forbiddenWordsIn(withoutPhrases(readableTextOf(dirty.container), DUE_WORK_PREVIEW_LIMITATIONS))
        const contributed = dirtyRenderedHits.filter((word) => !suppliedHits.includes(word))
        checkInvertible(
            "the fixture really does supply banned words, so the subset assertion below is not vacuous",
            suppliedHits.length >= 3,
            `supplied: ${suppliedHits.join(",")}`,
        )
        checkInvertible(
            "MEASURED: with engine text that contains banned words, the panel contributes NONE of its own",
            contributed.length === 0,
            contributed.length === 0
                ? `rendered ${dirtyRenderedHits.join(",")} - all inherited verbatim`
                : `panel-authored: ${contributed.join(",")}`,
        )
        report(
            `REPORT  banned words present in engine-owned item text and copied verbatim by the panel: ${suppliedHits.join(",") || "none"}`,
        )
        await unmount(dirty)

        // =============================================================================================
        // 8. THE NARROWED WORDING RULE, ASSERTED AGAINST TEXT THE REAL ENGINE WROTE.
        //
        // Sections 1 and 1b prove things about the PANEL: with clean text it adds no forbidden word, and
        // with dirty text it adds none of its own. Neither can say anything about the sentence an owner
        // actually reads, because that sentence is authored by the engine - and an audit found the engine
        // authoring "scheduled visit" for a FieldJob whose status is SCHEDULED, and "Renewal is scheduled
        // for a member of ..." for a membership whose renewalState is SCHEDULED. Both were copied, in
        // full, through the API and this panel, and nothing failed.
        //
        // THE FIX IS NOT A WORD BAN, because the two claims are not the same claim:
        //
        //   (a) the record's own state. The job's status really is SCHEDULED, because a human booked the
        //       window. Saying so is true and it is what an owner needs.
        //   (b) this platform claiming it scheduled or delivered something. Nothing on this path acts.
        //
        // The contract now tells them apart by ATTRIBUTION - `classifyPreviewProse` - and the engine now
        // names the record as the holder of the state. This section asserts that against strings NOTHING
        // IN THIS FILE TYPED: seeded rows in, real engine, real planner, real serialiser, real panel
        // mount, assertions over what came out. The mutation control below strips the attribution from
        // the ENGINE'S OWN sentences and shows the rule then reports them, so the rule is discriminating
        // rather than merely permissive.
        // =============================================================================================
        const engineNow = Date.now()
        const jobScheduled = {
            id: "engine-job-scheduled",
            status: "SCHEDULED",
            scheduledStartAt: new Date(engineNow - 2 * 3_600_000),
            reference: "FJ-4001",
            title: "Boiler service at 4 Example Street",
        }
        const jobDispatched = {
            id: "engine-job-dispatched",
            status: "DISPATCHED",
            scheduledStartAt: new Date(engineNow + 2 * 3_600_000),
            reference: "FJ-4002",
            title: "Meter exchange at 5 Example Street",
        }
        const jobInProgress = {
            id: "engine-job-in-progress",
            status: "IN_PROGRESS",
            scheduledStartAt: new Date(engineNow + 3 * 3_600_000),
            reference: "FJ-4003",
            title: "Roof survey at 6 Example Street",
        }
        const jobUndated = {
            id: "engine-job-undated",
            status: "SCHEDULED",
            scheduledStartAt: null,
            reference: "FJ-4004",
            title: "Follow-up at 7 Example Street",
        }
        const renewalCohort = { id: "engine-cohort", title: "Autumn intake" }
        const renewalMembership = {
            id: "engine-membership",
            cohortId: renewalCohort.id,
            status: "ACTIVE",
            renewalState: "SCHEDULED",
            renewalDueAt: new Date(engineNow + 4 * 3_600_000),
        }
        const blockedMilestone = {
            id: "engine-milestone",
            title: "Countersign the survey",
            status: "BLOCKED",
            dueAt: null,
            case: { reference: "CASE-7" },
        }

        const profileOnlySeed: EngineSeed = {
            fieldJobs: [jobScheduled, jobDispatched, jobInProgress, jobUndated],
            caseMilestones: [],
            cohorts: [renewalCohort],
            memberships: [renewalMembership],
        }
        const bothBoundariesSeed: EngineSeed = { ...profileOnlySeed, caseMilestones: [blockedMilestone] }
        const noRowsSeed: EngineSeed = { fieldJobs: [], caseMilestones: [], cohorts: [], memberships: [] }

        const enginePlan = await enginePreview(profileOnlySeed)
        const engineMixedPlan = await enginePreview(bothBoundariesSeed)
        const engineEmptyPlan = await enginePreview(noRowsSeed)

        const engineIds = enginePlan.items.map((entry) => entry.id)
        checkInvertible(
            "the seeded SCHEDULED field job and the seeded scheduled renewal both reach the plan, so the wording assertions below have real engine text to judge",
            engineIds.includes(jobScheduled.id) && engineIds.includes(renewalMembership.id),
            `${enginePlan.items.length} item(s): ${engineIds.join(",")}`,
        )
        const engineText = engineItemText(enginePlan)
        const engineOccurrences = classifyPreviewProse(engineText)
        report(
            `REPORT  engine-authored item text under test: ${enginePlan.items.map((entry) => `[${entry.domain}] ${entry.label} :: ${entry.attentionReason}`).join("  |  ")}`,
        )
        report(
            `REPORT  classified occurrences in that text: ${engineOccurrences.map((claim) => `${claim.word}=${claim.kind} in "${claim.excerpt}"`).join("  |  ") || "none"}`,
        )
        checkInvertible(
            "MEASURED: the real engine's item text really does contain forbidden state words - the audit's finding, reproduced from the engine rather than restated",
            engineOccurrences.length >= 3 && /\bscheduled\b/iu.test(engineText),
            `${engineOccurrences.length} occurrence(s): ${engineOccurrences.map((claim) => `${claim.word}=${claim.kind}`).join(", ")}`,
        )
        const enginePlatformClaims = platformClaimsIn(engineText)
        checkInvertible(
            "MEASURED: every forbidden word the engine emitted is an ATTRIBUTED report of a record's own state - case (a) - and none is a claim that this platform acted - case (b)",
            enginePlatformClaims.length === 0,
            enginePlatformClaims.length === 0
                ? `all ${engineOccurrences.length} attributed: ${engineOccurrences.map((claim) => `"${claim.excerpt}"`).join(" | ")}`
                : `PLATFORM CLAIMS: ${enginePlatformClaims.map((claim) => `"${claim.excerpt}"`).join(" | ")}`,
        )
        checkInvertible(
            "MEASURED: the engine no longer leaks a raw enum token into owner copy, so IN_PROGRESS does not reach a reader as in_progress",
            engineText.length > 0 && !/\b\w+_\w+\b/u.test(engineText),
            engineText,
        )

        // The surface's OWN prose keeps the FLAT ban: it reports no record's state, so it has nothing to
        // attribute and no reason to reach for any of these words. Pinned non-empty first, field by
        // field, because a scan over empty strings passes by scanning nothing.
        const engineSurface = surfaceProse(enginePlan)
        checkInvertible(
            "the surface prose scanned next is non-empty field by field, so the flat-ban assertion cannot pass by scanning nothing",
            engineSurface.length >= 2 && engineSurface.every((text) => text.trim().length > 0),
            `${engineSurface.length} field(s), ${engineSurface.reduce((n, text) => n + text.trim().length, 0)} chars`,
        )
        const engineSurfaceHits = engineSurface.flatMap((text) => classifyPreviewProse(text))
        checkInvertible(
            "MEASURED: this surface's OWN prose contains no forbidden word at all, attributed or not - the flat ban is unchanged where nothing legitimate is being reported",
            engineSurfaceHits.length === 0,
            engineSurfaceHits.map((claim) => `${claim.word} in "${claim.excerpt}"`).join(" | ") || "none",
        )

        // ---- THE MUTATION: the rule, applied to the engine's own sentences with attribution removed ---
        const attributionPattern = new RegExp(`\\b(?:${STATE_ATTRIBUTION_MARKERS.join("|")})\\b[\\s:_-]*`, "giu")
        const unattributed = engineText.replace(attributionPattern, "")
        const mutantClaims = platformClaimsIn(unattributed)
        checkInvertible(
            "MUTATION: strip the attribution out of the ENGINE'S OWN sentences and the rule reports every occurrence as a platform claim - so the narrowing discriminates rather than permitting the word everywhere",
            mutantClaims.length > 0 && mutantClaims.length === engineOccurrences.length,
            `${mutantClaims.length}/${engineOccurrences.length} now platform claims, e.g. "${mutantClaims[0]?.excerpt ?? ""}"`,
        )

        // ---- executed / sideEffects in the EMITTED body of a real engine-driven preview ---------------
        const emittedBody = JSON.stringify(enginePlan)
        checkInvertible(
            "MEASURED: executed is the literal false in the EMITTED body, not merely in the type",
            enginePlan.executed === false && /"executed":\s*false/u.test(emittedBody),
            `executed=${JSON.stringify(enginePlan.executed)} present in body=${/"executed":\s*false/u.test(emittedBody)}`,
        )
        checkInvertible(
            "MEASURED: sideEffects is an empty list in the EMITTED body, and there is no shape in which it could report otherwise",
            enginePlan.sideEffects.length === 0 && /"sideEffects":\s*\[\]/u.test(emittedBody),
            `sideEffects=${JSON.stringify(enginePlan.sideEffects)}`,
        )

        // ---- the scope notice: the arm that could not be reached, reached by DATA ---------------------
        //
        // THE MIXED-SCOPE ASSERTIONS BELOW WERE A COUNTEREXAMPLE AND ARE NOW A POSITIVE CLAIM.
        //
        // The previous form asserted `enginePlan.mixedScope === true && engineMixedPlan.mixedScope === true`
        // - mixedScope true for BOTH plans, including the one whose items span a single boundary - and its
        // name recorded that as proof the field could not describe a dataset. It was right about the code as
        // it stood: engine.ts derived the field from the frozen OPERATIONS_DOMAIN_SCOPE map, which always
        // holds both boundaries, so it was true for every workspace and every dataset including an empty one.
        //
        // That defect is fixed at the producer, so the counterexample is obsolete: left as it was it would
        // fail, and if it somehow kept passing it would be re-freezing the defect. It is REPLACED by the
        // claim its own name said could not be made - single-boundary rows yield false, genuinely mixed rows
        // yield true - across the three real engine-produced plans this section already builds, plus an
        // independent recomputation from each plan's items so the response cannot pass by agreeing with
        // itself. Nothing the old assertion covered is lost: the notices-differ clause is kept inside the
        // first assertion.
        const boundariesOf = (preview: DueWorkPreview) =>
            [...new Set(preview.items.map((entry) => OPERATIONS_DOMAIN_SCOPE[entry.domain]))].sort().join(",")
        const noticeArms = [engineEmptyPlan.scopeNotice, enginePlan.scopeNotice, engineMixedPlan.scopeNotice]
        checkInvertible(
            "MEASURED: three real engine-produced plans take THREE different scope notices, so the arm that was unreachable under the old constant-true condition is now reached by data",
            new Set(noticeArms).size === 3,
            noticeArms.join("  ||  "),
        )
        checkInvertible(
            "MEASURED: the single-boundary notice is reached because this plan's items really were all read on one boundary - recomputed from the items and the frozen scope map rather than read off the response",
            enginePlan.items.length > 0 && boundariesOf(enginePlan) === "profile",
            `items span [${boundariesOf(enginePlan)}]`,
        )
        checkInvertible(
            "MEASURED: the mixed notice is reached because that plan's items really do span two boundaries - workspace via caseMilestones, profile via fieldJobs",
            engineMixedPlan.items.length > 0 && boundariesOf(engineMixedPlan) === "profile,workspace",
            `items span [${boundariesOf(engineMixedPlan)}]`,
        )
        checkInvertible(
            "SINGLE BOUNDARY YIELDS FALSE, GENUINELY MIXED YIELDS TRUE: two real engine-produced plans disagree about mixedScope because their rows disagree about boundaries - the assertion the old counterexample recorded as impossible",
            enginePlan.mixedScope === false &&
                engineMixedPlan.mixedScope === true &&
                engineEmptyPlan.mixedScope === false &&
                enginePlan.scopeNotice !== engineMixedPlan.scopeNotice,
            `mixedScope single-boundary=${String(enginePlan.mixedScope)} mixed=${String(engineMixedPlan.mixedScope)} empty=${String(engineEmptyPlan.mixedScope)} while notices differ=${String(enginePlan.scopeNotice !== engineMixedPlan.scopeNotice)}`,
        )
        checkInvertible(
            "MEASURED: mixedScope agrees with the boundaries the plan's own items were read on, recomputed here from the items and the frozen scope map rather than read off the response, on all three plans",
            [enginePlan, engineMixedPlan, engineEmptyPlan].every(
                (plan) => plan.mixedScope === (boundariesOf(plan).split(",").filter((part) => part !== "").length > 1),
            ),
            [enginePlan, engineMixedPlan, engineEmptyPlan]
                .map((plan) => `[${boundariesOf(plan)}]->${String(plan.mixedScope)}`)
                .join(" "),
        )
        checkInvertible(
            "the empty plan claims no boundary at all, because it has no positions to compare",
            engineEmptyPlan.items.length === 0 && engineEmptyPlan.scopeNotice !== enginePlan.scopeNotice,
            engineEmptyPlan.scopeNotice,
        )
        const noticeHits = noticeArms.flatMap((text) => classifyPreviewProse(text))
        checkInvertible(
            "MEASURED: all three scope notices are free of forbidden words, so making this branch live did not smuggle one in",
            noticeHits.length === 0 && noticeArms.every((text) => text.trim().length > 0),
            noticeHits.map((claim) => claim.word).join(",") || "none",
        )

        // ---- the same text, on screen, in a real mount of the real panel -----------------------------
        const engineMount = mount()
        await render(engineMount, ENGINE_WORKSPACE)
        const engineCall = controlled.calls[controlled.calls.length - 1]
        await settle(() => succeed(engineCall, enginePlan))
        const engineRendered = engineMount.container.textContent
        snapshots.set("populated-real-engine-text", engineRendered)

        checkInvertible(
            "the panel rendered the engine's own item sentences verbatim, so the rendered-text scan below is scanning them rather than nothing",
            enginePlan.items.length > 0 &&
                enginePlan.items.every(
                    (entry) => engineRendered.includes(entry.label) && engineRendered.includes(entry.attentionReason),
                ),
            `${enginePlan.items.length} item(s) rendered`,
        )
        const engineRenderedProse = withoutPhrases(readableTextOf(engineMount.container), DUE_WORK_PREVIEW_LIMITATIONS)
        const renderedOccurrences = classifyPreviewProse(engineRenderedProse)
        const renderedPlatformClaims = platformClaimsIn(engineRenderedProse)
        report(
            `REPORT  rendered prose is ${engineRenderedProse.length} chars and carries ${renderedOccurrences.length} classified occurrence(s): ${renderedOccurrences.map((claim) => `${claim.word}=${claim.kind}`).join(",") || "none"}`,
        )
        checkInvertible(
            "MEASURED: with the REAL engine's text on screen, nothing an owner reads is a claim that this platform scheduled, sent or ran anything",
            renderedPlatformClaims.length === 0,
            renderedPlatformClaims.map((claim) => `"${claim.excerpt}"`).join(" | ") || "none",
        )
        checkInvertible(
            "and that scan is not passing by finding nothing - the rendered text really does carry attributed state words an owner can read",
            renderedOccurrences.length >= 3 &&
                renderedOccurrences.every((claim) => claim.kind === "attributed-state"),
            `${renderedOccurrences.length} attributed occurrence(s) on screen`,
        )
        checkInvertible(
            "MEASURED: the server's own scope notice for this plan is what the panel rendered, rather than a paraphrase",
            engineRendered.includes(enginePlan.scopeNotice),
            enginePlan.scopeNotice,
        )
        const engineButtons = collectElements(engineMount.container, (element) => element.tagName === "BUTTON")
        checkInvertible(
            "MEASURED: on the real engine's plan the panel still offers exactly ONE control, and it re-requests a plan rather than acting on the work",
            engineButtons.length === 1 &&
                engineButtons[0].textContent.trim() === "Request this plan again" &&
                engineButtons[0].getAttribute("type") === "button",
            `${engineButtons.length} button(s): ${engineButtons.map((button) => `${button.textContent.trim()}[${String(button.getAttribute("type"))}]`).join(" | ")}`,
        )
        await unmount(engineMount)

        // =============================================================================================
        // 9. NO TIMER, QUEUE, MESSAGE, PAYMENT OR PROVIDER ON THIS PATH - EXECUTABLE LINES ONLY.
        //
        // Two scans, and the reason there are two is that a name list is defeated by choosing a different
        // vendor. A dependency of that kind has to arrive either as an IMPORT or as a global CALL, so an
        // allowlist over import specifiers refuses the whole category, and a set of call SHAPES catches
        // the globals that need no import.
        //
        // Both run over `codeOnly`, which strips comments AND the contents of quoted strings. The second
        // step is the one this repository keeps forgetting: these files name every forbidden dependency
        // in prose in order to forbid it, and the contract ships that prose to the caller INSIDE STRING
        // LITERALS on executable lines. A comment-only strip therefore still reads the sentence "there is
        // no timer, interval, cron or background worker behind this surface" as three violations.
        // =============================================================================================
        const sourceOf = (relative: string) => readFileSync(join(__dirname, "../..", relative), "utf8")
        const pathFiles: readonly string[] = Object.freeze([
            "src/lib/operations/engine.ts",
            "src/lib/cohorts/needs-action.ts",
            "src/lib/operations/due-work-plan.ts",
            "src/lib/operations/due-work-preview-types.ts",
        ])
        const allPathFiles: readonly string[] = Object.freeze([
            ...pathFiles,
            "src/components/business-os/due-work-panel.tsx",
        ])

        const scannedSpecifiers = allPathFiles.flatMap((relative) => importSpecifiersOf(sourceOf(relative)))
        checkInvertible(
            "the import scan really found specifiers to judge, so the allowlist assertion below is not passing over an empty list",
            scannedSpecifiers.length >= 10,
            `${scannedSpecifiers.length} specifier(s) across ${allPathFiles.length} files`,
        )
        const outsideAllowlist = allPathFiles.flatMap((relative) =>
            importSpecifiersOf(sourceOf(relative))
                .filter(
                    (specifier) =>
                        !specifier.startsWith(".") &&
                        !specifier.startsWith("@/") &&
                        !ALLOWED_BARE_IMPORTS.includes(specifier),
                )
                .map((specifier) => `${relative}: ${specifier}`),
        )
        checkInvertible(
            "MEASURED: no file on this path imports a package outside the allowlist, so no timer, queue, mailer, payment client or carrier is a dependency of it",
            outsideAllowlist.length === 0,
            outsideAllowlist.join(" | ") || `allowed bare imports only: ${ALLOWED_BARE_IMPORTS.join(",")}`,
        )
        const executionCalls = pathFiles.flatMap((relative) => {
            const code = codeOnly(sourceOf(relative))
            return EXECUTION_CALL_NEEDLES.filter((needle) => code.includes(needle)).map(
                (needle) => `${relative}: ${needle}`,
            )
        })
        checkInvertible(
            "MEASURED: no executable line on this path is a timer, a background hand-off or an outbound request",
            executionCalls.length === 0,
            executionCalls.join(" | ") ||
                `checked ${EXECUTION_CALL_NEEDLES.length} call shapes over ${pathFiles.length} files, comments and string literals removed`,
        )
        const trapWords = ["timer", "cron", "queue", "mailer", "payment", "provider", "scheduler"]
        const trapHits = pathFiles.flatMap((relative) => {
            const raw = sourceOf(relative)
            return trapWords
                .filter((word) => new RegExp(`\\b${word}`, "iu").test(raw))
                .map((word) => `${relative.split("/").pop() ?? relative}:${word}`)
        })
        report(
            `REPORT  a whole-file word scan of the same four files would report ${trapHits.length} "violation(s)" (${trapHits.join(", ") || "none"}). Every one is a prohibition written down in order to be forbidden, and several sit inside the limitation strings the response ships to the caller - which is why the scan above strips comments AND string literals.`,
        )

        // =============================================================================================
        // 5b. EMPTY plan: visibly different from "not requested", and STILL states its coverage.
        // =============================================================================================
        const empty = mount()
        await render(empty, "workspace-empty")
        const emptyCall = controlled.calls[controlled.calls.length - 1]
        await settle(() => succeed(emptyCall, planFixture("workspace-empty", Object.freeze([]))))
        const emptyText = empty.container.textContent
        snapshots.set("empty", emptyText)

        checkInvertible(
            "an empty plan says it is an empty PLAN, not that nothing has been looked at",
            emptyText.includes(EMPTY_MARK) && !emptyText.includes(NOT_REQUESTED_MARK),
            emptyText.slice(0, 160),
        )
        checkInvertible(
            "MEASURED: an empty plan STILL renders what it does not cover, so zero cannot be read as nothing anywhere",
            Object.values(DOES_NOT_COVER).length > 0 &&
                Object.values(DOES_NOT_COVER).every((reason) => emptyText.includes(reason)) &&
                emptyText.includes(domainLabel("fieldJobs")),
        )
        checkInvertible(
            "MEASURED: an empty plan still renders every limitation from the response body",
            DUE_WORK_PREVIEW_LIMITATIONS.every((limitation) => emptyText.includes(limitation)),
        )
        checkInvertible(
            "an empty plan still names the clock reading it was computed against",
            emptyText.includes(new Date(AS_OF).toLocaleString()),
        )
        const emptyHits = forbiddenWordsIn(withoutPhrases(readableTextOf(empty.container), DUE_WORK_PREVIEW_LIMITATIONS))
        checkInvertible(
            "the empty state's copy contains no forbidden word either",
            emptyHits.length === 0,
            emptyHits.join(",") || "none",
        )
        checkInvertible(
            "an empty plan is not presented as an error or as still loading",
            !hasAttribute(empty.container, "role", "alert") && !hasAttribute(empty.container, "aria-busy", "true"),
        )
        await unmount(empty)

        // =============================================================================================
        // 5c. ERROR: a refusal reaches the owner as an error, named for THIS surface.
        // =============================================================================================
        const errored = mount()
        await render(errored, "workspace-forbidden")
        const forbiddenCall = controlled.calls[controlled.calls.length - 1]
        await settle(() => refuse(forbiddenCall, 403, "FORBIDDEN", "You are not a member of that workspace."))
        const errorText = errored.container.textContent
        snapshots.set("error", errorText)

        checkInvertible(
            "a refusal renders as an error an owner can see",
            hasAttribute(errored.container, "role", "alert") && errorText.includes(ERROR_MARK),
            errorText.slice(0, 160),
        )
        checkInvertible(
            "the error state is not left claiming to be loading, and claims no plan",
            !hasAttribute(errored.container, "aria-busy", "true") &&
                !errorText.includes(EMPTY_MARK) &&
                !errorText.includes(POPULATED_MARK),
        )
        checkInvertible(
            "the 403 copy never says the workspace was not found, because a refusal cannot tell the two apart",
            !/not found/iu.test(errorText),
        )
        const errorHits = forbiddenWordsIn(withoutPhrases(readableTextOf(errored.container), DUE_WORK_PREVIEW_LIMITATIONS))
        checkInvertible(
            "the error state's copy contains no forbidden word either",
            errorHits.length === 0,
            errorHits.join(",") || "none",
        )
        await unmount(errored)

        // An aborted request is not a failure the owner should read about.
        const abortedMount = mount()
        await render(abortedMount, "workspace-abort")
        const abortedCall = controlled.calls[controlled.calls.length - 1]
        await settle(() => abortTransport(abortedCall))
        checkInvertible(
            "an aborted request is not rendered as an error - it is a cancellation, not a failure",
            !hasAttribute(abortedMount.container, "role", "alert") &&
                hasAttribute(abortedMount.container, "aria-busy", "true"),
        )
        await unmount(abortedMount)

        // =============================================================================================
        // 5d. the five states are pairwise distinguishable, by marker and by text.
        // =============================================================================================
        const markers: ReadonlyArray<readonly [string, string]> = [
            ["no-workspace", NOT_REQUESTED_MARK],
            ["loading", LOADING_MARK],
            ["error", ERROR_MARK],
            ["empty", EMPTY_MARK],
            ["populated", POPULATED_MARK],
        ]
        for (const [state, marker] of markers) {
            const own = snapshots.get(state) ?? ""
            const others = markers.filter(([otherState]) => otherState !== state)
            checkInvertible(
                `MEASURED: the ${state} state carries its own marker and none of the other four states' markers`,
                own.includes(marker) && others.length > 0 && others.every(([, otherMarker]) => !own.includes(otherMarker)),
                others
                    .filter(([, otherMarker]) => own.includes(otherMarker))
                    .map(([otherState]) => `also looks like ${otherState}`)
                    .join(",") || `own marker present: ${own.includes(marker)}`,
            )
        }
        const distinctTexts = new Set(markers.map(([state]) => snapshots.get(state) ?? ""))
        checkInvertible(
            "the five states render five different texts, so none is a silent duplicate of another",
            distinctTexts.size === markers.length,
            `${distinctTexts.size} distinct of ${markers.length}`,
        )

        // =============================================================================================
        // 4. THE RACE. A starts, B supersedes it, B lands first, then the abort-ignoring A lands late.
        // =============================================================================================
        const raceStart = controlled.calls.length
        const race = mount()
        await render(race, "race-A")
        const callA = controlled.calls[raceStart]
        checkInvertible("race: the request for A starts", callA?.workspaceId === "race-A")

        await render(race, "race-B")
        const callB = controlled.calls[raceStart + 1]
        checkInvertible(
            "race: changing workspace starts a request for B",
            callB?.workspaceId === "race-B",
            String(callB?.workspaceId),
        )
        // DEFENCE 1, observed on the real panel.
        checkInvertible(
            "MEASURED: DEFENCE 1 - changing workspace ABORTS the in-flight request for the old workspace",
            callA?.signal?.aborted === true,
            `aborted=${String(callA?.signal?.aborted)}`,
        )
        checkInvertible(
            "race: B reads as pending before either response lands, and shows none of A's plan",
            hasAttribute(race.container, "aria-busy", "true"),
        )

        await settle(() => succeed(callB, planFixture("race-B", CLEAN_ITEMS)))
        checkInvertible(
            "race: B lands first and renders its own plan",
            race.container.textContent.includes("race-B") && !hasAttribute(race.container, "aria-busy", "true"),
        )

        const staleItems: DueWorkPreview["items"] = Object.freeze([
            item({ id: "stale-a", label: "STALE-A-ITEM-MUST-NOT-RENDER" }),
        ])
        await settle(() => succeed(callA, planFixture("race-A", staleItems)))
        // DEFENCES 2 AND 3 together, observed on the real panel: the late A response can neither be
        // SHOWN (key gate) nor ERASE B (superseded guard). Without the guard B would be stranded on its
        // skeleton; without the gate A's item would be on screen under workspace B.
        checkInvertible(
            "MEASURED: DEFENCE 3 - a late response for the OLD workspace is never rendered",
            !race.container.textContent.includes("STALE-A-ITEM-MUST-NOT-RENDER") &&
                !race.container.textContent.includes("race-A"),
            race.container.textContent.slice(0, 120),
        )
        checkInvertible(
            "MEASURED: DEFENCE 2 - a late response for the OLD workspace does not erase the CURRENT one",
            race.container.textContent.includes("race-B") && race.container.textContent.includes(POPULATED_MARK),
        )
        checkInvertible(
            "race: the late response leaves the panel neither busy nor in error",
            !hasAttribute(race.container, "aria-busy", "true") && !hasAttribute(race.container, "role", "alert"),
        )
        await unmount(race)

        // DEFENCE 3 in the stored-value direction: A's ALREADY RENDERED plan must vanish while B pends.
        const storedStart = controlled.calls.length
        const stored = mount()
        await render(stored, "stored-A")
        await settle(() => succeed(controlled.calls[storedStart], planFixture("stored-A", CLEAN_ITEMS)))
        checkInvertible("stored: A's plan really rendered first", stored.container.textContent.includes("stored-A"))
        await render(stored, "stored-B")
        checkInvertible(
            "MEASURED: DEFENCE 3 - a stored plan for the previous workspace is not shown for the current one",
            !stored.container.textContent.includes("stored-A") &&
                hasAttribute(stored.container, "aria-busy", "true"),
            stored.container.textContent.slice(0, 120),
        )
        // The same gate on the failure slot: A's error must not be attributed to B.
        const storedBCall = controlled.calls[controlled.calls.length - 1]
        await settle(() => refuse(storedBCall, 403, "FORBIDDEN", "Not a member."))
        checkInvertible("stored: B's own refusal renders", hasAttribute(stored.container, "role", "alert"))
        await render(stored, "stored-C")
        checkInvertible(
            "MEASURED: DEFENCE 3 - a stored refusal for the previous workspace is not shown for the current one",
            !hasAttribute(stored.container, "role", "alert") && hasAttribute(stored.container, "aria-busy", "true"),
        )
        await unmount(stored)

        // Unmount: the request is aborted and a late response commits nothing to the host.
        const unmountStart = controlled.calls.length
        const orphan = mount()
        await render(orphan, "orphan-A")
        await unmount(orphan)
        const mutationsAfterUnmount = document.mutations
        checkInvertible(
            "unmounting aborts the in-flight request",
            controlled.calls[unmountStart]?.signal?.aborted === true,
            `aborted=${String(controlled.calls[unmountStart]?.signal?.aborted)}`,
        )
        await settle(() => succeed(controlled.calls[unmountStart], planFixture("orphan-A", CLEAN_ITEMS)))
        checkInvertible(
            "MEASURED: a response arriving after unmount changes nothing in the document",
            document.mutations === mutationsAfterUnmount && orphan.container.childNodes.length === 0,
            `${document.mutations - mutationsAfterUnmount} host mutation(s) after unmount`,
        )

        // ---- the three defences, MUTATED ONE AT A TIME ----------------------------------------------
        // Each mutant is a harness-local replica with exactly one defence removed, exercised in the
        // scenario where that defence is load-bearing. This proves the observations above DISCRIMINATE;
        // the shipped panel was observed directly for all three.
        const noAbort = makeMutant({ abort: false, superseded: true, keyGate: true })
        const noAbortStart = controlled.calls.length
        const mutantA = mount()
        await render(mutantA, "mutant-A", noAbort)
        await render(mutantA, "mutant-B", noAbort)
        checkInvertible(
            "MUTATION: a replica without the AbortController cannot cancel the superseded request - so DEFENCE 1's check discriminates",
            controlled.calls[noAbortStart]?.signal === undefined,
            `signal=${String(controlled.calls[noAbortStart]?.signal)}`,
        )
        await unmount(mutantA)

        const noSuperseded = makeMutant({ abort: true, superseded: false, keyGate: true })
        const noSupersededStart = controlled.calls.length
        const mutantB = mount()
        await render(mutantB, "mutant-C", noSuperseded)
        await render(mutantB, "mutant-D", noSuperseded)
        await settle(() => succeed(controlled.calls[noSupersededStart + 1], planFixture("mutant-D", CLEAN_ITEMS)))
        const mutantShowedD = mutantB.container.textContent.includes(`${MUTANT_PLAN_PREFIX}mutant-D`)
        await settle(() => succeed(controlled.calls[noSupersededStart], planFixture("mutant-C", CLEAN_ITEMS)))
        checkInvertible(
            "MUTATION: a replica without the superseded guard lets a late old response ERASE the current workspace's plan - so DEFENCE 2's check discriminates",
            mutantShowedD && mutantB.container.textContent.includes(MUTANT_LOADING),
            `showed D first=${mutantShowedD}, then=${mutantB.container.textContent}`,
        )
        await unmount(mutantB)

        const noKeyGate = makeMutant({ abort: true, superseded: true, keyGate: false })
        const noKeyGateStart = controlled.calls.length
        const mutantC = mount()
        await render(mutantC, "mutant-E", noKeyGate)
        await settle(() => succeed(controlled.calls[noKeyGateStart], planFixture("mutant-E", CLEAN_ITEMS)))
        await render(mutantC, "mutant-F", noKeyGate)
        checkInvertible(
            "MUTATION: a replica without the read-time key gate shows the PREVIOUS workspace's plan under the current one - so DEFENCE 3's check discriminates",
            mutantC.container.textContent.includes(`${MUTANT_PLAN_PREFIX}mutant-E`),
            mutantC.container.textContent,
        )
        await unmount(mutantC)

        // =============================================================================================
        // 7. every recorded call is a GET, and 6 again over the whole run.
        // =============================================================================================
        const panelCalls = controlled.calls.filter((call) => call.pathname === "/api/platform/operations/due-work")
        checkInvertible(
            "MEASURED: every request this run recorded is an explicit GET - no write verb was ever used",
            panelCalls.length > 0 && panelCalls.every((call) => call.method === "GET"),
            `methods: ${[...new Set(panelCalls.map((call) => call.method))].join(",")}`,
        )
        checkInvertible(
            "MEASURED: no recorded request uses a state-changing verb, checked against the verb list rather than by eye",
            !panelCalls.some((call) => STATE_CHANGING_VERBS.includes(call.method.toUpperCase())),
            `${panelCalls.length} call(s)`,
        )
        checkInvertible(
            "MEASURED: across the whole run, no request was issued with a blank or missing workspaceId",
            panelCalls.length > 0 && panelCalls.every((call) => typeof call.workspaceId === "string" && call.workspaceId.length > 0),
            `${panelCalls.filter((call) => !call.workspaceId).length} blank-id request(s)`,
        )
        checkInvertible(
            "MEASURED: every request went to the due-work endpoint - the panel reaches no other surface",
            panelCalls.length === controlled.calls.length,
            `${controlled.calls.length - panelCalls.length} request(s) elsewhere`,
        )

        // ---- the refresh control, if its handler can be reached at all -------------------------------
        // The shared host implements no event dispatch, so a click cannot be synthesised. React does
        // attach the element's props to the host node, so the real handler can be invoked directly when
        // that internal key is present. When it is not, this is REPORTED and nothing is asserted - a
        // vacuous assertion would be worse than an admitted gap.
        const refreshStart = controlled.calls.length
        const refreshable = mount()
        await render(refreshable, "refresh-A")
        await settle(() => succeed(controlled.calls[refreshStart], planFixture("refresh-A", CLEAN_ITEMS)))
        const refreshButton = collectElements(refreshable.container, (element) => element.tagName === "BUTTON")[0]
        const propsKey = refreshButton
            ? Object.keys(refreshButton).find((key) => key.startsWith("__reactProps$"))
            : undefined
        const handler = propsKey
            ? (refreshButton as unknown as Record<string, { onClick?: () => void }>)[propsKey].onClick
            : undefined
        if (typeof handler === "function") {
            await settle(() => handler())
            const afterClick = controlled.calls.slice(refreshStart + 1)
            checkInvertible(
                "MEASURED: the one control re-requests a plan for the SAME workspace, with a GET",
                afterClick.length === 1 &&
                    afterClick[0].workspaceId === "refresh-A" &&
                    afterClick[0].method === "GET",
                `${afterClick.length} new call(s): ${afterClick.map((call) => `${call.method} ${call.workspaceId}`).join(",")}`,
            )
            checkInvertible(
                "re-requesting keeps the plan on screen instead of blanking it, and marks itself busy",
                refreshable.container.textContent.includes(POPULATED_MARK) &&
                    hasAttribute(refreshable.container, "aria-busy", "true"),
            )
            await settle(() => succeed(controlled.calls[controlled.calls.length - 1], planFixture("refresh-A", CLEAN_ITEMS)))
            checkInvertible(
                "once the re-requested plan lands the panel is no longer busy",
                !hasAttribute(refreshable.container, "aria-busy", "true"),
            )
            report("REPORT  the refresh control's real onClick handler was reached and invoked directly")
        } else {
            report(
                "REPORT  NOT PROVEN: the refresh handler could not be invoked - the shared host dispatches no events and React's internal props key was absent. The control's presence, label and type are asserted above; its click path is not.",
            )
        }
        await unmount(refreshable)

        // =============================================================================================
        // WIRING, and the one thing this harness could NOT observe.
        //
        // An unwired panel is a control connected to nothing, so this was first attempted by MOUNTING the
        // real shell behind its own fetch stub. That does not work on this host: the shell's workspace
        // picker is a Radix Select, which reads `window.HTMLSelectElement.prototype`'s value setter, calls
        // `Element.closest` and uses `window.clearTimeout`. The shared host in scripts/lib/dom-host.ts
        // implements none of them, and that file is not this package's to change - three local prototype
        // shims got the mount further and the fourth made it obvious this was turning into a browser
        // reimplementation inside a harness rather than a test of this panel.
        //
        // So the wiring is asserted STRUCTURALLY, which is what check-business-os-a11y.ts already does for
        // every other panel in this shell ("<ReservationsPanel", "<CasesPanel", ...). It is deliberately
        // not dressed up as an observation of rendering: it says the shell names the panel and hands it the
        // selected workspace, and nothing more. tsc covers the prop's type; the a11y harness covers the
        // shell still rendering with this import present; every behavioural claim in this file is made
        // against a real mount of the panel itself.
        // =============================================================================================
        const shellSource = readFileSync(
            join(__dirname, "../../src/components/business-os/business-os-shell.tsx"),
            "utf8",
        )
        checkInvertible(
            "STRUCTURAL: the shell renders the panel and hands it the selected workspace, so an owner can reach it",
            /<DueWorkPanel\s+workspaceId=\{selectedWorkspaceId\}\s*\/>/u.test(shellSource),
            "expected <DueWorkPanel workspaceId={selectedWorkspaceId} /> in the shell",
        )
        checkInvertible(
            "STRUCTURAL: the shell imports the panel from its own module",
            /import \{ DueWorkPanel \} from "@\/components\/business-os\/due-work-panel"/u.test(shellSource),
        )
        report(
            "REPORT  NOT PROVEN by mount: the panel's presence inside a MOUNTED shell. The shell cannot be mounted on the shared host - Radix Select requires window.HTMLSelectElement.prototype, Element.closest and window.clearTimeout, which dom-host.ts does not implement and which this package may not add. The two wiring assertions above are structural, not behavioural.",
        )
    } finally {
        ;(globalThis as { fetch?: unknown }).fetch = originalFetch
    }

    const observed = controlled.calls.map((call) => `${call.method} ${call.pathname}?workspaceId=${call.workspaceId ?? ""}`)
    const summary = {
        result: failures.length === 0 ? "PASS" : "FAIL",
        assertions: assertionCount,
        inversionEnabled: INVERT,
        inversionFlips: INVERT ? failures.length : 0,
        methodsObserved: [...new Set(controlled.calls.map((call) => call.method))],
        requestCount: controlled.calls.length,
        blankWorkspaceRequests: controlled.calls.filter((call) => !call.workspaceId).length,
        statesObserved: [...snapshots.keys()],
        observedRequests: observed,
        failures,
    }
    for (const line of reportLines) console.log(line)
    console.log(JSON.stringify(summary, null, 2))
    if (INVERT) console.log("INVERT_ASSERTION=1 was set: the failures above are the point.")
    if (failures.length > 0) process.exitCode = 1
}

void main().catch((cause) => {
    console.error(cause)
    process.exitCode = 1
})

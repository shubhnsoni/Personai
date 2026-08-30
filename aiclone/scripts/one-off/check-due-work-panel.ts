import { readFileSync } from "node:fs"
import { join } from "node:path"

import { collectElements, countTextOccurrences, hasAttribute, installDom } from "../lib/dom-host"
import type { HostElement, HostNode } from "../lib/dom-host"
import type { FunctionComponent } from "react"
import { domainLabel, readableKey } from "../../src/components/business-os/operations-shared"
import {
    DUE_WORK_PREVIEW_LIMITATIONS,
    FORBIDDEN_PREVIEW_WORDS,
    REQUIRED_PREVIEW_WORDS,
} from "../../src/lib/operations/due-work-preview-types"
import type { DueWorkPreview } from "../../src/lib/operations/due-work-preview-types"

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

const WRITE_VERBS: readonly string[] = Object.freeze(["POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"])

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
        const populatedProse = withoutPhrases(populatedText, DUE_WORK_PREVIEW_LIMITATIONS)
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
        const dirtyRenderedHits = forbiddenWordsIn(withoutPhrases(dirtyText, DUE_WORK_PREVIEW_LIMITATIONS))
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
        const emptyHits = forbiddenWordsIn(withoutPhrases(emptyText, DUE_WORK_PREVIEW_LIMITATIONS))
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
        const errorHits = forbiddenWordsIn(withoutPhrases(errorText, DUE_WORK_PREVIEW_LIMITATIONS))
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
            "MEASURED: no recorded request uses a write verb, checked against the verb list rather than by eye",
            !panelCalls.some((call) => WRITE_VERBS.includes(call.method.toUpperCase())),
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

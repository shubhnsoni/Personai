"use client"

import { ListTodo } from "lucide-react"
import { useEffect, useState } from "react"

import { domainLabel, formatAt, isAbortError, readableKey } from "./operations-shared"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Skeleton } from "@/components/ui/skeleton"
import type { DueWorkPreview } from "@/lib/operations/due-work-preview-types"

/**
 * The owner-facing DUE-WORK PLAN panel: it renders the explicitly requested preview produced by
 * `GET /api/platform/operations/due-work`.
 *
 * THE HONESTY PROBLEM THIS PANEL EXISTS TO SOLVE
 *
 * The response is a PROPOSAL about work that already needs attention. It is not a scheduler, not an
 * execution, not a write. `src/lib/operations/due-work-preview-types.ts` states that as a contract and
 * enumerates the words this surface may not use; the reason is one sentence long and is the whole design
 * constraint here: an owner who reads "3 reminders scheduled" stops checking, and nothing is scheduled.
 *
 * So this panel:
 *
 *   - takes the shape from the contract (`DueWorkPreview` is imported, never redeclared), so the panel
 *     and the API cannot drift apart without a compile error;
 *   - renders the response's own `limitations` as a plain, always-visible list. Not a tooltip, not a
 *     collapsed disclosure: a limitation nobody reads is a limitation nobody honours;
 *   - renders `covers` and `doesNotCover` whenever a plan is present, and especially when the plan is
 *     EMPTY, so the count cannot be read as a count of everything the business owes;
 *   - shows the single `asOf` clock reading the whole plan was compared against, rather than formatting
 *     a second clock reading in the browser;
 *   - copies each item's engine-owned `attentionReason` and its `orderingReason` verbatim, so a
 *     position is explained rather than asserted, and no judgement is re-derived here;
 *   - offers exactly ONE control, which asks the server for the plan again. There is no button, timer,
 *     interval or effect that could act on the work, because no such surface exists to call: the API is
 *     GET-only by construction.
 *
 * ABOUT THE WORDING RULE AND THIS COMMENT. `FORBIDDEN_PREVIEW_WORDS` is named and quoted in the contract
 * file, and the harness for this panel (`scripts/one-off/check-due-work-panel.ts`) asserts the rule over
 * the RENDERED TEXT of a real mount, never over this source. That is deliberate: a source scan flags a
 * comment explaining the ban as a violation of the ban, which is a trap this repository has walked into
 * five times. Two further consequences the harness has to respect, both inherited from the contract:
 * `limitations` are DENIALS ("nothing has been sent, charged, dispatched...") and are pinned by exact
 * equality with the contract's own sentences rather than by word absence, and engine-owned item text
 * (`label`, `attentionReason`) is held to the NARROWED rule rather than to the flat ban.
 *
 * THE NARROWED RULE, and why this panel does not edit item text to satisfy it. The contract distinguishes
 * a report of a RECORD'S own state ("visit marked scheduled" - a human booked that window, and the job
 * says so) from a claim that this PLATFORM scheduled, sent or ran something. The first is true and useful;
 * the second is the claim that makes an owner stop checking. `classifyPreviewProse` in the contract is the
 * enforceable form of that distinction, and this panel's harness runs it over the rendered text of a mount
 * driven by the REAL engine rather than over a fixture string somebody typed. So a banned word may
 * legitimately appear in an item here, and this panel still copies that text verbatim: re-wording another
 * module's judgement is how two screens start disagreeing, and the honesty requirement is met by the
 * engine attributing the state at source, not by this component paraphrasing it.
 *
 * THE STALE-RESPONSE PROBLEM, and the three defences the house pattern already settled
 *
 * A slow plan for workspace A must never land in workspace B's view after the owner switches workspace,
 * and B's view must not be left waiting forever because A's late response overwrote its state slot. The
 * defences are exactly the ones `workspace-surfaces-panel.tsx` documents, for the same reasons:
 *
 *   1. an `AbortController` cancels the in-flight request on every workspace change and on unmount;
 *   2. a `superseded` flag set by cleanup stops a response that ignored its abort signal from writing at
 *      all - without it, a late A success would overwrite B's slot and strand B on its skeleton;
 *   3. state is stored WITH the workspace id it was fetched for, and every read gate compares that key
 *      against the CURRENT prop, so a value for a workspace the owner has navigated away from is never
 *      the value handed to JSX.
 *
 * The fetch helper and error copy live in this file rather than in a `due-work-shared.ts` module because
 * this change is deliberately confined to one new component. They are NOT imported from
 * `operations-shared.ts`: that module's error copy names the operations view, and an owner reading
 * "Operations are unavailable" after requesting a plan cannot tell which of the two surfaces is down.
 * The neutral formatters that ARE imported from it - `domainLabel`, `readableKey`, `formatAt` - are
 * shared on purpose, because the plan's domains are the operations domains and two panels an owner reads
 * side by side must not label the same domain differently.
 */

/** The horizon this panel asks for. The response echoes it back, and the echo is what gets rendered. */
const DEFAULT_HORIZON_HOURS = 24

type ApiEnvelope<T> =
    | Readonly<{ ok: true; data: T }>
    | Readonly<{ ok: false; error: { code: string; message: string; details?: Record<string, unknown> } }>

class DueWorkRequestError extends Error {
    constructor(
        readonly status: number,
        readonly code: string,
        message: string,
    ) {
        super(message)
        this.name = "DueWorkRequestError"
    }
}

/**
 * The only network call this panel makes, and it is a GET.
 *
 * The method is passed EXPLICITLY rather than left to the default so that it is observable: the harness
 * records every call's method and asserts none is a write verb. An implicit default would make that
 * assertion an argument about `fetch`'s documentation instead of an observation of this panel.
 */
async function requestDueWorkPlan(
    workspaceId: string,
    horizonHours: number,
    signal: AbortSignal,
): Promise<DueWorkPreview> {
    const response = await fetch(
        `/api/platform/operations/due-work?workspaceId=${encodeURIComponent(workspaceId)}&horizonHours=${horizonHours}`,
        { method: "GET", cache: "no-store", signal },
    )
    let envelope: ApiEnvelope<DueWorkPreview>
    try {
        envelope = (await response.json()) as ApiEnvelope<DueWorkPreview>
    } catch {
        throw new DueWorkRequestError(response.status, "INVALID_RESPONSE", "The server returned an unreadable response.")
    }
    if (!response.ok || !envelope.ok) {
        const error = envelope.ok ? { code: "REQUEST_FAILED", message: "The request failed." } : envelope.error
        throw new DueWorkRequestError(response.status, error.code, error.message)
    }
    return envelope.data
}

/**
 * Copy for a refusal, naming THIS surface.
 *
 * A 403 covers a workspace that is not the caller's own AND one that does not exist, byte-identically,
 * so this copy never says "not found" - claiming to know which happened would reveal what the API
 * deliberately does not. A 503 states that nothing was changed, which is trivially true of a panel with
 * no write path at all.
 */
function dueWorkErrorCopy(error: unknown): { title: string; description: string } {
    if (error instanceof DueWorkRequestError) {
        if (error.status === 401) {
            return {
                title: "Sign in required",
                description: error.message || "Sign in to see this workspace's due-work plan.",
            }
        }
        if (error.status === 403) {
            return {
                title: "Workspace access required",
                description: "This workspace is not yours, so its due-work plan cannot be shown here.",
            }
        }
        if (error.status === 400) {
            return {
                title: "Check the details",
                description: error.message || "This request for a plan could not be understood.",
            }
        }
        if (error.status === 503) {
            return {
                title: "The due-work plan is unavailable",
                description:
                    "No plan could be produced right now. Nothing was changed - this panel only reads.",
            }
        }
        return { title: "The due-work plan could not load", description: error.message }
    }
    return {
        title: "The due-work plan could not load",
        description: "An unexpected problem occurred. Nothing was changed - this panel only reads.",
    }
}

const BAND_LABELS: Readonly<Record<DueWorkPreview["items"][number]["band"], string>> = Object.freeze({
    overdue: "overdue",
    upcoming: "has a date",
    undated: "no date",
})

/**
 * The single clock reading, shown as the server reported it.
 *
 * `formatAt` from the operations module is right for an ITEM date, where `null` genuinely means "this
 * domain has no notion of a deadline" and rendering "no due date" is the honest answer. It is wrong for
 * `asOf`: a reading that failed to parse would be described as an absent due date, which is a different
 * claim. Here an unparseable value is shown verbatim instead, so the owner sees what the server said.
 */
function formatClock(value: string): string {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString()
}

/**
 * State is stored WITH the workspace id it was fetched for AND the attempt it belongs to.
 *
 * The attempt number is what makes "a plan is being re-requested" a DERIVED fact rather than another
 * piece of state: a `pending` boolean would have to be set synchronously inside the effect, which is
 * exactly the shape `react-hooks/set-state-in-effect` exists to flag. Comparing the settled attempt
 * against the current one answers the same question with no extra state and no suppression.
 */
type Keyed<T> = Readonly<{ key: string; attempt: number; value: T }>

export function DueWorkPanel({ workspaceId }: { workspaceId: string }) {
    const [loaded, setLoaded] = useState<Keyed<DueWorkPreview> | null>(null)
    const [failed, setFailed] = useState<Keyed<unknown> | null>(null)
    const [attempt, setAttempt] = useState(0)

    /**
     * Written INLINE inside the effect, matching the fix `operations-panel.tsx` documents: the lint rule
     * fires on an effect that calls a named, externally reachable function which also sets state, and
     * accepts a self-contained async closure. No eslint-disable is used.
     *
     * Re-runs when the workspace changes and when the owner asks for the plan again. Both paths perform
     * the same cleanup - abort, then refuse the write - before the next request starts.
     */
    useEffect(() => {
        const controller = new AbortController()
        // Set by cleanup. The abort alone is not enough: a fetch that ignores its signal, or a promise
        // already resolved when abort fires, still lands in the `try` and would write into the single
        // state slot. That write cannot RENDER (the key gate below blocks it) but it would overwrite the
        // CURRENT workspace's stored plan, stranding the panel on its skeleton. So this guard stops the
        // right data being erased, and the key gate stops the wrong data being shown.
        let superseded = false
        const run = async () => {
            try {
                const data = await requestDueWorkPlan(workspaceId, DEFAULT_HORIZON_HOURS, controller.signal)
                if (superseded) return
                setFailed(null)
                setLoaded({ key: workspaceId, attempt, value: data })
            } catch (cause) {
                if (isAbortError(cause) || superseded) return
                setFailed({ key: workspaceId, attempt, value: cause })
            }
        }
        // No workspace, no request. A blank id would be a 400 the owner did not ask for.
        if (workspaceId) void run()
        return () => {
            superseded = true
            controller.abort()
        }
    }, [workspaceId, attempt])

    // Only this workspace's result counts. A plan left over from a previous workspace is not this
    // workspace's answer, so the panel reads as waiting rather than briefly showing the wrong plan.
    const currentPlan = loaded !== null && loaded.key === workspaceId ? loaded : null
    const currentFailure = failed !== null && failed.key === workspaceId ? failed : null
    const plan = currentPlan?.value ?? null
    const loadError = currentFailure?.value ?? null
    const awaitingPlan = Math.max(currentPlan?.attempt ?? -1, currentFailure?.attempt ?? -1) < attempt

    if (!workspaceId) {
        return (
            <EmptyState
                icon={<ListTodo aria-hidden="true" />}
                title="Select a workspace"
                description="No plan has been requested yet. Choose a workspace above to see a due-work plan preview for it."
            />
        )
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                    <ListTodo className="h-4 w-4" aria-hidden="true" />
                    Due work plan
                </CardTitle>
                {/* The workspace is named, always: the shell can select one on the owner's behalf, and
                    without this line an owner could read one workspace's plan believing it was another's. */}
                <p className="text-xs text-muted-foreground">
                    Showing workspace <span className="font-medium">{workspaceId}</span>
                </p>
            </CardHeader>
            <CardContent>
                <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="max-w-xl text-xs text-muted-foreground">
                        A preview of a plan: the order in which work that already needs attention could be dealt
                        with. It is a proposal and nothing more - nothing here acts on your behalf, nothing has
                        left the product, no timer or background worker stands behind it, and asking for the plan
                        changed no records.
                    </p>
                    <Button
                        size="sm"
                        variant="outline"
                        type="button"
                        onClick={() => setAttempt((value) => value + 1)}
                    >
                        Request this plan again
                    </Button>
                </div>

                {loadError ? (
                    <div className="mt-3">
                        <ErrorState
                            title={dueWorkErrorCopy(loadError).title}
                            description={dueWorkErrorCopy(loadError).description}
                        >
                            {plan !== null ? (
                                <p className="text-xs text-muted-foreground">
                                    The plan below is the one from an earlier request.
                                </p>
                            ) : null}
                        </ErrorState>
                    </div>
                ) : null}

                {plan === null && loadError === null ? (
                    <div className="mt-4 space-y-2" aria-live="polite" aria-busy="true">
                        <span className="sr-only">Requesting a due-work plan preview</span>
                        <Skeleton className="h-10 w-2/3" />
                        <Skeleton className="h-24 w-full" />
                    </div>
                ) : null}

                {plan !== null ? (
                    <div className="mt-4 space-y-4" aria-live="polite" aria-busy={awaitingPlan ? "true" : "false"}>
                        <div className="flex flex-wrap items-center gap-3 rounded-md border border-border/70 p-3">
                            <div>
                                <p className="text-2xl font-semibold">{plan.items.length}</p>
                                <p className="text-xs text-muted-foreground">
                                    {plan.items.length === 1 ? "item proposed for attention" : "items proposed for attention"}
                                </p>
                            </div>
                            <Badge variant="outline">next {plan.horizonHours} hours</Badge>
                            {/* ONE clock reading, taken from the response. Comparing against a second
                                reading in the browser is how two numbers on one screen start disagreeing. */}
                            <p className="text-xs text-muted-foreground">
                                Every comparison in this plan was made against one clock reading:{" "}
                                <span className="font-medium">{formatClock(plan.asOf)}</span>
                            </p>
                            <p className="text-xs text-muted-foreground">
                                Side effects reported in this response: {plan.sideEffects.length}.
                            </p>
                        </div>

                        {/* The response's own account of what it is. Rendered rather than paraphrased: the
                            server owns this sentence, and a paraphrase here could outlive it. */}
                        <p className="text-xs text-muted-foreground">{plan.explanation}</p>

                        {plan.empty ? (
                            <EmptyState
                                icon={<ListTodo aria-hidden="true" />}
                                title="This plan is empty"
                                description={`Nothing in the covered areas needs attention within the next ${plan.horizonHours} hours, as of ${formatClock(plan.asOf)}. This is an answer, not an unread panel - read what it covers below before treating it as everything.`}
                            />
                        ) : (
                            <ol className="space-y-2" aria-label="Proposed order">
                                {plan.items.map((item) => (
                                    <li key={`${item.domain}:${item.id}`} className="rounded-md border border-border/70 p-3">
                                        <div className="flex flex-wrap items-start justify-between gap-2">
                                            <div>
                                                <h4 className="text-sm font-medium">
                                                    {item.position}. {item.label}
                                                </h4>
                                                {/* The engine's own words for why this needs attention,
                                                    copied verbatim. Re-wording somebody else's judgement
                                                    here is how two screens start disagreeing. */}
                                                <p className="text-xs text-muted-foreground">{item.attentionReason}</p>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <Badge variant="outline">{domainLabel(item.domain)}</Badge>
                                                {item.overdue ? (
                                                    <Badge variant="destructive">{BAND_LABELS[item.band]}</Badge>
                                                ) : (
                                                    <Badge variant="secondary">{BAND_LABELS[item.band]}</Badge>
                                                )}
                                                <span className="text-xs text-muted-foreground">{formatAt(item.at)}</span>
                                            </div>
                                        </div>
                                        <p className="mt-1 text-xs text-muted-foreground">
                                            Why this position: {item.orderingReason}
                                        </p>
                                    </li>
                                ))}
                            </ol>
                        )}

                        {/*
                          * Rendered ALWAYS, and especially when the plan is empty. A count that did not
                          * say what it excludes would let an owner read "0" as "nothing anywhere" and stop
                          * checking the domains this plan never reads. Both lists come from the response
                          * rather than being restated here, so the panel cannot drift from the engine.
                          */}
                        <section
                            aria-labelledby="due-work-coverage-heading"
                            className="rounded-md border border-dashed border-border/70 p-3"
                        >
                            <h3
                                id="due-work-coverage-heading"
                                className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                            >
                                What this plan covers, and what it does not
                            </h3>
                            <p className="mt-1 text-xs text-muted-foreground">
                                Covers {plan.covers.map((domain) => domainLabel(domain)).join(", ") || "nothing"}. The
                                following are not read for this plan, so check them separately:
                            </p>
                            <ul className="mt-1 space-y-1">
                                {Object.entries(plan.doesNotCover).map(([key, reason]) => (
                                    <li key={key} className="text-xs text-muted-foreground">
                                        <span className="font-medium">{readableKey(key)}</span> — {reason}
                                    </li>
                                ))}
                            </ul>
                            {/* The server's own scope sentence. It reports the boundaries THIS plan's
                                items were read on, so when they differ, positions across domains
                                compare more than one population. Rendered, never paraphrased. */}
                            <p className="mt-2 text-xs text-muted-foreground">{plan.scopeNotice}</p>
                        </section>

                        {/*
                          * The response's own limitations, in the open. Not a tooltip and not a collapsed
                          * disclosure: these are the sentences that keep the panel from being read as a
                          * promise, and a limitation nobody reads is a limitation nobody honours.
                          */}
                        <section
                            aria-labelledby="due-work-limitations-heading"
                            className="rounded-md border border-dashed border-border/70 p-3"
                        >
                            <h3
                                id="due-work-limitations-heading"
                                className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                            >
                                What this plan cannot tell you
                            </h3>
                            <ul className="mt-1 space-y-1">
                                {plan.limitations.map((limitation) => (
                                    <li key={limitation} className="text-xs text-muted-foreground">
                                        {limitation}
                                    </li>
                                ))}
                            </ul>
                        </section>
                    </div>
                ) : null}
            </CardContent>
        </Card>
    )
}

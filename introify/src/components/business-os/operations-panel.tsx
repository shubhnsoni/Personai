"use client"

import { Activity } from "lucide-react"
import { useCallback, useEffect, useState } from "react"

import {
    domainLabel,
    formatAt,
    isAbortError,
    operationsErrorCopy,
    operationsRequest,
    readableKey,
    type OperationsSummaryView,
} from "./operations-shared"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * The operations command centre: one answer to "what needs attention today" across seven engines.
 *
 * THE HONESTY PROBLEM THIS PANEL EXISTS TO SOLVE, AND WHICH IT COULD EASILY HAVE CREATED
 *
 * A cross-engine total is the most dangerous number in the product, because an owner reads "0" as
 * "nothing anywhere" and stops looking. The view covers seven domains and deliberately does not cover
 * three, so a bare zero would be a lie by omission.
 *
 * So this panel ALWAYS renders what the response says it does not cover, with the server's own reason,
 * even when the total is zero - especially when the total is zero. `covers` and `doesNotCover` come
 * from the server rather than being restated here, so the panel cannot drift out of step with what the
 * engine actually reads.
 *
 * Everything else follows from the view being read-only:
 *
 *   - there is no action button on any item. This view cannot write, so offering one would be a
 *     control that either does nothing or belongs to another panel. Items name their domain so an
 *     owner knows where to go;
 *   - `at: null` is rendered as "no due date", never as an unknown or an error. Three of the seven
 *     domains genuinely have no notion of a deadline, and inventing one would be a small lie;
 *   - `overdue` is read from the server, never recomputed here. The server compares every record
 *     against a single clock reading, and a second comparison in the browser against a slightly
 *     different clock is how two numbers in one screen start disagreeing;
 *   - a 503 says nothing was changed, which is trivially true of a view with no write path.
 */

const HORIZONS: readonly number[] = [24, 72, 168]
const DEFAULT_HORIZON = 24

/**
 * The summary is stored WITH the key it was fetched for, rather than being cleared in an effect when
 * the key changes.
 *
 * Clearing state synchronously inside an effect is what `react-hooks/set-state-in-effect` exists to
 * flag, and the rule is right: it causes a second render pass and makes the "is this loading or is
 * this empty" question ambiguous. Keying the cached value answers that question by construction -
 * a summary whose key does not match the current one simply is not this workspace's summary.
 *
 * THE HORIZON IS PASSED AS AN ARGUMENT, NOT READ FROM STATE INSIDE `load`. That is what keeps the
 * mount effect free of the rule: if `load` closed over `horizonHours`, the effect would depend on
 * component state AND set component state, which is a loop the compiler is right to flag. Changing
 * the horizon is a user action, so it fetches from the event handler where reading state is fine,
 * and the effect only ever runs the default on mount.
 */
type Keyed<T> = Readonly<{ key: string; value: T }>

export function OperationsPanel({ workspaceId }: { workspaceId: string }) {
    const [loaded, setLoaded] = useState<Keyed<OperationsSummaryView> | null>(null)
    const [failed, setFailed] = useState<Keyed<unknown> | null>(null)
    const [horizonHours, setHorizonHours] = useState(DEFAULT_HORIZON)
    const [refreshing, setRefreshing] = useState(false)

    const key = `${workspaceId}:${horizonHours}`

    const load = useCallback(
        async (horizon: number, signal?: AbortSignal) => {
            if (!workspaceId) return
            const requestKey = `${workspaceId}:${horizon}`
            try {
                const data = await operationsRequest<OperationsSummaryView>(
                    `/api/platform/operations/today?workspaceId=${encodeURIComponent(workspaceId)}&horizonHours=${horizon}`,
                    { signal },
                )
                setFailed(null)
                setLoaded({ key: requestKey, value: data })
            } catch (cause) {
                if (isAbortError(cause)) return
                setFailed({ key: requestKey, value: cause })
            }
        },
        [workspaceId],
    )

    /**
     * The mount fetch is written INLINE rather than calling `load`, and that is not stylistic.
     *
     * `react-hooks/set-state-in-effect` flags an effect that calls a named function which is also
     * reachable from elsewhere and sets state; it accepts a self-contained async closure, because
     * there the compiler can see the whole path. Calling `load` here produced a real lint error, and
     * the alternatives were both worse: suppressing the rule hides it, and matching the pattern that
     * 8 other files already trip would have added a 15th error to a count this run is holding flat.
     *
     * The cost is that the request URL appears twice. That is a genuine duplication and the reason it
     * is acceptable here is narrow: the effect fetches only ever at DEFAULT_HORIZON, so the two call
     * sites cannot drift on the argument that matters. If a third caller appears, extract it.
     */
    useEffect(() => {
        const controller = new AbortController()
        const run = async () => {
            try {
                const data = await operationsRequest<OperationsSummaryView>(
                    `/api/platform/operations/today?workspaceId=${encodeURIComponent(workspaceId)}&horizonHours=${DEFAULT_HORIZON}`,
                    { signal: controller.signal },
                )
                setFailed(null)
                setLoaded({ key: `${workspaceId}:${DEFAULT_HORIZON}`, value: data })
            } catch (cause) {
                if (isAbortError(cause)) return
                setFailed({ key: `${workspaceId}:${DEFAULT_HORIZON}`, value: cause })
            }
        }
        if (workspaceId) void run()
        return () => controller.abort()
    }, [workspaceId])

    const changeHorizon = useCallback(
        (horizon: number) => {
            setHorizonHours(horizon)
            void load(horizon)
        },
        [load],
    )

    const refresh = useCallback(() => {
        setRefreshing(true)
        void load(horizonHours).finally(() => setRefreshing(false))
    }, [load, horizonHours])

    // Only this key's results count. A value left over from another workspace or horizon is not this
    // one's answer, so the panel reads as loading rather than briefly showing the wrong numbers.
    const summary = loaded !== null && loaded.key === key ? loaded.value : null
    const error = failed !== null && failed.key === key ? failed.value : null

    if (!workspaceId) {
        return (
            <EmptyState
                icon={<Activity aria-hidden="true" />}
                title="Select a workspace"
                description="Choose a workspace above to see what needs attention."
            />
        )
    }

    const active = summary?.domains.filter((domain) => domain.count > 0) ?? []

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                    <Activity className="h-4 w-4" aria-hidden="true" />
                    Today across your operations
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="flex flex-wrap items-end justify-between gap-2">
                    <p className="text-xs text-muted-foreground">
                        Everything waiting, read from the records each engine already owns. This view only reads — it
                        changes nothing and cannot mark anything as handled.
                    </p>
                    <div className="flex items-end gap-2">
                        <div>
                            <Label htmlFor="ops-horizon">Looking ahead</Label>
                            <select
                                id="ops-horizon"
                                className="mt-1 h-9 rounded-md border border-input bg-background px-2 text-sm"
                                value={horizonHours}
                                onChange={(event) => changeHorizon(Number(event.target.value))}
                            >
                                {HORIZONS.map((hours) => (
                                    <option key={hours} value={hours}>
                                        {hours === 24 ? "24 hours" : `${hours / 24} days`}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <Button size="sm" variant="outline" disabled={refreshing} onClick={refresh}>
                            Refresh
                        </Button>
                    </div>
                </div>

                {error ? (
                    <div className="mt-3">
                        <ErrorState title={operationsErrorCopy(error).title} description={operationsErrorCopy(error).description} />
                    </div>
                ) : null}

                {summary === null && !error ? (
                    <div className="mt-4 space-y-2" aria-live="polite" aria-busy="true">
                        <span className="sr-only">Loading operations summary</span>
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-24 w-full" />
                    </div>
                ) : null}

                {summary !== null ? (
                    <div className="mt-4" aria-live="polite" aria-busy={refreshing ? "true" : "false"}>
                        <div className="flex flex-wrap items-center gap-3 rounded-md border border-border/70 p-3">
                            <div>
                                <p className="text-2xl font-semibold">{summary.total}</p>
                                <p className="text-xs text-muted-foreground">
                                    {summary.total === 1 ? "item needs attention" : "items need attention"}
                                </p>
                            </div>
                            {summary.totalOverdue > 0 ? (
                                <Badge variant="destructive">{summary.totalOverdue} overdue</Badge>
                            ) : (
                                <Badge variant="outline">none overdue</Badge>
                            )}
                            <p className="text-xs text-muted-foreground">as of {formatAt(summary.asOf)}</p>
                        </div>

                        {active.length > 0 ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                                {active.map((domain) => (
                                    <Badge key={domain.domain} variant="secondary">
                                        {domainLabel(domain.domain)} {domain.count}
                                        {domain.overdue > 0 ? ` (${domain.overdue} overdue)` : ""}
                                        {domain.scope === "workspace" ? " · this workspace only" : ""}
                                    </Badge>
                                ))}
                            </div>
                        ) : null}

                        {/*
                          * Most domains are profile-scoped; case milestones are workspace-scoped
                          * because CaseProject carries workspaceId. For an owner with more than one
                          * workspace those are different sets, so a single total can span two
                          * boundaries. Saying so turns a number that would not reconcile against
                          * another screen into a fact the owner can act on.
                          */}
                        {/*
                          * TWO SENTENCES, AND THEY ARE DELIBERATELY DIFFERENT KINDS OF CLAIM.
                          *
                          * The first is unconditional and is about HOW THIS VIEW IS ASSEMBLED. It is true
                          * for every owner and every dataset, it is what makes the per-item "this
                          * workspace only" marker legible, and it is needed even when the current total
                          * happens to sit on one boundary - otherwise an owner cannot tell that the
                          * marker means anything.
                          *
                          * The second is conditional and is a MEASUREMENT OF THIS OWNER'S TOTAL. The
                          * branch on `summary.mixedScope` is back, and it is now legitimate, which it was
                          * not before. `mixedScope` used to be `scopes.size > 1` over the frozen
                          * OPERATIONS_DOMAIN_SCOPE map, so it was true for every owner, every workspace
                          * and every dataset including an empty one: the `: null` arm was unreachable and
                          * the sentence was shown unconditionally to owners for whom it was false. The
                          * producer now measures the boundaries the domains that actually returned
                          * something were read on, so both arms are reached by real data - an owner with
                          * no case milestones takes the null arm, and one with case milestones AND
                          * profile-scoped work takes the sentence.
                          *
                          * WHY THE FALSE ARM STAYS SILENT, having re-evaluated it rather than restored the
                          * old shape by default. This sentence is a WARNING: its whole content is "this
                          * one number adds two populations together, so do not reconcile it against a
                          * screen that shows one of them". When the total sits on one boundary there is
                          * nothing to reconcile against and nothing to warn about, and the honest
                          * negative - "your total does not mix boundaries" - is a sentence no owner has an
                          * action for. Rendering it anyway would put a permanent notice on the panel, and
                          * a notice that is always there is a notice nobody reads, which would cost the
                          * true case its force. The disclosure that this view CAN mix boundaries is not
                          * withheld by that silence: it is the unconditional sentence above, which is
                          * exactly why that sentence is kept rather than replaced by this branch.
                          *
                          * An empty total takes the null arm too, and that is correct rather than
                          * incidental: zero items span no boundary, so there is no combination to declare.
                          */}
                        <p className="mt-2 text-xs text-muted-foreground">
                            This view is assembled from domains read on two different boundaries: most cover your whole
                            profile, while items marked <span className="font-medium">this workspace only</span> cover
                            just the selected workspace. The marker on each item says which it is.
                        </p>

                        {summary.mixedScope ? (
                            <p className="mt-2 text-xs text-muted-foreground">
                                Right now your total spans both of them: it adds items read across your whole profile to
                                items read on this workspace only, so it does not reconcile against a screen that shows
                                just one of the two.
                            </p>
                        ) : null}

                        {summary.total === 0 ? (
                            <div className="mt-3">
                                <EmptyState
                                    icon={<Activity aria-hidden="true" />}
                                    title="Nothing is waiting"
                                    description="No records in the covered domains need attention in this window. Nothing here is sample data."
                                />
                            </div>
                        ) : (
                            <ul className="mt-3 space-y-2">
                                {summary.items.map((item) => (
                                    <li key={`${item.domain}:${item.id}`} className="rounded-md border border-border/70 p-3">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <div>
                                                <h3 className="text-sm font-medium">{item.label}</h3>
                                                <p className="text-xs text-muted-foreground">{item.reason}</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Badge variant="outline">{domainLabel(item.domain)}</Badge>
                                                {item.overdue ? <Badge variant="destructive">overdue</Badge> : null}
                                                <span className="text-xs text-muted-foreground">{formatAt(item.at)}</span>
                                            </div>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}

                        {/*
                          * Rendered ALWAYS, and especially when the total is zero. A cross-engine total
                          * that did not say what it excludes would let an owner read "0" as "nothing
                          * anywhere" and stop checking the domains this view does not read.
                          */}
                        <div className="mt-4 rounded-md border border-dashed border-border/70 p-3">
                            <h5 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                What this total does not include
                            </h5>
                            <p className="mt-1 text-xs text-muted-foreground">
                                Covers {summary.covers.map((domain) => domainLabel(domain)).join(", ")}. The following are
                                not read by this view, so check them separately:
                            </p>
                            <ul className="mt-1 space-y-1">
                                {Object.entries(summary.doesNotCover).map(([key, reason]) => (
                                    <li key={key} className="text-xs text-muted-foreground">
                                        <span className="font-medium">{readableKey(key)}</span> — {reason}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                ) : null}
            </CardContent>
        </Card>
    )
}

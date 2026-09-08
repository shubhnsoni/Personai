import { requireAdmin } from "@/lib/admin/require-admin"
import {
    TIER_COPY,
    dependencyHealth,
    measureCapacity,
    platformSetupChecks,
    recordCapacitySample,
    suggestedTier,
} from "@/lib/admin/capacity"
import { prisma } from "@/lib/prisma"
import { AdminStat } from "@/components/admin/admin-stat"

export const dynamic = "force-dynamic"

export default async function AdminCapacityPage() {
    await requireAdmin()
    const [snap, health, checks, samples] = await Promise.all([
        measureCapacity(),
        dependencyHealth(),
        platformSetupChecks(),
        prisma.capacitySample.findMany({ orderBy: { at: "desc" }, take: 12 }).catch(() => []),
    ])
    await recordCapacitySample(snap)
    const tier = suggestedTier(snap.band)
    const copy = TIER_COPY[tier]
    const deps: Array<{ label: string; ok: boolean; hint?: string }> = [
        { label: "Database", ok: health.database.ok, hint: `${health.database.ms}ms` },
        { label: "Clerk", ok: health.clerk },
        { label: "Stripe", ok: health.stripe, hint: health.lastStripeWebhookAt ? `webhook ${health.lastStripeWebhookAt}` : "no webhook yet" },
        { label: "Resend", ok: health.resend, hint: health.resend ? "configured" : "console fallback" },
        { label: "Codex", ok: health.codex },
        { label: "SpaceXAI", ok: health.xai },
        { label: "OpenAI", ok: health.openai },
        { label: "Last LLM", ok: !health.lastAi || health.lastAi.ok, hint: health.lastAi ? `${health.lastAi.provider} ${health.lastAi.ms}ms` : "none" },
    ]

    return (
        <div className="space-y-6">
            <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Platform</p>
                <h1 className="text-2xl font-semibold tracking-tight">Capacity</h1>
                <p className="text-sm text-muted-foreground">Health, current load, launch checklist, and what to buy when the band goes warm or hot.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <AdminStat label="Band" value={snap.band.toUpperCase()} hint={`DB ${snap.dbMs}ms`} />
                <AdminStat label="Live visitors" value={String(snap.liveVisitors)} hint={`heartbeat ~${snap.heartbeatQps.toFixed(1)}/s`} />
                <AdminStat label="Poll load" value={`${snap.pollQps.toFixed(1)}/s`} hint={`live chat ${snap.liveChatPollQps.toFixed(1)} · orders ${snap.orderPollQps.toFixed(1)}`} />
                <AdminStat label="LLM 5m" value={String(snap.llmCalls5m)} hint={snap.llmP95Ms != null ? `p95 ${snap.llmP95Ms}ms · ${snap.llmErrors5m} fail` : "no calls"} />
            </div>
            <section className="rounded-xl border p-4">
                <h2 className="text-sm font-medium">Dependencies</h2>
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                    {deps.map((row) => (
                        <li key={row.label} className="flex justify-between gap-2 text-sm">
                            <span>{row.ok ? "●" : "○"} {row.label}</span>
                            <span className="truncate text-xs text-muted-foreground">{row.hint || (row.ok ? "ok" : "missing")}</span>
                        </li>
                    ))}
                </ul>
            </section>
            <section className="rounded-xl border p-4">
                <h2 className="text-sm font-medium">Server setup requirements</h2>
                <ul className="mt-3 space-y-1.5 text-sm">
                    {checks.map((row) => (
                        <li key={row.id} className={row.ok ? "text-foreground" : "text-muted-foreground"}>
                            {row.ok ? "●" : "○"} {row.label}
                            {row.hint ? <span className="ml-2 text-xs text-muted-foreground">{row.hint}</span> : null}
                        </li>
                    ))}
                </ul>
            </section>
            <section className="rounded-xl border p-4">
                <h2 className="text-sm font-medium">{copy.title}</h2>
                <p className="mt-1 text-xs text-muted-foreground">Suggested from the current band. Tune after you have real samples.</p>
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
                    {copy.items.map((item) => <li key={item}>{item}</li>)}
                </ul>
            </section>
            {samples.length > 0 ? (
                <section className="rounded-xl border p-4">
                    <h2 className="text-sm font-medium">Recent samples</h2>
                    <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                        {samples.map((row) => (
                            <li key={row.id} className="flex justify-between gap-2">
                                <span>{row.at.toISOString().replace("T", " ").slice(0, 16)}</span>
                                <span>{row.band} · {row.liveVisitors} live · DB {row.dbMs}ms</span>
                            </li>
                        ))}
                    </ul>
                </section>
            ) : null}
        </div>
    )
}

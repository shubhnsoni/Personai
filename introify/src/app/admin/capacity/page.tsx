import {
    TIER_COPY,
    dependencyHealth,
    measureCapacity,
    platformSetupChecks,
    recordCapacitySample,
    suggestedTier,
} from "@/lib/admin/capacity"
import { prisma } from "@/lib/prisma"
import { AdminKpi, AdminKpiStrip, AdminPageHead, AdminPanel, AdminRow, AdminStatus } from "@/components/admin/admin-ui"

export const dynamic = "force-dynamic"

export default async function AdminCapacityPage() {
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
        <div className="space-y-5">
            <AdminPageHead title="Capacity" hint="Health, current load, launch checklist, and what to buy when the band goes warm or hot." />
            <AdminKpiStrip columns={4}>
                <AdminKpi title="Band" value={snap.band.toUpperCase()} subtitle={`DB ${snap.dbMs}ms`} hot={snap.band !== "ok"} />
                <AdminKpi title="Live visitors" value={snap.liveVisitors} subtitle={`heartbeat ~${snap.heartbeatQps.toFixed(1)}/s`} />
                <AdminKpi title="Poll load" value={`${snap.pollQps.toFixed(1)}/s`} subtitle={`live chat ${snap.liveChatPollQps.toFixed(1)} · orders ${snap.orderPollQps.toFixed(1)}`} />
                <AdminKpi title="LLM 5m" value={snap.llmCalls5m} subtitle={snap.llmP95Ms != null ? `p95 ${snap.llmP95Ms}ms · ${snap.llmErrors5m} fail` : "no calls"} />
            </AdminKpiStrip>
            <AdminPanel title="Dependencies">
                <div className="grid gap-1 sm:grid-cols-2">
                    {deps.map((row) => (
                        <AdminRow key={row.label}>
                            <AdminStatus ok={row.ok} label={row.label} />
                            <span className="ml-auto truncate text-xs text-muted-foreground">{row.hint || (row.ok ? "ok" : "missing")}</span>
                        </AdminRow>
                    ))}
                </div>
            </AdminPanel>
            <AdminPanel title="Server setup">
                {checks.map((row) => (
                    <AdminRow key={row.id}>
                        <AdminStatus ok={row.ok} label={row.label} />
                        {row.hint ? <span className="ml-auto truncate text-xs text-muted-foreground">{row.hint}</span> : null}
                    </AdminRow>
                ))}
            </AdminPanel>
            <AdminPanel title={copy.title}>
                <p className="px-4 pt-3 text-xs text-muted-foreground">Suggested from the current band. Tune after you have real samples.</p>
                <ul className="space-y-1 px-4 py-3 text-sm">
                    {copy.items.map((item) => <li key={item}>{item}</li>)}
                </ul>
            </AdminPanel>
            {samples.length > 0 ? (
                <AdminPanel title="Recent samples">
                    {samples.map((row) => (
                        <AdminRow key={row.id}>
                            <span className="flex-1 text-xs text-muted-foreground">{row.at.toISOString().replace("T", " ").slice(0, 16)}</span>
                            <span className="text-xs">{row.band} · {row.liveVisitors} live · DB {row.dbMs}ms</span>
                        </AdminRow>
                    ))}
                </AdminPanel>
            ) : null}
        </div>
    )
}

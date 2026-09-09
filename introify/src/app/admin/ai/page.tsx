import { getAiAvailability, resolveApiRecipe } from "@/lib/ai-runtime"
import { AI_MODES } from "@/lib/billing/catalog"
import { prisma } from "@/lib/prisma"
import { loadPlatformAiSettings, providerConfigured } from "@/lib/admin/ai-settings"
import { AiSettingsForm } from "@/components/admin/ai-settings-form"
import { AdminEmpty, AdminPageHead, AdminPanel, AdminRow } from "@/components/admin/admin-ui"

export const dynamic = "force-dynamic"

export default async function AdminAiPage() {
    const [settings, logs, overrides] = await Promise.all([
        loadPlatformAiSettings(),
        prisma.aiCallLog.findMany({ orderBy: { createdAt: "desc" }, take: 12 }).catch(() => []),
        prisma.profile.findMany({
            where: { aiProviderOverride: { not: null }, slug: { not: { startsWith: "try-" } } },
            select: { id: true, displayName: true, slug: true, aiProviderOverride: true, aiModel: true },
            take: 20,
        }),
    ])
    const status = {
        codex: providerConfigured("codex"),
        xai: providerConfigured("xai"),
        openai: providerConfigured("openai"),
    }
    const commercial = getAiAvailability()
    const stopped = process.env.INTROIFY_AI_DISABLED === "true"
    return (
        <div className="space-y-5">
            <AdminPageHead title="AI" hint="Published assistants use explicit commercial API mappings and account credits." />
            <AdminPanel title="Published assistant configuration">
                <p className="mb-3 text-sm text-muted-foreground">{stopped ? "Commercial AI is disabled by INTROIFY_AI_DISABLED=true." : "Configuration readiness below does not verify provider access or account credit availability."}</p>
                {Object.values(AI_MODES).map(mode => {
                    const recipe = resolveApiRecipe(mode.id)
                    return <AdminRow key={mode.id}><span className="flex-1 text-sm">{mode.name} · {mode.credits} {mode.credits === 1 ? "credit" : "credits"}</span><span className="text-xs text-muted-foreground">{commercial[mode.id] && recipe ? `${recipe.provider} · ${recipe.model}` : "Unavailable"}</span></AdminRow>
                })}
                <p className="mt-3 text-xs text-muted-foreground">Set INTROIFY_AI_PROVIDER and INTROIFY_AI_FAST_MODEL, INTROIFY_AI_SMART_MODEL, INTROIFY_AI_REASONING_MODEL in the server environment. INTROIFY_AI_DISABLED=true stops published AI and import enrichment. API keys stay on the server. Personal Codex sessions and the legacy settings below do not authorize customer replies.</p>
            </AdminPanel>
            <h2 className="text-sm font-medium">Legacy admin diagnostics</h2>
            <p className="text-xs text-muted-foreground">These saved defaults, fallbacks, provider disable switches and shop overrides apply only to the legacy diagnostic path. They do not select or stop the commercial runtime above. Diagnostic pings can incur provider charges and are not customer credit operations.</p>
            <AiSettingsForm settings={settings} status={status} />
            {overrides.length > 0 ? (
                <AdminPanel title="Legacy shop overrides">
                    {overrides.map((row) => (
                        <AdminRow key={row.id} href={`/admin/shops/${row.id}`}>
                            <span className="flex-1 truncate">{row.displayName}</span>
                            <span className="text-xs text-muted-foreground">{row.aiProviderOverride} · {row.aiModel}</span>
                        </AdminRow>
                    ))}
                </AdminPanel>
            ) : null}
            <AdminPanel title="Recent diagnostic calls">
                {logs.length === 0 ? <AdminEmpty>No diagnostic calls logged yet. Commercial usage is recorded in the billing ledger.</AdminEmpty> : logs.map((row) => (
                    <AdminRow key={row.id}>
                        <span className="flex-1 text-xs">{row.provider} · {row.model}</span>
                        <span className={row.ok ? "text-xs text-muted-foreground" : "text-xs text-red-400"}>{row.ok ? `${row.ms}ms` : row.errorCode || "fail"}</span>
                    </AdminRow>
                ))}
            </AdminPanel>
        </div>
    )
}

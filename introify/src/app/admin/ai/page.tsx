import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/admin/require-admin"
import { loadPlatformAiSettings, providerConfigured } from "@/lib/admin/ai-settings"
import { AiSettingsForm } from "@/components/admin/ai-settings-form"

export const dynamic = "force-dynamic"

export default async function AdminAiPage() {
    await requireAdmin()
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
    return (
        <div className="space-y-6">
            <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Platform</p>
                <h1 className="text-2xl font-semibold tracking-tight">AI backends</h1>
                <p className="text-sm text-muted-foreground">Keys stay in env / Codex login. This page picks who answers chats.</p>
            </div>
            <AiSettingsForm settings={settings} status={status} />
            {overrides.length > 0 ? (
                <section className="rounded-xl border p-4">
                    <h2 className="text-sm font-medium">Shop overrides</h2>
                    <ul className="mt-2 space-y-1 text-sm">
                        {overrides.map((row) => (
                            <li key={row.id} className="flex justify-between">
                                <a href={`/admin/shops/${row.id}`} className="hover:underline">{row.displayName}</a>
                                <span className="text-muted-foreground">{row.aiProviderOverride} · {row.aiModel}</span>
                            </li>
                        ))}
                    </ul>
                </section>
            ) : null}
            <section className="rounded-xl border p-4">
                <h2 className="text-sm font-medium">Recent calls</h2>
                <ul className="mt-2 space-y-1 text-sm">
                    {logs.map((row) => (
                        <li key={row.id} className="flex justify-between text-xs">
                            <span>{row.provider} · {row.model}</span>
                            <span className={row.ok ? "text-muted-foreground" : "text-red-500"}>{row.ok ? `${row.ms}ms` : row.errorCode || "fail"}</span>
                        </li>
                    ))}
                    {logs.length === 0 ? <li className="text-sm text-muted-foreground">No calls logged yet.</li> : null}
                </ul>
            </section>
        </div>
    )
}

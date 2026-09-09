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
    return (
        <div className="space-y-5">
            <AdminPageHead title="AI" hint="Keys stay in env / Codex login. This page picks who answers chats." />
            <AiSettingsForm settings={settings} status={status} />
            {overrides.length > 0 ? (
                <AdminPanel title="Shop overrides">
                    {overrides.map((row) => (
                        <AdminRow key={row.id} href={`/admin/shops/${row.id}`}>
                            <span className="flex-1 truncate">{row.displayName}</span>
                            <span className="text-xs text-muted-foreground">{row.aiProviderOverride} · {row.aiModel}</span>
                        </AdminRow>
                    ))}
                </AdminPanel>
            ) : null}
            <AdminPanel title="Recent calls">
                {logs.length === 0 ? <AdminEmpty>No calls logged yet.</AdminEmpty> : logs.map((row) => (
                    <AdminRow key={row.id}>
                        <span className="flex-1 text-xs">{row.provider} · {row.model}</span>
                        <span className={row.ok ? "text-xs text-muted-foreground" : "text-xs text-red-400"}>{row.ok ? `${row.ms}ms` : row.errorCode || "fail"}</span>
                    </AdminRow>
                ))}
            </AdminPanel>
        </div>
    )
}

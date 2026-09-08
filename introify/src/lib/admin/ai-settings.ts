import { prisma } from "@/lib/prisma"
import { hasCodexAuthSource } from "@/lib/codex-auth"
import { DEFAULT_CODEX_MODEL } from "@/lib/codex-chat"

export type AiProviderKind = "codex" | "xai" | "openai"

export type PlatformAiSettings = {
    defaultProvider: AiProviderKind
    fallback: AiProviderKind[]
    models: Record<AiProviderKind, string>
    kill: Record<AiProviderKind, boolean>
}

const DEFAULT_SETTINGS: PlatformAiSettings = {
    defaultProvider: "codex",
    fallback: ["xai", "openai"],
    models: {
        codex: DEFAULT_CODEX_MODEL,
        xai: "grok-4.5",
        openai: "gpt-4o-mini",
    },
    kill: { codex: false, xai: false, openai: false },
}

let cache: { at: number; settings: PlatformAiSettings } | null = null
const TTL_MS = 10_000

export function defaultPlatformAiSettings(): PlatformAiSettings {
    return {
        defaultProvider: DEFAULT_SETTINGS.defaultProvider,
        fallback: [...DEFAULT_SETTINGS.fallback],
        models: { ...DEFAULT_SETTINGS.models },
        kill: { ...DEFAULT_SETTINGS.kill },
    }
}

export function parsePlatformAiSettings(raw: string | null | undefined): PlatformAiSettings {
    const base = defaultPlatformAiSettings()
    try {
        const bag = JSON.parse(raw || "{}") as Partial<PlatformAiSettings>
        if (bag.defaultProvider === "codex" || bag.defaultProvider === "xai" || bag.defaultProvider === "openai") {
            base.defaultProvider = bag.defaultProvider
        }
        if (Array.isArray(bag.fallback)) {
            base.fallback = bag.fallback.filter((k): k is AiProviderKind => k === "codex" || k === "xai" || k === "openai")
        }
        if (bag.models && typeof bag.models === "object") {
            for (const key of ["codex", "xai", "openai"] as const) {
                const value = bag.models[key]
                if (typeof value === "string" && value.trim()) base.models[key] = value.trim()
            }
        }
        if (bag.kill && typeof bag.kill === "object") {
            for (const key of ["codex", "xai", "openai"] as const) {
                if (typeof bag.kill[key] === "boolean") base.kill[key] = bag.kill[key]
            }
        }
    } catch { /* keep defaults */ }
    return base
}

export function primePlatformAiSettings(settings: PlatformAiSettings) {
    cache = { at: Date.now(), settings }
}

export function cachedPlatformAiSettings(): PlatformAiSettings {
    return cache?.settings || defaultPlatformAiSettings()
}

export async function loadPlatformAiSettings(): Promise<PlatformAiSettings> {
    if (cache && Date.now() - cache.at < TTL_MS) return cache.settings
    const row = await prisma.platformConfig.findUnique({ where: { id: "platform" } }).catch(() => null)
    const settings = parsePlatformAiSettings(row?.aiJson)
    cache = { at: Date.now(), settings }
    return settings
}

export async function savePlatformAiSettings(settings: PlatformAiSettings) {
    const aiJson = JSON.stringify(settings)
    await prisma.platformConfig.upsert({
        where: { id: "platform" },
        create: { id: "platform", aiJson },
        update: { aiJson },
    })
    primePlatformAiSettings(settings)
}

export function providerConfigured(kind: AiProviderKind) {
    if (kind === "codex") return hasCodexAuthSource()
    if (kind === "xai") return Boolean(process.env.XAI_API_KEY?.trim())
    return Boolean(process.env.OPENAI_API_KEY?.trim())
}

export function pickProviderOrder(settings: PlatformAiSettings, shopOverride?: string | null): AiProviderKind[] {
    const start = shopOverride === "codex" || shopOverride === "xai" || shopOverride === "openai"
        ? shopOverride
        : settings.defaultProvider
    const rest = [start, ...settings.fallback.filter((k) => k !== start)]
    const seen = new Set<AiProviderKind>()
    const ordered: AiProviderKind[] = []
    for (const kind of rest) {
        if (seen.has(kind)) continue
        seen.add(kind)
        if (settings.kill[kind]) continue
        if (!providerConfigured(kind)) continue
        ordered.push(kind)
    }
    return ordered
}

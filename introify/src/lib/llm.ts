import OpenAI from "openai"
import {
    cachedPlatformAiSettings,
    defaultPlatformAiSettings,
    loadPlatformAiSettings,
    pickProviderOrder,
    type AiProviderKind,
    type PlatformAiSettings,
} from "@/lib/admin/ai-settings"
import { streamCodexChat } from "@/lib/codex-chat"

export type LlmProvider = {
    kind: AiProviderKind
    apiKey: string
    baseURL?: string
    defaultModel: string
}

function providerFor(kind: AiProviderKind, settings: PlatformAiSettings): LlmProvider | null {
    if (kind === "codex") {
        return {
            kind: "codex",
            apiKey: "codex",
            baseURL: "https://chatgpt.com/backend-api/codex",
            defaultModel: process.env.CODEX_MODEL?.trim() || settings.models.codex,
        }
    }
    if (kind === "xai") {
        const xai = process.env.XAI_API_KEY?.trim()
        if (!xai) return null
        return { kind: "xai", apiKey: xai, baseURL: "https://api.x.ai/v1", defaultModel: settings.models.xai }
    }
    const openai = process.env.OPENAI_API_KEY?.trim()
    if (!openai) return null
    return { kind: "openai", apiKey: openai, defaultModel: settings.models.openai }
}

export function resolveLlm(opts?: { override?: string | null; settings?: PlatformAiSettings }): LlmProvider | null {
    const settings = opts?.settings || cachedPlatformAiSettings()
    const order = pickProviderOrder(settings, opts?.override)
    for (const kind of order) {
        const provider = providerFor(kind, settings)
        if (provider) return provider
    }
    return null
}

export function resolveChatModel(stored: string | null | undefined, provider: LlmProvider) {
    const name = (stored || "").trim()
    if (provider.kind === "xai") {
        if (!name || /^(gpt-|o1|o3|o4|chatgpt)/i.test(name)) return provider.defaultModel
        return name
    }
    if (provider.kind === "codex") {
        if (!name || /^(grok-|xai|gpt-4o|gpt-4\.1|o1|o3)/i.test(name)) return provider.defaultModel
        return name
    }
    return name || provider.defaultModel
}

export async function resolveLlmReady(opts?: { override?: string | null }) {
    const settings = await loadPlatformAiSettings().catch(() => defaultPlatformAiSettings())
    return resolveLlm({ override: opts?.override, settings })
}

export function llmClient(opts?: { override?: string | null; settings?: PlatformAiSettings }) {
    const provider = resolveLlm(opts)
    if (!provider) return null
    if (provider.kind === "codex") {
        return {
            provider,
            client: {
                chat: {
                    completions: {
                        create: (input: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming) =>
                            streamCodexChat({
                                ...input,
                                model: resolveChatModel(
                                    typeof input.model === "string" ? input.model : provider.defaultModel,
                                    provider,
                                ),
                            }),
                    },
                },
            },
        }
    }
    return {
        provider,
        client: new OpenAI({ apiKey: provider.apiKey, baseURL: provider.baseURL }),
    }
}

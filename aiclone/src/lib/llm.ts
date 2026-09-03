import OpenAI from "openai"

export type LlmProvider = {
    kind: "xai" | "openai"
    apiKey: string
    baseURL?: string
    defaultModel: string
}

export function resolveLlm(): LlmProvider | null {
    const xai = process.env.XAI_API_KEY?.trim()
    if (xai) {
        return {
            kind: "xai",
            apiKey: xai,
            baseURL: "https://api.x.ai/v1",
            defaultModel: "grok-4.5",
        }
    }
    const openai = process.env.OPENAI_API_KEY?.trim()
    if (openai) {
        return { kind: "openai", apiKey: openai, defaultModel: "gpt-4o-mini" }
    }
    return null
}

export function resolveChatModel(stored: string | null | undefined, provider: LlmProvider) {
    const name = (stored || "").trim()
    if (provider.kind === "xai") {
        if (!name || /^(gpt-|o1|o3|o4|chatgpt)/i.test(name)) return provider.defaultModel
        return name
    }
    return name || provider.defaultModel
}

export function llmClient() {
    const provider = resolveLlm()
    if (!provider) return null
    return {
        provider,
        client: new OpenAI({ apiKey: provider.apiKey, baseURL: provider.baseURL }),
    }
}

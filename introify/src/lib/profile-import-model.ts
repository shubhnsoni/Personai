import OpenAI from "openai"
import { apiClient, boundedCodexChatStream, usageMetadata, type ApiRecipe } from "@/lib/ai-runtime"
import { PROFILE_IMPORT_POLICY, profileBlueprintSchema, type ProfileBlueprint } from "@/lib/profile-import-contract"
import { PROFILE_IMPORT_PROMPT } from "@/lib/profile-import-prompt"
import { literalProfileLinks, type ProfileImportEvidence } from "@/lib/profile-import-sources"

export type ProfileImportReceipt = {
    returnedModel: string | null
    inputTokens: number | null
    outputTokens: number | null
    usageKnown: boolean
    estimatedCostMicros: number | null
    costKnown: boolean
}

export type ProfileImportResult = { blueprint: ProfileBlueprint; receipt: ProfileImportReceipt }

export class ProfileImportInvalidError extends Error {
    readonly receipt: ProfileImportReceipt
    constructor(message: string, receipt: ProfileImportReceipt) {
        super(message)
        this.name = "ProfileImportInvalidError"
        this.receipt = receipt
    }
}

export function profileImportRecipe(base: ApiRecipe): ApiRecipe {
    return { ...base, inputBudget: PROFILE_IMPORT_POLICY.maxSourceBytes, outputBudget: PROFILE_IMPORT_POLICY.maxOutputTokens }
}

function receiptFor(recipe: ApiRecipe, usage: { prompt_tokens?: number | null; completion_tokens?: number | null; input_tokens?: number | null; output_tokens?: number | null } | undefined | null, returnedModel?: string | null): ProfileImportReceipt {
    const input = usage?.prompt_tokens ?? usage?.input_tokens ?? null
    const output = usage?.completion_tokens ?? usage?.output_tokens ?? null
    const meta = usageMetadata(recipe, input, output)
    return {
        returnedModel: returnedModel || null,
        inputTokens: meta.inputTokens,
        outputTokens: meta.outputTokens,
        usageKnown: meta.usageKnown,
        estimatedCostMicros: meta.estimatedCostMicros,
        costKnown: meta.costKnown,
    }
}

function collectSourceIds(value: unknown, into: Set<string>) {
    if (Array.isArray(value)) {
        for (const item of value) collectSourceIds(item, into)
        return
    }
    if (value && typeof value === "object") {
        for (const [key, item] of Object.entries(value)) {
            if (key === "sourceIds" && Array.isArray(item)) for (const id of item) into.add(String(id))
            else collectSourceIds(item, into)
        }
    }
}

function normalizeSocialUrl(raw: string): string | null {
    try {
        const url = new URL(raw.trim())
        if (url.protocol !== "https:" && url.protocol !== "http:") return null
        if (url.username || url.password || url.port) return null
        url.hash = ""
        return url.toString()
    } catch {
        return null
    }
}

function urlsForEvidence(entry: ProfileImportEvidence): Set<string> {
    const urls = new Set<string>()
    if (entry.url) {
        const normalized = normalizeSocialUrl(entry.url)
        if (normalized) urls.add(normalized)
    }
    for (const link of literalProfileLinks(entry.text)) {
        const normalized = normalizeSocialUrl(link)
        if (normalized) urls.add(normalized)
    }
    return urls
}

export function validateBlueprint(blueprint: ProfileBlueprint, evidence: ProfileImportEvidence[]): ProfileBlueprint {
    const byId = new Map(evidence.map(entry => [entry.id, entry]))
    const cited = new Set<string>()
    collectSourceIds(blueprint, cited)
    for (const id of cited) {
        if (!byId.has(id)) throw new Error(`Blueprint cites unknown source ${id}.`)
    }
    for (const social of blueprint.socials) {
        const normalized = normalizeSocialUrl(social.url)
        if (!normalized) throw new Error("Blueprint returned an invalid social link.")
        const bound = social.sourceIds.some(id => urlsForEvidence(byId.get(id) || { id: "", url: null, text: "" }).has(normalized))
        if (!bound) throw new Error("Blueprint returned a social link that was not supplied.")
    }
    return blueprint
}

function checkLength(text: string, receipt: ProfileImportReceipt): string {
    if (Buffer.byteLength(text, "utf8") > PROFILE_IMPORT_POLICY.maxResponseBytes) {
        throw new ProfileImportInvalidError("Provider returned an oversized response.", receipt)
    }
    return text
}

async function dispatch(recipe: ApiRecipe, messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[], signal: AbortSignal): Promise<{ text: string; receipt: ProfileImportReceipt }> {
    const options = { signal, timeout: PROFILE_IMPORT_POLICY.providerTimeoutMs }
    if (recipe.provider === "openai") {
        const response = await apiClient(recipe).chat.completions.create({
            model: recipe.model,
            messages,
            stream: false,
            response_format: { type: "json_object" },
            max_completion_tokens: PROFILE_IMPORT_POLICY.maxOutputTokens,
        }, options)
        const choice = response.choices[0]
        const receipt = receiptFor(recipe, response.usage, response.model)
        if (choice && choice.finish_reason !== "stop" && choice.finish_reason !== null) {
            throw new ProfileImportInvalidError(`Provider finished early (${choice.finish_reason}).`, receipt)
        }
        return { text: checkLength(choice?.message?.content || "", receipt), receipt }
    }
    if (recipe.provider === "xai") {
        const response = await apiClient(recipe).responses.create({
            model: recipe.model,
            input: messages.map(message => ({ role: message.role === "system" ? "system" as const : "user" as const, content: typeof message.content === "string" ? message.content : "" })) as unknown as OpenAI.Responses.ResponseInput,
            text: { format: { type: "json_object" } },
            max_output_tokens: PROFILE_IMPORT_POLICY.maxOutputTokens,
            store: false,
            stream: false,
            tools: [],
            parallel_tool_calls: false,
        }, options)
        const receipt = receiptFor(recipe, response.usage as { input_tokens?: number; output_tokens?: number } | undefined, response.model)
        if (response.status && response.status !== "completed") {
            throw new ProfileImportInvalidError(`Provider response incomplete (${response.status}).`, receipt)
        }
        const text = response.output.flatMap(output => output.type === "message" ? output.content.flatMap(content => content.type === "output_text" ? [content.text] : []) : []).join("")
        return { text: checkLength(text, receipt), receipt }
    }

    const stream = await boundedCodexChatStream({
        model: recipe.model,
        messages,
        stream: true,
        max_completion_tokens: PROFILE_IMPORT_POLICY.maxOutputTokens,
    }, recipe, signal)
    let text = ""
    let bytes = 0
    let usage: OpenAI.Completions.CompletionUsage | undefined
    let model = recipe.model
    const iterator = stream[Symbol.asyncIterator]()
    try {
        for (;;) {
            const { done, value: chunk } = await iterator.next()
            if (done) break
            const delta = chunk.choices[0]?.delta?.content || ""
            bytes += Buffer.byteLength(delta, "utf8")
            const receipt = receiptFor(recipe, chunk.usage || usage, chunk.model || model)
            if (bytes > PROFILE_IMPORT_POLICY.maxResponseBytes) {
                throw new ProfileImportInvalidError("Provider returned an oversized response.", receipt)
            }
            text += delta
            if (chunk.usage) usage = chunk.usage
            if (chunk.model) model = chunk.model
        }
    } finally {
        await iterator.return?.().catch(() => {})
    }
    return { text: checkLength(text, receiptFor(recipe, usage, model)), receipt: receiptFor(recipe, usage, model) }
}

export async function runProfileImportModel(recipe: ApiRecipe, evidence: ProfileImportEvidence[]): Promise<ProfileImportResult> {
    const messages = [{ role: "system" as const, content: PROFILE_IMPORT_PROMPT }, { role: "user" as const, content: JSON.stringify({ sources: evidence }) }]
    if (Buffer.byteLength(JSON.stringify(messages), "utf8") > PROFILE_IMPORT_POLICY.maxRequestBytes) {
        throw Object.assign(new Error("Source material is too large to import."), { providerNotDispatched: true })
    }
    const signal = AbortSignal.timeout(PROFILE_IMPORT_POLICY.providerTimeoutMs)
    const { text, receipt } = await dispatch(recipe, messages, signal)
    let parsed: unknown
    try { parsed = JSON.parse(text) } catch {
        throw new ProfileImportInvalidError("Provider returned malformed JSON.", receipt)
    }
    const strict = profileBlueprintSchema.safeParse(parsed)
    if (!strict.success) throw new ProfileImportInvalidError("Provider returned an invalid profile draft.", receipt)
    try {
        return { blueprint: validateBlueprint(strict.data, evidence), receipt }
    } catch (error) {
        throw new ProfileImportInvalidError(error instanceof Error ? error.message : "Provider returned an invalid profile draft.", receipt)
    }
}

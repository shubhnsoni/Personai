import type OpenAI from "openai"
import {
    CodexAuthError,
    loadCodexCredentials,
    refreshCodexCredentials,
    type CodexCredentials,
} from "@/lib/codex-auth"

const CODEX_RESPONSES_URL = "https://chatgpt.com/backend-api/codex/responses"
const CODEX_ORIGINATOR = "codex_cli_rs"
export const DEFAULT_CODEX_MODEL = "gpt-5.6-terra"

type ChatParams = OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming
type ChatChunk = OpenAI.Chat.Completions.ChatCompletionChunk
type ChatMessage = OpenAI.Chat.Completions.ChatCompletionMessageParam

type ResponsesInputItem =
    | { type: "message"; role: "user" | "assistant" | "system" | "developer"; content: string }
    | { type: "function_call"; call_id: string; name: string; arguments: string }
    | { type: "function_call_output"; call_id: string; output: string }

export function mapChatMessagesToCodex(messages: ChatMessage[]) {
    const instructions: string[] = []
    const input: ResponsesInputItem[] = []
    for (const message of messages) {
        if (message.role === "system") {
            const text = textOf(message.content)
            if (text) instructions.push(text)
            continue
        }
        if (message.role === "tool") {
            input.push({
                type: "function_call_output",
                call_id: message.tool_call_id,
                output: textOf(message.content),
            })
            continue
        }
        if (message.role === "assistant") {
            const toolCalls = "tool_calls" in message ? message.tool_calls : undefined
            if (Array.isArray(toolCalls) && toolCalls.length > 0) {
                for (const call of toolCalls) {
                    if (call.type !== "function") continue
                    input.push({
                        type: "function_call",
                        call_id: call.id,
                        name: call.function.name,
                        arguments: call.function.arguments || "{}",
                    })
                }
                continue
            }
            input.push({ type: "message", role: "assistant", content: textOf(message.content) })
            continue
        }
        if (message.role === "user") {
            input.push({ type: "message", role: "user", content: textOf(message.content) })
        }
    }
    return { instructions: instructions.join("\n\n"), input }
}

export function mapChatToolsToCodex(tools: ChatParams["tools"]) {
    if (!tools?.length) return []
    return tools.flatMap((tool) => {
        if (tool.type !== "function") return []
        return [{
            type: "function" as const,
            name: tool.function.name,
            description: tool.function.description || "",
            strict: false,
            parameters: tool.function.parameters || { type: "object", properties: {} },
        }]
    })
}

function textOf(content: unknown): string {
    if (typeof content === "string") return content
    if (Array.isArray(content)) {
        return content.map((part) => {
            if (typeof part === "string") return part
            if (part && typeof part === "object" && "text" in part) return String((part as { text?: unknown }).text || "")
            return ""
        }).join("")
    }
    return ""
}

function chunk(model: string, delta: ChatChunk["choices"][0]["delta"], finish: ChatChunk["choices"][0]["finish_reason"] = null): ChatChunk {
    return {
        id: "codex",
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model,
        choices: [{ index: 0, delta, finish_reason: finish, logprobs: null }],
    }
}

function headersFor(credentials: CodexCredentials) {
    const headers: Record<string, string> = {
        Authorization: `Bearer ${credentials.accessToken}`,
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        originator: CODEX_ORIGINATOR,
        "User-Agent": CODEX_ORIGINATOR,
    }
    if (credentials.accountId) headers["chatgpt-account-id"] = credentials.accountId
    return headers
}

export async function streamCodexChat(input: ChatParams): Promise<AsyncIterable<ChatChunk>> {
    const model = (typeof input.model === "string" && input.model.trim()) || DEFAULT_CODEX_MODEL
    const mapped = mapChatMessagesToCodex(input.messages)
    const payload = {
        model,
        instructions: mapped.instructions,
        input: mapped.input,
        tools: mapChatToolsToCodex(input.tools),
        tool_choice: "auto",
        parallel_tool_calls: true,
        store: false,
        stream: true,
        include: ["reasoning.encrypted_content"],
        reasoning: { effort: "low", summary: "auto" },
    }

    let credentials = await loadCodexCredentials()
    let response = await fetch(CODEX_RESPONSES_URL, {
        method: "POST",
        headers: headersFor(credentials),
        body: JSON.stringify(payload),
    })
    if (response.status === 401) {
        credentials = await refreshCodexCredentials(credentials)
        response = await fetch(CODEX_RESPONSES_URL, {
            method: "POST",
            headers: headersFor(credentials),
            body: JSON.stringify(payload),
        })
    }
    if (!response.ok || !response.body) {
        const detail = await response.text().catch(() => "")
        throw new CodexAuthError(`Codex chat failed (HTTP ${response.status})${detail ? `: ${detail.slice(0, 240)}` : ""}`)
    }

    return parseCodexSse(response.body, model)
}

async function* parseCodexSse(body: ReadableStream<Uint8Array>, model: string): AsyncIterable<ChatChunk> {
    const reader = body.getReader()
    const decoder = new TextDecoder()
    let buffer = ""
    const tools = new Map<string, { index: number; id: string; name: string }>()
    try {
        while (true) {
            const { done, value } = await reader.read()
            if (done) break
            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split(/\r?\n/)
            buffer = lines.pop() || ""
            for (const line of lines) {
                if (!line.startsWith("data:")) continue
                const data = line.slice(5).trim()
                if (!data || data === "[DONE]") continue
                let event: Record<string, unknown>
                try {
                    event = JSON.parse(data) as Record<string, unknown>
                } catch {
                    continue
                }
                const type = String(event.type || "")
                if (type === "error" || type === "response.failed" || type === "response.incomplete") {
                    // Upstream bodies may contain account details. Keep the stream error generic.
                    throw new CodexAuthError(type === "response.incomplete"
                        ? "Codex chat ended before completing a response."
                        : "Codex chat could not complete the response.")
                }
                if (type === "response.output_text.delta") {
                    const delta = String(event.delta || "")
                    if (delta) yield chunk(model, { content: delta })
                    continue
                }
                if (type === "response.output_item.added") {
                    const item = event.item && typeof event.item === "object" ? event.item as Record<string, unknown> : null
                    if (item?.type === "function_call") {
                        const callId = String(item.call_id || item.id || `call_${tools.size}`)
                        const name = String(item.name || "")
                        const index = tools.size
                        tools.set(String(item.id || callId), { index, id: callId, name })
                        yield chunk(model, {
                            tool_calls: [{
                                index,
                                id: callId,
                                type: "function",
                                function: { name, arguments: "" },
                            }],
                        })
                    }
                    continue
                }
                if (type === "response.function_call_arguments.delta") {
                    const key = String(event.item_id || "")
                    const fragment = String(event.delta || "")
                    const tool = tools.get(key)
                    if (tool && fragment) {
                        yield chunk(model, {
                            tool_calls: [{
                                index: tool.index,
                                id: tool.id,
                                type: "function",
                                function: { arguments: fragment },
                            }],
                        })
                    }
                }
            }
        }
    } finally {
        reader.releaseLock()
    }
}

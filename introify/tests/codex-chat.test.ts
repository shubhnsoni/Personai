import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { accountIdFromTokens, readCodexCredentialsFromObject } from "@/lib/codex-auth"
import { mapChatMessagesToCodex, mapChatToolsToCodex } from "@/lib/codex-chat"
import { resolveChatModel, resolveLlm } from "@/lib/llm"

describe("Codex credentials", () => {
    it("reads ChatGPT tokens and account id from auth.json", () => {
        const creds = readCodexCredentialsFromObject({
            auth_mode: "chatgpt",
            tokens: {
                access_token: "access-1",
                refresh_token: "refresh-1",
                account_id: "acct-9",
            },
        })
        expect(creds.accessToken).toBe("access-1")
        expect(creds.refreshToken).toBe("refresh-1")
        expect(creds.accountId).toBe("acct-9")
    })

    it("pulls chatgpt_account_id from the JWT auth claim", () => {
        const payload = Buffer.from(JSON.stringify({
            "https://api.openai.com/auth": { chatgpt_account_id: "jwt-acct" },
        })).toString("base64url")
        const token = `aaa.${payload}.sig`
        expect(accountIdFromTokens({ access_token: token })).toBe("jwt-acct")
    })
})

describe("Codex chat mapping", () => {
    it("lifts system text into instructions and keeps tool follow-ups", () => {
        const mapped = mapChatMessagesToCodex([
            { role: "system", content: "You are the shop." },
            { role: "user", content: "price?" },
            {
                role: "assistant",
                content: null,
                tool_calls: [{
                    id: "call_1",
                    type: "function",
                    function: { name: "showServices", arguments: "{}" },
                }],
            },
            { role: "tool", tool_call_id: "call_1", content: "no services" },
        ])
        expect(mapped.instructions).toBe("You are the shop.")
        expect(mapped.input[0]).toEqual({ type: "message", role: "user", content: "price?" })
        expect(mapped.input[1]).toMatchObject({ type: "function_call", call_id: "call_1", name: "showServices" })
        expect(mapped.input[2]).toEqual({ type: "function_call_output", call_id: "call_1", output: "no services" })
    })

    it("flattens chat tools for the Codex responses payload", () => {
        const tools = mapChatToolsToCodex([
            {
                type: "function",
                function: {
                    name: "collectLead",
                    description: "Save a lead",
                    parameters: { type: "object", properties: { email: { type: "string" } } },
                },
            },
        ])
        expect(tools[0]).toMatchObject({ type: "function", name: "collectLead", strict: false })
    })
})

describe("Codex model routing", () => {
    const previousHome = process.env.CODEX_HOME
    const previousDisabled = process.env.CODEX_DISABLED

    afterEach(() => {
        if (previousHome === undefined) delete process.env.CODEX_HOME
        else process.env.CODEX_HOME = previousHome
        if (previousDisabled === undefined) delete process.env.CODEX_DISABLED
        else process.env.CODEX_DISABLED = previousDisabled
    })

    it("prefers Codex when ~/.codex/auth.json is present", () => {
        const dir = mkdtempSync(join(tmpdir(), "codex-home-"))
        mkdirSync(dir, { recursive: true })
        writeFileSync(join(dir, "auth.json"), JSON.stringify({
            tokens: { access_token: "access-1", account_id: "acct-1" },
        }))
        process.env.CODEX_HOME = dir
        delete process.env.CODEX_DISABLED
        const provider = resolveLlm()
        expect(provider?.kind).toBe("codex")
        expect(resolveChatModel("gpt-4o-mini", provider!)).toBe(provider!.defaultModel)
        expect(resolveChatModel("gpt-5.6-sol", provider!)).toBe("gpt-5.6-sol")
    })
})

// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest"
import { Prisma } from "@prisma/client"

const mocks = vi.hoisted(() => ({
    completion: vi.fn(),
    responsesCreate: vi.fn(),
    codexStream: vi.fn(),
    reserve: vi.fn(),
    settle: vi.fn(),
    jobFind: vi.fn(),
    jobCreate: vi.fn(),
    jobUpdate: vi.fn(),
    jobUpdateMany: vi.fn(),
    collect: vi.fn(),
}))

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/prisma", () => ({
    prisma: {
        profileImportJob: { findUnique: mocks.jobFind, create: mocks.jobCreate, update: mocks.jobUpdate, updateMany: mocks.jobUpdateMany },
        billingAccount: { findUnique: vi.fn() },
    },
}))
vi.mock("@/lib/security", () => ({
    requireProfileAccess: vi.fn(async () => ({ ok: true, value: { actor: { userId: "user-1" }, profile: { id: "prof-1", billingAccountId: "acct-1" } } })),
    requireAuthenticatedUser: vi.fn(async () => ({ ok: true, value: { userId: "user-1", profiles: [] } })),
    unwrapOwnershipResult: (r: { ok: boolean; value?: unknown; refusal?: { message: string } }) => { if (!r.ok) throw new Error(r.refusal?.message); return r.value },
}))
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: vi.fn(() => ({ allowed: true })) }))
vi.mock("@/lib/billing/service", () => ({
    billingTransaction: async (work: (tx: unknown) => Promise<unknown>) => work({ profileImportJob: { update: mocks.jobUpdate, updateMany: mocks.jobUpdateMany, findUniqueOrThrow: mocks.jobFind } }),
    reserveUsageInTransaction: mocks.reserve,
    settleUsageInTransaction: mocks.settle,
    reserveUsage: vi.fn(),
    settleUsage: vi.fn(),
    getProfileBilling: vi.fn(async () => ({ accountId: "acct-1" })),
    ensureDefaultBillingAccount: vi.fn(async () => ({ id: "acct-1", ownerUserId: "user-1" })),
    lockBillingAccount: vi.fn(),
}))
vi.mock("@/lib/profile-import-sources", async original => ({
    ...await original<typeof import("@/lib/profile-import-sources")>(),
    collectProfileSources: mocks.collect,
}))
const recipe = { mode: "fast" as const, provider: "openai" as const, model: "gpt-4o-mini", inputBudget: 2000, outputBudget: 500, inputUsdPerMillion: null, outputUsdPerMillion: null }
vi.mock("@/lib/ai-runtime", async original => ({
    ...await original<typeof import("@/lib/ai-runtime")>(),
    resolveApiRecipe: vi.fn(() => recipe),
    apiClient: () => ({ chat: { completions: { create: mocks.completion } }, responses: { create: mocks.responsesCreate } }),
    boundedCodexChatStream: mocks.codexStream,
}))

import { runProfileImportModel, ProfileImportInvalidError, profileImportRecipe } from "@/lib/profile-import-model"
import { generateProfileImport, getProfileImport } from "@/app/actions/profile-import"
import type { ProfileBlueprint } from "@/lib/profile-import-contract"

const blueprint: ProfileBlueprint = {
    version: 1,
    profile: { displayName: "Ada", headline: "Engineer", bio: "Builds things.", welcome: "Hi!", sourceIds: ["s1"] },
    needId: "time",
    addons: ["services"],
    socials: [],
    experiences: [{ company: "Acme", role: "Eng", startDate: "2020", endDate: null, description: "Did work.", sourceIds: ["s1"] }],
    projects: [],
    services: [{ title: "Call", description: "A call.", durationMinutes: 30, price: null, currency: "USD", basis: "suggested", sourceIds: ["s1"] }],
    products: [],
    knowledge: [{ title: "Notes", body: "Real notes.", visibility: "PUBLIC", basis: "sourced", sourceIds: ["s1"] }],
    introductions: [],
    frameworks: [],
    missingInformation: [],
}

const evidence = [{ id: "s1", url: "https://ada.dev/", text: "evidence text" }]
const input = { requestId: "11111111-2222-3333-4444-555555555555", links: ["https://ada.dev"], text: "", discover: false }
const context = { profileId: "prof-1" }

function jobRow(over: Record<string, unknown> = {}) {
    return {
        id: "job-1", ownerUserId: "user-1", billingAccountId: "acct-1", targetProfileId: "prof-1",
        requestId: input.requestId, inputHash: "hash", status: "READY", draft: blueprint,
        sources: [], warnings: [], error: null, appliedProfileId: null, appliedSlug: null,
        reservationId: "res-1", expiresAt: new Date(Date.now() + 86400_000), ...over,
    }
}

beforeEach(() => {
    vi.clearAllMocks()
    mocks.collect.mockResolvedValue({ sources: [{ id: "s1", label: "ada.dev", url: "https://ada.dev/", status: "read", discoveredFrom: null, warning: null }], evidence, warnings: [] })
    mocks.jobCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => jobRow({ status: "PENDING", ...data }))
    mocks.jobUpdate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => jobRow(data as Record<string, unknown>))
    mocks.jobUpdateMany.mockResolvedValue({ count: 1 })
    mocks.reserve.mockResolvedValue({ id: "res-1", state: "RESERVED", created: true })
    mocks.completion.mockResolvedValue({ model: recipe.model, choices: [{ message: { content: JSON.stringify(blueprint) }, finish_reason: "stop" }], usage: { prompt_tokens: 300, completion_tokens: 120 } })
})

describe("runProfileImportModel", () => {
    it("sends the lead prompt plus all evidence and parses a strict blueprint", async () => {
        const result = await runProfileImportModel(profileImportRecipe(recipe), evidence)
        expect(result.blueprint.profile.displayName).toBe("Ada")
        const sent = mocks.completion.mock.calls[0][0]
        expect(sent.response_format).toEqual({ type: "json_object" })
        expect(sent.max_completion_tokens).toBe(7000)
        expect(mocks.completion.mock.calls[0][1]).toMatchObject({ timeout: 90_000 })
        expect(Buffer.byteLength(JSON.stringify(sent.messages))).toBeLessThanOrEqual(64_000)
        expect(sent.messages[1].content).toContain("evidence text")
        expect(result.receipt.outputTokens).toBe(120)
    })

    it("keeps the tail of long evidence in the model input", async () => {
        const long = [{ id: "s1", url: null, text: `${"x".repeat(1500)}ENDMARKER-7f3a` }]
        await runProfileImportModel(profileImportRecipe(recipe), long)
        expect(mocks.completion.mock.calls[0][0].messages[1].content).toContain("ENDMARKER-7f3a")
    })

    it("rejects malformed JSON, schema violations and truncated finishes", async () => {
        mocks.completion.mockResolvedValue({ model: recipe.model, choices: [{ message: { content: "not json" }, finish_reason: "stop" }], usage: { prompt_tokens: 1, completion_tokens: 1 } })
        await expect(runProfileImportModel(profileImportRecipe(recipe), evidence)).rejects.toBeInstanceOf(ProfileImportInvalidError)
        mocks.completion.mockResolvedValue({ model: recipe.model, choices: [{ message: { content: JSON.stringify({ ...blueprint, needId: "bogus" }) }, finish_reason: "stop" }], usage: {} })
        await expect(runProfileImportModel(profileImportRecipe(recipe), evidence)).rejects.toBeInstanceOf(ProfileImportInvalidError)
        mocks.completion.mockResolvedValue({ model: recipe.model, choices: [{ message: { content: JSON.stringify(blueprint) }, finish_reason: "length" }], usage: {} })
        await expect(runProfileImportModel(profileImportRecipe(recipe), evidence)).rejects.toBeInstanceOf(ProfileImportInvalidError)
    })

    it("rejects fabricated source ids and social urls not bound to their source", async () => {
        const badRefs = { ...blueprint, profile: { ...blueprint.profile, sourceIds: ["s9"] } }
        mocks.completion.mockResolvedValue({ model: recipe.model, choices: [{ message: { content: JSON.stringify(badRefs) }, finish_reason: "stop" }] })
        await expect(runProfileImportModel(profileImportRecipe(recipe), evidence)).rejects.toBeInstanceOf(ProfileImportInvalidError)
        const invented = { ...blueprint, socials: [{ label: "X", url: "https://x.com/someone-else", sourceIds: ["s1"] }] }
        mocks.completion.mockResolvedValue({ model: recipe.model, choices: [{ message: { content: JSON.stringify(invented) }, finish_reason: "stop" }] })
        await expect(runProfileImportModel(profileImportRecipe(recipe), evidence)).rejects.toBeInstanceOf(ProfileImportInvalidError)

        const twoSources = [{ id: "s1", url: "https://ada.dev/", text: "about ada" }, { id: "s2", url: null, text: "find me at https://github.com/ada" }]
        const miscited = { ...blueprint, socials: [{ label: "GitHub", url: "https://github.com/ada", sourceIds: ["s1"] }] }
        mocks.completion.mockResolvedValue({ model: recipe.model, choices: [{ message: { content: JSON.stringify(miscited) }, finish_reason: "stop" }] })
        await expect(runProfileImportModel(profileImportRecipe(recipe), twoSources)).rejects.toBeInstanceOf(ProfileImportInvalidError)
        const bound = { ...blueprint, socials: [{ label: "GitHub", url: "https://github.com/ada", sourceIds: ["s2"] }] }
        mocks.completion.mockResolvedValue({ model: recipe.model, choices: [{ message: { content: JSON.stringify(bound) }, finish_reason: "stop" }] })
        const ok = await runProfileImportModel(profileImportRecipe(recipe), twoSources)
        expect(ok.blueprint.socials[0].url).toBe("https://github.com/ada")
    })

    it("runs the xAI responses branch with its own budget and status check", async () => {
        mocks.responsesCreate.mockResolvedValue({
            model: "grok-x", status: "completed",
            output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(blueprint) }] }],
            usage: { input_tokens: 200, output_tokens: 80 },
        })
        const result = await runProfileImportModel(profileImportRecipe({ ...recipe, provider: "xai", model: "grok-x" }), evidence)
        expect(mocks.responsesCreate).toHaveBeenCalledWith(expect.objectContaining({ max_output_tokens: 7000, store: false, stream: false }), expect.objectContaining({ timeout: 90_000 }))
        expect(result.receipt.returnedModel).toBe("grok-x")
        mocks.responsesCreate.mockResolvedValue({ model: "grok-x", status: "incomplete", output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(blueprint) }] }], usage: {} })
        await expect(runProfileImportModel(profileImportRecipe({ ...recipe, provider: "xai", model: "grok-x" }), evidence)).rejects.toBeInstanceOf(ProfileImportInvalidError)
    })

    it("runs the Codex stream branch and treats oversized output as known-invalid", async () => {
        async function* chunks(parts: string[], usage?: unknown) {
            for (const part of parts) yield { model: "codex-x", choices: [{ delta: { content: part } }] }
            yield { model: "codex-x", choices: [{}], usage: usage || { prompt_tokens: 50, completion_tokens: 20 } }
        }
        mocks.codexStream.mockResolvedValue(chunks([JSON.stringify(blueprint)]))
        const result = await runProfileImportModel(profileImportRecipe({ ...recipe, provider: "codex", model: "codex-x" }), evidence)
        expect(result.blueprint.profile.displayName).toBe("Ada")
        expect(result.receipt.outputTokens).toBe(20)

        mocks.codexStream.mockResolvedValue(chunks(["y".repeat(100_500)]))
        try {
            await runProfileImportModel(profileImportRecipe({ ...recipe, provider: "codex", model: "codex-x" }), evidence)
            expect.unreachable()
        } catch (error) {
            expect(error).toBeInstanceOf(ProfileImportInvalidError)
            expect((error as { status?: number }).status).not.toBe(413)
        }
    })
})

describe("generateProfileImport metering", () => {
    it("reserves exactly 10 AI credits once, consumes on READY, and replays idempotently", async () => {
        mocks.jobFind.mockResolvedValue(null)
        const preview = await generateProfileImport(context, input)
        expect(preview.status).toBe("READY")
        expect(mocks.reserve).toHaveBeenCalledTimes(1)
        expect(mocks.reserve.mock.calls[0][1]).toMatchObject({ unit: "AI", amount: 10, profileId: "prof-1", metadata: expect.objectContaining({ operation: "PROFILE_IMPORT" }) })
        expect(mocks.settle).toHaveBeenCalledWith(expect.anything(), "res-1", "CONSUME", expect.objectContaining({ outputTokens: 120 }))
        const createdHash = (mocks.jobCreate.mock.calls[0][0] as { data: { inputHash: string } }).data.inputHash
        mocks.jobFind.mockResolvedValue(jobRow({ inputHash: createdHash }))
        const replay = await generateProfileImport(context, input)
        expect(replay.id).toBe("job-1")
        expect(mocks.reserve).toHaveBeenCalledTimes(1)
        expect(mocks.completion).toHaveBeenCalledTimes(1)
    })

    it("rejects the same requestId with different input and never charges", async () => {
        mocks.jobFind.mockResolvedValue(jobRow({ inputHash: "other" }))
        await expect(generateProfileImport(context, input)).rejects.toThrow(/different input/i)
        expect(mocks.reserve).not.toHaveBeenCalled()
    })

    it("rejects a requestId reused under a different target context", async () => {
        mocks.jobFind.mockResolvedValue(jobRow({ targetProfileId: null }))
        await expect(generateProfileImport(context, input)).rejects.toThrow(/already used elsewhere/i)
        expect(mocks.reserve).not.toHaveBeenCalled()
    })

    it("rejects oversized input before a job row or hash exists", async () => {
        await expect(generateProfileImport(context, { ...input, text: "x".repeat(100_001) })).rejects.toThrow(/at most/)
        expect(mocks.jobCreate).not.toHaveBeenCalled()
        await expect(generateProfileImport(context, { ...input, requestId: "req-not-uuid" })).rejects.toThrow(/invalid/i)
        expect(mocks.jobCreate).not.toHaveBeenCalled()
    })

    it("reloads and replays the winner when a concurrent create hits P2002", async () => {
        mocks.jobFind.mockResolvedValue(null)
        mocks.jobCreate.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError("unique", { code: "P2002", clientVersion: "5.22.0" }))
        mocks.jobFind.mockResolvedValueOnce(null).mockResolvedValue(jobRow({ status: "READY", inputHash: "any" }))

        await expect(generateProfileImport(context, input)).rejects.toThrow(/different input/i)
        expect(mocks.reserve).not.toHaveBeenCalled()
    })

    it("refuses to dispatch when the reservation did not land as RESERVED", async () => {
        mocks.jobFind.mockResolvedValue(null)
        mocks.reserve.mockResolvedValue({ id: "res-1", state: "RESERVED", created: false })
        await expect(generateProfileImport(context, input)).rejects.toThrow(/already received/i)
        expect(mocks.completion).not.toHaveBeenCalled()
    })

    it("releases a known-zero reservation when persisting its id fails pre-dispatch", async () => {
        mocks.jobFind.mockResolvedValue(null)
        mocks.jobUpdate.mockRejectedValueOnce(new Error("db down"))
        await expect(generateProfileImport(context, input)).rejects.toThrow(/not charged/i)
        expect(mocks.settle).toHaveBeenCalledWith(expect.anything(), "res-1", "RELEASE", expect.objectContaining({ reason: "reservation_unpersisted" }))
        expect(mocks.completion).not.toHaveBeenCalled()
    })

    it("releases the reservation with a receipt on known-invalid output", async () => {
        mocks.jobFind.mockResolvedValue(null)
        mocks.completion.mockResolvedValue({ model: recipe.model, choices: [{ message: { content: "garbage" }, finish_reason: "stop" }], usage: { prompt_tokens: 10, completion_tokens: 5 } })
        await expect(generateProfileImport(context, input)).rejects.toThrow(/could not be used/i)
        expect(mocks.settle).toHaveBeenCalledWith(expect.anything(), "res-1", "RELEASE", expect.objectContaining({ reason: "invalid_structured_output", outputTokens: 5 }))
    })

    it("holds the reservation on unknown timeout and does not retry", async () => {
        mocks.jobFind.mockResolvedValue(null)
        mocks.completion.mockRejectedValue(new Error("request timed out"))
        await expect(generateProfileImport(context, input)).rejects.toThrow(/pending reconciliation/i)
        expect(mocks.settle).not.toHaveBeenCalled()
        expect(mocks.completion).toHaveBeenCalledTimes(1)
    })

    it("fails without a reservation when no source is usable", async () => {
        mocks.jobFind.mockResolvedValue(null)
        mocks.collect.mockRejectedValue(new Error("No readable source material."))
        await expect(generateProfileImport(context, input)).rejects.toThrow(/No readable source/i)
        expect(mocks.reserve).not.toHaveBeenCalled()
        expect(mocks.completion).not.toHaveBeenCalled()
    })

    it("scopes getProfileImport to the exact owner/account/target and TTL", async () => {
        mocks.jobFind.mockResolvedValue(jobRow({ targetProfileId: "prof-1" }))
        expect((await getProfileImport(context, "job-1"))?.id).toBe("job-1")
        mocks.jobFind.mockResolvedValue(jobRow({ targetProfileId: null }))
        expect(await getProfileImport(context, "job-1")).toBeNull()
        mocks.jobFind.mockResolvedValue(jobRow({ billingAccountId: "acct-2" }))
        expect(await getProfileImport(context, "job-1")).toBeNull()
        mocks.jobFind.mockResolvedValue(jobRow({ expiresAt: new Date(Date.now() - 1000) }))
        expect(await getProfileImport(context, "job-1")).toBeNull()
    })

    it("keeps the legacy chat recipe budgets unchanged", () => {
        expect(recipe.inputBudget).toBe(2000)
        expect(recipe.outputBudget).toBe(500)
        const cloned = profileImportRecipe(recipe)
        expect(cloned).toMatchObject({ inputBudget: 48_000, outputBudget: 7_000 })
        expect(recipe.outputBudget).toBe(500)
    })
})

import { randomUUID } from "node:crypto"
import type OpenAI from "openai"
import type { Member, Prisma } from "@prisma/client"
import { assertDisposableTarget } from "../lib/disposable-db"
import { prisma } from "../../src/lib/prisma"
import { createNotification } from "../../src/lib/notifications"
import { notifyOwnerLive } from "../../src/app/actions/inbox"
import {
    CONVERSATION_CAPABILITY_TTL_SECONDS,
    conversationCapabilityCookieName,
    createChatPostHandler,
    issueConversationCapability,
} from "../../src/app/api/chat/route"
import { createLivePostHandler } from "../../src/app/api/live/route"

const REQUIRED_DATABASE = "personalink_phase0_rehearsal_20260826_210704"
const TEST_CAPABILITY_KEY = "deterministic-test-key-with-no-production-value"
const TEST_NOW = Date.UTC(2026, 7, 28, 3, 0, 0)
const ROLLBACK = Symbol("lane-d-deterministic-rollback")
const HARD_TIMEOUT_MS = 150_000
const ROUTE_READ_TIMEOUT_MS = 10_000
const invert = process.env.INVERT_ASSERTION === "1"
const failures: string[] = []
const checks: string[] = []

function check(name: string, condition: unknown, central = false): void {
    checks.push(name)
    const passed = central && invert ? !condition : Boolean(condition)
    if (!passed) failures.push(name)
}

function jsonRequest(path: string, body: unknown, cookie = "", signal?: AbortSignal): Request {
    const headers = new Headers({ "content-type": "application/json" })
    if (cookie) headers.set("cookie", cookie)
    return new Request(`http://lane-d.invalid${path}`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal,
    })
}

async function responseSnapshot(response: Response): Promise<{ status: number; body: string }> {
    if (!response.body) return { status: response.status, body: "" }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    const chunks: string[] = []
    const deadline = Date.now() + ROUTE_READ_TIMEOUT_MS
    try {
        while (true) {
            const remaining = deadline - Date.now()
            if (remaining <= 0) throw new Error("Route response stream exceeded 10 seconds")
            let timer: ReturnType<typeof setTimeout> | undefined
            const result = await Promise.race([
                reader.read(),
                new Promise<never>((_, reject) => {
                    timer = setTimeout(() => reject(new Error("Route response stream exceeded 10 seconds")), remaining)
                }),
            ]).finally(() => {
                if (timer) clearTimeout(timer)
            })
            if (result.done) break
            chunks.push(decoder.decode(result.value, { stream: true }))
        }
        chunks.push(decoder.decode())
        return { status: response.status, body: chunks.join("") }
    } finally {
        await reader.cancel().catch(() => undefined)
        reader.releaseLock()
    }
}

function setCookieLines(response: Response): string[] {
    const headers = response.headers as Headers & { getSetCookie?: () => string[] }
    const direct = headers.getSetCookie?.()
    if (direct && direct.length > 0) return direct
    const combined = response.headers.get("set-cookie")
    return combined ? combined.split(/,\s*(?=[^;,]+=)/u) : []
}

function applyResponseCookies(response: Response, jar: Map<string, string>): void {
    for (const line of setCookieLines(response)) {
        const first = line.split(";", 1)[0]
        const separator = first.indexOf("=")
        if (separator < 1) continue
        jar.set(first.slice(0, separator), decodeURIComponent(first.slice(separator + 1)))
    }
}

function cookieHeader(jar: Map<string, string>): string {
    return [...jar].map(([name, value]) => `${name}=${encodeURIComponent(value)}`).join("; ")
}

function fakeCompletionStream(text = "stubbed route reply"): AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk> {
    return {
        async *[Symbol.asyncIterator]() {
            yield {
                id: "lane-d-stub",
                object: "chat.completion.chunk",
                created: Math.floor(TEST_NOW / 1000),
                model: "stubbed-model",
                choices: [{
                    index: 0,
                    delta: { role: "assistant", content: text },
                    finish_reason: "stop",
                    logprobs: null,
                }],
            }
        },
    }
}

type StateSnapshot = Readonly<{
    conversations: unknown[]
    messages: number
    events: number
}>

async function stateSnapshot(tx: Prisma.TransactionClient, profileIds: string[]): Promise<StateSnapshot> {
    const conversations = await tx.conversation.findMany({
        where: { profileId: { in: profileIds } },
        orderBy: { id: "asc" },
        select: {
            id: true,
            profileId: true,
            visitorId: true,
            visitorName: true,
            visitorEmail: true,
            memberId: true,
            mode: true,
            liveRequestedAt: true,
            liveRespondedAt: true,
            lastMessageAt: true,
        },
    })
    const [messages, events] = await Promise.all([
        tx.message.count({ where: { conversation: { profileId: { in: profileIds } } } }),
        tx.profileEvent.count({ where: { profileId: { in: profileIds } } }),
    ])
    return { conversations, messages, events }
}

function unchanged(before: StateSnapshot, after: StateSnapshot): boolean {
    return JSON.stringify(before) === JSON.stringify(after)
}

async function main(): Promise<void> {
    const target = assertDisposableTarget(process.env.DATABASE_URL)
    if (target !== REQUIRED_DATABASE) {
        throw new Error(`Refusing non-mandated rehearsal target: ${target}`)
    }

    const run = randomUUID().replaceAll("-", "")
    const ids = {
        user: `lane_d_user_${run}`,
        profileA: `lane_d_profile_a_${run}`,
        profileB: `lane_d_profile_b_${run}`,
        memberA: `lane_d_member_a_${run}`,
        memberB: `lane_d_member_b_${run}`,
        memberConversation: `lane_d_member_conversation_${run}`,
        wrongMemberConversation: `lane_d_wrong_member_conversation_${run}`,
        foreignVisitorConversation: `lane_d_foreign_visitor_${run}`,
    }

    let providerCalls = 0
    let retrievalCalls = 0
    let currentMember: Member | null = null

    try {
        await prisma.$transaction(async (tx) => {
            const user = await tx.user.create({
                data: {
                    id: ids.user,
                    clerkId: `lane_d_clerk_${run}`,
                    email: `lane-d-owner-${run}@example.invalid`,
                    name: "Lane D owner",
                },
            })
            await tx.profile.createMany({
                data: [
                    {
                        id: ids.profileA,
                        userId: user.id,
                        slug: `lane-d-a-${run}`,
                        displayName: "Lane D Profile A",
                        isPublic: true,
                        liveChatEnabled: true,
                    },
                    {
                        id: ids.profileB,
                        userId: user.id,
                        slug: `lane-d-b-${run}`,
                        displayName: "Lane D Profile B",
                        isPublic: true,
                        liveChatEnabled: true,
                    },
                ],
            })
            const memberA = await tx.member.create({
                data: {
                    id: ids.memberA,
                    email: `lane-d-member-a-${run}@example.invalid`,
                    name: "Member A",
                },
            })
            const memberB = await tx.member.create({
                data: {
                    id: ids.memberB,
                    email: `lane-d-member-b-${run}@example.invalid`,
                    name: "Member B",
                },
            })
            await tx.conversation.createMany({
                data: [
                    {
                        id: ids.memberConversation,
                        profileId: ids.profileA,
                        memberId: memberA.id,
                        visitorEmail: memberA.email,
                        visitorName: memberA.name,
                    },
                    {
                        id: ids.wrongMemberConversation,
                        profileId: ids.profileA,
                        memberId: memberB.id,
                        visitorEmail: memberB.email,
                        visitorName: memberB.name,
                    },
                    {
                        id: ids.foreignVisitorConversation,
                        profileId: ids.profileA,
                        visitorId: `foreign-visitor-${run}`,
                    },
                ],
            })
            await tx.message.create({
                data: {
                    conversationId: ids.foreignVisitorConversation,
                    senderType: "AI",
                    role: "assistant",
                    text: `private-history-${run}`,
                },
            })

            const chatPost = createChatPostHandler({
                db: tx,
                resolveMember: async () => currentMember,
                rateLimit: () => ({ allowed: true, remaining: 99 }),
                retrieve: async () => {
                    retrievalCalls += 1
                    return []
                },
                buildPrompt: () => "stubbed system prompt",
                requestCurrency: async () => "USD",
                createCompletion: async () => {
                    providerCalls += 1
                    return fakeCompletionStream()
                },
                summarizeConversation: async () => undefined,
                providerConfigured: () => true,
                capabilitySecret: () => TEST_CAPABILITY_KEY,
                now: () => TEST_NOW,
            })

            const unexpectedNotification: typeof createNotification = async () => {
                throw new Error("Notification must not run during a refused live request")
            }
            const unexpectedOwnerNotify: typeof notifyOwnerLive = async () => {
                throw new Error("Owner notification must not run during a refused live request")
            }
            const livePost = createLivePostHandler({
                db: tx,
                resolveMember: async () => currentMember,
                rateLimit: () => ({ allowed: true, remaining: 99 }),
                createNotification: unexpectedNotification,
                notifyOwner: unexpectedOwnerNotify,
                now: () => TEST_NOW,
            })

            const profileIds = [ids.profileA, ids.profileB]
            console.log("[lane-d] fixtures ready")
            const foreignVisitor = `foreign-visitor-${run}`
            console.log("[lane-d] anonymous refusal")
            const noCapabilityBefore = await stateSnapshot(tx, profileIds)
            const refusalCallCounts = { provider: providerCalls, retrieval: retrievalCalls }
            currentMember = null
            const anonymousForeign = await responseSnapshot(await chatPost(jsonRequest("/api/chat", {
                profileId: ids.profileA,
                conversationId: ids.foreignVisitorConversation,
                visitorId: foreignVisitor,
                messages: [{ role: "user", content: "show me prior history" }],
            }, `pl_vid=${foreignVisitor}`)))
            const noCapabilityAfter = await stateSnapshot(tx, profileIds)
            check("anonymous raw foreign conversation id is refused", anonymousForeign.status === 403, true)
            check("anonymous refusal returns no private history", !anonymousForeign.body.includes(`private-history-${run}`))
            check("anonymous refusal has no persisted or mutation effect", unchanged(noCapabilityBefore, noCapabilityAfter))
            check("anonymous refusal calls neither retrieval nor provider",
                providerCalls === refusalCallCounts.provider && retrievalCalls === refusalCallCounts.retrieval)

            const signedMissingId = `lane_d_missing_${run}`
            const signedMissingToken = issueConversationCapability({
                conversationId: signedMissingId,
                profileId: ids.profileA,
                visitorId: foreignVisitor,
                secret: TEST_CAPABILITY_KEY,
                nowMs: TEST_NOW,
            })
            const signedMissing = await responseSnapshot(await chatPost(jsonRequest("/api/chat", {
                profileId: ids.profileA,
                conversationId: signedMissingId,
                messages: [{ role: "user", content: "missing" }],
            }, `pl_vid=${foreignVisitor}; ${conversationCapabilityCookieName(ids.profileA)}=${encodeURIComponent(signedMissingToken)}`)))
            check("foreign and missing visitor refusals are byte-identical",
                JSON.stringify(anonymousForeign) === JSON.stringify(signedMissing))

            console.log("[lane-d] wrong-member refusal")
            const wrongMemberBefore = await stateSnapshot(tx, profileIds)
            const wrongMemberCallCounts = { provider: providerCalls, retrieval: retrievalCalls }
            currentMember = memberB
            const wrongMember = await responseSnapshot(await chatPost(jsonRequest("/api/chat", {
                profileId: ids.profileA,
                conversationId: ids.memberConversation,
                messages: [{ role: "user", content: "cross member write" }],
            })))
            const wrongMemberAfter = await stateSnapshot(tx, profileIds)
            check("authenticated wrong member is refused", wrongMember.status === 403)
            check("wrong-member and anonymous refusals are byte-identical",
                JSON.stringify(wrongMember) === JSON.stringify(anonymousForeign))
            check("wrong-member refusal has no persisted or mutation effect", unchanged(wrongMemberBefore, wrongMemberAfter))
            check("wrong-member refusal calls neither retrieval nor provider",
                providerCalls === wrongMemberCallCounts.provider && retrievalCalls === wrongMemberCallCounts.retrieval)

            console.log("[lane-d] cross-profile refusal")
            const profileAToken = issueConversationCapability({
                conversationId: ids.foreignVisitorConversation,
                profileId: ids.profileA,
                visitorId: foreignVisitor,
                secret: TEST_CAPABILITY_KEY,
                nowMs: TEST_NOW,
            })
            const crossProfileBefore = await stateSnapshot(tx, profileIds)
            currentMember = null
            const crossProfile = await responseSnapshot(await chatPost(jsonRequest("/api/chat", {
                profileId: ids.profileB,
                conversationId: ids.foreignVisitorConversation,
                messages: [{ role: "user", content: "reuse against profile B" }],
            }, `pl_vid=${foreignVisitor}; ${conversationCapabilityCookieName(ids.profileB)}=${encodeURIComponent(profileAToken)}`)))
            const crossProfileAfter = await stateSnapshot(tx, profileIds)
            check("profile A conversation id is unusable against profile B", crossProfile.status === 403)
            check("cross-profile refusal is non-enumerating", JSON.stringify(crossProfile) === JSON.stringify(anonymousForeign))
            check("cross-profile refusal has no persisted or mutation effect", unchanged(crossProfileBefore, crossProfileAfter))

            console.log("[lane-d] valid member")
            currentMember = memberA
            const memberMessageCount = await tx.message.count({ where: { conversationId: ids.memberConversation } })
            const validMemberResponse = await chatPost(jsonRequest("/api/chat", {
                profileId: ids.profileA,
                conversationId: ids.memberConversation,
                messages: [{ role: "user", content: "valid member request" }],
            }))
            const validMember = await responseSnapshot(validMemberResponse)
            const memberMessageCountAfter = await tx.message.count({ where: { conversationId: ids.memberConversation } })
            check("valid member request succeeds", validMember.status === 200)
            check("valid member request persists visitor and stubbed AI messages", memberMessageCountAfter === memberMessageCount + 2)

            console.log("[lane-d] public visitor")
            const publicVisitor = `public-visitor-${run}`
            const visitorJar = new Map<string, string>([["pl_vid", publicVisitor]])
            currentMember = null
            const firstPublicResponse = await chatPost(jsonRequest("/api/chat", {
                profileId: ids.profileA,
                visitorId: publicVisitor,
                messages: [{ role: "user", content: "start public chat" }],
            }, cookieHeader(visitorJar)))
            applyResponseCookies(firstPublicResponse, visitorJar)
            const publicConversationId = firstPublicResponse.headers.get("x-conversation-id")
            const firstPublic = await responseSnapshot(firstPublicResponse)
            check("anonymous public chat creates a conversation", firstPublic.status === 200 && Boolean(publicConversationId))
            check("public chat returns a verified visitor capability cookie",
                visitorJar.has(conversationCapabilityCookieName(ids.profileA)))
            check("public chat used only the stubbed provider", firstPublic.body.includes("stubbed route reply"))

            const publicMessageCount = publicConversationId
                ? await tx.message.count({ where: { conversationId: publicConversationId } })
                : -1
            const continuedPublicResponse = await chatPost(jsonRequest("/api/chat", {
                profileId: ids.profileA,
                conversationId: publicConversationId,
                messages: [{ role: "user", content: "continue public chat" }],
            }, cookieHeader(visitorJar)))
            const continuedPublic = await responseSnapshot(continuedPublicResponse)
            const publicMessageCountAfter = publicConversationId
                ? await tx.message.count({ where: { conversationId: publicConversationId } })
                : -1
            check("verified visitor can continue the intentionally public conversation",
                continuedPublic.status === 200 && publicMessageCountAfter === publicMessageCount + 2)

            if (!publicConversationId) throw new Error("Public route did not return a conversation id")
            const validCapability = visitorJar.get(conversationCapabilityCookieName(ids.profileA)) || ""
            const forgedCapability = `${validCapability.slice(0, -1)}${validCapability.endsWith("A") ? "B" : "A"}`
            const forgedBefore = await stateSnapshot(tx, profileIds)
            const forgedCallCounts = { provider: providerCalls, retrieval: retrievalCalls }
            const forged = await responseSnapshot(await chatPost(jsonRequest("/api/chat", {
                profileId: ids.profileA,
                conversationId: publicConversationId,
                messages: [{ role: "user", content: "forged capability" }],
            }, `pl_vid=${publicVisitor}; ${conversationCapabilityCookieName(ids.profileA)}=${encodeURIComponent(forgedCapability)}`)))
            const forgedAfter = await stateSnapshot(tx, profileIds)
            check("forged visitor capability is refused", forged.status === 403)
            check("forged capability refusal is non-enumerating", JSON.stringify(forged) === JSON.stringify(anonymousForeign))
            check("forged capability refusal has no persisted or mutation effect", unchanged(forgedBefore, forgedAfter))
            check("forged capability calls neither retrieval nor provider",
                providerCalls === forgedCallCounts.provider && retrievalCalls === forgedCallCounts.retrieval)

            const expiredCapability = issueConversationCapability({
                conversationId: publicConversationId,
                profileId: ids.profileA,
                visitorId: publicVisitor,
                secret: TEST_CAPABILITY_KEY,
                nowMs: TEST_NOW - (CONVERSATION_CAPABILITY_TTL_SECONDS + 1) * 1000,
            })
            const expiredBefore = await stateSnapshot(tx, profileIds)
            const expiredCallCounts = { provider: providerCalls, retrieval: retrievalCalls }
            const expired = await responseSnapshot(await chatPost(jsonRequest("/api/chat", {
                profileId: ids.profileA,
                conversationId: publicConversationId,
                messages: [{ role: "user", content: "expired capability" }],
            }, `pl_vid=${publicVisitor}; ${conversationCapabilityCookieName(ids.profileA)}=${encodeURIComponent(expiredCapability)}`)))
            const expiredAfter = await stateSnapshot(tx, profileIds)
            check("expired visitor capability is refused", expired.status === 403)
            check("expired capability refusal is non-enumerating", JSON.stringify(expired) === JSON.stringify(anonymousForeign))
            check("expired capability refusal has no persisted or mutation effect", unchanged(expiredBefore, expiredAfter))
            check("expired capability calls neither retrieval nor provider",
                providerCalls === expiredCallCounts.provider && retrievalCalls === expiredCallCounts.retrieval)

            console.log("[lane-d] live refusal")
            currentMember = memberB
            const liveBefore = await stateSnapshot(tx, profileIds)
            const liveAbort = new AbortController()
            const liveAbortTimer = setTimeout(() => liveAbort.abort(), ROUTE_READ_TIMEOUT_MS)
            let liveWrongMember: { status: number; body: string }
            try {
                liveWrongMember = await responseSnapshot(await livePost(jsonRequest("/api/live", {
                    conversationId: ids.memberConversation,
                    action: "request",
                }, "", liveAbort.signal)))
            } finally {
                clearTimeout(liveAbortTimer)
                liveAbort.abort()
            }
            const liveAfter = await stateSnapshot(tx, profileIds)
            check("live route refuses an authenticated wrong member", liveWrongMember.status === 403)
            check("live wrong-member refusal is non-enumerating",
                JSON.stringify(liveWrongMember) === JSON.stringify(anonymousForeign))
            check("live wrong-member refusal has no persisted or mutation effect", unchanged(liveBefore, liveAfter))

            check("all external model calls were test stubs", providerCalls === 3)
            check("all retrieval calls were test stubs", retrievalCalls === 3)

            throw ROLLBACK
        }, { maxWait: 10_000, timeout: 30_000 })
    } catch (error) {
        if (error !== ROLLBACK) throw error
    }

    const rollbackRows = await prisma.profile.count({ where: { id: { in: [ids.profileA, ids.profileB] } } })
    check("transaction rollback removed every fixture", rollbackRows === 0)

    console.log(JSON.stringify({
        result: failures.length === 0 ? "PASS" : "FAIL",
        database: REQUIRED_DATABASE,
        assertions: checks.length,
        provider: "stubbed",
        retrieval: "stubbed",
        transaction: "rolled back",
        inversion: invert,
        failures,
    }, null, 2))

}

async function run(): Promise<never> {
    const hardTimeout = setTimeout(() => {
        console.error(`[lane-d] HARD TIMEOUT after ${HARD_TIMEOUT_MS}ms`)
        process.exit(124)
    }, HARD_TIMEOUT_MS)

    let exitCode = 0
    try {
        await main()
        exitCode = failures.length > 0 ? 1 : 0
    } catch (error) {
        console.error(error instanceof Error ? error.message : String(error))
        exitCode = 1
    } finally {
        clearTimeout(hardTimeout)
        await Promise.race([
            prisma.$disconnect(),
            new Promise<void>((resolve) => setTimeout(resolve, 5_000)),
        ])
    }

    process.exit(exitCode)
}

void run()

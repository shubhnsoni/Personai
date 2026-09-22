import { permittedPersonality } from "@/lib/ai-settings"
import { createHash } from "node:crypto"
import type { Prisma } from "@prisma/client"
import OpenAI from "openai"
import { prisma } from "@/lib/prisma"
import { vectorRetrieval, buildSystemPrompt, scopeDocuments, showStoryDescription } from "@/lib/rag"
import { checkRateLimit } from "@/lib/rate-limit"
import { getMemberFromSession } from "@/lib/members"
import { generateSuggestions } from "@/lib/suggestions"
import { maybeSummarizeConversation, visitorKeyFrom } from "@/lib/memory"
import { formatMoney, type DisplayCurrency } from "@/lib/pricing"
import {
    answerCatalogPriceQuestion,
    chatWhatsAppDigits,
    compactCatalogFacts,
    formatChatCatalogPrice,
} from "@/lib/chat-catalog"
import { extrasOf, fieldOn, hasSurface } from "@/lib/surfaces"
import { resolveKitRole } from "@/lib/role-alias"
import {
    catalogRequestItem,
    DEFAULT_HOTEL_EXPERIENCES,
    DEFAULT_MAINTENANCE_CATALOGUE,
    DEFAULT_SPA_CATALOGUE,
    DEFAULT_TRANSPORT_OPTIONS,
    encodeHotelCard,
    hotelDeskReply,
    isHotelRole,
    parseHotelGuestIntent,
    detectGuestLanguage,
    guestMaintenanceCopy,
    type HotelRequestType,
} from "@/lib/hotels"
import { createHotelRequest, loadHotelGuestContext } from "@/lib/hotels/store"
import { marketingBusiness } from "@/lib/marketing-business"
import { createOwnershipFoundation, ownershipRefusalResponse } from "@/lib/security"
import { getRequestCurrency } from "@/lib/request-currency"
import { boundedChatInput, clipUtf8, resolveApiRecipe, streamChatWithFailover, usageMetadata, type ApiRecipe } from "@/lib/ai-runtime"
import { guestDeskReply } from "@/lib/chat-fallback"
import { AiAccessError, prepareAiUsage, finishAiUsage, providerRejectedWithoutSpend, type AiReservation } from "@/lib/ai-usage"
import { resolveClientDocumentIds } from "@/lib/knowledge-access"
import { shouldRecordKnowledgeGap } from "@/lib/profile-expertise-policy"
import { redactVisitorText } from "@/lib/memory-privacy"
import { getProfileBilling } from "@/lib/billing/service"
import {
    CONVERSATION_CAPABILITY_TTL_SECONDS,
    conversationCapabilityCookieName,
    issueConversationCapability,
    productionCapabilitySecret,
    verifyConversationCapability,
} from "@/lib/conversation-capability"

export {
    CONVERSATION_CAPABILITY_TTL_SECONDS,
    conversationCapabilityCookieName,
    issueConversationCapability,
    verifyConversationCapability,
}

const VISITOR_COOKIE = "pl_vid"
const VISITOR_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365

export function chatProviderTimeoutMs() {
    const n = Number(process.env.INTROIFY_CHAT_PROVIDER_TIMEOUT_MS)
    if (Number.isFinite(n) && n >= 20 && n < 1_000) return n
    if (Number.isFinite(n) && n >= 1_000) return Math.min(n, 40_000)
    return 40_000
}

function raceWithTimeout<T>(work: Promise<T>, ms: number, signal: AbortSignal): Promise<T> {
    return new Promise((resolve, reject) => {
        if (signal.aborted) {
            reject(Object.assign(new Error("aborted"), { name: "AbortError" }))
            return
        }
        const timer = setTimeout(() => {
            reject(Object.assign(new Error("provider_timeout"), { name: "TimeoutError" }))
        }, ms)
        const onAbort = () => {
            clearTimeout(timer)
            reject(Object.assign(new Error("aborted"), { name: "AbortError" }))
        }
        signal.addEventListener("abort", onAbort, { once: true })
        work.then(
            (value) => { clearTimeout(timer); signal.removeEventListener("abort", onAbort); resolve(value) },
            (error) => { clearTimeout(timer); signal.removeEventListener("abort", onAbort); reject(error) },
        )
    })
}

const CONVERSATION_FORBIDDEN = Object.freeze({
    code: "FORBIDDEN" as const,
    status: 403 as const,
    message: "Access denied",
})

type ConversationDb = Prisma.TransactionClient
type MemberIdentity = Awaited<ReturnType<typeof getMemberFromSession>>
type StreamingCompletionInput = OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming
type StreamingChunk = OpenAI.Chat.Completions.ChatCompletionChunk

type ChatRouteDependencies = Readonly<{
    db: ConversationDb
    resolveMember: () => Promise<MemberIdentity>
    rateLimit: typeof checkRateLimit
    retrieve: typeof vectorRetrieval
    buildPrompt: typeof buildSystemPrompt
    requestCurrency: () => Promise<DisplayCurrency>
    createCompletion: (input: StreamingCompletionInput, recipe?: ApiRecipe, signal?: AbortSignal) => Promise<AsyncIterable<StreamingChunk>>
    summarizeConversation: (conversationId: string) => Promise<unknown>
    providerConfigured: () => boolean
    capabilitySecret: () => string | null
    now: () => number
    reserveAi: typeof prepareAiUsage
    settleAi: typeof finishAiUsage
    clientDocumentIds: (profileId: string, member: MemberIdentity) => Promise<Set<string>>
    profileBillingFeatures: (profileId: string) => Promise<{ advancedAnalytics?: boolean } | null>
}>


async function readChatBody(request: Request): Promise<string> {
    if (Number(request.headers.get("content-length")) > 65_536 || !request.body) throw new Error("request_too_large")
    const reader = request.body.getReader()
    const chunks: Uint8Array[] = []
    let total = 0
    while (true) {
        const { done, value } = await reader.read()
        if (done) break
        total += value.byteLength
        if (total > 65_536) { await reader.cancel(); throw new Error("request_too_large") }
        chunks.push(value)
    }
    return Buffer.concat(chunks).toString("utf8")
}

function opaqueId(value: unknown): string | null {
    if (typeof value !== "string" || value.length === 0 || value.length > 191) return null
    if (value.trim() !== value || /[\s\u0000-\u001f\u007f]/u.test(value)) return null
    return value
}

function parseCookies(header: string | null): Map<string, string> {
    const parsed = new Map<string, string>()
    for (const part of (header || "").split(";")) {
        const separator = part.indexOf("=")
        if (separator < 1) continue
        const name = part.slice(0, separator).trim()
        const encoded = part.slice(separator + 1).trim()
        try {
            parsed.set(name, decodeURIComponent(encoded))
        } catch {
            // Malformed cookies are ignored and therefore fail closed.
        }
    }
    return parsed
}

function serializeHttpOnlyCookie(name: string, value: string, maxAge: number, path = "/"): string {
    const secure = process.env.NODE_ENV === "production" ? "; Secure" : ""
    return `${name}=${encodeURIComponent(value)}; Path=${path}; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${secure}`
}

const productionDependencies: ChatRouteDependencies = {
    db: prisma as unknown as ConversationDb,
    resolveMember: getMemberFromSession,
    rateLimit: checkRateLimit,
    retrieve: vectorRetrieval,
    buildPrompt: buildSystemPrompt,
    requestCurrency: getRequestCurrency,
    createCompletion: async (input, recipe, signal) => {
        if (!recipe) throw new Error("ai_not_configured")
        return streamChatWithFailover(input, recipe, signal)
    },
    summarizeConversation: maybeSummarizeConversation,
    providerConfigured: () => ["fast", "smart", "reasoning"].some(mode => resolveApiRecipe(mode as "fast" | "smart" | "reasoning")),
    reserveAi: prepareAiUsage,
    settleAi: finishAiUsage,
    capabilitySecret: productionCapabilitySecret,
    now: Date.now,
    clientDocumentIds: (profileId, member) => resolveClientDocumentIds(prisma, profileId, member ? { id: member.id, email: member.email } : null),
    profileBillingFeatures: (profileId) => getProfileBilling(profileId).then(billing => ({ advancedAnalytics: billing.features.advancedAnalytics === true })).catch(() => null),
}

function conversationRefusal(): Response {
    return ownershipRefusalResponse(CONVERSATION_FORBIDDEN)
}

export function createChatPostHandler(overrides: Partial<ChatRouteDependencies> = {}) {
    const dependencies: ChatRouteDependencies = { ...productionDependencies, ...overrides }

    return async function handleChatPost(req: Request): Promise<Response> {
        const {
            db,
            resolveMember,
            rateLimit,
            retrieve,
            buildPrompt,
            requestCurrency,
            createCompletion,
            summarizeConversation,
            providerConfigured,
            capabilitySecret,
            now,
            reserveAi,
            settleAi,
            clientDocumentIds,
            profileBillingFeatures,
        } = dependencies

        const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
            || req.headers.get("x-real-ip")
            || "unknown"
        const { allowed } = rateLimit(ip)
        if (!allowed) {
            return new Response("Too many requests. Please wait a moment before sending more messages.", {
                status: 429,
                headers: { "Retry-After": "60", "X-RateLimit-Remaining": "0" },
            })
        }

        let body: {
            messages?: Array<{ role?: string; content?: string }>
            profileId?: unknown
            conversationId?: unknown
            visitorId?: unknown
            requestId?: unknown
            memoryConsent?: unknown
            knowledgeGapConsent?: unknown
            hotelRoom?: unknown
            stayToken?: unknown
        }
        try {
            body = JSON.parse(await readChatBody(req))
        } catch {
            return new Response("Invalid request", { status: 400 })
        }

        const messages = Array.isArray(body.messages) ? body.messages.slice(-20).map(message => ({ role: message?.role, content: typeof message?.content === "string" ? message.content.replace(/[\u0000-\u001f\u007f]/gu, " ").slice(0, 4000) : "" })) : []
        const profileId = opaqueId(body.profileId)
        const existingConversationId = body.conversationId === null || body.conversationId === undefined
            ? null
            : opaqueId(body.conversationId)
        const lastMessage = messages[messages.length - 1]
        const query = typeof lastMessage?.content === "string" ? lastMessage.content.trim() : ""
        if (!profileId || !query || (body.conversationId != null && !existingConversationId)) {
            return new Response("Invalid request", { status: 400 })
        }

        const requestCookies = parseCookies(req.headers.get("cookie"))
        const cookieVisitorId = opaqueId(requestCookies.get(VISITOR_COOKIE))
        const bodyVisitorId = opaqueId(body.visitorId)
        const member = await resolveMember().catch(() => null)

        const profile = await db.profile.findUnique({
            where: { id: profileId },
            include: {
                documents: true,
                workExperiences: true,
                projects: true,
                serviceOfferings: { where: { isActive: true } },
                digitalProducts: { where: { isActive: true } },
                courses: {
                    where: { isActive: true, isPublished: true },
                    include: { modules: { include: { lessons: true } } },
                },
                events: { where: { isActive: true } },
                communities: { where: { isActive: true } },
                leadMagnets: { where: { isActive: true } },
            },
        })
        if (!profile) return new Response("Profile not found", { status: 404 })

        let conversationId = existingConversationId
        let visitorId = cookieVisitorId || bodyVisitorId || null
        let liveMode = "AI"

        if (conversationId && member) {
            const memberOwnership = createOwnershipFoundation({
                resolve: async () => ({ id: member.id, profiles: [{ id: profile.id }] }),
            })
            const owned = await memberOwnership.requireOwnedResource({
                resourceId: conversationId,
                claimedProfileId: profileId,
                findOwned: ({ resourceId, profile: ownedProfile, actor }) => db.conversation.findFirst({
                    where: {
                        id: resourceId,
                        profileId: ownedProfile.id,
                        memberId: actor.userId,
                    },
                }),
            })
            if (!owned.ok) return ownershipRefusalResponse(owned.refusal)
            liveMode = owned.value.resource.mode
            visitorId = owned.value.resource.visitorId
        } else if (conversationId) {
            if (!cookieVisitorId) return conversationRefusal()
            const existing = await db.conversation.findFirst({
                where: {
                    id: conversationId,
                    profileId,
                    memberId: null,
                    visitorId: cookieVisitorId,
                },
            })
            if (!existing) return conversationRefusal()
            liveMode = existing.mode
            visitorId = existing.visitorId
        }

        const restaurantDesk = resolveKitRole(profile.roleTemplate) === "RESTAURANT"
        const hotelDesk = resolveKitRole(profile.roleTemplate) === "HOTEL"
        const hotelRoom = typeof body.hotelRoom === "string" ? body.hotelRoom.trim().slice(0, 16) : ""
        const stayToken = typeof body.stayToken === "string" ? body.stayToken.trim().slice(0, 64) : ""
        if (!capabilitySecret() || (!providerConfigured() && !restaurantDesk && !hotelDesk && liveMode !== "LIVE" && liveMode !== "LIVE_REQUESTED")) {
            return new Response(
                JSON.stringify({ error: "ai_not_configured", message: "The AI assistant is temporarily unavailable. You can still use this business's contact and booking options." }),
                { status: 503, headers: { "Content-Type": "application/json" } },
            )
        }

        if (!conversationId && !member && !profile.isPublic) return conversationRefusal()
        let reservation: AiReservation | null = null
        let providerStarted = false
        let settled = false
        const requestId = opaqueId(req.headers.get("Idempotency-Key") || body.requestId)
        const needsAi = liveMode !== "LIVE" && liveMode !== "LIVE_REQUESTED" && providerConfigured()
        if (needsAi) {
            if (!requestId) return Response.json({ error: "request_id_required", message: "A request ID is required." }, { status: 400 })
            try {
                reservation = await reserveAi({
                    profileId, storedModel: profile.aiModel,
                    operationKey: `chat:${createHash("sha256").update(`${profileId}:${requestId}`).digest("hex")}`,
                    metadata: { channel: "chat", requestHash: createHash("sha256").update(JSON.stringify(messages)).digest("hex") },
                })
            } catch (error) {
                return Response.json({ error: error instanceof AiAccessError ? error.code : "ai_allowance_unavailable", message: error instanceof AiAccessError ? error.message : "The assistant's AI allowance is unavailable. Please contact the business directly." }, { status: error instanceof AiAccessError ? error.status : 503 })
            }
        }
        async function settle(action: "CONSUME" | "RELEASE", metadata: Record<string, unknown> = {}) {
            if (!reservation || settled) return
            await settleAi(reservation.id, action, metadata)
            settled = true
        }
        const requestStartedAt = now()
        try {
        const responseCookies: string[] = []
        if (!conversationId) {
            if (!member && !profile.isPublic) return conversationRefusal()
            visitorId = member ? visitorId : (visitorId || crypto.randomUUID())
            const ref = (requestCookies.get("pl_ref") || "").slice(0, 40)
            const conversation = await db.conversation.create({
                data: {
                    profileId,
                    visitorId: visitorId || null,
                    memberId: member?.id || null,
                    visitorName: member?.name || null,
                    visitorEmail: member?.email || null,
                    source: ref || "PROFILE_PAGE",
                    leadStatus: "NEW",
                },
            })
            await db.profileEvent.create({
                data: {
                    profileId,
                    name: "chat_open",
                    ref: ref || null,
                    visitor: visitorId?.slice(0, 80) || null,
                },
            }).catch(() => null)
            conversationId = conversation.id
        }

        if (!member) {
            if (!visitorId) return conversationRefusal()
            const secret = capabilitySecret()
            if (!secret) return conversationRefusal()
            const token = issueConversationCapability({
                conversationId,
                profileId,
                visitorId,
                secret,
                nowMs: now(),
            })
            responseCookies.push(serializeHttpOnlyCookie(
                conversationCapabilityCookieName(profileId),
                token,
                CONVERSATION_CAPABILITY_TTL_SECONDS,
                "/api",
            ))
            if (!cookieVisitorId) {
                responseCookies.push(serializeHttpOnlyCookie(
                    VISITOR_COOKIE,
                    visitorId,
                    VISITOR_COOKIE_MAX_AGE_SECONDS,
                ))
            }
        }

        if (!conversationId) return conversationRefusal()
        const authorizedConversationId = conversationId
        const authorizedProfileId = profileId

        const profileData = {
            slug: profile.slug,
            displayName: profile.displayName,
            headline: profile.headline,
            bio: profile.bio,
            roleTemplate: profile.roleTemplate,
            primaryGoal: profile.primaryGoal,
            serviceOfferings: profile.serviceOfferings,
            workExperiences: profile.workExperiences,
            projects: profile.projects,
            digitalProducts: profile.digitalProducts,
            whatsapp: profile.whatsapp,
            upiId: profile.upiId,
            courses: profile.courses,
            events: profile.events,
            communities: profile.communities,
            leadMagnets: profile.leadMagnets,
        }

        const visitorKey = visitorKeyFrom(null, visitorId || member?.id)
        if (typeof body.memoryConsent === "boolean" && (body.memoryConsent === false || reservation?.autoMemory)) {
            await db.profileEvent.create({ data: { profileId, name: "visitor_memory_consent", path: authorizedConversationId, meta: JSON.stringify({ granted: body.memoryConsent }) } })
            if (!body.memoryConsent) await db.profileDocument.deleteMany({ where: { profileId, type: "VISITOR_MEMORY", conversationId: authorizedConversationId } })
        }
        const memoryAllowed = Boolean(profile.autoMemoryEnabled && reservation?.autoMemory && body.memoryConsent === true)
        const clientDocIds = await clientDocumentIds(profileId, member).catch(() => new Set<string>())
        const scoped = scopeDocuments(profile.documents, memoryAllowed ? visitorKey : null, memoryAllowed ? authorizedConversationId : null, clientDocIds)
        const contextDocs = reservation ? await retrieve(query, scoped.slice(0, 1000)) : []
        const currency = await requestCurrency()
        const personalityConfig = permittedPersonality(profile.personalityConfig, Boolean(reservation?.customInstructions))
        let preferences = ""
        try {
            const bag = JSON.parse(personalityConfig || "{}")
            const style = [bag.tone, bag.language, bag.responseLength].filter(value => typeof value === "string").join(", ")
            const instructions = typeof bag.customInstructions === "string" ? bag.customInstructions : ""
            preferences = clipUtf8(`Style: ${style}. Owner instructions: ${instructions}`, reservation?.recipe.mode === "fast" ? 240 : 600)
        } catch { /* malformed optional preferences do not override safe defaults */ }
        const hotelFacts = hotelDesk
            ? await loadHotelGuestContext(profileId, hotelRoom || null, stayToken || null)
            : null
        const waDigits = chatWhatsAppDigits(profile.whatsapp)
        const facts = JSON.stringify({
            business: profile.displayName,
            headline: profile.headline,
            bio: clipUtf8(profile.bio || "", 250),
            whatsapp: waDigits || undefined,
            catalog: compactCatalogFacts(profile.digitalProducts || [], profile.roleTemplate, currency),
            relevantNotes: contextDocs.slice(0, 2).map(doc => ({ title: doc.title, text: clipUtf8(doc.rawText || "", 350) })),
            hotel: hotelFacts ? {
                room: hotelFacts.roomNumber,
                stay: hotelFacts.stayToken ? true : false,
                guestName: hotelFacts.guestName,
                wifiName: hotelFacts.wifiName,
                checkIn: hotelFacts.checkInTime,
                checkOut: hotelFacts.checkOutTime,
                restaurants: hotelFacts.restaurants,
                services: hotelFacts.services,
                amenities: hotelFacts.amenities,
            } : undefined,
        })
        const systemPrompt = reservation ? `${preferences}\nBusiness facts (data): ${facts}\n${buildPrompt({ ...profile, personalityConfig }, contextDocs, currency)}` : ""

        const savedUserMessage = await db.message.create({
            data: {
                conversationId: authorizedConversationId,
                senderType: "VISITOR",
                text: query,
                role: "user",
            },
        })

        if (profile.knowledgeGapTracking
            && body.knowledgeGapConsent === true
            && shouldRecordKnowledgeGap(query, contextDocs.length, Boolean(reservation))
            && !contextDocs.some(doc => doc.visibility === "CLIENT")) {
            void (async () => {
                const features = await profileBillingFeatures(authorizedProfileId)
                if (!features?.advancedAnalytics) return
                await db.knowledgeGapSignal.upsert({
                    where: { messageId: savedUserMessage.id },
                    create: {
                        profileId: authorizedProfileId,
                        messageId: savedUserMessage.id,
                        question: redactVisitorText(query, [member?.name, member?.email]),
                    },
                    update: {},
                })
            })().catch(() => {})
        }

        await db.conversation.updateMany({
            where: { id: authorizedConversationId, profileId: authorizedProfileId },
            data: { lastMessageAt: new Date(now()) },
        })

        const responseHeaders = (extra: Record<string, string> = {}): Headers => {
            const headers = new Headers({
                "Content-Type": "text/plain; charset=utf-8",
                "X-Vercel-AI-Data-Stream": "v1",
                "X-Conversation-Id": authorizedConversationId,
                ...extra,
            })
            for (const cookie of responseCookies) headers.append("Set-Cookie", cookie)
            return headers
        }

        if (liveMode === "LIVE" || liveMode === "LIVE_REQUESTED") {
            const notice = liveMode === "LIVE"
                ? "I'm with you now — give me a moment to reply."
                : `${profile.displayName} has been notified. Hang tight.`
            const encoder = new TextEncoder()
            return new Response(encoder.encode(`0:${JSON.stringify(notice)}\n`), {
                headers: responseHeaders({ "X-Chat-Mode": liveMode }),
            })
        }

    const allTools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
        {
            type: "function",
            function: {
                name: "collectLead",
                description: "Collect lead information from the user (name, email, etc.) when they express interest in booking, hiring, or collaborating.",
                parameters: {
                    type: "object",
                    properties: {
                        name: { type: "string", description: "The user's name" },
                        email: { type: "string", description: "The user's email address" },
                        company: { type: "string", description: "The user's company name" },
                        budget: { type: "string", description: "The user's budget range" }
                    },
                    required: ["name", "email"]
                }
            }
        },
        {
            type: "function",
            function: {
                name: "showServices",
                description: "Show available services and pricing when user asks about rates, pricing, consultation services, or booking a call",
                parameters: { type: "object", properties: {} }
            }
        },
        {
            type: "function",
            function: {
                name: "showWorkExperience",
                description: "Show work experience and career history when user asks about background, experience, or CV",
                parameters: { type: "object", properties: {} }
            }
        },
        {
            type: "function",
            function: {
                name: "showProjects",
                description: "Show portfolio projects when user asks about work, projects, or portfolio",
                parameters: { type: "object", properties: {} }
            }
        },
        {
            type: "function",
            function: {
                name: "showProducts",
                description: "Show shop or catalogue items when the user asks what is for sale. For a pharmacy these are physical medicines, never digital downloads.",
                parameters: { type: "object", properties: {} }
            }
        },
        {
            type: "function",
            function: {
                name: "showMenu",
                description: "Show the restaurant menu when the user asks about dishes, veg/non-veg, spice, or what to eat",
                parameters: { type: "object", properties: {} }
            }
        },
        {
            type: "function",
            function: {
                name: "showStory",
                description: showStoryDescription(profile.roleTemplate),
                parameters: { type: "object", properties: {} }
            }
        },
        {
            type: "function",
            function: {
                name: "bookTable",
                description: "Reserve a table after you have the guest name, party size, date (YYYY-MM-DD), and time (HH:MM). Parties of 12 or more join tables. For 20+ also offer WhatsApp. Never invent an empty table.",
                parameters: {
                    type: "object",
                    properties: {
                        visitorName: { type: "string" },
                        visitorEmail: { type: "string" },
                        visitorPhone: { type: "string" },
                        partySize: { type: "number" },
                        date: { type: "string", description: "YYYY-MM-DD" },
                        time: { type: "string", description: "HH:MM 24h" },
                        notes: { type: "string" },
                    },
                    required: ["visitorName", "partySize", "date", "time"],
                }
            }
        },
        {
            type: "function",
            function: {
                name: "showCourses",
                description: "Show available courses when user asks about learning, courses, training, or education",
                parameters: { type: "object", properties: {} }
            }
        },
        {
            type: "function",
            function: {
                name: "showEvents",
                description: "Show upcoming events and webinars when user asks about events, webinars, workshops, or live sessions",
                parameters: { type: "object", properties: {} }
            }
        },
        {
            type: "function",
            function: {
                name: "showCommunities",
                description: "Show community memberships when user asks about community, groups, membership, Telegram, or Discord",
                parameters: { type: "object", properties: {} }
            }
        },
        {
            type: "function",
            function: {
                name: "showLeadMagnets",
                description: "Show free resources and lead magnets when user asks about free resources, downloads, giveaways, or guides",
                parameters: { type: "object", properties: {} }
            }
        },
        {
            type: "function",
            function: {
                name: "createHotelRequest",
                description: "Create a hotel ticket: housekeeping, maintenance, spa, transport, experience, checkout, or feedback. Never confirm payment or post a review. Do not use this for emergencies — use raiseHotelEmergency.",
                parameters: {
                    type: "object",
                    properties: {
                        type: { type: "string", enum: ["HOUSEKEEPING", "MAINTENANCE", "SPA", "TRANSPORT", "EXPERIENCE", "CHECKOUT", "FEEDBACK"] },
                        items: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    sku: { type: "string" },
                                    qty: { type: "number" },
                                    label: { type: "string" },
                                },
                            },
                        },
                        roomNumber: { type: "string" },
                        notes: { type: "string" },
                    },
                },
            },
        },
        {
            type: "function",
            function: {
                name: "showHotelSpa",
                description: "Show hotel spa treatments. Do not confirm a paid booking.",
                parameters: { type: "object", properties: {} },
            },
        },
        {
            type: "function",
            function: {
                name: "showHotelTransport",
                description: "Show airport transfer, taxi, and scooter request options. Do not charge.",
                parameters: { type: "object", properties: {} },
            },
        },
        {
            type: "function",
            function: {
                name: "showHotelExperiences",
                description: "Show hotel-curated experiences. Do not invent activities.",
                parameters: { type: "object", properties: {} },
            },
        },
        {
            type: "function",
            function: {
                name: "showHotelLocalGuide",
                description: "Show hotel-curated experiences and linked restaurants only. Stay honest if the list is empty.",
                parameters: { type: "object", properties: {} },
            },
        },
        {
            type: "function",
            function: {
                name: "requestHotelCheckout",
                description: "File a checkout request. Do not close a bill or charge a card.",
                parameters: { type: "object", properties: { notes: { type: "string" } } },
            },
        },
        {
            type: "function",
            function: {
                name: "submitHotelFeedback",
                description: "Store stay feedback. Offer a Google review search only for a positive note. Never post a review.",
                parameters: { type: "object", properties: { notes: { type: "string" } } },
            },
        },
        {
            type: "function",
            function: {
                name: "showHotelRestaurants",
                description: "Show restaurants connected to this hotel. Do not invent a menu.",
                parameters: { type: "object", properties: {} },
            },
        },
        {
            type: "function",
            function: {
                name: "talkToReception",
                description: "Hand the guest to a human at reception.",
                parameters: { type: "object", properties: { notes: { type: "string" } } },
            },
        },
        {
            type: "function",
            function: {
                name: "requestLateCheckout",
                description: "File a late-checkout request. Do not confirm payment.",
                parameters: { type: "object", properties: { notes: { type: "string" } } },
            },
        },
        {
            type: "function",
            function: {
                name: "raiseHotelEmergency",
                description: "Alert staff and tell the guest to call reception or emergency now. Not an ordinary wait-on-ticket path. Never confirm a dispatch time.",
                parameters: { type: "object", properties: { notes: { type: "string" } } },
            },
        },
        {
            type: "function",
            function: {
                name: "showHotelMap",
                description: "Show a property map marker. Do not invent indoor navigation.",
                parameters: { type: "object", properties: { query: { type: "string" } } },
            },
        },
    ]

    const role = profile.roleTemplate
    const extras = extrasOf(profile)
    const allowedTools = new Set<string>(["collectLead"])
    if (fieldOn(role, "shopDigital", extras)) allowedTools.add("showLeadMagnets")
    if (hasSurface(role, "services", extras)) allowedTools.add("showServices")
    if (fieldOn(role, "portfolio", extras) || role === "CUSTOM") {
        allowedTools.add("showWorkExperience")
        allowedTools.add("showProjects")
    }
    const foodKit = resolveKitRole(role) === "RESTAURANT"
    if (hasSurface(role, "shop", extras) && (foodKit || extras?.packs?.includes("menuDish") || role === "CUSTOM")) allowedTools.add("showMenu")
    allowedTools.add("showStory")
    if (hasSurface(role, "shop", extras) && !foodKit) allowedTools.add("showProducts")
    if (fieldOn(role, "tableBook", extras) || foodKit) allowedTools.add("bookTable")
    if (hasSurface(role, "courses", extras)) allowedTools.add("showCourses")
    if (hasSurface(role, "events", extras)) {
        allowedTools.add("showEvents")
        allowedTools.add("showCommunities")
    }
    if (isHotelRole(role)) {
        allowedTools.add("createHotelRequest")
        allowedTools.add("showHotelRestaurants")
        allowedTools.add("talkToReception")
        allowedTools.add("requestLateCheckout")
        allowedTools.add("showHotelSpa")
        allowedTools.add("showHotelTransport")
        allowedTools.add("showHotelExperiences")
        allowedTools.add("showHotelLocalGuide")
        allowedTools.add("requestHotelCheckout")
        allowedTools.add("submitHotelFeedback")
        allowedTools.add("raiseHotelEmergency")
        allowedTools.add("showHotelMap")
    }
    const tools = allTools.filter((t) => t.type === "function" && allowedTools.has(t.function.name))

    async function executeTool(toolName: string, args: Record<string, unknown>): Promise<string> {
        switch (toolName) {
            case "collectLead": {
                const name = typeof args.name === "string" ? args.name.trim().slice(0, 100) : ""
                const email = typeof args.email === "string" ? args.email.trim().slice(0, 254) : ""
                const company = typeof args.company === "string" ? args.company.slice(0, 160) : undefined
                const budget = typeof args.budget === "string" ? args.budget.slice(0, 100) : undefined
                if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !query.toLowerCase().includes(email.toLowerCase())) return "Please share your name and email so I can save your enquiry."
                try {
                    await db.visitorLead.create({
                        data: {
                            profileId: authorizedProfileId,
                            conversationId: authorizedConversationId,
                            name,
                            email,
                            company,
                            budgetRange: budget,
                            status: "NEW",
                        }
                    })

                    await db.conversation.update({
                        where: { id: authorizedConversationId, profileId: authorizedProfileId },
                        data: {
                            visitorName: name,
                            visitorEmail: email,
                            leadStatus: "QUALIFIED"
                        }
                    })

                    return `Great! I've noted your details. ${profileData.displayName} will get back to you soon!`
                } catch (e) {
                    console.error("Failed to collect lead", e)
                    return "I had trouble saving your information. Please try again."
                }
            }
            case "showServices": {
                const services = profileData.serviceOfferings
                if (services.length === 0) {
                    return `${profileData.displayName} hasn't listed specific consultation services yet, but you can reach out to discuss your needs.`
                }

                const serviceList = services.map(s =>
                    `- **${s.name}**: ${s.isFree ? 'Free' : formatMoney(s.priceCents, currency)} (${s.durationMinutes} min)${s.description ? ` - ${s.description}` : ''}`
                ).join('\n')

                return `Here are ${profileData.displayName}'s consultation services:\n${serviceList}\n\nWould you like to book any of these?`
            }
            case "showWorkExperience": {
                const experiences = profileData.workExperiences
                if (experiences.length === 0) {
                    return `${profileData.displayName}'s detailed work history isn't available here, but their headline is: ${profileData.headline}`
                }

                const expList = experiences.map(e =>
                    `- **${e.role}** at ${e.company} (${e.startDate} - ${e.endDate || 'Present'})${e.description ? `: ${e.description}` : ''}`
                ).join('\n')

                return `${profileData.displayName}'s Work Experience:\n${expList}`
            }
            case "showProjects": {
                const projects = profileData.projects
                if (projects.length === 0) {
                    return `${profileData.displayName}'s project portfolio isn't listed here yet. You can ask about their experience or book a call to see examples.`
                }

                const projectList = projects.map(p =>
                    `- **${p.title}**${p.client ? ` for ${p.client}` : ''}${p.year ? ` (${p.year})` : ''}${p.description ? `: ${p.description}` : ''}`
                ).join('\n')

                return `${profileData.displayName}'s Projects:\n${projectList}`
            }
            case "showStory": {
                const { publishedStoryForSlug } = await import("@/app/actions/story")
                const { storyLabel, storyPath } = await import("@/lib/story")
                const story = await publishedStoryForSlug(profileData.slug)
                const label = storyLabel(profileData.roleTemplate)
                if (!story?.frames.length) {
                    return `${profileData.displayName} hasn't published ${label.page.toLowerCase()} photos yet.`
                }
                const peek = story.frames.slice(0, 4).map((frame) => `- **${frame.title || "Frame"}**${frame.body ? ` — ${frame.body.slice(0, 80)}` : ""}`).join("\n")
                return `Here's ${label.page} at ${profileData.displayName}:\n${peek}\n\nOpen ${storyPath(profileData.slug)} for the full about page.`
            }
            case "showProducts":
            case "showMenu": {
                const products = profileData.digitalProducts
                const restaurant = resolveKitRole(profileData.roleTemplate) === "RESTAURANT" || toolName === "showMenu"
                if (products.length === 0) {
                    return restaurant
                        ? `${profileData.displayName} hasn't published a menu yet. Ask to book a table or WhatsApp them.`
                        : profileData.roleTemplate === "PHARMACY"
                            ? `${profileData.displayName} hasn't listed medicines yet. Ask on WhatsApp or check back at the counter.`
                        : `${profileData.displayName} doesn't have products listed yet. Check out their courses or services instead!`
                }
                const productList = products.map(p => {
                    const extras = [
                        p.diet,
                        p.category,
                        p.spiceLevel ? `spice ${p.spiceLevel}/3` : "",
                        p.stock != null && p.stock <= 0 ? "sold out" : "",
                    ].filter(Boolean).join(" · ")
                    const price = restaurant
                        ? formatChatCatalogPrice(p, profileData.roleTemplate, currency)
                        : formatMoney(p.priceCents, currency)
                    return `- **${p.title}**: ${price}${extras ? ` · ${extras}` : ""}${p.description ? ` — ${p.description}` : ""}`
                }).join('\n')
                return restaurant
                    ? `Here's the menu at ${profileData.displayName}:\n${productList}\n\nWant a table, or should I pick something?`
                    : profileData.roleTemplate === "PHARMACY"
                        ? `Here are medicines in stock at ${profileData.displayName}:\n${productList}\n\nThese are physical items from the counter, not digital files. Open the medicines page to order, or ask for a specific one.`
                    : `Here are ${profileData.displayName}'s products:\n${productList}\n\nWould you like to purchase any of these?`
            }
            case "bookTable": {
                const { createBooking, getAvailableSlots } = await import("@/app/actions/bookings")
                const visitorName = String(args.visitorName || "").trim()
                const partySize = Math.max(1, Math.min(80, Number(args.partySize) || 1))
                const date = String(args.date || "").slice(0, 10)
                const time = String(args.time || "").slice(0, 5)
                const visitorEmail = String(args.visitorEmail || "").trim() || `${visitorName.replace(/\s+/g, ".").toLowerCase() || "guest"}@guest.local`
                const visitorPhone = args.visitorPhone ? String(args.visitorPhone) : undefined
                if (!visitorName || !date || !time) {
                    return "I need a name, party size, date, and time to hold a table."
                }
                const tableService = profileData.serviceOfferings.find((s: { kind?: string }) => s.kind === "TABLE")
                    || profileData.serviceOfferings[0]
                if (!tableService) {
                    return `I don't have table bookings open yet. ${chatWhatsAppDigits(profileData.whatsapp) ? `WhatsApp us at ${chatWhatsAppDigits(profileData.whatsapp)} and we'll seat you.` : "Ask the restaurant directly."}`
                }
                try {
                    const slots = await getAvailableSlots(authorizedProfileId, date, tableService.durationMinutes, {
                        partySize,
                        serviceId: tableService.id,
                    })
                    if (!slots.includes(time)) {
                        const next = slots.slice(0, 4).join(", ")
                        return next
                            ? `That time is full for ${partySize}. Open slots: ${next}. Or WhatsApp us.`
                            : `No tables left on ${date} for ${partySize}. Try another day or WhatsApp us.`
                    }
                    await createBooking({
                        profileId: authorizedProfileId,
                        serviceOfferingId: tableService.id,
                        startTime: `${date}T${time}:00`,
                        visitorName,
                        visitorEmail,
                        partySize,
                        visitorPhone,
                        notes: args.notes ? String(args.notes) : undefined,
                    })
                    return `Booked a table for ${partySize} on ${date} at ${time} under ${visitorName}. See you then.`
                } catch (e) {
                    console.error("bookTable failed", e)
                    return "I couldn't hold that table. Try another time or WhatsApp us."
                }
            }
            case "showCourses": {
                const courses = profileData.courses
                if (courses.length === 0) {
                    return `${profileData.displayName} doesn't have courses available yet. You might be interested in their consultation services instead!`
                }

                const courseList = courses.map(c => {
                    const lessonCount = c.modules.reduce((sum, m) => sum + m.lessons.length, 0)
                    return `- 🎓 **${c.title}**: ${formatMoney(c.priceCents, currency)} (${c.modules.length} modules, ${lessonCount} lessons)${c.description ? ` - ${c.description}` : ''}`
                }).join('\n')

                return `Here are ${profileData.displayName}'s courses:\n${courseList}\n\nWould you like to enroll in any of these?`
            }
            case "showEvents": {
                const events = profileData.events
                const upcomingEvents = events.filter(e => new Date(e.startTime) > new Date())

                if (upcomingEvents.length === 0) {
                    return `${profileData.displayName} doesn't have upcoming events scheduled. Follow them to stay updated!`
                }

                const eventList = upcomingEvents.map(e => {
                    const typeIcon = e.eventType === 'WEBINAR' ? '🎥' : e.eventType === 'WORKSHOP' ? '🛠️' : '👥'
                    const date = new Date(e.startTime).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
                    const price = e.isFree ? 'Free' : formatMoney(e.priceCents, currency)
                    return `- ${typeIcon} **${e.title}** - ${date} (${price})${e.description ? ` - ${e.description}` : ''}`
                }).join('\n')

                return `Here are ${profileData.displayName}'s upcoming events:\n${eventList}\n\nWould you like to register for any of these?`
            }
            case "showCommunities": {
                const communities = profileData.communities
                if (communities.length === 0) {
                    return `${profileData.displayName} doesn't have community memberships available yet.`
                }

                const communityList = communities.map(c => {
                    const platformIcon = c.platform === 'TELEGRAM' ? '📱' : '💬'
                    const billing = c.billingCycle === 'MONTHLY' ? '/month' : c.billingCycle === 'YEARLY' ? '/year' : ' one-time'
                    return `- ${platformIcon} **${c.name}** (${c.platform}): ${formatMoney(c.priceCents, currency)}${billing}${c.description ? ` - ${c.description}` : ''}`
                }).join('\n')

                return `Join ${profileData.displayName}'s communities:\n${communityList}\n\nWould you like to join any of these?`
            }
            case "showLeadMagnets": {
                const leadMagnets = profileData.leadMagnets
                if (leadMagnets.length === 0) {
                    return `${profileData.displayName} doesn't have free resources available right now. Check out their products or courses!`
                }

                const magnetList = leadMagnets.map(m => {
                    const typeIcon = m.type === 'FORM' ? '📝' : m.type === 'GIVEAWAY' ? '🎁' : '📥'
                    return `- ${typeIcon} **${m.title}** (${m.type === 'FORM' ? 'Sign up' : 'Free download'})${m.description ? ` - ${m.description}` : ''}`
                }).join('\n')

                return `Here are ${profileData.displayName}'s free resources:\n${magnetList}\n\nWould you like to get any of these?`
            }
            case "createHotelRequest":
            case "showHotelRestaurants":
            case "showHotelSpa":
            case "showHotelTransport":
            case "showHotelExperiences":
            case "showHotelLocalGuide":
            case "talkToReception":
            case "requestLateCheckout":
            case "requestHotelCheckout":
            case "submitHotelFeedback":
            case "raiseHotelEmergency":
            case "showHotelMap": {
                const ctx = await loadHotelGuestContext(authorizedProfileId, hotelRoom || null, stayToken || null)
                if (!ctx) return "This concierge is not ready yet."
                const deskCtx = { ...ctx, policiesApproved: marketingBusiness.policiesApproved }
                if (toolName === "showHotelRestaurants") return hotelDeskReply("restaurants nearby", deskCtx).text
                if (toolName === "showHotelSpa") {
                    const items = ctx.spa.map((row) => `${row.label} (${row.durationMinutes} min)`)
                    const card = encodeHotelCard({ type: "spa", title: "Spa", items, note: "Request only — this chat does not charge a fee." })
                    return `${card}\nTreatments at ${ctx.displayName}:\n${items.map((row) => `- **${row}**`).join("\n")}\nTell me which one to request. This is not a billed booking.`
                }
                if (toolName === "showHotelTransport") {
                    const items = ctx.transport.map((row) => row.label)
                    const card = encodeHotelCard({ type: "transport", title: "Transport", items, note: "Request only — this chat does not charge a fee." })
                    return `${card}\nRides we can request:\n${items.map((row) => `- **${row}**`).join("\n")}\nAirport, taxi, or scooter — this is a request, not a billed ride.`
                }
                if (toolName === "showHotelExperiences") return hotelDeskReply("What experiences can I join?", deskCtx).text
                if (toolName === "showHotelLocalGuide") return hotelDeskReply("what's nearby / local guide", deskCtx).text
                if (toolName === "showHotelMap") {
                    const q = typeof args.query === "string" ? args.query : query
                    return hotelDeskReply(q.includes("where") ? q : `where's the ${q}`, deskCtx).text
                }
                if (toolName === "raiseHotelEmergency") {
                    await createHotelRequest({
                        profileId: authorizedProfileId,
                        type: "EMERGENCY",
                        items: [{ sku: "emergency", qty: 1, label: "Emergency" }],
                        roomId: ctx.roomId,
                        stayId: ctx.stayId,
                        conversationId: authorizedConversationId,
                        guestName: ctx.guestName,
                        notes: typeof args.notes === "string" ? args.notes : query,
                        priority: "URGENT",
                    })
                    return hotelDeskReply("emergency", deskCtx).text
                }
                if (toolName === "talkToReception") {
                    await createHotelRequest({
                        profileId: authorizedProfileId,
                        type: "HANDOFF",
                        roomId: ctx.roomId,
                        stayId: ctx.stayId,
                        conversationId: authorizedConversationId,
                        guestName: ctx.guestName,
                        notes: typeof args.notes === "string" ? args.notes : query,
                    })
                    await db.conversation.update({
                        where: { id: authorizedConversationId, profileId: authorizedProfileId },
                        data: { mode: "LIVE_REQUESTED", liveRequestedAt: new Date() },
                    })
                    const card = encodeHotelCard({ type: "handoff", title: "Talk to reception", room: ctx.roomNumber || undefined })
                    return `${card}\nReception has been flagged. Stay on this chat.`
                }
                if (toolName === "requestLateCheckout") {
                    await createHotelRequest({
                        profileId: authorizedProfileId,
                        type: "LATE_CHECKOUT",
                        roomId: ctx.roomId,
                        stayId: ctx.stayId,
                        conversationId: authorizedConversationId,
                        guestName: ctx.guestName,
                        notes: typeof args.notes === "string" ? args.notes : query,
                    })
                    return hotelDeskReply("late checkout please", deskCtx).text
                }
                if (toolName === "requestHotelCheckout") {
                    await createHotelRequest({
                        profileId: authorizedProfileId,
                        type: "CHECKOUT",
                        items: [{ sku: "checkout", qty: 1, label: "Checkout" }],
                        roomId: ctx.roomId,
                        stayId: ctx.stayId,
                        conversationId: authorizedConversationId,
                        guestName: ctx.guestName,
                        notes: typeof args.notes === "string" ? args.notes : query,
                    })
                    return hotelDeskReply("ready to checkout", deskCtx).text
                }
                if (toolName === "submitHotelFeedback") {
                    const note = typeof args.notes === "string" ? args.notes : query
                    await createHotelRequest({
                        profileId: authorizedProfileId,
                        type: "FEEDBACK",
                        items: [{ sku: "feedback", qty: 1, label: "Stay feedback" }],
                        roomId: ctx.roomId,
                        stayId: ctx.stayId,
                        conversationId: authorizedConversationId,
                        guestName: ctx.guestName,
                        notes: note,
                    })
                    return hotelDeskReply(note, deskCtx).text
                }
                const guestTypes = ["HOUSEKEEPING", "MAINTENANCE", "SPA", "TRANSPORT", "EXPERIENCE", "CHECKOUT", "FEEDBACK"] as const
                const requestedType = String(args.type || "HOUSEKEEPING").toUpperCase()
                const type: HotelRequestType = guestTypes.includes(requestedType as typeof guestTypes[number])
                    ? requestedType as typeof guestTypes[number]
                    : "HOUSEKEEPING"
                const items = Array.isArray(args.items)
                    ? (args.items as Array<{ sku?: string; qty?: number; label?: string }>).map((item) => ({
                        sku: String(item.sku || "item"),
                        qty: Math.max(1, Number(item.qty) || 1),
                        label: String(item.label || item.sku || "Item"),
                    }))
                    : []
                const fallbackItems = type === "SPA"
                    ? [catalogRequestItem(DEFAULT_SPA_CATALOGUE[0])]
                    : type === "TRANSPORT"
                        ? [catalogRequestItem(DEFAULT_TRANSPORT_OPTIONS[0])]
                        : type === "EXPERIENCE"
                            ? [catalogRequestItem(DEFAULT_HOTEL_EXPERIENCES[0])]
                            : type === "CHECKOUT"
                                ? [{ sku: "checkout", qty: 1, label: "Checkout" }]
                                : type === "FEEDBACK"
                                    ? [{ sku: "feedback", qty: 1, label: "Stay feedback" }]
                                    : type === "MAINTENANCE"
                                        ? [{ sku: "ac", qty: 1, label: "Air conditioning" }]
                                        : [{ sku: "cleaning", qty: 1, label: "Room cleaning" }]
                const usedItems = items.length ? items : fallbackItems
                const roomHint = typeof args.roomNumber === "string" ? args.roomNumber : ctx.roomNumber
                const roomCtx = await loadHotelGuestContext(authorizedProfileId, roomHint, stayToken || null)
                const created = await createHotelRequest({
                    profileId: authorizedProfileId,
                    type,
                    items: usedItems,
                    roomId: roomCtx?.roomId || ctx.roomId,
                    stayId: ctx.stayId,
                    conversationId: authorizedConversationId,
                    guestName: ctx.guestName,
                    notes: typeof args.notes === "string" ? args.notes : query,
                })
                const labels = usedItems.map((item) => `${item.qty && item.qty > 1 ? `${item.qty} ` : ""}${item.label}`)
                const titles: Record<string, string> = {
                    HOUSEKEEPING: "Housekeeping",
                    MAINTENANCE: "Maintenance",
                    SPA: "Spa",
                    TRANSPORT: "Transport",
                    EXPERIENCE: "Experience",
                    CHECKOUT: "Checkout",
                    FEEDBACK: "Feedback",
                }
                const card = encodeHotelCard({
                    type: type === "SPA" ? "spa" : type === "TRANSPORT" ? "transport" : type === "EXPERIENCE" ? "experiences" : type === "CHECKOUT" ? "checkout" : type === "FEEDBACK" ? "feedback" : type === "MAINTENANCE" ? "maintenance" : "request",
                    id: created.id,
                    status: created.status,
                    title: titles[type] || "Request",
                    room: created.room?.number || roomHint || undefined,
                    items: labels,
                    note: type === "HOUSEKEEPING" ? undefined : type === "MAINTENANCE" ? "Request only — add a photo if you can. This chat does not charge a fee." : "Request only — this chat does not charge a fee.",
                })
                if (type === "MAINTENANCE") {
                    const lang = detectGuestLanguage(query)
                    const label = usedItems[0]?.label || "Maintenance"
                    return `${card}\n${guestMaintenanceCopy(lang, label, created.room?.number || roomHint || undefined)}`
                }
                const desk = type === "HOUSEKEEPING" ? "Housekeeping will pick it up." : "Staff will pick it up on the requests board."
                return `${card}\nRequested ${labels.join(" and ")}${created.room?.number ? ` for room ${created.room.number}` : ""}. ${desk}`
            }
            default:
                return "I don't know how to handle that request."
        }
    }

    async function restaurantDeskReply(text: string) {
        const t = text.toLowerCase()
        const priced = answerCatalogPriceQuestion({
            query: text,
            items: profileData.digitalProducts || [],
            roleTemplate: profileData.roleTemplate,
            requestCurrency: currency,
            shopName: profileData.displayName,
            whatsapp: profileData.whatsapp,
        })
        if (priced) return priced
        if (/menu|dish|eat|food|hungry|veg|price|what's on|whats on/.test(t)) {
            const n = profileData.digitalProducts.length
            return n
                ? `${profileData.displayName} has ${n} dishes on. Tap Menu to browse, or tell me veg / non-veg / a dish name.`
                : executeTool("showMenu", {})
        }
        if (/story|inside|about|ambiance|ambience|vibe|room|people|photos/.test(t)) {
            return executeTool("showStory", {})
        }
        if (/table|reserv|book|seat|party/.test(t)) {
            return "Tap Reserve a table and I’ll hold seats. How many people, and which day?"
        }
        if (/order|timer|kitchen|ready|ticket/.test(t)) {
            return "If you’ve already ordered, tap the Order chip on this chat for the kitchen timer. You can place more than one — each ticket has its own timer."
        }
        if (/hi|hello|hey|namaste/.test(t)) {
            return `Hi — I’m ${profileData.displayName}'s desk. Menu, a table, or an order ticket?`
        }
        return `I can open the menu, hold a table, or send you to your kitchen timer. What do you need?`
    }

    async function hotelConciergeReply(text: string) {
        const ctx = await loadHotelGuestContext(authorizedProfileId, hotelRoom || null, stayToken || null)
        if (!ctx) return `This concierge is not ready yet.`
        const desk = hotelDeskReply(text, { ...ctx, policiesApproved: marketingBusiness.policiesApproved })
        if (desk.action?.type === "createHousekeeping") {
            return executeTool("createHotelRequest", {
                type: "HOUSEKEEPING",
                items: desk.action.items,
                roomNumber: desk.action.roomNumber,
                notes: text,
            })
        }
        if (desk.action?.type === "createMaintenance") {
            const action = desk.action
            const item = DEFAULT_MAINTENANCE_CATALOGUE.find((row) => row.sku === action.sku) || DEFAULT_MAINTENANCE_CATALOGUE[0]
            return executeTool("createHotelRequest", {
                type: "MAINTENANCE",
                items: [catalogRequestItem(item)],
                roomNumber: action.roomNumber,
                notes: text,
            })
        }
        if (desk.action?.type === "emergency") return executeTool("raiseHotelEmergency", { notes: text })
        if (desk.action?.type === "createSpa") {
            const action = desk.action
            const item = DEFAULT_SPA_CATALOGUE.find((row) => row.sku === action.sku) || DEFAULT_SPA_CATALOGUE[0]
            return executeTool("createHotelRequest", {
                type: "SPA",
                items: [catalogRequestItem(item)],
                roomNumber: action.roomNumber,
                notes: text,
            })
        }
        if (desk.action?.type === "createTransport") {
            const action = desk.action
            const item = DEFAULT_TRANSPORT_OPTIONS.find((row) => row.sku === action.sku) || DEFAULT_TRANSPORT_OPTIONS[0]
            return executeTool("createHotelRequest", {
                type: "TRANSPORT",
                items: [catalogRequestItem(item)],
                roomNumber: action.roomNumber,
                notes: text,
            })
        }
        if (desk.action?.type === "createExperience") {
            const action = desk.action
            const item = DEFAULT_HOTEL_EXPERIENCES.find((row) => row.sku === action.sku) || DEFAULT_HOTEL_EXPERIENCES[0]
            return executeTool("createHotelRequest", {
                type: "EXPERIENCE",
                items: [catalogRequestItem(item)],
                roomNumber: action.roomNumber,
                notes: text,
            })
        }
        if (desk.action?.type === "handoff") return executeTool("talkToReception", { notes: text })
        if (desk.action?.type === "lateCheckout") return executeTool("requestLateCheckout", { notes: text })
        if (desk.action?.type === "checkout") return executeTool("requestHotelCheckout", { notes: text })
        if (desk.action?.type === "feedback") return executeTool("submitHotelFeedback", { notes: text })
        return desk.text
    }

    function groundedFallback() {
        if (restaurantDesk) return restaurantDeskReply(query)
        if (hotelDesk) return hotelConciergeReply(query)
        return guestDeskReply(query, profileData)
    }

    const hotelIntent = hotelDesk ? parseHotelGuestIntent(query).kind : "unknown"
    // P1-9: when restaurant/cafe desk has a catalog price hit, answer before the LLM
    // (groundedFallback alone only runs when !providerConfigured / hotel short-circuit).
    const restaurantCatalogPrice = restaurantDesk
        ? answerCatalogPriceQuestion({
            query,
            items: profileData.digitalProducts || [],
            roleTemplate: profileData.roleTemplate,
            requestCurrency: currency,
            shopName: profileData.displayName,
            whatsapp: profileData.whatsapp,
        })
        : null
    if (
        !providerConfigured()
        || (hotelDesk && hotelIntent !== "unknown")
        || Boolean(restaurantCatalogPrice)
    ) {
        if (reservation) {
            await settle("RELEASE", {
                reason: restaurantCatalogPrice ? "restaurant_catalog_price" : "hotel_desk",
            })
        }
        const notice = restaurantCatalogPrice || await groundedFallback()
        await db.message.create({
            data: {
                conversationId: authorizedConversationId,
                senderType: "AI",
                text: notice,
                role: "assistant",
            },
        })
        const encoder = new TextEncoder()
        return new Response(encoder.encode(`0:${JSON.stringify(notice)}\n`), {
            headers: responseHeaders(),
        })
    }

    if (!reservation) return Response.json({ error: "ai_allowance_unavailable" }, { status: 503 })
    const recipe = reservation.recipe
    const input = boundedChatInput(recipe, systemPrompt, messages, tools)
    const offeredTools = new Set((input.tools || []).flatMap(tool => tool.type === "function" ? [tool.function.name] : []))
    let inputTokens: number | null = null
    let outputTokens: number | null = null
    let reasoningTokens: number | null = null
    let returnedModel = recipe.model
    try {
        if (req.signal.aborted) { await settle("RELEASE", { reason: "cancelled_before_dispatch" }); return new Response(null, { status: 499 }) }
        providerStarted = true
        const responseAbort = new AbortController()
        const timeoutMs = Math.max(20, requestStartedAt + chatProviderTimeoutMs() - now())
        const responseSignal = typeof AbortSignal.any === "function"
            ? AbortSignal.any([req.signal, responseAbort.signal])
            : responseAbort.signal
        const encoder = new TextEncoder()
        let fullResponse = ""
        let streamed = false
        let toolCall: { id: string; name: string; arguments: string } | null = null
        const aborted = () => Object.assign(new Error("aborted"), { name: "AbortError" })
        const body = new ReadableStream<Uint8Array>({
            async start(controller) {
                const send = (text: string) => {
                    if (!text) return
                    streamed = true
                    controller.enqueue(encoder.encode(`0:${JSON.stringify(text)}\n`))
                }
                const finish = (text: string) => {
                    controller.enqueue(encoder.encode(`d:${JSON.stringify({ suggestions: generateSuggestions(text, profile.displayName) })}\n`))
                    controller.close()
                }
                try {
                    const collected = await raceWithTimeout((async () => {
                        const response = await createCompletion(input, recipe, responseSignal)
                        for await (const chunk of response) {
                            if (responseSignal.aborted) throw aborted()
                            if (chunk.model) returnedModel = chunk.model
                            if (chunk.usage) { inputTokens = chunk.usage.prompt_tokens; outputTokens = chunk.usage.completion_tokens; reasoningTokens = chunk.usage.completion_tokens_details?.reasoning_tokens ?? null }
                            const delta = chunk.choices[0]?.delta
                            if (delta?.content) {
                                const text = clipUtf8(delta.content, Math.max(0, recipe.outputBudget * 8 - Buffer.byteLength(fullResponse)))
                                fullResponse += text
                                send(text)
                            }
                            for (const call of delta?.tool_calls || []) {
                                if (call.index !== 0) continue
                                if (!toolCall) toolCall = { id: call.id || "", name: call.function?.name || "", arguments: "" }
                                if (call.function?.name) toolCall.name = call.function.name
                                if (call.function?.arguments) toolCall.arguments = (toolCall.arguments + call.function.arguments).slice(0, 2048)
                            }
                        }
                        if (responseSignal.aborted) throw aborted()
                        if (toolCall?.name && offeredTools.has(toolCall.name) && allowedTools.has(toolCall.name)) {
                            let args: Record<string, unknown> | null = null
                            try { const parsed = JSON.parse(toolCall.arguments || "{}"); if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) args = parsed } catch { /* invalid tool arguments do not execute */ }
                            if (args) {
                                const result = clipUtf8(await executeTool(toolCall.name, args), 4000)
                                const extra = `${fullResponse ? "\n\n" : ""}${result}`
                                fullResponse += extra
                                send(extra)
                            }
                        }
                        return fullResponse
                    })(), timeoutMs, responseSignal)
                    const hadText = Boolean(collected)
                    if (!hadText) await settle("RELEASE", { ...usageMetadata(recipe, inputTokens, outputTokens), returnedModel, reasoningTokens, reason: "empty_completed_response" })
                    fullResponse = clipUtf8(collected || await groundedFallback(), 4000)
                    if (!streamed) send(fullResponse)
                    const saved = await db.message.create({ data: { conversationId: authorizedConversationId, senderType: "AI", text: fullResponse, role: "assistant" } })
                    if (hadText) await settle("CONSUME", { ...usageMetadata(recipe, inputTokens, outputTokens), returnedModel, reasoningTokens, conversationId: authorizedConversationId, responseMessageId: saved.id, toolCalls: toolCall ? 1 : 0 })
                    if (hadText && memoryAllowed && !contextDocs.some(doc => doc.visibility === "CLIENT")) void summarizeConversation(authorizedConversationId).catch(() => {})
                    finish(fullResponse)
                } catch (error) {
                    responseAbort.abort()
                    try {
                        const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.message === "provider_timeout")
                        if (timedOut) await settle("RELEASE", { reason: "provider_timeout" })
                        else if (providerRejectedWithoutSpend(error)) await settle("RELEASE", { reason: "provider_rejected" })
                        fullResponse = clipUtf8(fullResponse || await groundedFallback(), 4000)
                        if (!streamed) send(fullResponse)
                        await db.message.create({ data: { conversationId: authorizedConversationId, senderType: "AI", text: fullResponse, role: "assistant" } })
                        finish(fullResponse)
                    } catch {
                        try { controller.error(error) } catch { /* already closed */ }
                    }
                }
            },
        })
        return new Response(body, { headers: responseHeaders() })
    } catch (error) {
        if (providerRejectedWithoutSpend(error)) await settle("RELEASE", { reason: "provider_rejected" })
        return Response.json({ error: "ai_generation_failed", message: "The reply could not be completed. Please check the conversation before retrying." }, { status: 502 })
    }
        } catch {
            if (!providerStarted) await settle("RELEASE", { reason: "failed_before_dispatch" })
            return Response.json({ error: "ai_request_failed", message: "This request could not be completed." }, { status: 503 })
        }
    }
}

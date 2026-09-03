import { createHash, createHmac, timingSafeEqual } from "node:crypto"
import type { Prisma } from "@prisma/client"
import OpenAI from "openai"
import { prisma } from "@/lib/prisma"
import { vectorRetrieval, buildSystemPrompt, scopeDocuments, showStoryDescription } from "@/lib/rag"
import { checkRateLimit } from "@/lib/rate-limit"
import { getMemberFromSession } from "@/lib/members"
import { generateSuggestions } from "@/lib/suggestions"
import { maybeSummarizeConversation, visitorKeyFrom } from "@/lib/memory"
import { formatMoney, type DisplayCurrency } from "@/lib/pricing"
import { extrasOf, fieldOn, hasSurface } from "@/lib/surfaces"
import { createOwnershipFoundation, ownershipRefusalResponse } from "@/lib/security"
import { getRequestCurrency } from "@/lib/request-currency"
import { llmClient, resolveChatModel, resolveLlm } from "@/lib/llm"

export const dynamic = "force-dynamic"

const VISITOR_COOKIE = "pl_vid"
const VISITOR_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365
const CAPABILITY_VERSION = 1
export const CONVERSATION_CAPABILITY_TTL_SECONDS = 60 * 60 * 24
const CAPABILITY_CONTEXT = "personai:conversation-capability:v1"

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
    createCompletion: (input: StreamingCompletionInput) => Promise<AsyncIterable<StreamingChunk>>
    summarizeConversation: (conversationId: string) => Promise<unknown>
    providerConfigured: () => boolean
    capabilitySecret: () => string | null
    now: () => number
}>

type CapabilityPayload = Readonly<{
    v: number
    c: string
    p: string
    i: string
    e: number
}>

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

function capabilitySigningKey(secret: string): Buffer {
    return createHash("sha256").update(CAPABILITY_CONTEXT).update("\0").update(secret).digest()
}

export function conversationCapabilityCookieName(profileId: string): string {
    const scope = createHash("sha256").update(profileId).digest("hex").slice(0, 24)
    return `pl_cc_${scope}`
}

export function issueConversationCapability(input: {
    conversationId: string
    profileId: string
    visitorId: string
    secret: string
    nowMs?: number
    ttlSeconds?: number
}): string {
    const nowMs = input.nowMs ?? Date.now()
    const ttlSeconds = input.ttlSeconds ?? CONVERSATION_CAPABILITY_TTL_SECONDS
    const payload: CapabilityPayload = {
        v: CAPABILITY_VERSION,
        c: input.conversationId,
        p: input.profileId,
        i: input.visitorId,
        e: Math.floor(nowMs / 1000) + ttlSeconds,
    }
    const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url")
    const signature = createHmac("sha256", capabilitySigningKey(input.secret)).update(encoded).digest("base64url")
    return `${encoded}.${signature}`
}

export function verifyConversationCapability(input: {
    token: string
    conversationId: string
    profileId: string
    visitorId: string
    secret: string
    nowMs?: number
}): boolean {
    if (!input.token || input.token.length > 2048) return false
    const [encoded, suppliedSignature, extra] = input.token.split(".")
    if (!encoded || !suppliedSignature || extra !== undefined) return false

    const expectedSignature = createHmac("sha256", capabilitySigningKey(input.secret)).update(encoded).digest()
    let supplied: Buffer
    try {
        supplied = Buffer.from(suppliedSignature, "base64url")
    } catch {
        return false
    }
    if (supplied.length !== expectedSignature.length || !timingSafeEqual(supplied, expectedSignature)) return false

    let payload: CapabilityPayload
    try {
        payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as CapabilityPayload
    } catch {
        return false
    }
    const nowSeconds = Math.floor((input.nowMs ?? Date.now()) / 1000)
    return payload.v === CAPABILITY_VERSION
        && payload.c === input.conversationId
        && payload.p === input.profileId
        && payload.i === input.visitorId
        && Number.isSafeInteger(payload.e)
        && payload.e > nowSeconds
}

function productionCapabilitySecret(): string | null {
    return process.env.CONVERSATION_CAPABILITY_SECRET
        || process.env.CLERK_SECRET_KEY
        || process.env.XAI_API_KEY
        || process.env.OPENAI_API_KEY
        || null
}

const productionDependencies: ChatRouteDependencies = {
    db: prisma as unknown as ConversationDb,
    resolveMember: getMemberFromSession,
    rateLimit: checkRateLimit,
    retrieve: vectorRetrieval,
    buildPrompt: buildSystemPrompt,
    requestCurrency: getRequestCurrency,
    createCompletion: async (input) => {
        const llm = llmClient()
        if (!llm) throw new Error("ai_not_configured")
        return llm.client.chat.completions.create({
            ...input,
            model: resolveChatModel(input.model, llm.provider),
        })
    },
    summarizeConversation: maybeSummarizeConversation,
    providerConfigured: () => Boolean(resolveLlm()),
    capabilitySecret: productionCapabilitySecret,
    now: Date.now,
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
        }
        try {
            body = await req.json()
        } catch {
            return new Response("Invalid request", { status: 400 })
        }

        const messages = Array.isArray(body.messages) ? body.messages : []
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
            const secret = capabilitySecret()
            const token = requestCookies.get(conversationCapabilityCookieName(profileId)) || ""
            if (!secret || !cookieVisitorId || !verifyConversationCapability({
                token,
                conversationId,
                profileId,
                visitorId: cookieVisitorId,
                secret,
                nowMs: now(),
            })) {
                return conversationRefusal()
            }
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

        const restaurantDesk = profile.roleTemplate === "RESTAURANT"
        if (!capabilitySecret() || (!providerConfigured() && !restaurantDesk)) {
            return new Response(
                JSON.stringify({ error: "ai_not_configured", message: "AI chat is coming soon! The creator hasn't set up AI yet." }),
                { status: 503, headers: { "Content-Type": "application/json" } },
            )
        }

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

        const visitorKey = visitorKeyFrom(member?.email, visitorId)
        const contextDocs = await retrieve(query, scopeDocuments(profile.documents, visitorKey))
        const currency = await requestCurrency()
        const systemPrompt = buildPrompt(profile, contextDocs, currency)

        await db.message.create({
            data: {
                conversationId: authorizedConversationId,
                senderType: "VISITOR",
                text: query,
                role: "user",
            },
        })

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
                description: "Show products or shop items when the user asks about products, downloads, or things they can buy",
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
        }
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
    if (hasSurface(role, "shop", extras) && (role === "RESTAURANT" || extras?.packs?.includes("menuDish") || role === "CUSTOM")) allowedTools.add("showMenu")
    allowedTools.add("showStory")
    if (hasSurface(role, "shop", extras) && role !== "RESTAURANT") allowedTools.add("showProducts")
    if (fieldOn(role, "tableBook", extras)) allowedTools.add("bookTable")
    if (hasSurface(role, "courses", extras)) allowedTools.add("showCourses")
    if (hasSurface(role, "events", extras)) {
        allowedTools.add("showEvents")
        allowedTools.add("showCommunities")
    }
    const tools = allTools.filter((t) => t.type === "function" && allowedTools.has(t.function.name))

    async function executeTool(toolName: string, args: Record<string, unknown>): Promise<string> {
        switch (toolName) {
            case "collectLead": {
                const { name, email, company, budget } = args as { name: string; email: string; company?: string; budget?: string }
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
                const restaurant = profileData.roleTemplate === "RESTAURANT" || toolName === "showMenu"
                if (products.length === 0) {
                    return restaurant
                        ? `${profileData.displayName} hasn't published a menu yet. Ask to book a table or WhatsApp them.`
                        : `${profileData.displayName} doesn't have products listed yet. Check out their courses or services instead!`
                }
                const productList = products.map(p => {
                    const extras = [
                        p.diet,
                        p.category,
                        p.spiceLevel ? `spice ${p.spiceLevel}/3` : "",
                        p.stock != null && p.stock <= 0 ? "sold out" : "",
                    ].filter(Boolean).join(" · ")
                    return `- **${p.title}**: ${formatMoney(p.priceCents, currency)}${extras ? ` · ${extras}` : ""}${p.description ? ` — ${p.description}` : ""}`
                }).join('\n')
                return restaurant
                    ? `Here's the menu at ${profileData.displayName}:\n${productList}\n\nWant a table, or should I pick something?`
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
                    return `I don't have table bookings open yet. ${profileData.whatsapp ? "WhatsApp us and we'll seat you." : "Ask the restaurant directly."}`
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
            default:
                return "I don't know how to handle that request."
        }
    }

    const openaiMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: "system", content: systemPrompt },
        ...messages.map((m) => ({
            role: m.role === "assistant" ? "assistant" as const : "user" as const,
            content: m.content || "",
        }))
    ]

    async function restaurantDeskReply(text: string) {
        const t = text.toLowerCase()
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

    if (!providerConfigured()) {
        const notice = await restaurantDeskReply(query)
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

    const aiModel = profile.aiModel || "gpt-4o-mini"

    try {
        const response = await createCompletion({
            model: aiModel,
            messages: openaiMessages,
            tools,
            stream: true
        })

        const encoder = new TextEncoder()
        let fullResponse = ""
        const toolCalls: { id: string; name: string; arguments: string }[] = []

        const stream = new ReadableStream({
            async start(controller) {
                try {
                    for await (const chunk of response) {
                        const delta = chunk.choices[0]?.delta

                        if (delta?.content) {
                            fullResponse += delta.content
                            controller.enqueue(encoder.encode(`0:"${delta.content.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"\n`))
                        }

                        if (delta?.tool_calls) {
                            for (const tc of delta.tool_calls) {
                                const idx = tc.index
                                if (!toolCalls[idx]) {
                                    toolCalls[idx] = { id: tc.id || "", name: tc.function?.name || "", arguments: "" }
                                }
                                if (tc.function?.arguments) {
                                    toolCalls[idx].arguments += tc.function.arguments
                                }
                            }
                        }
                    }

                    if (toolCalls.length > 0) {
                        for (const tc of toolCalls) {
                            if (tc.name) {
                                const args = tc.arguments ? JSON.parse(tc.arguments) : {}
                                const toolResult = await executeTool(tc.name, args)
                                
                                const followUpMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
                                    ...openaiMessages,
                                    { role: "assistant", content: null, tool_calls: [{ id: tc.id, type: "function", function: { name: tc.name, arguments: tc.arguments } }] },
                                    { role: "tool", tool_call_id: tc.id, content: toolResult }
                                ]

                                const followUpResponse = await createCompletion({
                                    model: aiModel,
                                    messages: followUpMessages,
                                    stream: true
                                })

                                for await (const chunk of followUpResponse) {
                                    const delta = chunk.choices[0]?.delta
                                    if (delta?.content) {
                                        fullResponse += delta.content
                                        controller.enqueue(encoder.encode(`0:"${delta.content.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"\n`))
                                    }
                                }
                            }
                        }
                    }

                    if (fullResponse) {
                        await db.message.create({
                            data: {
                                conversationId: authorizedConversationId,
                                senderType: "AI",
                                text: fullResponse,
                                role: "assistant"
                            }
                        })
                        const suggestions = generateSuggestions(fullResponse, profile.displayName)
                        controller.enqueue(encoder.encode(`d:${JSON.stringify({ suggestions })}\n`))
                        summarizeConversation(authorizedConversationId).catch(() => {})
                    }

                    controller.close()
                } catch (error) {
                    console.error("Streaming error:", error)
                    controller.error(error)
                }
            }
        })

        return new Response(stream, {
            headers: responseHeaders()
        })
    } catch (error) {
        console.error("Chat API error:", error)
        return new Response("Failed to generate response", { status: 500 })
    }
}


}

export const POST = createChatPostHandler()

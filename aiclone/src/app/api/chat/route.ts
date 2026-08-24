import OpenAI from "openai"
import { cookies } from "next/headers"
import { prisma } from "@/lib/prisma"
import { vectorRetrieval, buildSystemPrompt, scopeDocuments } from "@/lib/rag"
import { checkRateLimit } from "@/lib/rate-limit"
import { getMemberFromSession } from "@/lib/members"
import { generateSuggestions } from "@/lib/suggestions"
import { maybeSummarizeConversation, visitorKeyFrom } from "@/lib/memory"
import { formatMoney } from "@/lib/pricing"
import { extrasOf, fieldOn, hasSurface } from "@/lib/surfaces"

export const dynamic = 'force-dynamic'

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(req: Request) {
    // Check if OpenAI is configured
    if (!process.env.OPENAI_API_KEY) {
        return new Response(
            JSON.stringify({ error: "ai_not_configured", message: "AI chat is coming soon! The creator hasn't set up AI yet." }),
            { status: 503, headers: { "Content-Type": "application/json" } }
        )
    }

    // Rate limiting
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
               req.headers.get("x-real-ip") || "unknown"
    const { allowed, remaining } = checkRateLimit(ip)
    if (!allowed) {
        return new Response("Too many requests. Please wait a moment before sending more messages.", {
            status: 429,
            headers: { "Retry-After": "60", "X-RateLimit-Remaining": "0" }
        })
    }

    const { messages, profileId, conversationId: existingConversationId, visitorId: bodyVisitorId } = await req.json()
    const jar = await cookies()
    const cookieVid = jar.get("pl_vid")?.value
    const visitorId = cookieVid || bodyVisitorId || null
    const member = await getMemberFromSession().catch(() => null)

    const profile = await prisma.profile.findUnique({
        where: { id: profileId },
        include: { 
            documents: true,
            workExperiences: true,
            projects: true,
            serviceOfferings: {
                where: { isActive: true }
            },
            digitalProducts: {
                where: { isActive: true }
            },
            courses: {
                where: { isActive: true, isPublished: true },
                include: {
                    modules: {
                        include: { lessons: true }
                    }
                }
            },
            events: {
                where: { isActive: true }
            },
            communities: {
                where: { isActive: true }
            },
            leadMagnets: {
                where: { isActive: true }
            }
        }
    })

    if (!profile) {
        return new Response("Profile not found", { status: 404 })
    }

    const profileData = {
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
        leadMagnets: profile.leadMagnets
    }

    const lastMessage = messages[messages.length - 1]
    const query = lastMessage.content

    const visitorKey = visitorKeyFrom(member?.email, visitorId)
    const contextDocs = await vectorRetrieval(query, scopeDocuments(profile.documents, visitorKey))
    const { getRequestCurrency } = await import("@/lib/request-currency")
    const currency = await getRequestCurrency()
    const systemPrompt = buildSystemPrompt(profile, contextDocs, currency)

    let conversationId = existingConversationId
    let liveMode = "AI"

    if (conversationId) {
        const existing = await prisma.conversation.findUnique({ where: { id: conversationId } })
        if (existing) liveMode = existing.mode
    }

    if (!conversationId) {
        const ref = (jar.get("pl_ref")?.value || "").slice(0, 40)
        const conversation = await prisma.conversation.create({
            data: {
                profileId,
                visitorId: visitorId || null,
                memberId: member?.id || null,
                visitorName: member?.name || null,
                visitorEmail: member?.email || null,
                source: ref || "PROFILE_PAGE",
                leadStatus: "NEW"
            }
        })
        void prisma.profileEvent.create({
            data: {
                profileId,
                name: "chat_open",
                ref: ref || null,
                visitor: visitorId?.slice(0, 80) || null,
            },
        }).catch(() => {})
        conversationId = conversation.id
    } else if (member?.id) {
        await prisma.conversation.update({
            where: { id: conversationId },
            data: {
                memberId: member.id,
                visitorEmail: member.email,
                visitorName: member.name || undefined,
            },
        }).catch(() => {})
    }

    await prisma.message.create({
        data: {
            conversationId,
            senderType: "VISITOR",
            text: query,
            role: "user"
        }
    })

    await prisma.conversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: new Date() }
    })

    if (liveMode === "LIVE" || liveMode === "LIVE_REQUESTED") {
        const notice = liveMode === "LIVE"
            ? "I'm with you now — give me a moment to reply."
            : `${profile.displayName} has been notified. Hang tight.`
        const encoder = new TextEncoder()
        return new Response(encoder.encode(`0:${JSON.stringify(notice)}\n`), {
            headers: {
                "Content-Type": "text/plain; charset=utf-8",
                "X-Vercel-AI-Data-Stream": "v1",
                "X-Conversation-Id": conversationId,
                "X-Chat-Mode": liveMode,
            },
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
                name: "bookTable",
                description: "Reserve a table after you have the guest name, party size, date (YYYY-MM-DD), and time (HH:MM). Never invent an empty table.",
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
                    await prisma.visitorLead.create({
                        data: {
                            profileId,
                            conversationId,
                            name,
                            email,
                            company,
                            budgetRange: budget,
                            status: "NEW",
                        }
                    })

                    await prisma.conversation.update({
                        where: { id: conversationId },
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
                const partySize = Math.max(1, Math.min(24, Number(args.partySize) || 1))
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
                    const slots = await getAvailableSlots(profileId, date, tableService.durationMinutes, {
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
                        profileId,
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
        ...messages.map((m: { role: string; content: string }) => ({
            role: m.role as "user" | "assistant",
            content: m.content
        }))
    ]

    const aiModel = profile.aiModel || "gpt-4o-mini"

    try {
        const response = await openai.chat.completions.create({
            model: aiModel,
            messages: openaiMessages,
            tools,
            stream: true
        })

        const encoder = new TextEncoder()
        let fullResponse = ""
        let toolCalls: { id: string; name: string; arguments: string }[] = []

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

                                const followUpResponse = await openai.chat.completions.create({
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
                        await prisma.message.create({
                            data: {
                                conversationId,
                                senderType: "AI",
                                text: fullResponse,
                                role: "assistant"
                            }
                        })
                        const suggestions = generateSuggestions(fullResponse, profile.displayName)
                        controller.enqueue(encoder.encode(`d:${JSON.stringify({ suggestions })}\n`))
                        maybeSummarizeConversation(conversationId).catch(() => {})
                    }

                    controller.close()
                } catch (error) {
                    console.error("Streaming error:", error)
                    controller.error(error)
                }
            }
        })

        return new Response(stream, {
            headers: {
                "Content-Type": "text/plain; charset=utf-8",
                "X-Vercel-AI-Data-Stream": "v1",
                "X-Conversation-Id": conversationId
            }
        })
    } catch (error) {
        console.error("Chat API error:", error)
        return new Response("Failed to generate response", { status: 500 })
    }
}

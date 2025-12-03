import OpenAI from "openai"
import { prisma } from "@/lib/prisma"
import { simpleRetrieval, buildSystemPrompt } from "@/lib/rag"

const openai = new OpenAI({
    apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY,
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || undefined
})

export async function POST(req: Request) {
    const { messages, profileId, conversationId: existingConversationId } = await req.json()

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
        serviceOfferings: profile.serviceOfferings,
        workExperiences: profile.workExperiences,
        projects: profile.projects,
        digitalProducts: profile.digitalProducts,
        courses: profile.courses,
        events: profile.events,
        communities: profile.communities,
        leadMagnets: profile.leadMagnets
    }

    const lastMessage = messages[messages.length - 1]
    const query = lastMessage.content

    const contextDocs = simpleRetrieval(query, profile.documents)
    const systemPrompt = buildSystemPrompt(profile, contextDocs)

    let conversationId = existingConversationId

    if (!conversationId) {
        const conversation = await prisma.conversation.create({
            data: {
                profileId,
                source: "PROFILE_PAGE",
                leadStatus: "NEW"
            }
        })
        conversationId = conversation.id
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

    const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
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
                description: "Show digital products (ebooks, templates, videos, courses) when user asks about products, downloads, resources, or things they can buy/purchase",
                parameters: { type: "object", properties: {} }
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
                    `- **${s.name}**: ${s.isFree ? 'Free' : `$${(s.priceCents / 100).toFixed(0)}`} (${s.durationMinutes} min)${s.description ? ` - ${s.description}` : ''}`
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
            case "showProducts": {
                const products = profileData.digitalProducts
                if (products.length === 0) {
                    return `${profileData.displayName} doesn't have digital products listed yet. Check out their courses or services instead!`
                }
                
                const productList = products.map(p => {
                    const typeLabel = p.type === 'PDF' ? '📄' : p.type === 'VIDEO' ? '🎬' : p.type === 'AUDIO' ? '🎧' : '📦'
                    return `- ${typeLabel} **${p.title}**: $${(p.priceCents / 100).toFixed(0)}${p.description ? ` - ${p.description}` : ''}`
                }).join('\n')
                
                return `Here are ${profileData.displayName}'s digital products:\n${productList}\n\nWould you like to purchase any of these?`
            }
            case "showCourses": {
                const courses = profileData.courses
                if (courses.length === 0) {
                    return `${profileData.displayName} doesn't have courses available yet. You might be interested in their consultation services instead!`
                }
                
                const courseList = courses.map(c => {
                    const lessonCount = c.modules.reduce((sum, m) => sum + m.lessons.length, 0)
                    return `- 🎓 **${c.title}**: $${(c.priceCents / 100).toFixed(0)} (${c.modules.length} modules, ${lessonCount} lessons)${c.description ? ` - ${c.description}` : ''}`
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
                    const price = e.isFree ? 'Free' : `$${(e.priceCents / 100).toFixed(0)}`
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
                    return `- ${platformIcon} **${c.name}** (${c.platform}): $${(c.priceCents / 100).toFixed(0)}${billing}${c.description ? ` - ${c.description}` : ''}`
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

    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o",
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
                                    model: "gpt-4o",
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

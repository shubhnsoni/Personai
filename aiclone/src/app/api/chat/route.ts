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
        projects: profile.projects
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
                description: "Show available services and pricing when user asks about rates, pricing, or services",
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
                    return `${profileData.displayName} hasn't listed specific services yet, but you can book a call to discuss your needs.`
                }
                
                const serviceList = services.map(s => 
                    `- ${s.name}: ${s.isFree ? 'Free' : `$${(s.priceCents / 100).toFixed(2)}`} (${s.durationMinutes} min)${s.description ? ` - ${s.description}` : ''}`
                ).join('\n')
                
                return `Here are ${profileData.displayName}'s services:\n${serviceList}\n\nWould you like to book any of these?`
            }
            case "showWorkExperience": {
                const experiences = profileData.workExperiences
                if (experiences.length === 0) {
                    return `${profileData.displayName}'s detailed work history isn't available here, but their headline is: ${profileData.headline}`
                }
                
                const expList = experiences.map(e => 
                    `- ${e.role} at ${e.company} (${e.startDate} - ${e.endDate || 'Present'})${e.description ? `: ${e.description}` : ''}`
                ).join('\n')
                
                return `${profileData.displayName}'s Work Experience:\n${expList}`
            }
            case "showProjects": {
                const projects = profileData.projects
                if (projects.length === 0) {
                    return `${profileData.displayName}'s project portfolio isn't listed here yet. You can ask about their experience or book a call to see examples.`
                }
                
                const projectList = projects.map(p => 
                    `- ${p.title}${p.client ? ` for ${p.client}` : ''}${p.year ? ` (${p.year})` : ''}${p.description ? `: ${p.description}` : ''}`
                ).join('\n')
                
                return `${profileData.displayName}'s Projects:\n${projectList}`
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

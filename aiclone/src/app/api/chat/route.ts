import { openai } from "@ai-sdk/openai"
import { streamText, tool } from "ai"
import { prisma } from "@/lib/prisma"
import { simpleRetrieval, buildSystemPrompt } from "@/lib/rag"
import { z } from "zod"

export async function POST(req: Request) {
    const { messages, profileId } = await req.json()
    console.log("Chat API called with profileId:", profileId)
    console.log("API Key starts with dummy:", process.env.OPENAI_API_KEY?.startsWith("dummy"))

    const profile = await prisma.profile.findUnique({
        where: { id: profileId },
        include: { documents: true }
    })

    if (!profile) {
        return new Response("Profile not found", { status: 404 })
    }

    const lastMessage = messages[messages.length - 1]
    const query = lastMessage.content

    const contextDocs = simpleRetrieval(query, profile.documents)
    const systemPrompt = buildSystemPrompt(profile, contextDocs)

    if (process.env.OPENAI_API_KEY?.startsWith("dummy")) {
        const userMsg = messages[messages.length - 1].content.toLowerCase()
        let responseText = "I am a simulated AI response (Mock Mode)."

        if (userMsg.includes("work") || userMsg.includes("history") || userMsg.includes("experience")) {
            responseText = "Here is Max's work experience. He has worked at Parloa as a Principal Product Designer and founded his own agency, SomethingCreative."
        } else if (userMsg.includes("project") || userMsg.includes("design") || userMsg.includes("portfolio")) {
            responseText = "Here are some of Max's design projects. He focuses on AI interfaces, conversational agents, and clean UX design."
        } else if (userMsg.includes("who") || userMsg.includes("about")) {
            responseText = "Max is a Product Designer and Engineer based in Berlin. He loves building beautiful software that feels good to use."
        } else if (userMsg.includes("book") || userMsg.includes("call")) {
            responseText = "I'd love to chat! You can book a call with me directly."
        }

        const encoder = new TextEncoder()
        const stream = new ReadableStream({
            async start(controller) {
                await new Promise(r => setTimeout(r, 500))
                const words = responseText.split(" ")
                for (const word of words) {
                    // 0: "text" is the format for text parts in AI SDK Data Stream Protocol
                    controller.enqueue(encoder.encode(`0:"${word} "\n`))
                    await new Promise(r => setTimeout(r, 50))
                }
                controller.close()
            }
        })
        return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Vercel-AI-Data-Stream': 'v1' } })
    }

    const result = streamText({
        model: openai("gpt-4o"),
        system: systemPrompt,
        messages,
        tools: {
            collectLead: tool({
                description: "Collect lead information from the user (name, email, etc.) when they express interest.",
                parameters: z.object({
                    name: z.string().describe("The user's name"),
                    email: z.string().describe("The user's email address"),
                    company: z.string().optional().describe("The user's company name"),
                    budget: z.string().optional().describe("The user's budget range"),
                }),
                execute: async ({ name, email, company, budget }) => {
                    try {
                        await prisma.visitorLead.create({
                            data: {
                                profileId,
                                name,
                                email,
                                company,
                                budgetRange: budget,
                                status: "NEW",
                            }
                        })
                        return "Lead collected successfully. I will be in touch soon!"
                    } catch (e) {
                        console.error("Failed to collect lead", e)
                        return "Failed to save your information. Please try again."
                    }
                },
            }),
        },
    })

    return result.toDataStreamResponse()
}

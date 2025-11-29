import { ProfileDocument } from "@prisma/client"

export function simpleRetrieval(query: string, documents: ProfileDocument[], topK: number = 3): ProfileDocument[] {
    if (!query || documents.length === 0) return []

    const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2)

    const scoredDocs = documents.map(doc => {
        let score = 0
        const text = (doc.rawText || doc.title || "").toLowerCase()

        queryTerms.forEach(term => {
            if (text.includes(term)) {
                score += 1
            }
        })

        return { doc, score }
    })

    scoredDocs.sort((a, b) => b.score - a.score)

    return scoredDocs.filter(d => d.score > 0).slice(0, topK).map(d => d.doc)
}

export function buildSystemPrompt(profile: any, contextDocs: ProfileDocument[]): string {
    let contextText = ""
    if (contextDocs.length > 0) {
        contextText = "Here is some relevant context about me:\n" +
            contextDocs.map(d => `- ${d.title}: ${d.rawText || d.url}`).join("\n")
    }

    return `You are ${profile.displayName}, a ${profile.roleTemplate}.
Your headline is: ${profile.headline}
Your bio is: ${profile.bio}

${profile.welcomeMessageOverride ? `Your welcome message is: "${profile.welcomeMessageOverride}"` : ""}

Your goal is to ${profile.primaryGoal}.
Tone: Professional, friendly, and helpful.
Language: ${profile.language}.

${contextText}

Instructions:
- Answer questions as if you are ${profile.displayName}.
- Use the provided context to answer specific questions about my work, rates, or portfolio.
- If the answer is not in the context, you can say "I don't have that information right now, but you can book a call to discuss."
- Keep answers concise and engaging.
`
}

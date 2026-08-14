import OpenAI from "openai"
import { prisma } from "@/lib/prisma"

function getOpenAI(): OpenAI {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
        throw new Error("OPENAI_API_KEY is not configured")
    }
    return new OpenAI({ apiKey })
}

export async function generateEmbedding(text: string): Promise<number[]> {
    const response = await getOpenAI().embeddings.create({
        model: "text-embedding-3-small",
        input: text.slice(0, 8000), // limit input size
    })
    return response.data[0].embedding
}

export function cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0
    let dot = 0, normA = 0, normB = 0
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i]
        normA += a[i] * a[i]
        normB += b[i] * b[i]
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB)
    return denom === 0 ? 0 : dot / denom
}

/**
 * Generate and store embedding for a ProfileDocument.
 * Call this when documents are created or updated.
 */
export async function embedDocument(documentId: string): Promise<void> {
    const doc = await prisma.profileDocument.findUnique({ where: { id: documentId } })
    if (!doc) return

    const text = doc.rawText || doc.title || ""
    if (!text.trim()) return

    try {
        const embedding = await generateEmbedding(text)
        await prisma.profileDocument.update({
            where: { id: documentId },
            data: { embedding }
        })
    } catch (error) {
        console.error(`Failed to embed document ${documentId}:`, error)
    }
}

/**
 * Batch embed all documents for a profile that don't have embeddings yet.
 */
export async function embedProfileDocuments(profileId: string): Promise<number> {
    const docs = await prisma.profileDocument.findMany({
        where: {
            profileId,
            embedding: { isEmpty: true }
        }
    })

    let count = 0
    for (const doc of docs) {
        await embedDocument(doc.id)
        count++
    }
    return count
}

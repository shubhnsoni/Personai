/** Vector indexing is suspended while chat uses local retrieval. No background provider spend. */
export async function generateEmbedding(_text: string): Promise<number[]> { return [] }

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

/** Compatibility hook: documents remain searchable through local retrieval. */
export async function embedDocument(_documentId: string): Promise<void> { /* intentionally no provider call */ }

export async function embedProfileDocuments(_profileId: string): Promise<number> { return 0 }

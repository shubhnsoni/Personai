import type { FrameworkDraft } from "@/lib/profile-import-contract"

export type FrameworkAnswer = "yes" | "partly" | "no" | "unsure"
export function evaluateFramework(framework: FrameworkDraft, answers: Record<string, FrameworkAnswer>) {
    const ids = framework.questions.map(question => question.id)
    if (new Set(ids).size !== ids.length) throw new Error("Question IDs must be unique.")
    const points: Record<FrameworkAnswer, number | null> = { yes: 2, partly: 1, no: 0, unsure: null }
    let knownAnswers = 0
    let totalPoints = 0
    const reviewIds: string[] = []
    for (const id of ids) {
        const answer = answers[id]
        if (!Object.hasOwn(points, answer || "")) continue
        const value = points[answer]
        if (answer !== "yes") reviewIds.push(id)
        if (value !== null) { knownAnswers += 1; totalPoints += value }
    }
    return {
        knownAnswers,
        totalQuestions: ids.length,
        score: ids.length > 0 && knownAnswers === ids.length ? Math.round(100 * totalPoints / (2 * ids.length)) : null,
        reviewIds,
    }
}

export type KnowledgeAccessRow = {
    id: string
    type: string
    sourceType?: string | null
    visibility?: string | null
    publicationState?: string | null
}
export function isPublishedKnowledge(document: KnowledgeAccessRow): boolean {
    return (document.publicationState ?? "PUBLISHED") === "PUBLISHED"
        && document.type !== "VISITOR_MEMORY" && document.type !== "PROFILE_MEMORY"
        && document.type !== "PRIVATE_CHAT_NOTES" && document.sourceType !== "CHAT_PRIVATE"
        && document.sourceType !== "CHAT_SUMMARY"
}
export function canReadKnowledge(document: KnowledgeAccessRow, clientDocumentIds: ReadonlySet<string> = new Set()): boolean {
    if (!isPublishedKnowledge(document)) return false
    const visibility = document.visibility ?? "PUBLIC"
    return visibility === "PUBLIC" || (visibility === "CLIENT" && clientDocumentIds.has(document.id))
}

export type GapSignal = { id: string; question: string; createdAt: Date; status: string }
export function groupKnowledgeGaps(signals: GapSignal[]) {
    const groups = new Map<string, { question: string; occurrences: number; signalIds: string[]; lastSeen: string }>()
    for (const signal of signals) {
        if (signal.status !== "OPEN") continue
        const key = signal.question.normalize("NFKC").toLowerCase().replace(/\s+/gu, " ").trim()
        if (!key) continue
        const previous = groups.get(key)
        if (previous) {
            previous.occurrences += 1
            previous.signalIds.push(signal.id)
            if (signal.createdAt.toISOString() > previous.lastSeen) previous.lastSeen = signal.createdAt.toISOString()
        } else {
            groups.set(key, { question: signal.question, occurrences: 1, signalIds: [signal.id], lastSeen: signal.createdAt.toISOString() })
        }
    }
    return [...groups.values()].sort((a, b) => b.occurrences - a.occurrences || b.lastSeen.localeCompare(a.lastSeen))
}
export function shouldRecordKnowledgeGap(query: string, matchedSourceCount: number, retrievalRan: boolean): boolean {
    return retrievalRan && matchedSourceCount === 0 && query.trim().length > 0
        && !/^(hi|hello|hey|namaste|thanks|thank you)[!.\s]*$/iu.test(query.trim())
}
export const KNOWLEDGE_GAP_WINDOW_DAYS = 30
export const KNOWLEDGE_GAP_ROW_LIMIT = 200

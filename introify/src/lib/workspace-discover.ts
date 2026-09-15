import { maturityLabel } from "@/lib/workspace-economy"

export function exploreQueryExamples() {
    return [
        "Animate my logo.",
        "Analyze restaurant inventory.",
        "Review a GitHub PR.",
        "Turn this podcast into reels.",
    ]
}

export function matchesOutcome(query: string, item: { name: string; purpose: string | null; description: string | null; jobs: string[] }) {
    const hay = [item.name, item.purpose || "", item.description || "", ...item.jobs].join(" ").toLowerCase()
    const terms = query.toLowerCase().split(/\s+/).filter((part) => part.length > 2)
    if (!terms.length) return true
    return terms.some((term) => hay.includes(term))
}

export function rankingScore(input: { completed: number; rating: number | null; repeats: number; refunds: number }) {
    const rating = input.rating ?? 0
    return input.completed * 2 + rating * 20 + input.repeats * 5 - input.refunds * 8
}

export function publicSignals(input: { createdAt: Date; completed: number; rating: number | null; now?: Date }) {
    const days = Math.max(1, Math.floor(((input.now || new Date()).getTime() - input.createdAt.getTime()) / 86400000))
    return {
        activeFor: days === 1 ? "1 day" : `${days} days`,
        completedJobs: input.completed,
        rating: input.rating,
        maturity: maturityLabel(input.completed),
    }
}

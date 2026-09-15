import { maturityLabel } from "@/lib/workspace-economy"

export function workspaceToolLinks() {
    return [
        { href: "/workspace/explore", label: "Explore", blurb: "Find a job by outcome, not by model name." },
        { href: "/workspace/earnings", label: "Earnings", blurb: "Jobs sold, fees, and net. Payouts wait on billing." },
        { href: "/workspace/connections", label: "Connections", blurb: "Connect a service once. Each AI asks for its own scopes." },
        { href: "/workspace/automations", label: "Background jobs", blurb: "Nightly Read/Create work. Sending still needs approval." },
        { href: "/workspace/teams", label: "AI teams", blurb: "Specialists for one event — covers, prep, stock, staffing." },
        { href: "/workspace/skills", label: "Skills", blurb: "One AI may use another. Dependencies stay visible." },
        { href: "/workspace/bridge", label: "Desktop Bridge", blurb: "Cloud jobs still run on Introify servers." },
        { href: "/workspace/assistant", label: "Assistant", blurb: "Expired access and approvals, in plain language." },
    ]
}

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
    const terms = query.toLowerCase().split(/\s+/).map((part) => part.replace(/[^a-z0-9]+/g, "")).filter((part) => part.length > 2)
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

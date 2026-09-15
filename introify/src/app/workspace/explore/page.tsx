import Link from "next/link"
import { redirect } from "next/navigation"
import { Search } from "lucide-react"
import { syncUser } from "@/lib/auth-sync"
import { exploreCreations } from "@/lib/workspace-market"
import { exploreQueryExamples } from "@/lib/workspace-discover"

export const dynamic = "force-dynamic"

export default async function ExplorePage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
    const user = await syncUser()
    if (!user) redirect("/sign-in")
    const { q } = await searchParams
    const query = q?.trim() || ""
    const items = await exploreCreations(query)
    const examples = exploreQueryExamples()

    return (
        <div className="w-page">
            <h1 className="w-h1">What do you need done?</h1>
            <p className="w-lede">Search by outcome — logo motion, restaurant reports, a PR review — not by model name.</p>
            <form className="w-search-form" role="search">
                <label htmlFor="explore-q">Search</label>
                <div className="w-search-row">
                    <input id="explore-q" name="q" defaultValue={query} placeholder={examples[0]} />
                    <button className="w-btn" type="submit">Search</button>
                </div>
            </form>
            <div className="w-chiprow" aria-label="Example outcomes">
                {examples.map((example) => (
                    <Link key={example} href={`/workspace/explore?q=${encodeURIComponent(example)}`}>{example}</Link>
                ))}
            </div>
            {items.length === 0 ? (
                <div className="w-empty">
                    <Search size={28} aria-hidden="true" />
                    <h2>No matching skills yet</h2>
                    <p>Showcase an AI that completes a real job. Explore stays small until there is useful supply.</p>
                </div>
            ) : (
                <ul className="w-card-grid">
                    {items.map((item) => (
                        <li key={item.id}>
                            <Link href={item.href} className="w-creation-card">
                                <span className="w-creation-avatar" aria-hidden="true">{item.name.slice(0, 2).toUpperCase()}</span>
                                <div>
                                    <h2>{item.name}</h2>
                                    <p>{item.purpose || item.description}</p>
                                    <div className="w-card-meta">
                                        <span>{item.creator}</span>
                                        <span>{item.signals.maturity}</span>
                                        <span>{item.signals.completedJobs} jobs</span>
                                    </div>
                                </div>
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    )
}

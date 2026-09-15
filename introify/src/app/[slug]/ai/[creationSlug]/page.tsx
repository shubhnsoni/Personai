import Link from "next/link"
import { notFound } from "next/navigation"
import { getPublicCreation, visitorChatEnabled } from "@/lib/creations"
import { VisitorCreationChat } from "@/components/workspace/visitor-creation-chat"
import { publicSignals } from "@/lib/workspace-discover"
import { formatInr, hireLanguage, jobCheckoutOpen } from "@/lib/workspace-economy"
import { HireJobForm } from "@/components/workspace/hire-job-form"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export default async function PublicCreationPage({
    params,
}: {
    params: Promise<{ slug: string; creationSlug: string }>
}) {
    const { slug, creationSlug } = await params
    const found = await getPublicCreation(slug, creationSlug)
    if (!found) notFound()
    const { profile, creation } = found
    const canChat = visitorChatEnabled(creation.visibility, creation.allowVisitorChat)
    const signals = publicSignals({ createdAt: creation.createdAt, completed: creation._count.runs, rating: null })
    const checkoutOpen = jobCheckoutOpen()

    return (
        <main className="mx-auto max-w-lg space-y-6 px-5 py-10">
            <Link href={`/${profile.slug}`} className="text-sm font-medium text-muted-foreground hover:text-foreground">
                {profile.displayName}
            </Link>
            <header className="space-y-2">
                <h1 className="text-3xl font-semibold tracking-tight">{creation.name}</h1>
                {creation.purpose ? <p className="text-muted-foreground">{creation.purpose}</p> : null}
                {creation.description ? <p>{creation.description}</p> : null}
                <p className="text-sm text-muted-foreground">{signals.maturity} · Active for {signals.activeFor} · {signals.completedJobs} completed jobs</p>
                {creation.visibility === "UNLISTED" ? (
                    <p className="rounded-2xl bg-muted px-3 py-2 text-sm">This AI is unlisted. It is not shown on the public profile.</p>
                ) : null}
            </header>
            <section className="space-y-3">
                {canChat ? (
                    <VisitorCreationChat creationId={creation.id} name={creation.name} />
                ) : (
                    <p className="text-sm text-muted-foreground">The creator has not opened chat on this AI.</p>
                )}
            </section>
            {creation.jobs.length ? (
                <section className="space-y-3">
                    <h2 className="text-lg font-semibold">Jobs you can hire</h2>
                    <p className="text-sm text-muted-foreground">{hireLanguage()}</p>
                    {creation.jobs.map((job) => (
                        <div key={job.id} className="rounded-2xl border border-border/70 p-4">
                            <p className="font-medium">{job.name}</p>
                            {job.description ? <p className="text-sm text-muted-foreground">{job.description}</p> : null}
                            <p className="mt-1 text-sm">{job.priceCents ? formatInr(job.priceCents) : "Listed without a price"}</p>
                            <HireJobForm creationId={creation.id} jobId={job.id} checkoutOpen={checkoutOpen} />
                        </div>
                    ))}
                </section>
            ) : null}
        </main>
    )
}

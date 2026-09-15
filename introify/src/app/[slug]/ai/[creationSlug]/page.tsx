import { notFound } from "next/navigation"
import { getPublicCreation, visitorChatEnabled } from "@/lib/creations"
import { VisitorCreationChat } from "@/components/workspace/visitor-creation-chat"

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

    return (
        <main className="mx-auto max-w-lg space-y-5 px-5 py-10">
            <p className="text-sm text-muted-foreground">{profile.displayName}</p>
            <h1 className="text-3xl font-semibold tracking-tight">{creation.name}</h1>
            {creation.purpose ? <p className="text-muted-foreground">{creation.purpose}</p> : null}
            {creation.description ? <p>{creation.description}</p> : null}
            {creation.visibility === "UNLISTED" ? (
                <p className="text-xs text-muted-foreground">This AI is unlisted. It is not shown on the public profile.</p>
            ) : null}
            {canChat ? (
                <VisitorCreationChat creationId={creation.id} name={creation.name} />
            ) : (
                <p className="text-sm text-muted-foreground">The creator has not opened chat on this AI.</p>
            )}
        </main>
    )
}

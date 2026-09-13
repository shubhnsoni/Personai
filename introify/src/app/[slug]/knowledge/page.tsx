import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { getMemberFromSession } from "@/lib/members"
import { resolveClientDocumentIds } from "@/lib/knowledge-access"
import { canReadKnowledge } from "@/lib/profile-expertise-policy"

export const dynamic = "force-dynamic"

export default async function KnowledgePage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params
    const profile = await prisma.profile.findUnique({
        where: { slug },
        select: { id: true, displayName: true, isPublic: true },
    })
    if (!profile || !profile.isPublic) notFound()

    const member = await getMemberFromSession().catch(() => null)
    const clientIds = member ? await resolveClientDocumentIds(prisma, profile.id, { id: member.id, email: member.email }) : new Set<string>()

    const rows = await prisma.profileDocument.findMany({
        where: {
            profileId: profile.id,
            OR: [
                { visibility: "PUBLIC", publicationState: "PUBLISHED" },
                ...(clientIds.size ? [{ visibility: "CLIENT", id: { in: [...clientIds] } }] : []),
            ],
        },
        select: { id: true, title: true, rawText: true, type: true, sourceType: true, visibility: true, publicationState: true },
        orderBy: { createdAt: "desc" },
    })
    const documents = rows.filter(row => canReadKnowledge(row, clientIds))
    const clientDocs = documents.filter(row => row.visibility === "CLIENT")
    const publicDocs = documents.filter(row => row.visibility === "PUBLIC")

    return (
        <main className="mx-auto w-full max-w-2xl space-y-6 px-4 py-10">
            <header className="space-y-1">
                <p className="text-sm text-muted-foreground">{profile.displayName}</p>
                <h1 className="text-lg font-semibold">Knowledge</h1>
            </header>
            {!member ? (
                <p className="rounded-2xl border border-border/70 px-4 py-3 text-sm text-muted-foreground">
                    Sign in to your library with the email you purchased with to see client-only notes.
                </p>
            ) : null}
            {publicDocs.length === 0 && clientDocs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No published knowledge yet.</p>
            ) : null}
            {publicDocs.map(doc => (
                <article key={doc.id} className="space-y-1 rounded-2xl border border-border/70 p-4">
                    <h2 className="text-sm font-medium">{doc.title}</h2>
                    <p className="whitespace-pre-wrap text-sm text-muted-foreground">{doc.rawText}</p>
                </article>
            ))}
            {clientDocs.map(doc => (
                <article key={doc.id} className="space-y-1 rounded-2xl border border-border/70 p-4">
                    <div className="flex items-center gap-2">
                        <h2 className="text-sm font-medium">{doc.title}</h2>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">Clients only</span>
                    </div>
                    <p className="whitespace-pre-wrap text-sm text-muted-foreground">{doc.rawText}</p>
                </article>
            ))}
        </main>
    )
}

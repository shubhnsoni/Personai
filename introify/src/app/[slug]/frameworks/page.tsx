import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { FrameworkRunner } from "@/components/profile/framework-runner"
import { frameworkDraftSchema, type FrameworkDraft } from "@/lib/profile-import-contract"

export const dynamic = "force-dynamic"

export default async function FrameworksPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params
    const profile = await prisma.profile.findUnique({
        where: { slug },
        select: { id: true, displayName: true, isPublic: true },
    })
    if (!profile || !profile.isPublic) notFound()

    const rows = await prisma.profileFramework.findMany({
        where: { profileId: profile.id, status: "PUBLISHED", scoringApproved: true },
        orderBy: { createdAt: "desc" },
        select: { id: true, title: true, description: true, definition: true },
    })
    const frameworks = rows
        .map(row => ({ ...row, parsed: frameworkDraftSchema.safeParse(row.definition) }))
        .flatMap(row => row.parsed.success ? [{ id: row.id, title: row.title, description: row.description, definition: row.parsed.data as FrameworkDraft }] : [])

    return (
        <main className="mx-auto w-full max-w-2xl space-y-8 px-4 py-10">
            <p className="text-sm text-muted-foreground">{profile.displayName}</p>
            {frameworks.length === 0 ? (
                <p className="text-sm text-muted-foreground">No published self-assessments yet.</p>
            ) : frameworks.map(framework => (
                <FrameworkRunner key={framework.id} title={framework.title} description={framework.description} definition={framework.definition} />
            ))}
        </main>
    )
}

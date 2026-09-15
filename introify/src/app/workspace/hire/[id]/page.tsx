import { notFound, redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { hireLanguage } from "@/lib/workspace-economy"

export const dynamic = "force-dynamic"

export default async function HirePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const creation = await prisma.creation.findFirst({
        where: { id, visibility: { in: ["UNLISTED", "SHOWCASE"] } },
        include: { profile: { select: { slug: true } } },
    })
    if (!creation) notFound()
    redirect(`/${creation.profile.slug}/ai/${creation.slug}`)
    return <p>{hireLanguage()}</p>
}

import { headers } from "next/headers"
import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { catalogPath, isRestaurant } from "@/lib/menu"
import { GuestSharePanel } from "@/components/profile/guest-qr-share"

export const dynamic = "force-dynamic"

export default async function GuestSharePage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params
    const profile = await prisma.profile.findUnique({
        where: { slug },
        select: { displayName: true, isPublic: true, roleTemplate: true, slug: true, whatsapp: true },
    })
    if (!profile || !profile.isPublic) notFound()

    const h = await headers()
    const host = h.get("x-forwarded-host") || h.get("host") || "introify.com"
    const proto = h.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https")
    const origin = `${proto}://${host}`
    const food = isRestaurant(profile.roleTemplate)
    const pageUrl = `${origin}/${profile.slug}`
    const menuUrl = food ? `${origin}${catalogPath(profile.slug, profile.roleTemplate)}` : null

    return (
        <GuestSharePanel
            slug={profile.slug}
            name={profile.displayName}
            pageUrl={pageUrl}
            menuUrl={menuUrl}
            whatsapp={profile.whatsapp}
            isFood={food}
        />
    )
}

import { headers } from "next/headers"
import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { catalogPath, isRestaurant } from "@/lib/menu"
import { GuestQrPanel } from "@/components/profile/guest-qr-share"

export const dynamic = "force-dynamic"

export default async function GuestQrPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params
    const profile = await prisma.profile.findUnique({
        where: { slug },
        select: { displayName: true, isPublic: true, roleTemplate: true, slug: true },
    })
    if (!profile || !profile.isPublic) notFound()

    const h = await headers()
    const host = h.get("x-forwarded-host") || h.get("host") || "introify.com"
    const proto = h.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https")
    const origin = `${proto}://${host}`
    const food = isRestaurant(profile.roleTemplate)
    const path = food ? catalogPath(profile.slug, profile.roleTemplate) : `/${profile.slug}`
    const targetUrl = `${origin}${path}?ref=qr`

    return (
        <GuestQrPanel
            slug={profile.slug}
            name={profile.displayName}
            targetUrl={targetUrl}
            targetLabel={food ? "the menu" : "this page"}
        />
    )
}

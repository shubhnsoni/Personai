import type { ReactNode } from "react"
import Link from "@/components/navigation/transition-link"
import { prisma } from "@/lib/prisma"
import { notFound, permanentRedirect } from "next/navigation"
import { canHideIntroifyBrand, configuredProfileAnimation, publicBrandingAccess } from "@/lib/profile-branding"
import { hotelHidesIntroifyChrome, isHotelRole } from "@/lib/hotels"
import { isLocaleHomeSlug, isReservedUiLocale } from "@/lib/ui-locale"
import { isReservedSlug } from "@/lib/slugs"
import { resolveBloubTheme } from "@/lib/bloub/catalog"
import { PublicBusinessFrame } from "@/components/profile/public-business-frame"
import { isIndexableProfileSlug, marketingMetadata, marketingOrigin, marketingStructuredData } from "@/lib/marketing-seo"
import { HomeLanding } from "@/components/landing/home-landing"
import { Metadata } from "next"
import "@/components/profile/retro-lcd-theme.css"
import "@/components/profile/premium-themes.css"

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
    const { slug } = await params
    if (isLocaleHomeSlug(slug)) {
        const { messagesFor } = await import("@/lib/ui-messages")
        const meta = messagesFor(slug).meta
        return marketingMetadata({
            title: meta.homeTitle,
            description: meta.homeDescription,
            path: `/${slug}`,
            languages: true,
        })
    }
    if (isReservedUiLocale(slug) || isReservedSlug(slug)) {
        return { title: "Not Found", robots: { index: false, follow: false } }
    }
    const profile = await prisma.profile.findUnique({
        where: { slug },
        select: { displayName: true, headline: true, bio: true, slug: true, isPublic: true }
    })
    if (!profile || !profile.isPublic) {
        return { title: "Profile Not Found", robots: { index: false, follow: false } }
    }
    const description = profile.headline || profile.bio || `Chat with ${profile.displayName}'s AI clone on Introify.`
    const baseUrl = marketingOrigin()
    const profileUrl = `${baseUrl}/${profile.slug}`
    return {
        title: `${profile.displayName} | Introify`,
        description,
        robots: { index: isIndexableProfileSlug(profile.slug), follow: true },
        openGraph: {
            title: `${profile.displayName} — Introify`,
            description,
            url: profileUrl,
            siteName: "Introify",
            type: "profile",
        },
        twitter: {
            card: "summary_large_image",
            title: `${profile.displayName} — Introify`,
            description,
        },
        alternates: { canonical: profileUrl },
    }
}

export default async function PublicBusinessLayout({ children, params }: { children: ReactNode; params: Promise<{ slug: string }> }) {
    const { slug } = await params

    if (slug === "en") permanentRedirect("/")
    if (isLocaleHomeSlug(slug)) {
        return (
            <>
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{
                        __html: JSON.stringify(marketingStructuredData()).replace(/</g, "\\u003c"),
                    }}
                />
                <HomeLanding locale={slug} />
            </>
        )
    }
    if (isReservedUiLocale(slug) || isReservedSlug(slug)) notFound()

    const profile = await prisma.profile.findUnique({ where: { slug }, select: { id: true, isPublic: true, personalityConfig: true, roleTemplate: true, animationStyle: { select: { config: true } } } })
    if (!profile || !profile.isPublic) notFound()

    const entitled = await publicBrandingAccess(profile.id)
    const hotelWhiteLabel = isHotelRole(profile.roleTemplate)
        ? Boolean((await prisma.hotelProperty.findUnique({ where: { profileId: profile.id }, select: { whiteLabel: true } }))?.whiteLabel)
        : false
    const hideBrand = profile.isPublic && (
        isHotelRole(profile.roleTemplate)
            ? hotelHidesIntroifyChrome({ entitled, hotelWhiteLabel, personalityConfig: profile.personalityConfig })
            : canHideIntroifyBrand(entitled, profile.personalityConfig)
    )
    const content = <>{children}{profile?.isPublic && !hideBrand && (
        <footer className="shrink-0 border-t border-border bg-profile px-4 py-3 text-center text-xs text-muted-foreground">
            Made with <Link href="/" className="font-semibold text-foreground underline-offset-4 hover:underline">Introify</Link>
        </footer>
    )}</>

    return profile?.isPublic
        ? <PublicBusinessFrame profilePath={`/${slug}`} theme={resolveBloubTheme(configuredProfileAnimation(profile).theme)}>{content}</PublicBusinessFrame>
        : content
}

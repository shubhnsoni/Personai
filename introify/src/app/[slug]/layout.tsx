import type { ReactNode } from "react"
import Link from "@/components/navigation/transition-link"
import { prisma } from "@/lib/prisma"
import { canHideIntroifyBrand, configuredProfileAnimation, publicBrandingAccess } from "@/lib/profile-branding"
import { isReservedUiLocale } from "@/lib/ui-locale"
import { resolveBloubTheme } from "@/lib/bloub/catalog"
import "@/components/profile/retro-lcd-theme.css"

export default async function PublicBusinessLayout({ children, params }: { children: ReactNode; params: Promise<{ slug: string }> }) {
    const { slug } = await params
    if (isReservedUiLocale(slug)) return children
    const profile = await prisma.profile.findUnique({ where: { slug }, select: { id: true, isPublic: true, personalityConfig: true, animationStyle: { select: { config: true } } } })
    const hideBrand = profile?.isPublic && canHideIntroifyBrand(await publicBrandingAccess(profile.id), profile.personalityConfig)
    const content = <>{children}{profile?.isPublic && !hideBrand && (
        <footer className="border-t border-border bg-background px-4 py-3 text-center text-xs text-muted-foreground">
            Made with <Link href="/" className="font-semibold text-foreground underline-offset-4 hover:underline">Introify</Link>
        </footer>
    )}</>
    return profile?.isPublic && resolveBloubTheme(configuredProfileAnimation(profile).theme) === "retro-lcd"
        ? <div data-public-business-theme="retro-lcd">{content}</div>
        : content
}

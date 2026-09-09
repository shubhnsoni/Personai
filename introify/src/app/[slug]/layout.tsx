import type { ReactNode } from "react"
import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { canHideIntroifyBrand, publicBrandingAccess } from "@/lib/profile-branding"

export default async function PublicBusinessLayout({ children, params }: { children: ReactNode; params: Promise<{ slug: string }> }) {
    const { slug } = await params
    const profile = await prisma.profile.findUnique({ where: { slug }, select: { id: true, isPublic: true, personalityConfig: true } })
    const hideBrand = profile?.isPublic && canHideIntroifyBrand(await publicBrandingAccess(profile.id), profile.personalityConfig)
    return <>{children}{profile?.isPublic && !hideBrand && (
        <footer className="border-t border-border bg-background px-4 py-3 text-center text-xs text-muted-foreground">
            Made with <Link href="/" className="font-semibold text-foreground underline-offset-4 hover:underline">Introify</Link>
        </footer>
    )}</>
}

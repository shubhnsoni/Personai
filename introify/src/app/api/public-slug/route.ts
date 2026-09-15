import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { isReservedSlug } from "@/lib/slugs"
import { isLocaleHomeSlug } from "@/lib/ui-locale"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
    const slug = new URL(req.url).searchParams.get("slug")?.trim().toLowerCase() || ""
    if (!slug || slug.length > 64 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
        return NextResponse.json({ exists: false })
    }
    if (isReservedSlug(slug) && !isLocaleHomeSlug(slug)) {
        return NextResponse.json({ exists: false })
    }
    const profile = await prisma.profile.findUnique({
        where: { slug },
        select: { isPublic: true },
    })
    return NextResponse.json({ exists: Boolean(profile?.isPublic) })
}

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

interface RouteParams {
    params: Promise<{ code: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
    const { code } = await params

    const shortLink = await prisma.shortLink.findUnique({
        where: { code }
    })

    if (!shortLink) {
        return new NextResponse("Link not found", { status: 404 })
    }

    if (!shortLink.isActive) {
        return new NextResponse("This link is no longer active", { status: 404 })
    }

    await prisma.shortLink.update({
        where: { id: shortLink.id },
        data: { clicks: { increment: 1 } }
    })

    return NextResponse.redirect(shortLink.targetUrl, { status: 302 })
}

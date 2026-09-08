import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = 'force-dynamic'

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

    const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || request.nextUrl.host
    const protoHeader = request.headers.get("x-forwarded-proto")
    const proto = protoHeader || (request.nextUrl.protocol.replace(":", "") || "http")
    const origin = `${proto}://${host}`

    let target = shortLink.targetUrl
    try {
        const parsed = new URL(target)
        if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1" || parsed.hostname === "0.0.0.0") {
            target = new URL(parsed.pathname + parsed.search + parsed.hash, origin).toString()
        }
    } catch {
        if (target.startsWith("/")) {
            target = new URL(target, origin).toString()
        }
    }

    const res = NextResponse.redirect(target, { status: 302 })
    res.cookies.set("pl_ref", code.slice(0, 40), { path: "/", maxAge: 60 * 60 * 24 * 30, sameSite: "lax" })
    return res
}

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { checkRateLimit } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"

const OPEN_MS = 30 * 60 * 1000

function deviceOf(ua: string) {
    const t = ua.toLowerCase()
    if (/ipad|tablet/.test(t)) return "tablet"
    if (/mobi|iphone|android/.test(t)) return "mobile"
    return "desktop"
}

function hostOf(url: string) {
    try {
        return new URL(url).host.slice(0, 80)
    } catch {
        return ""
    }
}

export async function POST(req: NextRequest) {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown"
    const { allowed } = checkRateLimit(`sess:${ip}`, 120)
    if (!allowed) return NextResponse.json({ ok: false }, { status: 429 })

    let body: {
        slug?: string
        path?: string
        leave?: boolean
        sessionId?: string
        pageviewId?: string
        ref?: string
        referrer?: string
        utmSource?: string
        utmMedium?: string
        utmCampaign?: string
    }
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ ok: false }, { status: 400 })
    }
    const slug = body.slug?.trim().toLowerCase()
    const path = (body.path || "/").slice(0, 180)
    if (!slug) return NextResponse.json({ ok: false }, { status: 400 })

    const profile = await prisma.profile.findUnique({ where: { slug }, select: { id: true, isPublic: true } })
    if (!profile || !profile.isPublic) return NextResponse.json({ ok: false }, { status: 404 })

    const visitorId = req.cookies.get("pl_vid")?.value?.slice(0, 80)
    if (!visitorId) return NextResponse.json({ ok: false }, { status: 400 })

    const now = new Date()
    if (body.leave && body.pageviewId) {
        const page = await prisma.visitorPageview.findUnique({ where: { id: body.pageviewId } })
        if (page && !page.leftAt) {
            const ms = Math.max(0, now.getTime() - page.enteredAt.getTime())
            await prisma.visitorPageview.update({
                where: { id: page.id },
                data: { leftAt: now, ms },
            })
        }
        if (body.sessionId) {
            await prisma.visitorSession.update({
                where: { id: body.sessionId },
                data: { lastSeenAt: now },
            }).catch(() => {})
        }
        return NextResponse.json({ ok: true })
    }

    const country = req.headers.get("x-vercel-ip-country") || req.headers.get("cf-ipcountry") || null
    const device = deviceOf(req.headers.get("user-agent") || "")
    const referrerHost = hostOf(body.referrer || "") || null
    const landRef = (body.ref || req.cookies.get("pl_ref")?.value || "").slice(0, 40) || null

    let session = body.sessionId
        ? await prisma.visitorSession.findFirst({
            where: { id: body.sessionId, profileId: profile.id, visitorId },
            include: { pages: { where: { leftAt: null }, orderBy: { enteredAt: "desc" }, take: 1 } },
        })
        : null
    if (!session) {
        session = await prisma.visitorSession.findFirst({
            where: {
                profileId: profile.id,
                visitorId,
                endedAt: null,
                lastSeenAt: { gte: new Date(now.getTime() - OPEN_MS) },
            },
            include: { pages: { where: { leftAt: null }, orderBy: { enteredAt: "desc" }, take: 1 } },
            orderBy: { lastSeenAt: "desc" },
        })
    }
    if (!session) {
        session = await prisma.visitorSession.create({
            data: {
                profileId: profile.id,
                visitorId,
                landPath: path,
                landRef,
                utmSource: body.utmSource?.slice(0, 40) || null,
                utmMedium: body.utmMedium?.slice(0, 40) || null,
                utmCampaign: body.utmCampaign?.slice(0, 40) || null,
                referrerHost,
                country: country?.slice(0, 8) || null,
                device,
            },
            include: { pages: true },
        })
    } else {
        await prisma.visitorSession.update({
            where: { id: session.id },
            data: { lastSeenAt: now },
        })
    }

    const open = session.pages[0]
    let pageviewId = open?.id
    if (!open || open.path !== path) {
        if (open) {
            await prisma.visitorPageview.update({
                where: { id: open.id },
                data: { leftAt: now, ms: Math.max(0, now.getTime() - open.enteredAt.getTime()) },
            })
        }
        const created = await prisma.visitorPageview.create({
            data: { sessionId: session.id, path },
        })
        pageviewId = created.id
    }

    return NextResponse.json({ ok: true, sessionId: session.id, pageviewId })
}

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { checkRateLimit } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"

const NAMES = new Set([
    "visit", "chat_open", "chip", "shop_view", "menu_view", "reserve_open", "wa_tap", "qr",
])

export async function POST(req: NextRequest) {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
        || req.headers.get("x-real-ip")
        || "unknown"
    const raw = await req.text()
    const body = (() => { try { return JSON.parse(raw) } catch { return null } })() as {
        slug?: string
        name?: string
        path?: string
        ref?: string
        meta?: Record<string, unknown>
    } | null
    const slug = body?.slug?.trim().toLowerCase()
    const name = body?.name?.trim()
    if (!body || !slug || !name || !NAMES.has(name)) {
        return NextResponse.json({ ok: false }, { status: 400 })
    }
    const { allowed } = checkRateLimit(`ev:${ip}:${slug}`, 60)
    if (!allowed) return NextResponse.json({ ok: false }, { status: 429 })

    const profile = await prisma.profile.findUnique({
        where: { slug },
        select: { id: true, isPublic: true },
    })
    if (!profile || !profile.isPublic) return NextResponse.json({ ok: false }, { status: 404 })

    const cookieVid = req.cookies.get("pl_vid")?.value
    const cookieRef = req.cookies.get("pl_ref")?.value
    const ref = (body.ref || cookieRef || "").slice(0, 40) || null

    await prisma.profileEvent.create({
        data: {
            profileId: profile.id,
            name,
            path: (body.path || "").slice(0, 180) || null,
            ref,
            visitor: cookieVid?.slice(0, 80) || null,
            meta: body.meta ? JSON.stringify(body.meta).slice(0, 500) : null,
        },
    })

    return NextResponse.json({ ok: true })
}

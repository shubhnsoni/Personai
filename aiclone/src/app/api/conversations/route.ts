import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"
import { checkRateLimit } from "@/lib/rate-limit"

export const dynamic = 'force-dynamic'

const VISITOR_COOKIE = "pl_vid"
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365

function clientIp(req: NextRequest): string {
    return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
        || req.headers.get("x-real-ip")
        || "unknown"
}

function withVisitorCookie(res: NextResponse, visitorId: string, setCookie: boolean): NextResponse {
    if (setCookie) {
        res.cookies.set(VISITOR_COOKIE, visitorId, {
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
            path: "/",
            maxAge: COOKIE_MAX_AGE,
        })
    }
    return res
}

/**
 * GET /api/conversations?profileId=xxx&visitorId=yyy
 * Cookie-bound visitor threads only. Query visitorId must match httpOnly pl_vid.
 */
export async function GET(req: NextRequest) {
    const { allowed } = checkRateLimit(clientIp(req))
    if (!allowed) {
        return NextResponse.json({ error: "Too many requests" }, { status: 429 })
    }

    const existingCookie = req.cookies.get(VISITOR_COOKIE)?.value
    const visitorId = existingCookie || crypto.randomUUID()
    const setCookie = !existingCookie

    const { searchParams } = req.nextUrl
    const profileId = searchParams.get("profileId")
    const queryVisitorId = searchParams.get("visitorId")

    if (queryVisitorId && queryVisitorId !== visitorId) {
        return withVisitorCookie(
            NextResponse.json({ error: "Forbidden" }, { status: 403 }),
            visitorId,
            setCookie,
        )
    }

    if (!profileId) {
        return withVisitorCookie(
            NextResponse.json({ messages: [], conversationId: null }),
            visitorId,
            setCookie,
        )
    }

    const conversation = await prisma.conversation.findFirst({
        where: {
            profileId,
            visitorId,
        },
        orderBy: { lastMessageAt: "desc" },
        include: {
            messages: {
                orderBy: { createdAt: "asc" },
                take: 50,
            }
        }
    })

    if (!conversation) {
        return withVisitorCookie(
            NextResponse.json({ messages: [], conversationId: null }),
            visitorId,
            setCookie,
        )
    }

    return withVisitorCookie(
        NextResponse.json({
            conversationId: conversation.id,
            messages: conversation.messages.map(m => ({
                id: m.id,
                role: m.role as "user" | "assistant",
                content: m.text,
            }))
        }),
        visitorId,
        setCookie,
    )
}

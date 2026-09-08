import { NextRequest, NextResponse } from "next/server"
import { consumeLibraryLink, createMemberSession, setMemberCookie } from "@/lib/members"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
    const token = request.nextUrl.searchParams.get("token")
    if (!token) {
        return NextResponse.redirect(originUrl(request, "/library/login"))
    }
    const member = await consumeLibraryLink(token)
    if (!member) {
        return NextResponse.redirect(originUrl(request, "/library/login?error=expired"))
    }
    const session = await createMemberSession(member.id)
    await setMemberCookie(session)
    return NextResponse.redirect(originUrl(request, "/library"))
}

function originUrl(request: NextRequest, path: string) {
    const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || request.nextUrl.host
    const proto = request.headers.get("x-forwarded-proto") || request.nextUrl.protocol.replace(":", "") || "http"
    return `${proto}://${host}${path}`
}

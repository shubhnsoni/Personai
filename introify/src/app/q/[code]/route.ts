import { NextRequest, NextResponse } from "next/server"
import { resolveHotelQr } from "@/lib/hotels/store"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
    const { code } = await params
    const resolved = await resolveHotelQr(code)
    if (!resolved) {
        return new NextResponse("QR not found", { status: 404 })
    }
    const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || request.nextUrl.host
    const proto = request.headers.get("x-forwarded-proto") || request.nextUrl.protocol.replace(":", "") || "http"
    const target = new URL(resolved.path, `${proto}://${host}`)
    return NextResponse.redirect(target, { status: 302 })
}

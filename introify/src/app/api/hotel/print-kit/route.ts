import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { isHotelRole } from "@/lib/hotels"
import { buildPrintPackage } from "@/lib/hotels/print-kit"
import { requireProfileAccess, ownershipRefusalResponse } from "@/lib/security"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
    const access = await requireProfileAccess({ permission: "operations.write" })
    if (!access.ok) return ownershipRefusalResponse(access.refusal)
    const { profile } = access.value
    if (!isHotelRole(profile.roleTemplate)) {
        return NextResponse.json({ error: "This desk is for hotel profiles." }, { status: 403 })
    }

    const qrs = await prisma.hotelQr.findMany({
        where: { profileId: profile.id },
        include: { room: { select: { number: true } } },
        orderBy: [{ kind: "asc" }, { createdAt: "asc" }],
    })
    if (!qrs.length) {
        return NextResponse.json({ error: "Generate QRs before downloading a print kit." }, { status: 409 })
    }

    const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "introify.com"
    const proto = request.headers.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https")
    const accent = profile.themeColor && profile.themeColor !== "#000000" ? profile.themeColor : "#00D7FF"
    const pack = buildPrintPackage({
        slug: profile.slug,
        hotelName: profile.displayName,
        origin: `${proto}://${host}`,
        accent,
        logoUrl: profile.shopLogoUrl || profile.imageUrl,
        qrs: qrs.map((row) => ({
            code: row.code,
            kind: row.kind,
            label: row.label,
            roomNumber: row.room?.number || null,
        })),
    })

    const payload = new ArrayBuffer(pack.zip.byteLength)
    new Uint8Array(payload).set(pack.zip)
    return new NextResponse(new Blob([payload], { type: "application/zip" }), {
        status: 200,
        headers: {
            "Content-Type": "application/zip",
            "Content-Disposition": `attachment; filename="${pack.filename}"`,
            "Cache-Control": "no-store",
        },
    })
}

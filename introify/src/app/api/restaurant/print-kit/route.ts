import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { isRestaurant } from "@/lib/menu"
import { buildFoodPrintPackage } from "@/lib/restaurants/print-kit"
import { requireProfileAccess, ownershipRefusalResponse } from "@/lib/security"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
    const access = await requireProfileAccess({ permission: "operations.write" })
    if (!access.ok) return ownershipRefusalResponse(access.refusal)
    const { profile } = access.value
    if (!isRestaurant(profile.roleTemplate)) {
        return NextResponse.json({ error: "This desk is for food profiles." }, { status: 403 })
    }

    const tables = await prisma.restaurantTable.findMany({
        where: { profileId: profile.id, isActive: true },
        orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    })
    if (!tables.length) {
        return NextResponse.json({ error: "Add tables before downloading a print kit." }, { status: 409 })
    }

    const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "introify.com"
    const proto = request.headers.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https")
    const accent = profile.themeColor && profile.themeColor !== "#000000" ? profile.themeColor : "#00D7FF"
    const pack = buildFoodPrintPackage({
        slug: profile.slug,
        name: profile.displayName,
        origin: `${proto}://${host}`,
        accent,
        logoUrl: profile.shopLogoUrl || profile.imageUrl,
        tables: tables.map((row) => ({
            code: row.code,
            label: row.label,
            seats: row.seats,
            zone: row.zone,
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

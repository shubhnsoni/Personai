import { NextResponse } from "next/server"
import { http404Response } from "@/lib/http-404"
import { prisma } from "@/lib/prisma"
import { isHotelRole } from "@/lib/hotels"
import { findHotelRoom } from "@/lib/hotels/store"

export const dynamic = "force-dynamic"

async function resolve(req: Request, method: string) {
    const url = new URL(req.url)
    const slug = url.searchParams.get("slug")?.trim().toLowerCase() || ""
    const room = url.searchParams.get("room")?.trim() || ""
    const from = url.searchParams.get("from") || (slug ? (room ? `/${slug}/r/${encodeURIComponent(room)}` : `/${slug}`) : "")

    if (slug && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length <= 64) {
        try {
            const profile = await prisma.profile.findUnique({
                where: { slug },
                select: { id: true, isPublic: true, roleTemplate: true },
            })
            if (!profile?.isPublic) return http404Response(method)

            if (room) {
                if (!isHotelRole(profile.roleTemplate)) return http404Response(method)
                const hotelRoom = await findHotelRoom(profile.id, room)
                if (!hotelRoom?.isActive) return http404Response(method)
                const dest = new URL(from || `/${slug}/r/${encodeURIComponent(room)}`, url.origin)
                const safe =
                    dest.origin === url.origin &&
                    dest.pathname.startsWith(`/${slug}/`)
                const target = safe ? dest : new URL(`/${slug}/r/${encodeURIComponent(hotelRoom.number)}`, url.origin)
                const res = NextResponse.redirect(target, 307)
                res.cookies.set("introify-slug-gate", slug, {
                    path: "/",
                    maxAge: 15,
                    httpOnly: true,
                    sameSite: "lax",
                    secure: target.protocol === "https:",
                })
                return res
            }

            const dest = new URL(from || `/${slug}`, url.origin)
            const safe =
                dest.origin === url.origin &&
                (dest.pathname === `/${slug}` || dest.pathname.startsWith(`/${slug}/`))
            const target = safe ? dest : new URL(`/${slug}`, url.origin)
            const res = NextResponse.redirect(target, 307)
            res.cookies.set("introify-slug-gate", slug, {
                path: "/",
                maxAge: 15,
                httpOnly: true,
                sameSite: "lax",
                secure: target.protocol === "https:",
            })
            return res
        } catch {
            // DB error → still hard 404 rather than soft 200
        }
        return http404Response(method)
    }

    return http404Response(method)
}

export function GET(req: Request) {
    return resolve(req, "GET")
}

export function HEAD(req: Request) {
    return resolve(req, "HEAD")
}

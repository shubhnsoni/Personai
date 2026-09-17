import { NextResponse } from "next/server"
import { http404Response } from "@/lib/http-404"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

async function resolve(req: Request, method: string) {
    const url = new URL(req.url)
    const slug = url.searchParams.get("slug")?.trim().toLowerCase() || ""
    const from = url.searchParams.get("from") || (slug ? `/${slug}` : "")

    if (slug && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length <= 64) {
        try {
            const profile = await prisma.profile.findUnique({
                where: { slug },
                select: { isPublic: true },
            })
            if (profile?.isPublic) {
                const dest = new URL(from || `/${slug}`, url.origin)
                const safe =
                    dest.origin === url.origin &&
                    (dest.pathname === `/${slug}` || dest.pathname.startsWith(`/${slug}/`))
                const target = safe ? dest : new URL(`/${slug}`, url.origin)
                const res = NextResponse.redirect(target, 307)
                // One-shot gate so proxy skips the broken self-fetch and does not loop.
                res.cookies.set("introify-slug-gate", slug, {
                    path: "/",
                    maxAge: 15,
                    httpOnly: true,
                    sameSite: "lax",
                    secure: target.protocol === "https:",
                })
                return res
            }
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
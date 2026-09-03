import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { fetchGooglePlace, googlePlaceFromConfig } from "@/lib/google-place"

export const dynamic = "force-dynamic"

const cache = new Map<string, { at: number; body: unknown }>()
const TTL = 30 * 60 * 1000
const CACHE_KEY = "v3"

export async function GET(request: NextRequest) {
    const slug = request.nextUrl.searchParams.get("slug")?.trim()
    if (!slug || !/^[a-z0-9-]{2,60}$/.test(slug)) {
        return NextResponse.json({ error: "Missing place" }, { status: 400 })
    }

    const hit = cache.get(`${CACHE_KEY}:${slug}`)
    if (hit && Date.now() - hit.at < TTL) {
        return NextResponse.json(hit.body)
    }

    const profile = await prisma.profile.findUnique({
        where: { slug },
        select: { displayName: true, isPublic: true, personalityConfig: true },
    })
    if (!profile || !profile.isPublic) {
        return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const fromConfig = googlePlaceFromConfig(profile.personalityConfig)
    if (!fromConfig.mapsUrl && !fromConfig.placeId) {
        return NextResponse.json({ error: "No Google listing linked" }, { status: 404 })
    }

    try {
        const info = await fetchGooglePlace({
            name: profile.displayName,
            mapsUrl: fromConfig.mapsUrl,
            placeId: fromConfig.placeId,
        })
        cache.set(`${CACHE_KEY}:${slug}`, { at: Date.now(), body: info })
        return NextResponse.json(info)
    } catch {
        return NextResponse.json({ error: "Could not reach Google" }, { status: 502 })
    }
}

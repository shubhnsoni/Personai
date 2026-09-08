import { NextRequest, NextResponse } from "next/server"
import { embedDocument, embedProfileDocuments } from "@/lib/embeddings"
import { syncUser } from "@/lib/auth-sync"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

/**
 * POST /api/embeddings
 * Body: { documentId?: string, profileId?: string }
 * Auth required. Document/profile must belong to the signed-in user.
 */
export async function POST(req: NextRequest) {
    const user = await syncUser()
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { documentId, profileId } = await req.json()

    if (documentId) {
        const doc = await prisma.profileDocument.findUnique({
            where: { id: documentId },
            include: { profile: { select: { userId: true } } },
        })
        if (!doc) {
            return NextResponse.json({ error: "Not found" }, { status: 404 })
        }
        if (doc.profile.userId !== user.id) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        }
        await embedDocument(documentId)
        return NextResponse.json({ success: true, message: "Document embedded" })
    }

    if (profileId) {
        const profile = await prisma.profile.findUnique({
            where: { id: profileId },
            select: { userId: true },
        })
        if (!profile) {
            return NextResponse.json({ error: "Not found" }, { status: 404 })
        }
        if (profile.userId !== user.id) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        }
        const count = await embedProfileDocuments(profileId)
        return NextResponse.json({ success: true, message: `Embedded ${count} documents` })
    }

    return NextResponse.json({ error: "Provide documentId or profileId" }, { status: 400 })
}

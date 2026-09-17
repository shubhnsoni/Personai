import { mkdir, writeFile } from "fs/promises"
import { resolve } from "path"
import { prisma } from "@/lib/prisma"
import { uploadsDirectory } from "@/lib/uploads-storage"
import {
    conversationCapabilityCookieName,
    productionCapabilitySecret,
    verifyConversationCapability,
} from "@/lib/conversation-capability"

export const runtime = "nodejs"

function cookieMap(header: string | null) {
    const out = new Map<string, string>()
    if (!header) return out
    for (const part of header.split(";")) {
        const idx = part.indexOf("=")
        if (idx < 0) continue
        out.set(part.slice(0, idx).trim(), decodeURIComponent(part.slice(idx + 1).trim()))
    }
    return out
}

export async function POST(request: Request) {
    const form = await request.formData().catch(() => null)
    const requestId = String(form?.get("requestId") || "")
    const file = form?.get("file")
    if (!requestId || !(file instanceof File)) {
        return Response.json({ error: "Photo and request are required." }, { status: 400 })
    }
    const row = await prisma.hotelRequest.findUnique({
        where: { id: requestId },
        select: { id: true, profileId: true, conversationId: true, type: true },
    })
    if (!row?.conversationId) return Response.json({ error: "Unknown request." }, { status: 404 })
    if (row.type !== "MAINTENANCE") return Response.json({ error: "Photos attach to maintenance tickets." }, { status: 400 })

    const cookies = cookieMap(request.headers.get("cookie"))
    const visitorId = cookies.get("pl_vid") || ""
    const token = cookies.get(conversationCapabilityCookieName(row.profileId)) || ""
    const secret = productionCapabilitySecret()
    if (!secret || !visitorId || !verifyConversationCapability({
        token,
        conversationId: row.conversationId,
        profileId: row.profileId,
        visitorId,
        secret,
    })) {
        return Response.json({ error: "Chat session required." }, { status: 401 })
    }

    const bytes = Buffer.from(await file.arrayBuffer())
    if (bytes.length > 8 * 1024 * 1024) return Response.json({ error: "Photo is too large." }, { status: 413 })
    const jpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
    const png = bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50
    if (!jpeg && !png) return Response.json({ error: "Use a JPEG or PNG." }, { status: 415 })
    const ext = jpeg ? "jpg" : "png"
    const owner = row.profileId.replace(/[^a-z0-9_-]/gi, "").slice(0, 32) || "hotel"
    const filename = `maint-${row.id}.${ext}`
    const directory = resolve(uploadsDirectory(), owner)
    await mkdir(directory, { recursive: true })
    await writeFile(resolve(directory, filename), bytes)
    const url = `/uploads/${owner}/${filename}`
    await prisma.hotelRequest.update({ where: { id: row.id }, data: { photoUrl: url } })
    return Response.json({ url })
}

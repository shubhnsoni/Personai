import { NextRequest, NextResponse } from "next/server"
import { writeFile, mkdir } from "fs/promises"
import { join } from "path"
import { randomUUID } from "crypto"
import { imageTo3dGlb } from "@/lib/image-to-3d"

export const runtime = "nodejs"
export const maxDuration = 120

export async function POST(req: NextRequest) {
    try {
        const body = await req.json() as { image?: string }
        if (!body.image || typeof body.image !== "string") {
            return NextResponse.json({ error: "No photo" }, { status: 400 })
        }
        const glb = await imageTo3dGlb(body.image)
        const dir = join(process.cwd(), "public", "uploads")
        await mkdir(dir, { recursive: true })
        const filename = `${randomUUID()}.glb`
        await writeFile(join(dir, filename), glb)
        return NextResponse.json({ url: `/uploads/${filename}`, source: "sf3d" })
    } catch (e) {
        return NextResponse.json(
            { error: e instanceof Error ? e.message : "Could not build 3D" },
            { status: 502 },
        )
    }
}

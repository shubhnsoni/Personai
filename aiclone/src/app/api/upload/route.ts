import { NextRequest, NextResponse } from "next/server"
import { writeFile, mkdir } from "fs/promises"
import { join } from "path"
import { randomUUID } from "crypto"

const UPLOAD_DIR = join(process.cwd(), "public", "uploads")

const ALLOWED_TYPES = [
  "image/jpeg", "image/png", "image/webp", "image/gif",
  "application/pdf",
  "video/mp4", "video/webm",
  "audio/mpeg", "audio/wav",
]

const MAX_SIZE = 50 * 1024 * 1024 // 50MB

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File | null

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "File type not allowed" }, { status: 400 })
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "File too large (max 50MB)" }, { status: 400 })
    }

    const ext = file.name.split(".").pop() || "bin"
    const filename = `${randomUUID()}.${ext}`

    await mkdir(UPLOAD_DIR, { recursive: true })

    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(join(UPLOAD_DIR, filename), buffer)

    const url = `/uploads/${filename}`

    return NextResponse.json({ url, filename })
  } catch (error) {
    console.error("Upload error:", error)
    return NextResponse.json({ error: "Upload failed" }, { status: 500 })
  }
}

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getOwnedCreation, updateCreation } from "@/lib/creations"
import { requireWorkspaceProfile } from "@/lib/workspace-session"

export const dynamic = "force-dynamic"

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await requireWorkspaceProfile()
    if (session.error) return session.error
    const { id } = await params
    const creation = await getOwnedCreation(session.profileId, id)
    if (!creation) return NextResponse.json({ error: "Not found." }, { status: 404 })
    return NextResponse.json({ creation })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await requireWorkspaceProfile()
    if (session.error) return session.error
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    try {
        const creation = await updateCreation(session.profileId, id, body)
        if (!creation) return NextResponse.json({ error: "Not found." }, { status: 404 })
        return NextResponse.json({ creation })
    } catch (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : "Could not update this AI." }, { status: 400 })
    }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await requireWorkspaceProfile()
    if (session.error) return session.error
    const { id } = await params
    const existing = await prisma.creation.findFirst({ where: { id, profileId: session.profileId }, select: { id: true } })
    if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 })
    await prisma.creation.delete({ where: { id } })
    return NextResponse.json({ ok: true })
}

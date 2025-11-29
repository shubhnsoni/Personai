"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

export async function addContent(profileId: string, data: { type: string, title: string, content: string }) {
    await prisma.profileDocument.create({
        data: {
            profileId,
            type: "TEXT", // For now hardcoded or passed
            sourceType: data.type, // "TEXT" or "URL"
            title: data.title,
            rawText: data.content, // For URL, we might want to fetch it, but for MVP let's assume user pastes text or we store URL
            url: data.type === "URL" ? data.content : undefined,
        }
    })
    revalidatePath("/dashboard/content")
}

export async function deleteContent(documentId: string) {
    await prisma.profileDocument.delete({
        where: { id: documentId }
    })
    revalidatePath("/dashboard/content")
}

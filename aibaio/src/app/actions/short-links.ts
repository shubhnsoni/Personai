"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

export interface ShortLinkData {
    title?: string
    targetUrl: string
    code?: string
    isActive: boolean
}

function generateCode(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let code = ''
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return code
}

async function ensureUniqueCode(code: string): Promise<string> {
    const existing = await prisma.shortLink.findUnique({
        where: { code }
    })
    if (existing) {
        return ensureUniqueCode(generateCode())
    }
    return code
}

export async function createShortLink(profileId: string, data: ShortLinkData) {
    const code = data.code?.trim() || generateCode()
    const uniqueCode = await ensureUniqueCode(code)

    await prisma.shortLink.create({
        data: {
            profileId,
            title: data.title?.trim() || null,
            targetUrl: data.targetUrl.trim(),
            code: uniqueCode,
            isActive: data.isActive,
        }
    })
    revalidatePath("/dashboard/links")
}

export async function updateShortLink(linkId: string, data: ShortLinkData) {
    const existingLink = await prisma.shortLink.findUnique({
        where: { id: linkId }
    })

    if (!existingLink) {
        throw new Error("Short link not found")
    }

    let code = existingLink.code
    if (data.code?.trim() && data.code.trim() !== existingLink.code) {
        const codeInUse = await prisma.shortLink.findFirst({
            where: {
                code: data.code.trim(),
                id: { not: linkId }
            }
        })
        if (codeInUse) {
            throw new Error("This code is already in use")
        }
        code = data.code.trim()
    }

    await prisma.shortLink.update({
        where: { id: linkId },
        data: {
            title: data.title?.trim() || null,
            targetUrl: data.targetUrl.trim(),
            code,
            isActive: data.isActive,
        }
    })
    revalidatePath("/dashboard/links")
}

export async function deleteShortLink(linkId: string) {
    await prisma.shortLink.delete({
        where: { id: linkId }
    })
    revalidatePath("/dashboard/links")
}

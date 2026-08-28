"use server"

import { prisma } from "@/lib/prisma"
import { executeOwnedResourceWrite, requireOwnedProfile, unwrapOwnershipResult } from "@/lib/security"
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
    const { profile } = unwrapOwnershipResult(await requireOwnedProfile({ claimedProfileId: profileId }))
    const code = data.code?.trim() || generateCode()
    const uniqueCode = await ensureUniqueCode(code)

    await prisma.shortLink.create({
        data: {
            profileId: profile.id,
            title: data.title?.trim() || null,
            targetUrl: data.targetUrl.trim(),
            code: uniqueCode,
            isActive: data.isActive,
        }
    })
    revalidatePath("/dashboard/links")
}

export async function updateShortLink(linkId: string, data: ShortLinkData) {
    const requestedCode = data.code?.trim()
    try {
        unwrapOwnershipResult(await executeOwnedResourceWrite({
            resourceId: linkId,
            writeOwned: async ({ resourceId, profile }) => {
                const updated = await prisma.shortLink.updateMany({
                    where: { id: resourceId, profileId: profile.id },
                    data: {
                        title: data.title?.trim() || null,
                        targetUrl: data.targetUrl.trim(),
                        code: requestedCode || undefined,
                        isActive: data.isActive,
                    },
                })
                return updated.count === 1 ? true : null
            },
        }))
    } catch (error) {
        if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
            throw new Error("This code is already in use")
        }
        throw error
    }
    revalidatePath("/dashboard/links")
}

export async function deleteShortLink(linkId: string) {
    unwrapOwnershipResult(await executeOwnedResourceWrite({
        resourceId: linkId,
        writeOwned: async ({ resourceId, profile }) => {
            const deleted = await prisma.shortLink.deleteMany({
                where: { id: resourceId, profileId: profile.id },
            })
            return deleted.count === 1 ? true : null
        },
    }))
    revalidatePath("/dashboard/links")
}

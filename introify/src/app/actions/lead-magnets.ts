"use server"

import { withOfferingLimit } from "@/lib/billing/resource-limits"
import { prisma } from "@/lib/prisma"
import { executeProfileResourceWrite, requireProfileAccess, unwrapOwnershipResult } from "@/lib/security"
import { revalidatePath } from "next/cache"

export interface LeadMagnetData {
    title: string
    description?: string
    type: "FORM" | "GIVEAWAY" | "DOWNLOAD"
    fileUrl?: string
    formFields?: string
    isActive: boolean
}

function leadMagnetWrite(data: LeadMagnetData) {
    return {
        title: data.title,
        description: data.description || null,
        type: data.type,
        fileUrl: data.fileUrl || null,
        formFields: data.formFields || null,
        isActive: data.isActive,
    }
}

export async function createLeadMagnet(profileId: string, data: LeadMagnetData) {
    const { profile } = unwrapOwnershipResult(await requireProfileAccess({ claimedProfileId: profileId }))
    await withOfferingLimit(profile.id, "leadMagnet", null, data.isActive, (tx) => tx.leadMagnet.create({
        data: {
            profileId: profile.id,
            ...leadMagnetWrite(data),
        },
    }))
    revalidatePath("/dashboard/lead-magnets")
}

export async function updateLeadMagnet(leadMagnetId: string, data: LeadMagnetData) {
    unwrapOwnershipResult(await executeProfileResourceWrite({
        resourceId: leadMagnetId,
        writeOwned: async ({ resourceId, profile }) => {
            const updated = await withOfferingLimit(profile.id, "leadMagnet", resourceId, data.isActive, (tx) => tx.leadMagnet.updateMany({
                where: { id: resourceId, profileId: profile.id },
                data: leadMagnetWrite(data),
            }))
            return updated.count === 1 ? true : null
        },
    }))
    revalidatePath("/dashboard/lead-magnets")
}

export async function deleteLeadMagnet(leadMagnetId: string) {
    unwrapOwnershipResult(await executeProfileResourceWrite({
        resourceId: leadMagnetId,
        writeOwned: async ({ resourceId, profile }) => {
            const deleted = await prisma.leadMagnet.deleteMany({
                where: { id: resourceId, profileId: profile.id },
            })
            return deleted.count === 1 ? true : null
        },
    }))
    revalidatePath("/dashboard/lead-magnets")
}

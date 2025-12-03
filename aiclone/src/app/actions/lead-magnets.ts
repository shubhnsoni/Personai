"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

export interface LeadMagnetData {
    title: string
    description?: string
    type: "FORM" | "GIVEAWAY" | "DOWNLOAD"
    fileUrl?: string
    formFields?: string
    isActive: boolean
}

export async function createLeadMagnet(profileId: string, data: LeadMagnetData) {
    await prisma.leadMagnet.create({
        data: {
            profileId,
            title: data.title,
            description: data.description || null,
            type: data.type,
            fileUrl: data.fileUrl || null,
            formFields: data.formFields || null,
            isActive: data.isActive,
        }
    })
    revalidatePath("/dashboard/lead-magnets")
}

export async function updateLeadMagnet(leadMagnetId: string, data: LeadMagnetData) {
    await prisma.leadMagnet.update({
        where: { id: leadMagnetId },
        data: {
            title: data.title,
            description: data.description || null,
            type: data.type,
            fileUrl: data.fileUrl || null,
            formFields: data.formFields || null,
            isActive: data.isActive,
        }
    })
    revalidatePath("/dashboard/lead-magnets")
}

export async function deleteLeadMagnet(leadMagnetId: string) {
    await prisma.leadMagnet.delete({
        where: { id: leadMagnetId }
    })
    revalidatePath("/dashboard/lead-magnets")
}

"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

export async function createProfile(userId: string, data: any) {
    // Generate a slug from display name or random
    let slug = data.displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-')

    // Check uniqueness
    const existing = await prisma.profile.findUnique({ where: { slug } })
    if (existing) {
        slug = `${slug}-${Math.floor(Math.random() * 1000)}`
    }

    await prisma.profile.create({
        data: {
            userId,
            slug,
            displayName: data.displayName,
            headline: data.headline,
            bio: data.bio,
            roleTemplate: data.roleTemplate,
            primaryGoal: data.primaryGoal,
            language: data.language,
            timezone: data.timezone,
            animationStyleId: data.animationStyleId,
            isPublic: true, // Auto-publish for MVP
        }
    })

    revalidatePath("/dashboard")
}

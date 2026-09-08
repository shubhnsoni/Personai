"use server"

import { randomBytes } from "node:crypto"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { syncUser } from "@/lib/auth-sync"
import { STORY_CATEGORIES, type StoryCategory, type StoryFrame } from "@/lib/story"
import { writeWalkIn, type AboutWalkIn } from "@/lib/walk-in"

async function owner() {
    const user = await syncUser()
    const profile = user?.profiles[0]
    if (!user || !profile) throw new Error("Unauthorized")
    return profile
}

function newId() {
    return `c${randomBytes(12).toString("hex")}`
}

function asCategory(raw: string | null | undefined): StoryCategory {
    return STORY_CATEGORIES.includes(raw as StoryCategory) ? (raw as StoryCategory) : "AMBIENCE"
}

function mapRow(row: {
    id: string
    url: string
    title?: string | null
    caption?: string | null
    body?: string | null
    category: string
    sortOrder: number
    isPublished?: boolean | null
}): StoryFrame {
    return {
        id: row.id,
        url: row.url,
        title: row.title || "",
        caption: row.caption || "",
        body: row.body || "",
        category: asCategory(row.category),
        sortOrder: row.sortOrder,
        isPublished: row.isPublished !== false,
    }
}

export async function listStoryFrames(): Promise<StoryFrame[]> {
    const profile = await owner()
    const rows = await prisma.$queryRaw<Array<{
        id: string
        url: string
        title: string | null
        caption: string | null
        body: string | null
        category: string
        sortOrder: number
        isPublished: boolean
    }>>`
        SELECT id, url, title, caption, body, category, "sortOrder", "isPublished"
        FROM "ProfileImage"
        WHERE "profileId" = ${profile.id}
        ORDER BY "sortOrder" ASC, "createdAt" ASC
    `
    return rows.map(mapRow)
}

export async function addStoryFrame(input: {
    url: string
    title?: string
    caption?: string
    body?: string
    category?: string
}) {
    const profile = await owner()
    const url = input.url.trim()
    if (!url.startsWith("/") && !url.startsWith("https://")) throw new Error("Upload a photo first.")
    const last = await prisma.$queryRaw<Array<{ sortOrder: number }>>`
        SELECT "sortOrder" FROM "ProfileImage" WHERE "profileId" = ${profile.id} ORDER BY "sortOrder" DESC LIMIT 1
    `
    const sortOrder = (last[0]?.sortOrder || 0) + 1
    const id = newId()
    const category = asCategory(input.category)
    await prisma.$executeRaw`
        INSERT INTO "ProfileImage" (id, "profileId", url, title, caption, body, category, "sortOrder", "isPublished", "createdAt")
        VALUES (
            ${id},
            ${profile.id},
            ${url},
            ${input.title?.trim().slice(0, 80) || null},
            ${input.caption?.trim().slice(0, 160) || null},
            ${input.body?.trim().slice(0, 2000) || null},
            CAST(${category} AS "ProfileImageCategory"),
            ${sortOrder},
            true,
            CURRENT_TIMESTAMP
        )
    `
    revalidatePath("/dashboard/profile")
    revalidatePath(`/${profile.slug}/story`)
    return { id }
}

export async function updateStoryFrame(id: string, input: {
    title?: string
    caption?: string
    body?: string
    category?: string
    isPublished?: boolean
}) {
    const profile = await owner()
    const category = asCategory(input.category)
    await prisma.$executeRaw`
        UPDATE "ProfileImage"
        SET
            title = ${input.title?.trim().slice(0, 80) || null},
            caption = ${input.caption?.trim().slice(0, 160) || null},
            body = ${input.body?.trim().slice(0, 2000) || null},
            category = CAST(${category} AS "ProfileImageCategory"),
            "isPublished" = ${input.isPublished !== false}
        WHERE id = ${id} AND "profileId" = ${profile.id}
    `
    revalidatePath("/dashboard/profile")
    revalidatePath(`/${profile.slug}/story`)
}

export async function moveStoryFrame(id: string, direction: "up" | "down") {
    const profile = await owner()
    const rows = await listStoryFrames()
    const index = rows.findIndex((row) => row.id === id)
    const swapWith = direction === "up" ? index - 1 : index + 1
    if (index < 0 || swapWith < 0 || swapWith >= rows.length) return
    const a = rows[index]
    const b = rows[swapWith]
    await prisma.$executeRaw`UPDATE "ProfileImage" SET "sortOrder" = ${b.sortOrder} WHERE id = ${a.id} AND "profileId" = ${profile.id}`
    await prisma.$executeRaw`UPDATE "ProfileImage" SET "sortOrder" = ${a.sortOrder} WHERE id = ${b.id} AND "profileId" = ${profile.id}`
    revalidatePath("/dashboard/profile")
    revalidatePath(`/${profile.slug}/story`)
}

export async function deleteStoryFrame(id: string) {
    const profile = await owner()
    await prisma.$executeRaw`DELETE FROM "ProfileImage" WHERE id = ${id} AND "profileId" = ${profile.id}`
    revalidatePath("/dashboard/profile")
    revalidatePath(`/${profile.slug}/story`)
}

export async function setAboutWalkIn(walkIn: AboutWalkIn | null) {
    const profile = await owner()
    const row = await prisma.profile.findUnique({
        where: { id: profile.id },
        select: { personalityConfig: true, slug: true },
    })
    const next = writeWalkIn(row?.personalityConfig, walkIn)
    await prisma.profile.update({
        where: { id: profile.id },
        data: { personalityConfig: next },
    })
    revalidatePath("/dashboard/profile")
    revalidatePath(`/${profile.slug}/story`)
}

export async function publishedStoryForSlug(slug: string) {
    const profile = await prisma.profile.findUnique({
        where: { slug },
        select: {
            id: true,
            slug: true,
            displayName: true,
            headline: true,
            bio: true,
            imageUrl: true,
            shopLogoUrl: true,
            roleTemplate: true,
            isPublic: true,
            whatsapp: true,
            personalityConfig: true,
            availability: {
                select: {
                    dayOfWeek: true,
                    startTime: true,
                    endTime: true,
                    isEnabled: true,
                },
            },
        },
    })
    if (!profile || !profile.isPublic) return null
    const rows = await prisma.$queryRaw<Array<{
        id: string
        url: string
        title: string | null
        caption: string | null
        body: string | null
        category: string
        sortOrder: number
        isPublished: boolean
    }>>`
        SELECT id, url, title, caption, body, category, "sortOrder", "isPublished"
        FROM "ProfileImage"
        WHERE "profileId" = ${profile.id} AND "isPublished" = true
        ORDER BY "sortOrder" ASC, "createdAt" ASC
    `
    return { profile, frames: rows.map(mapRow) }
}

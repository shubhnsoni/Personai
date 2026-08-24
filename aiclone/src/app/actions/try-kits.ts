"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { syncUser } from "@/lib/auth-sync"
import { ACTIVE_PROFILE_COOKIE, TRY_KITS } from "@/lib/try-kits"

async function seedRole(profileId: string, role: string) {
    if (role === "RESTAURANT") {
        const existing = await prisma.serviceOffering.count({ where: { profileId } })
        if (existing === 0) {
            await prisma.serviceOffering.create({
                data: {
                    profileId,
                    name: "Reserve a table",
                    description: "Dine-in seating",
                    priceCents: 0,
                    isFree: true,
                    durationMinutes: 90,
                    currency: "USD",
                    isActive: true,
                    kind: "TABLE",
                    covers: 20,
                },
            })
        }
        const hours = await prisma.availabilitySchedule.count({ where: { profileId } })
        if (hours === 0) {
            await prisma.availabilitySchedule.createMany({
                data: [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
                    profileId,
                    dayOfWeek,
                    startTime: "12:00",
                    endTime: "22:00",
                    isEnabled: dayOfWeek !== 1,
                })),
            })
        }
    }

    if (role === "CONSULTANT" || role === "CA" || role === "COACH") {
        const existing = await prisma.serviceOffering.count({ where: { profileId } })
        if (existing === 0) {
            await prisma.serviceOffering.create({
                data: {
                    profileId,
                    name: role === "COACH" ? "Intro session" : "Fit call",
                    description: "A first conversation to see if we should work together.",
                    priceCents: 0,
                    isFree: true,
                    durationMinutes: 30,
                    currency: "USD",
                    isActive: true,
                    kind: "SESSION",
                },
            })
        }
        const hours = await prisma.availabilitySchedule.count({ where: { profileId } })
        if (hours === 0) {
            await prisma.availabilitySchedule.createMany({
                data: [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
                    profileId,
                    dayOfWeek,
                    startTime: "10:00",
                    endTime: "18:00",
                    isEnabled: dayOfWeek >= 1 && dayOfWeek <= 5,
                })),
            })
        }
    }
}

export async function openTryKit(formData: FormData) {
    const role = String(formData.get("role") || "")
    const user = await syncUser()
    if (!user) redirect("/sign-in")

    const kit = TRY_KITS.find((k) => k.role === role)
    if (!kit) redirect("/qa")

    let profile = await prisma.profile.findFirst({
        where: { userId: user.id, slug: kit.slug },
    })

    if (!profile) {
        const clash = await prisma.profile.findUnique({ where: { slug: kit.slug } })
        const slug = clash ? `${kit.slug}-${user.id.slice(-6).toLowerCase()}` : kit.slug
        profile = await prisma.profile.create({
            data: {
                userId: user.id,
                slug,
                displayName: kit.name,
                headline: kit.blurb,
                roleTemplate: kit.role,
                primaryGoal: kit.goal,
                language: "en",
                timezone: "Asia/Kolkata",
                isPublic: true,
                welcomeMessageOverride: kit.blurb,
            },
        })
        await seedRole(profile.id, kit.role)
    }

    const jar = await cookies()
    jar.set(ACTIVE_PROFILE_COOKIE, profile.id, { path: "/", sameSite: "lax", httpOnly: true })
    revalidatePath("/dashboard")
    redirect(kit.next)
}

export async function exitTryKit() {
    const jar = await cookies()
    jar.delete(ACTIVE_PROFILE_COOKIE)
    revalidatePath("/dashboard")
    redirect("/qa")
}

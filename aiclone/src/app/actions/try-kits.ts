"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { syncUser } from "@/lib/auth-sync"
import { ACTIVE_PROFILE_COOKIE, TRY_KITS, TRY_NOW_COOKIE } from "@/lib/try-kits"
import { seedRole } from "@/lib/try-kit-seed"

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
    jar.set(TRY_NOW_COOKIE, "1", { path: "/", sameSite: "lax", httpOnly: true, maxAge: 60 * 60 })
    revalidatePath("/dashboard")
    redirect(kit.next)
}

export async function exitTryKit() {
    const jar = await cookies()
    jar.delete(ACTIVE_PROFILE_COOKIE)
    jar.delete(TRY_NOW_COOKIE)
    revalidatePath("/dashboard")
    redirect("/qa")
}

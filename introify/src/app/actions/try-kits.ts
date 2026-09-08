"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { syncUser } from "@/lib/auth-sync"
import { ACTIVE_PROFILE_COOKIE, TRY_KITS, TRY_NOW_COOKIE } from "@/lib/try-kits"
import { seedRole } from "@/lib/try-kit-seed"
import { userIsAdmin } from "@/lib/admin/allowlist"

export async function openTryKit(formData: FormData) {
    const role = String(formData.get("role") || "")
    const user = await syncUser()
    if (!user) redirect("/sign-in")
    if (!userIsAdmin(user)) redirect("/dashboard")

    const kit = TRY_KITS.find((k) => k.role === role)
    if (!kit) redirect("/admin/kits")

    let profile = await prisma.profile.findFirst({
        where: { userId: user.id, slug: kit.slug },
    })

    if (!profile) {
        const clash = await prisma.profile.findUnique({ where: { slug: kit.slug } })
        const slug = clash ? `${kit.slug}-${user.id.slice(-6).toLowerCase()}` : kit.slug
        const { kitAbout } = await import("@/lib/kit-copy")
        const about = kitAbout(kit.role, kit.name)
        profile = await prisma.profile.create({
            data: {
                userId: user.id,
                slug,
                displayName: kit.name,
                headline: about.headline || kit.blurb,
                bio: about.bio || null,
                roleTemplate: kit.role,
                primaryGoal: kit.goal,
                language: "en",
                timezone: "Asia/Kolkata",
                isPublic: true,
                liveChatEnabled: true,
                welcomeMessageOverride: kit.role === "PHARMACY" ? "Ask about a medicine, stock, or pickup." : kit.blurb,
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
    redirect("/admin/kits")
}

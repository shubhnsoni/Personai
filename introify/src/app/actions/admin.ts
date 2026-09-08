"use server"

import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/admin/require-admin"
import { demoteBlockReason, isAdminEmail } from "@/lib/admin/allowlist"
import { IMPERSONATE_COOKIE, IMPERSONATE_MAX_AGE } from "@/lib/admin/impersonate"
import {
    parsePlatformAiSettings,
    savePlatformAiSettings,
    type AiProviderKind,
    type PlatformAiSettings,
} from "@/lib/admin/ai-settings"
import { llmClient, resolveChatModel } from "@/lib/llm"

async function audit(actorUserId: string, action: string, profileId?: string | null, meta?: unknown) {
    await prisma.auditEvent.create({
        data: {
            actorUserId,
            action,
            profileId: profileId || null,
            meta: meta ? JSON.stringify(meta).slice(0, 2000) : null,
        },
    }).catch(() => {})
}

export async function unpublishShop(profileId: string) {
    const admin = await requireAdmin()
    await prisma.profile.update({ where: { id: profileId }, data: { isPublic: false } })
    await audit(admin.id, "unpublish", profileId)
    revalidatePath("/admin")
    revalidatePath(`/admin/shops/${profileId}`)
}

export async function publishShop(profileId: string) {
    const admin = await requireAdmin()
    const row = await prisma.profile.findUnique({ where: { id: profileId }, select: { suspendedAt: true } })
    if (row?.suspendedAt) throw new Error("Shop is suspended")
    await prisma.profile.update({ where: { id: profileId }, data: { isPublic: true } })
    await audit(admin.id, "publish", profileId)
    revalidatePath("/admin")
    revalidatePath(`/admin/shops/${profileId}`)
}

export async function suspendShop(profileId: string) {
    const admin = await requireAdmin()
    await prisma.profile.update({
        where: { id: profileId },
        data: { isPublic: false, suspendedAt: new Date() },
    })
    await audit(admin.id, "suspend", profileId)
    revalidatePath("/admin")
    revalidatePath(`/admin/shops/${profileId}`)
}

export async function unsuspendShop(profileId: string) {
    const admin = await requireAdmin()
    await prisma.profile.update({
        where: { id: profileId },
        data: { suspendedAt: null },
    })
    await audit(admin.id, "unsuspend", profileId)
    revalidatePath("/admin")
    revalidatePath(`/admin/shops/${profileId}`)
}

export async function startImpersonate(profileId: string) {
    const admin = await requireAdmin()
    const shop = await prisma.profile.findUnique({ where: { id: profileId }, select: { id: true, slug: true } })
    if (!shop) throw new Error("Shop not found")
    const jar = await cookies()
    jar.set(IMPERSONATE_COOKIE, shop.id, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: IMPERSONATE_MAX_AGE,
    })
    await audit(admin.id, "impersonate_start", shop.id, { slug: shop.slug })
    revalidatePath("/dashboard")
}

export async function stopImpersonate() {
    const admin = await requireAdmin()
    const jar = await cookies()
    const id = jar.get(IMPERSONATE_COOKIE)?.value
    jar.delete(IMPERSONATE_COOKIE)
    await audit(admin.id, "impersonate_stop", id || null)
    revalidatePath("/dashboard")
    revalidatePath("/admin")
}

export async function saveAdminAiSettings(settings: PlatformAiSettings) {
    const admin = await requireAdmin()
    const parsed = parsePlatformAiSettings(JSON.stringify(settings))
    await savePlatformAiSettings(parsed)
    await audit(admin.id, "ai_settings", null, { defaultProvider: parsed.defaultProvider, kill: parsed.kill })
    revalidatePath("/admin/ai")
}

export async function setShopAiOverride(profileId: string, provider: AiProviderKind | "") {
    const admin = await requireAdmin()
    await prisma.profile.update({
        where: { id: profileId },
        data: { aiProviderOverride: provider || null },
    })
    await audit(admin.id, "shop_ai_override", profileId, { provider: provider || null })
    revalidatePath(`/admin/shops/${profileId}`)
    revalidatePath("/admin/ai")
}

export async function testAdminAiPing(provider?: AiProviderKind | "") {
    await requireAdmin()
    const started = Date.now()
    const llm = llmClient({ override: provider || null })
    if (!llm) return { ok: false as const, ms: 0, error: "Provider not configured", provider: provider || "none", model: "" }
    const model = resolveChatModel(llm.provider.defaultModel, llm.provider)
    try {
        const stream = await llm.client.chat.completions.create({
            model,
            stream: true,
            messages: [{ role: "user", content: "Reply with the single word pong." }],
        })
        let text = ""
        for await (const chunk of stream) {
            text += chunk.choices[0]?.delta?.content || ""
            if (text.length > 24) break
        }
        const ms = Date.now() - started
        await prisma.aiCallLog.create({
            data: { provider: llm.provider.kind, model, ok: true, ms },
        }).catch(() => {})
        return { ok: true as const, ms, preview: text.slice(0, 40), provider: llm.provider.kind, model }
    } catch (err) {
        const ms = Date.now() - started
        const error = err instanceof Error ? err.message.slice(0, 180) : "ping failed"
        await prisma.aiCallLog.create({
            data: { provider: llm.provider.kind, model, ok: false, ms, errorCode: error.slice(0, 80) },
        }).catch(() => {})
        return { ok: false as const, ms, error, provider: llm.provider.kind, model }
    }
}

export async function setUserRole(userId: string, role: "ADMIN" | "CREATOR") {
    const admin = await requireAdmin()
    const target = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, role: true },
    })
    if (!target) throw new Error("User not found")
    if (role === "CREATOR") {
        const adminCount = await prisma.user.count({ where: { role: "ADMIN" } })
        const blocked = demoteBlockReason({ actorId: admin.id, target, adminCount })
        if (blocked) throw new Error(blocked)
    }
    await prisma.user.update({ where: { id: userId }, data: { role } })
    await audit(admin.id, role === "ADMIN" ? "promote_admin" : "demote_admin", null, { email: target.email })
    revalidatePath("/admin/users")
    revalidatePath(`/admin/users/${userId}`)
}

export async function suspendUser(userId: string) {
    const admin = await requireAdmin()
    if (userId === admin.id) throw new Error("You cannot suspend yourself")
    const target = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } })
    if (!target) throw new Error("User not found")
    if (isAdminEmail(target.email)) throw new Error("This email is in ADMIN_EMAILS")
    await prisma.profile.updateMany({
        where: { userId },
        data: { isPublic: false, suspendedAt: new Date() },
    })
    await audit(admin.id, "suspend_user", null, { userId, email: target.email })
    revalidatePath("/admin/users")
    revalidatePath(`/admin/users/${userId}`)
    revalidatePath("/admin/shops")
}

export async function unsuspendUser(userId: string) {
    const admin = await requireAdmin()
    await prisma.profile.updateMany({
        where: { userId },
        data: { suspendedAt: null },
    })
    await audit(admin.id, "unsuspend_user", null, { userId })
    revalidatePath("/admin/users")
    revalidatePath(`/admin/users/${userId}`)
    revalidatePath("/admin/shops")
}

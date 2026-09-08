import { goldBoardFromConfig } from "@/lib/metal/board"
import { hasSurface, extrasOf } from "@/lib/surfaces"
import { isJewelryKit } from "@/lib/metal/math"

export type SetupCheck = {
    id: string
    label: string
    ok: boolean
}

export function shopSetupChecks(profile: {
    slug: string
    roleTemplate: string
    isPublic: boolean
    displayName: string
    imageUrl?: string | null
    shopLogoUrl?: string | null
    whatsapp?: string | null
    upiId?: string | null
    personalityConfig?: string | null
    liveChatEnabled?: boolean
    suspendedAt?: Date | null
    _count?: { digitalProducts?: number; conversations?: number }
}): { score: number; checks: SetupCheck[]; pending: string[] } {
    const extras = extrasOf(profile)
    const shop = hasSurface(profile.roleTemplate, "shop", extras)
    const jewelry = isJewelryKit(profile.roleTemplate)
    const products = profile._count?.digitalProducts ?? 0
    const chats = profile._count?.conversations ?? 0
    const board = jewelry ? goldBoardFromConfig(profile.personalityConfig) : null

    const checks: SetupCheck[] = [
        { id: "public", label: "Public page", ok: profile.isPublic && !profile.suspendedAt },
        { id: "identity", label: "Name and photo", ok: Boolean(profile.displayName?.trim()) && Boolean(profile.imageUrl || profile.shopLogoUrl) },
        { id: "reach", label: "WhatsApp or UPI", ok: Boolean(profile.whatsapp?.trim() || profile.upiId?.trim()) },
    ]
    if (shop) checks.push({ id: "catalog", label: "At least one product", ok: products > 0 })
    if (jewelry) checks.push({ id: "gold", label: "Gold board set", ok: Boolean(board) })
    checks.push({ id: "chat", label: "Has had a chat", ok: chats > 0 })

    const ok = checks.filter((c) => c.ok).length
    const pending = checks.filter((c) => !c.ok).map((c) => c.label)
    return { score: checks.length ? Math.round((ok / checks.length) * 100) : 0, checks, pending }
}

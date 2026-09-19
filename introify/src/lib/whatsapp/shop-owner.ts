import { prisma } from "@/lib/prisma"
import { last10Digits, normalizeE164, phonesMatch } from "@/lib/whatsapp/phone"

export type ShopOwnerMatch = {
    profileId: string
    slug: string
    displayName: string
    whatsapp: string
}

/**
 * Find a registered (non-suspended) shop/store owner whose Profile.whatsapp
 * matches the inbound sender. Silent ignore when none.
 */
export async function findShopOwnerByWhatsapp(fromRaw: string): Promise<ShopOwnerMatch | null> {
    const e164 = normalizeE164(fromRaw)
    const last10 = last10Digits(fromRaw)
    if (!e164 && !last10) return null

    const or: { whatsapp: { equals?: string; endsWith?: string; contains?: string } }[] = []
    if (e164) {
        or.push({ whatsapp: { equals: e164 } })
        or.push({ whatsapp: { equals: e164.slice(1) } })
        or.push({ whatsapp: { contains: e164 } })
    }
    if (last10) {
        or.push({ whatsapp: { endsWith: last10 } })
        or.push({ whatsapp: { contains: last10 } })
    }

    const candidates = await prisma.profile.findMany({
        where: {
            suspendedAt: null,
            whatsapp: { not: null },
            OR: or,
        },
        select: { id: true, slug: true, displayName: true, whatsapp: true },
        take: 25,
    })

    for (const row of candidates) {
        if (phonesMatch(row.whatsapp, fromRaw)) {
            return {
                profileId: row.id,
                slug: row.slug,
                displayName: row.displayName,
                whatsapp: row.whatsapp!,
            }
        }
    }
    return null
}

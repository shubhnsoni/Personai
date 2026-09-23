import type { PrismaClient } from "@prisma/client"
import { resolveKitRole } from "@/lib/role-alias"
import { applyDemoShop } from "./apply"
import {
    isTryShopShowcaseSlug,
    tryShopShopBySlug,
    type TryShopShowcaseSlug,
} from "./try-shop"

export {
    isTryShopShowcaseSlug,
    TRY_SHOP_SHOWCASE_SLUGS,
    TRY_SHOP_SHOPS,
    TRY_SHOP,
    TRY_STORE,
    tryShopShopBySlug,
} from "./try-shop"
export type { TryShopShowcaseSlug } from "./try-shop"

export type TryShopEnsureAction =
    | "noop-unrelated"
    | "return-existing"
    | "create"
    | "skip-foreign-role"
    | "skip-workspace"
    | "skip-user-clash"
    | "skip-no-shop"

export type TryShopEnsureState = {
    slug: string
    profile: { id: string; slug: string; roleTemplate: string; isPublic: boolean } | null
    workspaceExists: boolean
    userByClerk: { id: string; email: string; clerkId: string } | null
    userByEmail: { id: string; email: string; clerkId: string } | null
}

export type TryShopEnsurePlan = {
    action: TryShopEnsureAction
    slug: string
    expectedFlavor: string | null
    clerkId: string | null
    email: string | null
}

function credentialsFor(slug: TryShopShowcaseSlug) {
    return {
        clerkId: `mock-clerk-id-${slug}`,
        email: `${slug}@introify.com`,
    }
}

/** Pure planner for unit tests — mirrors ensureTryFoodShowcase collision guards. */
export function planTryShopEnsure(state: TryShopEnsureState): TryShopEnsurePlan {
    if (!isTryShopShowcaseSlug(state.slug)) {
        return { action: "noop-unrelated", slug: state.slug, expectedFlavor: null, clerkId: null, email: null }
    }
    const shop = tryShopShopBySlug(state.slug)
    if (!shop) {
        return { action: "skip-no-shop", slug: state.slug, expectedFlavor: null, clerkId: null, email: null }
    }
    const creds = credentialsFor(state.slug)
    const expectedFlavor = shop.flavor
    const expectedEngine = resolveKitRole(expectedFlavor) || expectedFlavor

    if (state.profile) {
        const haveEngine = resolveKitRole(state.profile.roleTemplate) || state.profile.roleTemplate
        if (haveEngine !== expectedEngine) {
            return {
                action: "skip-foreign-role",
                slug: state.slug,
                expectedFlavor,
                clerkId: creds.clerkId,
                email: creds.email,
            }
        }
        return {
            action: "return-existing",
            slug: state.slug,
            expectedFlavor,
            clerkId: creds.clerkId,
            email: creds.email,
        }
    }

    if (state.workspaceExists) {
        return {
            action: "skip-workspace",
            slug: state.slug,
            expectedFlavor,
            clerkId: creds.clerkId,
            email: creds.email,
        }
    }

    const byClerk = state.userByClerk
    const byEmail = state.userByEmail
    if (
        (byClerk && byClerk.email !== creds.email) ||
        (byEmail && byEmail.clerkId !== creds.clerkId)
    ) {
        return {
            action: "skip-user-clash",
            slug: state.slug,
            expectedFlavor,
            clerkId: creds.clerkId,
            email: creds.email,
        }
    }

    return {
        action: "create",
        slug: state.slug,
        expectedFlavor,
        clerkId: creds.clerkId,
        email: creds.email,
    }
}

export type EnsureTryShopResult = {
    created: boolean
    skipped: string[]
    profileId: string | null
    action: TryShopEnsureAction
}

/**
 * Ensure-on-miss for /try-shop and /try-store showcases.
 * Matching SHOP-engine roles (SHOP, KIRANA, BOUTIQUE, …) return without wiping catalog.
 */
export async function ensureTryShopShowcase(prisma: PrismaClient, slug: string): Promise<EnsureTryShopResult> {
    if (!isTryShopShowcaseSlug(slug)) {
        return { created: false, skipped: [], profileId: null, action: "noop-unrelated" }
    }

    const shop = tryShopShopBySlug(slug)
    if (!shop) {
        return { created: false, skipped: [slug], profileId: null, action: "skip-no-shop" }
    }

    const existing = await prisma.profile.findUnique({
        where: { slug },
        select: { id: true, slug: true, roleTemplate: true, isPublic: true },
    })

    const workspace = await prisma.workspace.findUnique({ where: { slug }, select: { id: true } }).catch(() => null)
    const creds = credentialsFor(slug)
    const byClerk = await prisma.user.findUnique({ where: { clerkId: creds.clerkId } })
    const byEmail = await prisma.user.findUnique({ where: { email: creds.email } })

    const plan = planTryShopEnsure({
        slug,
        profile: existing,
        workspaceExists: Boolean(workspace) && !existing,
        userByClerk: byClerk,
        userByEmail: byEmail,
    })

    if (plan.action === "return-existing" && existing) {
        if (!existing.isPublic) {
            await prisma.profile.update({ where: { id: existing.id }, data: { isPublic: true } })
        }
        return { created: false, skipped: [slug], profileId: existing.id, action: plan.action }
    }
    if (plan.action !== "create") {
        return { created: false, skipped: [slug], profileId: existing?.id || null, action: plan.action }
    }

    const user =
        byClerk ||
        (await prisma.user.create({
            data: {
                clerkId: creds.clerkId,
                email: creds.email,
                name: shop.name,
            },
        }))

    const created = await prisma.profile.create({
        data: {
            userId: user.id,
            slug,
            displayName: shop.name,
            headline: shop.headline,
            bio: shop.bio,
            roleTemplate: shop.flavor,
            primaryGoal: shop.goal,
            language: "en",
            timezone: "Asia/Kolkata",
            imageUrl: shop.imageUrl || null,
            shopLogoUrl: shop.shopLogoUrl || null,
            whatsapp: shop.whatsapp || null,
            upiId: shop.upiId || null,
            isPublic: true,
            liveChatEnabled: true,
            welcomeMessageOverride: shop.welcome,
            personalityConfig: JSON.stringify({
                tone: shop.tone || "warm",
                language: "en",
                responseLength: "medium",
                customInstructions: shop.customInstructions,
            }),
        },
    })

    await applyDemoShop(prisma, created.id, shop, { replaceCatalog: true, fresh: true })

    return { created: true, skipped: [], profileId: created.id, action: "create" }
}

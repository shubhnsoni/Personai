import type { Prisma } from '@prisma/client'
import type Stripe from 'stripe'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUncachableStripeClient, StripeNotConfiguredError } from '@/lib/stripe'
import {
    ownershipRefusalResponse,
    requireOwnedProfile,
} from '@/lib/security'

type CatalogDb = Pick<Prisma.TransactionClient, 'profile'>

type PublicCatalogDependencies = Readonly<{
    db: CatalogDb
}>

const publicCatalogDependencies: PublicCatalogDependencies = { db: prisma }

const PUBLIC_CATALOG_SELECT = {
    digitalProducts: {
        where: { isActive: true },
        orderBy: { createdAt: 'desc' },
        select: {
            id: true,
            title: true,
            description: true,
            type: true,
            thumbnailUrl: true,
            subtitle: true,
            compareAtCents: true,
            priceCents: true,
            currency: true,
            category: true,
        },
    },
    courses: {
        where: { isActive: true, isPublished: true },
        orderBy: { createdAt: 'desc' },
        select: {
            id: true,
            title: true,
            description: true,
            thumbnailUrl: true,
            subtitle: true,
            outcomes: true,
            level: true,
            compareAtCents: true,
            priceCents: true,
            currency: true,
            totalModules: true,
            totalLessons: true,
            modules: {
                orderBy: { orderIndex: 'asc' },
                select: {
                    id: true,
                    title: true,
                    description: true,
                    orderIndex: true,
                    lessons: {
                        orderBy: { orderIndex: 'asc' },
                        select: {
                            id: true,
                            title: true,
                            description: true,
                            durationMinutes: true,
                            orderIndex: true,
                            isFree: true,
                        },
                    },
                },
            },
        },
    },
    events: {
        where: { isActive: true },
        orderBy: { startTime: 'asc' },
        select: {
            id: true,
            title: true,
            description: true,
            eventType: true,
            thumbnailUrl: true,
            startTime: true,
            endTime: true,
            timezone: true,
            location: true,
            priceCents: true,
            currency: true,
            isFree: true,
            maxAttendees: true,
        },
    },
    communities: {
        where: { isActive: true },
        orderBy: { createdAt: 'desc' },
        select: {
            id: true,
            name: true,
            description: true,
            platform: true,
            priceCents: true,
            currency: true,
            billingCycle: true,
            memberCount: true,
        },
    },
} satisfies Prisma.ProfileSelect

export function createPublicCatalogGet(
    dependencies: PublicCatalogDependencies = publicCatalogDependencies,
) {
    return async function publicCatalogGet(request: NextRequest) {
        try {
            const profileId = new URL(request.url).searchParams.get('profileId')
            if (!profileId) {
                return NextResponse.json({ error: 'Profile ID required' }, { status: 400 })
            }

            const catalog = await dependencies.db.profile.findFirst({
                where: { id: profileId, isPublic: true },
                select: PUBLIC_CATALOG_SELECT,
            })

            if (!catalog) {
                return NextResponse.json({ error: 'Catalog not found' }, { status: 404 })
            }

            return NextResponse.json({
                products: catalog.digitalProducts,
                courses: catalog.courses,
                events: catalog.events,
                communities: catalog.communities,
            })
        } catch (error) {
            console.error('Error fetching products:', error)
            return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 })
        }
    }
}

type StripeProductClient = Readonly<{
    products: {
        create: (input: Stripe.ProductCreateParams) => Promise<Pick<Stripe.Product, 'id'>>
    }
    prices: {
        create: (input: Stripe.PriceCreateParams) => Promise<Pick<Stripe.Price, 'id'>>
    }
}>

type StripeProductDependencies = Readonly<{
    requireOwnedProfile: typeof requireOwnedProfile
    ownershipRefusalResponse: typeof ownershipRefusalResponse
    getStripeClient: () => Promise<StripeProductClient>
}>

const stripeProductDependencies: StripeProductDependencies = {
    requireOwnedProfile,
    ownershipRefusalResponse,
    getStripeClient: getUncachableStripeClient,
}

export function createStripeProductPost(
    dependencies: StripeProductDependencies = stripeProductDependencies,
) {
    return async function stripeProductPost(request: NextRequest) {
        try {
            let body: unknown
            try {
                body = await request.json()
            } catch {
                return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
            }

            const {
                name,
                description,
                priceCents,
                productType,
                metadata,
                profileId,
            } = (body ?? {}) as Record<string, unknown>

            const ownedProfile = await dependencies.requireOwnedProfile({ claimedProfileId: profileId })
            if (!ownedProfile.ok) {
                return dependencies.ownershipRefusalResponse(ownedProfile.refusal)
            }

            if (typeof name !== 'string' || !name.trim()) {
                return NextResponse.json({ error: 'Invalid name' }, { status: 400 })
            }
            if (typeof priceCents !== 'number' || !Number.isFinite(priceCents) || priceCents < 0) {
                return NextResponse.json({ error: 'Invalid priceCents' }, { status: 400 })
            }

            const stripeMetadata = metadata && typeof metadata === 'object'
                ? Object.fromEntries(Object.entries(metadata).filter((entry): entry is [string, string] => typeof entry[1] === 'string'))
                : {}
            const stripe = await dependencies.getStripeClient()
            const product = await stripe.products.create({
                name: name.trim(),
                description: typeof description === 'string' ? description : undefined,
                metadata: {
                    ...stripeMetadata,
                    productType: typeof productType === 'string' ? productType : '',
                    ownerProfileId: ownedProfile.value.profile.id,
                },
            })
            const price = await stripe.prices.create({
                product: product.id,
                unit_amount: priceCents,
                currency: 'usd',
            })

            return NextResponse.json({ productId: product.id, priceId: price.id })
        } catch (error) {
            if (error instanceof StripeNotConfiguredError) {
                return NextResponse.json({ error: 'payments_not_configured' }, { status: 503 })
            }
            console.error('Error creating Stripe product:', error)
            return NextResponse.json({ error: 'Failed to create product in Stripe' }, { status: 500 })
        }
    }
}

export const GET = createPublicCatalogGet()
export const POST = createStripeProductPost()

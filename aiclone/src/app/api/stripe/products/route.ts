import { NextRequest, NextResponse } from 'next/server'
import { getUncachableStripeClient } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const profileId = searchParams.get('profileId')

        if (!profileId) {
            return NextResponse.json({ error: 'Profile ID required' }, { status: 400 })
        }

        const products = await prisma.digitalProduct.findMany({
            where: { 
                profileId,
                isActive: true
            },
            orderBy: { createdAt: 'desc' }
        })

        const courses = await prisma.course.findMany({
            where: { 
                profileId,
                isActive: true,
                isPublished: true
            },
            include: {
                modules: {
                    include: { lessons: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        })

        const events = await prisma.event.findMany({
            where: { 
                profileId,
                isActive: true,
                startTime: { gte: new Date() }
            },
            orderBy: { startTime: 'asc' }
        })

        const communities = await prisma.community.findMany({
            where: { 
                profileId,
                isActive: true
            },
            orderBy: { createdAt: 'desc' }
        })

        return NextResponse.json({
            products,
            courses,
            events,
            communities
        })
    } catch (error) {
        console.error('Error fetching products:', error)
        return NextResponse.json(
            { error: 'Failed to fetch products' },
            { status: 500 }
        )
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { 
            name, 
            description, 
            priceCents, 
            productType,
            metadata 
        } = body

        const stripe = await getUncachableStripeClient()

        const product = await stripe.products.create({
            name,
            description,
            metadata: {
                ...metadata,
                productType
            }
        })

        const price = await stripe.prices.create({
            product: product.id,
            unit_amount: priceCents,
            currency: 'usd'
        })

        return NextResponse.json({
            productId: product.id,
            priceId: price.id
        })
    } catch (error) {
        console.error('Error creating Stripe product:', error)
        return NextResponse.json(
            { error: 'Failed to create product in Stripe' },
            { status: 500 }
        )
    }
}

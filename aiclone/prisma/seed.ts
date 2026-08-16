import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const DEMO_CLERK_ID = 'mock-clerk-id-new'

const demoIdentity = {
    displayName: 'Riley Vale',
    headline: 'Independent consultant · official PersonaLink demo',
    bio: 'I help operators turn their expertise into a page that chats, books, and sells. This is a live PersonaLink profile — the same surface you get at personalink.com/you.',
    roleTemplate: 'CONSULTANT',
    primaryGoal: 'BOOK_CALL',
    isPublic: true,
}

async function main() {
    console.log('Seeding database...')

    const presets = [
        {
            name: 'GlowOrb',
            description: 'A soft, glowing orb that pulses gently.',
            config: JSON.stringify({
                type: 'orb',
                colors: ['#A855F7', '#EC4899'],
                speed: 1,
                intensity: 1,
            }),
            isDefault: true,
        },
        {
            name: 'LiquidSphere',
            description: 'A fluid-like sphere with organic movement.',
            config: JSON.stringify({
                type: 'liquid',
                colors: ['#3B82F6', '#10B981'],
                speed: 1.5,
                intensity: 1.2,
            }),
            isDefault: false,
        },
        {
            name: 'SoftPulse',
            description: 'A minimal, breathing circle.',
            config: JSON.stringify({
                type: 'pulse',
                colors: ['#F59E0B', '#EF4444'],
                speed: 0.8,
                intensity: 0.8,
            }),
            isDefault: false,
        },
    ]

    for (const preset of presets) {
        const existing = await prisma.welcomeAnimationPreset.findFirst({
            where: { name: preset.name }
        })
        if (!existing) {
            await prisma.welcomeAnimationPreset.create({ data: preset })
            console.log(`Created preset: ${preset.name}`)
        } else {
            console.log(`Preset already exists: ${preset.name}`)
        }
    }

    const defaultPreset = await prisma.welcomeAnimationPreset.findFirst({
        where: { isDefault: true }
    })

    const demoUser = await prisma.user.upsert({
        where: { clerkId: DEMO_CLERK_ID },
        update: {
            name: 'Riley Vale',
            email: 'demo@personalink.com',
        },
        create: {
            clerkId: DEMO_CLERK_ID,
            email: 'demo@personalink.com',
            name: 'Riley Vale',
        }
    })
    console.log(`Created/found demo user: ${demoUser.email}`)

    const demoProfile = await prisma.profile.upsert({
        where: { slug: 'demo' },
        update: {
            ...demoIdentity,
            animationStyleId: defaultPreset?.id,
        },
        create: {
            userId: demoUser.id,
            slug: 'demo',
            ...demoIdentity,
            animationStyleId: defaultPreset?.id,
        }
    })
    console.log(`Created/found demo profile: ${demoProfile.slug} (${demoProfile.displayName})`)

    await prisma.workExperience.deleteMany({ where: { profileId: demoProfile.id } })
    await prisma.workExperience.createMany({
        data: [
            {
                profileId: demoProfile.id,
                company: 'PersonaLink',
                role: 'Founding creator partner',
                startDate: '2025',
                endDate: null,
                description: 'The official live demo. Shows what a working AI clone looks like for an independent consultant.',
                achievements: JSON.stringify([
                    'Shipped the public /demo profile used on the marketing homepage',
                    'Packaged chat, booking, and products on one link',
                    'Used as the reference creator for onboarding templates',
                ]),
            },
            {
                profileId: demoProfile.id,
                company: 'Independent practice',
                role: 'Principal consultant',
                startDate: '2021',
                endDate: '2025',
                description: 'Positioning, offer design, and operator systems for B2B specialists.',
                achievements: JSON.stringify([
                    'Rebuilt offer stacks for 30+ independent practices',
                    'Cut sales-cycle time with async qualification',
                    'Productized workshops into evergreen products',
                ]),
            },
            {
                profileId: demoProfile.id,
                company: 'Northwind Advisory',
                role: 'Engagement lead',
                startDate: '2018',
                endDate: '2021',
                description: 'Led discovery and delivery for mid-market operators adopting new GTM motions.',
            },
        ]
    })
    console.log('Refreshed demo work experiences')

    await prisma.project.deleteMany({ where: { profileId: demoProfile.id } })
    await prisma.project.createMany({
        data: [
            {
                profileId: demoProfile.id,
                title: 'Operator OS',
                description: 'Positioning and offer stack for a B2B consultancy moving off custom proposals.',
                client: 'Northline Studio',
                year: '2025',
            },
            {
                profileId: demoProfile.id,
                title: 'Launch desk',
                description: 'Booking plus product funnel so a solo creator could sell while traveling.',
                client: 'Independent',
                year: '2024',
            },
            {
                profileId: demoProfile.id,
                title: 'Office hours loop',
                description: 'Community plus monthly event cadence that replaced one-off calls.',
                client: 'Operators Circle',
                year: '2024',
            },
        ]
    })
    console.log('Refreshed demo projects')

    await upsertNamed(prisma.serviceOffering, demoProfile.id, [
        {
            name: 'Strategy session',
            description: 'One-on-one working session to tighten your offer and next 90 days.',
            priceCents: 20000,
            durationMinutes: 60,
            isActive: true,
        },
        {
            name: 'Offer review',
            description: 'Fast feedback on your current page, pricing, and call-to-action.',
            priceCents: 9000,
            durationMinutes: 30,
            isActive: true,
        },
    ], ['name', 'description', 'priceCents', 'durationMinutes', 'isActive'])
    console.log('Ensured demo services')

    await upsertNamed(prisma.digitalProduct, demoProfile.id, [
        {
            title: 'Offer stack workbook',
            description: 'A practical PDF to name your offer, price it, and write the page.',
            type: 'PDF',
            priceCents: 2900,
            isActive: true,
        },
        {
            title: 'Discovery call script',
            description: 'A short script your AI (or you) can use to qualify inbound leads.',
            type: 'PDF',
            priceCents: 1900,
            isActive: true,
        },
    ], ['title', 'description', 'type', 'priceCents', 'isActive'])
    console.log('Ensured demo digital products')

    const existingCourse = await prisma.course.findFirst({
        where: { profileId: demoProfile.id }
    })
    if (!existingCourse) {
        const course = await prisma.course.create({
            data: {
                profileId: demoProfile.id,
                title: 'Clone your practice',
                description: 'Turn what you already know into a page that chats, books, and sells.',
                priceCents: 14900,
                isActive: true,
                isPublished: true,
                totalModules: 3,
                totalLessons: 9,
            }
        })

        const module1 = await prisma.courseModule.create({
            data: {
                courseId: course.id,
                title: 'Position the clone',
                description: 'What your AI should know before it talks to anyone',
                orderIndex: 0,
            }
        })

        await prisma.courseLesson.createMany({
            data: [
                { moduleId: module1.id, title: 'What belongs on the page', orderIndex: 0, durationMinutes: 12 },
                { moduleId: module1.id, title: 'Writing a headline the AI can stand behind', orderIndex: 1, durationMinutes: 10 },
                { moduleId: module1.id, title: 'Your first three chips', orderIndex: 2, durationMinutes: 14 },
            ]
        })
        console.log('Created demo course')
    } else {
        await prisma.course.update({
            where: { id: existingCourse.id },
            data: {
                title: 'Clone your practice',
                description: 'Turn what you already know into a page that chats, books, and sells.',
                isActive: true,
                isPublished: true,
            }
        })
        console.log('Updated demo course')
    }

    const existingEvent = await prisma.event.findFirst({
        where: { profileId: demoProfile.id }
    })
    const nextMonth = new Date()
    nextMonth.setMonth(nextMonth.getMonth() + 1)
    nextMonth.setHours(14, 0, 0, 0)
    const eventData = {
        title: 'Live office hours',
        description: 'Watch the demo profile convert a visitor — then ask anything about your own page.',
        eventType: 'WEBINAR',
        startTime: nextMonth,
        endTime: new Date(nextMonth.getTime() + 2 * 60 * 60 * 1000),
        priceCents: 0,
        isFree: true,
        isActive: true,
    }
    if (!existingEvent) {
        await prisma.event.create({
            data: { profileId: demoProfile.id, ...eventData }
        })
        console.log('Created demo event')
    } else {
        await prisma.event.update({
            where: { id: existingEvent.id },
            data: eventData,
        })
        console.log('Updated demo event')
    }

    const existingCommunity = await prisma.community.findFirst({
        where: { profileId: demoProfile.id }
    })
    const communityData = {
        name: 'Operators Circle',
        description: 'A small monthly room for consultants shipping their PersonaLink page.',
        platform: 'TELEGRAM',
        priceCents: 1900,
        billingCycle: 'MONTHLY',
        isActive: true,
    }
    if (!existingCommunity) {
        await prisma.community.create({
            data: { profileId: demoProfile.id, ...communityData }
        })
        console.log('Created demo community')
    } else {
        await prisma.community.update({
            where: { id: existingCommunity.id },
            data: communityData,
        })
        console.log('Updated demo community')
    }

    const existingLeadMagnet = await prisma.leadMagnet.findFirst({
        where: { profileId: demoProfile.id }
    })
    const magnetData = {
        title: 'Offer-stack checklist',
        description: 'A one-page checklist to decide what your AI should sell first.',
        type: 'DOWNLOAD',
        isActive: true,
    }
    if (!existingLeadMagnet) {
        await prisma.leadMagnet.create({
            data: { profileId: demoProfile.id, ...magnetData }
        })
        console.log('Created demo lead magnet')
    } else {
        await prisma.leadMagnet.update({
            where: { id: existingLeadMagnet.id },
            data: magnetData,
        })
        console.log('Updated demo lead magnet')
    }

    console.log('Seeding finished.')
}

type NamedRecord = { id: string }

async function upsertNamed<T extends NamedRecord>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delegate: { findMany: (args: any) => Promise<T[]>; update: (args: any) => Promise<T>; create: (args: any) => Promise<T> },
    profileId: string,
    items: Array<Record<string, unknown>>,
    fields: string[],
) {
    const existing = await delegate.findMany({
        where: { profileId },
        orderBy: { createdAt: 'asc' },
    })
    for (let i = 0; i < items.length; i++) {
        const data = Object.fromEntries(fields.map((key) => [key, items[i][key]]))
        if (existing[i]) {
            await delegate.update({ where: { id: existing[i].id }, data })
        } else {
            await delegate.create({ data: { profileId, ...data } })
        }
    }
}

main()
    .then(async () => {
        await prisma.$disconnect()
    })
    .catch(async (e) => {
        console.error(e)
        await prisma.$disconnect()
        process.exit(1)
    })

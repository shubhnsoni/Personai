import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

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
        where: { clerkId: 'mock-clerk-id-new' },
        update: {},
        create: {
            clerkId: 'mock-clerk-id-new',
            email: 'mock-new@example.com',
            name: 'Demo Creator',
        }
    })
    console.log(`Created/found demo user: ${demoUser.email}`)

    const demoProfile = await prisma.profile.upsert({
        where: { slug: 'demo' },
        update: {},
        create: {
            userId: demoUser.id,
            slug: 'demo',
            displayName: 'Alex Designer',
            headline: 'Product Designer & UX Consultant',
            bio: 'I help startups create beautiful, user-centered products. With 8+ years of experience in design, I specialize in turning complex ideas into intuitive interfaces.',
            roleTemplate: 'DESIGNER',
            primaryGoal: 'BOOK_CALL',
            isPublic: true,
            animationStyleId: defaultPreset?.id,
        }
    })
    console.log(`Created/found demo profile: ${demoProfile.slug}`)

    const existingService = await prisma.serviceOffering.findFirst({
        where: { profileId: demoProfile.id }
    })
    if (!existingService) {
        await prisma.serviceOffering.createMany({
            data: [
                {
                    profileId: demoProfile.id,
                    name: 'Design Consultation',
                    description: 'One-on-one session to discuss your design needs',
                    priceCents: 15000,
                    durationMinutes: 60,
                    isActive: true,
                },
                {
                    profileId: demoProfile.id,
                    name: 'Quick Review',
                    description: 'Fast feedback on your current design',
                    priceCents: 5000,
                    durationMinutes: 30,
                    isActive: true,
                }
            ]
        })
        console.log('Created demo services')
    }

    const existingProduct = await prisma.digitalProduct.findFirst({
        where: { profileId: demoProfile.id }
    })
    if (!existingProduct) {
        await prisma.digitalProduct.createMany({
            data: [
                {
                    profileId: demoProfile.id,
                    title: 'Design System Template',
                    description: 'A complete Figma template with 200+ components for building modern interfaces.',
                    type: 'OTHER',
                    priceCents: 4900,
                    isActive: true,
                },
                {
                    profileId: demoProfile.id,
                    title: 'UX Research Guide',
                    description: 'Comprehensive PDF guide on conducting effective user research.',
                    type: 'PDF',
                    priceCents: 2900,
                    isActive: true,
                }
            ]
        })
        console.log('Created demo digital products')
    }

    const existingCourse = await prisma.course.findFirst({
        where: { profileId: demoProfile.id }
    })
    if (!existingCourse) {
        const course = await prisma.course.create({
            data: {
                profileId: demoProfile.id,
                title: 'Design Fundamentals Masterclass',
                description: 'Learn the core principles of product design from scratch.',
                priceCents: 19900,
                isActive: true,
                isPublished: true,
                totalModules: 3,
                totalLessons: 9,
            }
        })

        const module1 = await prisma.courseModule.create({
            data: {
                courseId: course.id,
                title: 'Getting Started',
                description: 'Introduction to design thinking',
                orderIndex: 0,
            }
        })

        await prisma.courseLesson.createMany({
            data: [
                { moduleId: module1.id, title: 'What is Design Thinking?', orderIndex: 0, durationMinutes: 15 },
                { moduleId: module1.id, title: 'Setting Up Your Workspace', orderIndex: 1, durationMinutes: 10 },
                { moduleId: module1.id, title: 'Your First Design', orderIndex: 2, durationMinutes: 20 },
            ]
        })
        console.log('Created demo course')
    }

    const existingEvent = await prisma.event.findFirst({
        where: { profileId: demoProfile.id }
    })
    if (!existingEvent) {
        const nextMonth = new Date()
        nextMonth.setMonth(nextMonth.getMonth() + 1)
        nextMonth.setHours(14, 0, 0, 0)

        await prisma.event.create({
            data: {
                profileId: demoProfile.id,
                title: 'Design Systems Workshop',
                description: 'Learn how to build and maintain scalable design systems.',
                eventType: 'WEBINAR',
                startTime: nextMonth,
                endTime: new Date(nextMonth.getTime() + 2 * 60 * 60 * 1000),
                priceCents: 4900,
                isFree: false,
                isActive: true,
            }
        })
        console.log('Created demo event')
    }

    const existingCommunity = await prisma.community.findFirst({
        where: { profileId: demoProfile.id }
    })
    if (!existingCommunity) {
        await prisma.community.create({
            data: {
                profileId: demoProfile.id,
                name: 'Design Circle',
                description: 'Join our exclusive community of designers for weekly tips, feedback, and networking.',
                platform: 'TELEGRAM',
                priceCents: 1900,
                billingCycle: 'MONTHLY',
                isActive: true,
            }
        })
        console.log('Created demo community')
    }

    const existingLeadMagnet = await prisma.leadMagnet.findFirst({
        where: { profileId: demoProfile.id }
    })
    if (!existingLeadMagnet) {
        await prisma.leadMagnet.create({
            data: {
                profileId: demoProfile.id,
                title: 'Free UI Kit',
                description: 'Download my starter UI kit with 50+ essential components.',
                type: 'DOWNLOAD',
                isActive: true,
            }
        })
        console.log('Created demo lead magnet')
    }

    console.log('Seeding finished.')
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

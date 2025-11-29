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
                colors: ['#A855F7', '#EC4899'], // Purple to Pink
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
                colors: ['#3B82F6', '#10B981'], // Blue to Green
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
                colors: ['#F59E0B', '#EF4444'], // Amber to Red
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

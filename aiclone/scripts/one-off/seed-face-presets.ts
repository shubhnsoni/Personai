import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

const presets = [
    {
        aliases: ["8-Bit", "8-Bit Slime", "Bit Slime"],
        name: "8-Bit",
        description: "Two rectangle eyes. No orb.",
        config: JSON.stringify({
            look: "pixel",
            skin: "bit",
            variant: "forest",
            colors: ["#34D399", "#052E1A"],
            speed: 0.95,
            intensity: 1,
        }),
    },
    {
        aliases: ["CRT", "Phosphor"],
        name: "CRT",
        description: "Scanline phosphor eyes.",
        config: JSON.stringify({
            look: "pixel",
            skin: "crt",
            variant: "aqua",
            colors: ["#00D7FF", "#07104D"],
            speed: 1,
            intensity: 1.1,
        }),
    },
    {
        aliases: ["Spark", "Pixel Spark"],
        name: "Spark",
        description: "Twin pixel stars.",
        config: JSON.stringify({
            look: "pixel",
            skin: "spark",
            variant: "ember",
            colors: ["#FFB020", "#3A0A08"],
            speed: 1.05,
            intensity: 1.1,
        }),
    },
]

async function main() {
    for (const preset of presets) {
        const existing = await prisma.welcomeAnimationPreset.findFirst({
            where: { name: { in: preset.aliases } },
        })
        const data = {
            name: preset.name,
            description: preset.description,
            config: preset.config,
            isDefault: false,
        }
        if (existing) {
            await prisma.welcomeAnimationPreset.update({ where: { id: existing.id }, data })
            console.log("updated", preset.name)
        } else {
            await prisma.welcomeAnimationPreset.create({ data })
            console.log("created", preset.name)
        }
    }
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })

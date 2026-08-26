import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

const presets = [
    {
        aliases: ["8-Bit Slime", "Bit Slime"],
        name: "8-Bit Slime",
        description: "Pixel orb with a stepped smile.",
        config: JSON.stringify({
            look: "pixel",
            skin: "slime",
            variant: "forest",
            colors: ["#34D399", "#052E1A"],
            speed: 0.95,
            intensity: 1,
        }),
    },
    {
        aliases: ["8-Bit Gem", "Bit Gem"],
        name: "8-Bit Gem",
        description: "Diamond sprite, same face animations.",
        config: JSON.stringify({
            look: "pixel",
            skin: "gem",
            variant: "violet",
            colors: ["#C084FC", "#1E0B3A"],
            speed: 1,
            intensity: 1,
        }),
    },
    {
        aliases: ["8-Bit Bot", "Bit Bot"],
        name: "8-Bit Bot",
        description: "Chunky robot face, 16-bit glow.",
        config: JSON.stringify({
            look: "pixel",
            skin: "bot",
            variant: "aqua",
            colors: ["#00D7FF", "#07104D"],
            speed: 1,
            intensity: 1,
        }),
    },
    {
        aliases: ["8-Bit Brick", "Bit Brick"],
        name: "8-Bit Brick",
        description: "Square block creature, ember palette.",
        config: JSON.stringify({
            look: "pixel",
            skin: "block",
            variant: "ember",
            colors: ["#FFB020", "#3A0A08"],
            speed: 1.05,
            intensity: 1.05,
        }),
    },
]

async function main() {
    const ids: Record<string, string> = {}
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
        const row = existing
            ? await prisma.welcomeAnimationPreset.update({ where: { id: existing.id }, data })
            : await prisma.welcomeAnimationPreset.create({ data })
        ids[preset.name] = row.id
        console.log(existing ? "updated" : "created", preset.name)
    }

    const slimeId = ids["8-Bit Slime"]
    if (slimeId) {
        const sylvie = await prisma.profile.update({
            where: { slug: "sylvie" },
            data: { animationStyleId: slimeId },
        })
        console.log("sylvie ->", sylvie.animationStyleId)
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

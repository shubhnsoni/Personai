import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
    const keep = await prisma.welcomeAnimationPreset.findFirst({
        where: { name: { in: ["8-Bit", "8-Bit Slime", "Bit Slime"] } },
    })
    if (!keep) throw new Error("8-bit preset missing")

    await prisma.welcomeAnimationPreset.update({
        where: { id: keep.id },
        data: {
            name: "8-Bit",
            description: "Pixel circle with two rectangle eyes.",
            config: JSON.stringify({
                look: "pixel",
                skin: "slime",
                variant: "forest",
                colors: ["#34D399", "#052E1A"],
                speed: 0.95,
                intensity: 1,
            }),
        },
    })

    const extras = await prisma.welcomeAnimationPreset.findMany({
        where: { name: { in: ["8-Bit Gem", "Bit Gem", "8-Bit Bot", "Bit Bot", "8-Bit Brick", "Bit Brick"] } },
    })
    const extraIds = extras.map((p) => p.id)
    if (extraIds.length) {
        await prisma.profile.updateMany({
            where: { animationStyleId: { in: extraIds } },
            data: { animationStyleId: keep.id },
        })
        await prisma.welcomeAnimationPreset.deleteMany({
            where: { id: { in: extraIds } },
        })
    }

    await prisma.profile.update({
        where: { slug: "sylvie" },
        data: { animationStyleId: keep.id },
    })
    console.log("kept", keep.id, "removed", extraIds.length)
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })

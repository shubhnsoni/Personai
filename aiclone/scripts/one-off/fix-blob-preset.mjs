import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

const config = JSON.stringify({
    look: "bloub",
    shape: "cercle",
    expression: "surpris",
    color: "blanc",
    variant: "aqua",
    colors: ["#f7f7f8", "#d8d8dc"],
    speed: 1,
    intensity: 1,
})

const blob = await prisma.welcomeAnimationPreset.findFirst({
    where: { name: { in: ["Blob", "Bloub"] } },
})

if (!blob) {
    console.log("NO BLOB PRESET")
    process.exit(1)
}

console.log("before", blob.id, blob.config, blob.isDefault)

const updated = await prisma.welcomeAnimationPreset.update({
    where: { id: blob.id },
    data: {
        name: "Blob",
        description: "Morphing blob with 8 shapes and 16 faces.",
        isDefault: true,
        config,
    },
})

await prisma.welcomeAnimationPreset.updateMany({
    where: { id: { not: blob.id }, isDefault: true },
    data: { isDefault: false },
})

console.log("after", updated.config, updated.isDefault)
await prisma.$disconnect()

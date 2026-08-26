import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
    const profile = await prisma.profile.update({
        where: { slug: "sylvie" },
        data: { welcomeMessageOverride: "Ask about coaching or book a call." },
    })
    console.log("updated", profile.welcomeMessageOverride)
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })

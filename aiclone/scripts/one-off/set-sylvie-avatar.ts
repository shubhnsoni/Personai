import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
    const r = await prisma.profile.update({
        where: { slug: "sylvie" },
        data: { chatAvatarMode: "ORB", imageUrl: "/sylvie.jpg" },
    })
    console.log(r.chatAvatarMode, r.imageUrl)
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })

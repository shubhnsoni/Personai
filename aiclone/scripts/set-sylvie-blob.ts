import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  const blob = await prisma.welcomeAnimationPreset.findFirst({ where: { name: "Blob" } })
  const sylvie = await prisma.profile.findUnique({
    where: { slug: "sylvie" },
    select: { id: true, slug: true, animationStyleId: true, personalityConfig: true },
  })
  console.log(JSON.stringify({ blob, sylvie }, null, 2))
  if (blob && sylvie) {
    await prisma.profile.update({
      where: { id: sylvie.id },
      data: { animationStyleId: blob.id },
    })
    console.log("Sylvie now uses Blob")
  }
}

main().finally(() => prisma.$disconnect())

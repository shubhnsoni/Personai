import { MetadataRoute } from "next"
import { prisma } from "@/lib/prisma"

export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

  const profiles = await prisma.profile.findMany({
    where: { isPublic: true },
    select: { slug: true, updatedAt: true },
  })

  const profileUrls: MetadataRoute.Sitemap = profiles.map((profile) => ({
    url: `${baseUrl}/${profile.slug}`,
    lastModified: profile.updatedAt,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }))

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
    ...profileUrls,
  ]
}

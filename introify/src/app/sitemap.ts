import { MetadataRoute } from "next"
import { prisma } from "@/lib/prisma"
import { homeLanguageAlternates, isIndexableProfileSlug, MARKETING_ROUTES, marketingOrigin } from "@/lib/marketing-seo"

export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = marketingOrigin()

  const profiles = await prisma.profile.findMany({
    where: { isPublic: true },
    select: { slug: true, updatedAt: true },
  })

  const profileUrls: MetadataRoute.Sitemap = profiles.filter((profile) => isIndexableProfileSlug(profile.slug)).map((profile) => ({
    url: `${baseUrl}/${profile.slug}`,
    lastModified: profile.updatedAt,
  }))

  const languages = homeLanguageAlternates(baseUrl)
  return [
    ...MARKETING_ROUTES.filter((route) => route.index).map((route) => ({
      url: new URL(route.path, baseUrl).href,
      ...(route.path === "/" || route.path === "/hi" ? { alternates: { languages } } : {}),
    })),
    ...profileUrls,
  ]
}

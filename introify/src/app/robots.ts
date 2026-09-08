import { MetadataRoute } from "next"
import { marketingOrigin } from "@/lib/marketing-seo"

export default function robots(): MetadataRoute.Robots {
  const baseUrl = marketingOrigin()
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // HTML routes must remain crawlable for their noindex metadata or
        // X-Robots-Tag headers to take effect. Authentication still protects
        // private data; robots.txt is not an access-control mechanism.
        disallow: ["/api$", "/api/"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}

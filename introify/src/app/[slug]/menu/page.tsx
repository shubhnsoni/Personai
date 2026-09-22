import { prisma } from "@/lib/prisma"
import { ensureTryFoodShowcase, isTryFoodShowcaseSlug } from "@/lib/demo-shops/ensure-try-food"
import ShopPage from "../shop/page"

export const dynamic = "force-dynamic"

export default async function MenuPage(props: {
    params: Promise<{ slug: string }>
    searchParams?: Promise<{ t?: string | string[] }>
}) {
    const { slug } = await props.params
    if (isTryFoodShowcaseSlug(slug)) {
        await ensureTryFoodShowcase(prisma, slug)
    }
    return ShopPage(props)
}

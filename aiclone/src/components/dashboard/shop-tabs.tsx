import Link from "next/link"
import { ExternalLink } from "lucide-react"
import { cn } from "@/lib/utils"

export function ShopTabs({
    slug,
    tab,
}: {
    slug: string
    tab: "shop" | "free"
}) {
    return (
        <div className="flex shrink-0 items-center gap-1">
            <div className="flex rounded-full bg-muted p-0.5">
                <Link
                    href="/dashboard/products"
                    className={cn(
                        "rounded-full px-2.5 py-1 text-xs font-medium",
                        tab === "shop" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                    )}
                >
                    Shop
                </Link>
                <Link
                    href="/dashboard/lead-magnets"
                    className={cn(
                        "rounded-full px-2.5 py-1 text-xs font-medium",
                        tab === "free" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                    )}
                >
                    Free
                </Link>
            </div>
            <Link
                href={tab === "free" ? `/${slug}` : `/${slug}/shop`}
                target="_blank"
                aria-label={tab === "free" ? "Open live page" : "Open live shop"}
                className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            >
                <ExternalLink className="h-3.5 w-3.5" />
            </Link>
        </div>
    )
}

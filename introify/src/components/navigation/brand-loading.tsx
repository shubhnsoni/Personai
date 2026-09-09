import { cn } from "@/lib/utils"

/** Quiet feedback for actual streamed loading states. */
export function BrandLoadingVisual({ compact = false }: { compact?: boolean }) {
    return (
        <div className={cn("brand-loading-visual", compact && "brand-loading-visual--compact")} aria-hidden="true">
            <span className="brand-loading-track"><span /></span>
        </div>
    )
}

export function BrandLoading({
    label = "Loading page",
    fullPage = false,
    compact = false,
}: {
    label?: string
    fullPage?: boolean
    compact?: boolean
}) {
    return (
        <div className={cn("brand-loading", fullPage && "brand-loading--page", compact && "brand-loading--compact")} role="status" aria-live="polite">
            <BrandLoadingVisual compact={compact} />
            <span className="brand-loading-label">{label}</span>
        </div>
    )
}

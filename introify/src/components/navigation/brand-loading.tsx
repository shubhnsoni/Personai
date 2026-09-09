import { IntroifyWordmark } from "@/components/brand/wordmark"
import { cn } from "@/lib/utils"

/** A small companion to the owner's wordmark, drawn from its dot and upright. */
export function BrandLoadingVisual({ compact = false }: { compact?: boolean }) {
    return (
        <div className={cn("brand-loading-visual", compact && "brand-loading-visual--compact")} aria-hidden="true">
            <div className="brand-loading-orbit">
                <span className="brand-loading-halo" />
                <span className="brand-loading-satellite" />
                <div className="brand-loading-orb">
                    <svg viewBox="0 0 64 64" fill="none" focusable="false">
                        <circle className="brand-loading-dot" cx="32" cy="19" r="5" />
                        <path d="M27.5 29h9v21h-9z" fill="currentColor" />
                    </svg>
                    <span className="brand-loading-shine" />
                </div>
            </div>
            <IntroifyWordmark decorative className="brand-loading-wordmark" />
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
